// v86's ESM build keeps node-only require("fs")/require("crypto") branches that no
// browser bundler can resolve, so it is served from public/ (postinstall, like
// Stockfish) and pulled in at runtime instead of being bundled.
const loadV86 = (url: string) =>
  import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<typeof import("v86")>;

// A module that fails to load stays failed in the module map, so a retry needs a fresh URL.
const moduleUrl = (attempt: number) =>
  attempt > 0 ? `/v86/libv86.mjs?r=${attempt}` : "/v86/libv86.mjs";

const READY_TIMEOUT_MS = 5000;

export interface TerminalVM {
  send(data: string): void;
  onOutput(cb: (chunk: Uint8Array) => void): () => void;
  destroy(): Promise<void>;
}

export interface CreateVMOptions {
  /** Abort before the emulator is constructed, for a caller that unmounted meanwhile. */
  signal?: AbortSignal;
  /** Retry counter, used to cache-bust the module URL. */
  attempt?: number;
}

/**
 * Boots the committed Alpine 9p image in a v86 VM wired to serial0.
 * Options are copied from scripts/terminal/README.md — `bios` is NOT optional:
 * without it the machine hangs silently and emits no serial output at all.
 */
export async function createVM({ signal, attempt = 0 }: CreateVMOptions = {}): Promise<TerminalVM> {
  const { V86 } = await loadV86(moduleUrl(attempt));
  // Nothing is allocated until the constructor runs, so a doomed mount stops here
  // instead of booting a second 128 MB machine alongside the one that survives.
  signal?.throwIfAborted();

  const emulator = new V86({
    wasm_path: "/v86/v86.wasm",
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    bios: { url: "/terminal/seabios.bin" },
    vga_bios: { url: "/terminal/vgabios.bin" },
    filesystem: {
      baseurl: "/terminal/rootfs-flat/",
      basefs: "/terminal/fs.json",
    },
    bzimage_initrd_from_filesystem: true,
    cmdline:
      "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0 tsc=reliable",
    autostart: true,
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
  });

  // v86's destroy() dereferences internals that only exist once "emulator-ready"
  // has fired, so a VM torn down mid-boot has to wait for it first.
  let markReady = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  emulator.add_listener("emulator-ready", () => markReady());

  const listeners = new Set<(chunk: Uint8Array) => void>();
  let pending: number[] = [];
  let frame = 0;

  const flush = () => {
    frame = 0;
    if (pending.length === 0) return;
    const chunk = Uint8Array.from(pending);
    pending = [];
    for (const cb of listeners) cb(chunk);
  };

  // The kernel emits serial bytes one event at a time; batching per frame turns
  // tens of thousands of xterm writes during boot into one per paint.
  emulator.add_listener("serial0-output-byte", (byte) => {
    pending.push(byte);
    if (frame === 0) frame = requestAnimationFrame(flush);
  });

  return {
    send: (data) => emulator.serial0_send(data),

    onOutput(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async destroy() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      pending = [];
      listeners.clear();
      // A boot that never reaches "emulator-ready" (missing asset) must not strand
      // the teardown; past the timeout v86 throws and the caller swallows it.
      await Promise.race([ready, new Promise((r) => setTimeout(r, READY_TIMEOUT_MS))]);
      await emulator.destroy();
    },
  };
}
