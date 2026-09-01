// v86's ESM build keeps node-only require("fs")/require("crypto") branches that no
// browser bundler can resolve, so it is served from public/ (postinstall, like
// Stockfish) and pulled in at runtime instead of being bundled.
const loadV86 = (url: string) =>
  import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<typeof import("v86")>;

// A module that fails to load stays failed in the module map, so a retry needs a fresh URL.
const moduleUrl = (attempt: number) =>
  attempt > 0 ? `/v86/libv86.mjs?r=${attempt}` : "/v86/libv86.mjs";

const READY_TIMEOUT_MS = 5000;

// Nothing re-arms the caller's boot-silence watchdog while the snapshot downloads — autostart
// is off, so not a single serial byte flows until run(). A slow link has to fall through to a
// cold boot well inside that budget, and a stale state must not bill the user 20 MB first.
const STATE_DEADLINE_MS = 8000;

// Past this the caller has long since given up (its own silence watchdog is 60 s), so settle
// rather than pinning the snapshot and the emulator inside a promise that never returns.
const READY_DEADLINE_MS = 60_000;

const STATE_URL = "/terminal/state.bin.zst";
const STATE_META_URL = "/terminal/state.meta.json";
const FS_JSON_URL = "/terminal/fs.json";

export interface TerminalVM {
  /**
   * Resolves true once the committed snapshot has been restored and the machine started,
   * false when it cold booted instead or when the emulator never became ready at all.
   * Never rejects.
   */
  restored: Promise<boolean>;
  send(data: string): void;
  onOutput(cb: (chunk: Uint8Array) => void): () => void;
  destroy(): Promise<void>;
}

export interface CreateVMOptions {
  /** Abort before the emulator is constructed, for a caller that unmounted meanwhile. */
  signal?: AbortSignal;
  /** Retry counter, used to cache-bust the module URL. */
  attempt?: number;
  /** Cold boot even when a snapshot is available, for a restored session that went silent. */
  skipRestore?: boolean;
}

// A snapshot resumes cleanly only once per document. Restore a second time and the guest comes
// up with its kernel alive — it echoes serial input — but userspace is never scheduled again, so
// the shell never reprints its prompt. Reproduced against a bare v86 with no React and no
// teardown involved, and independent of when the guest is poked, so it is a v86 restore limit
// rather than something this module can hold differently. Later opens cold boot instead, which
// is what they did before saved state existed; the 5 s echo belt covers the first one.
let restoreSpent = false;

const sha256Hex = async (bytes: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/**
 * The snapshot the guest resumes from still holds 9p handles into the content-addressed
 * rootfs, so an image rebuilt underneath it would resume against blobs that moved. The
 * meta records the fs.json the state was taken from; anything else cold boots.
 * Returns the raw .zst bytes — restore_state sniffs the zstd magic and inflates them itself.
 */
async function loadSavedState(signal?: AbortSignal): Promise<ArrayBuffer | null> {
  // crypto.subtle is secure-context only, and an unverifiable state is not worth restoring.
  if (!globalThis.crypto?.subtle) return null;
  // Cancel the download on the deadline rather than racing it: 20 MB left in flight behind a
  // machine that has already moved on is bandwidth the cold boot needs for its own blobs.
  const deadline = AbortSignal.timeout(STATE_DEADLINE_MS);
  const fetchSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const get = (url: string) =>
    fetch(url, { signal: fetchSignal }).then((res) => (res.ok ? res : null));
  const [metaRes, stateRes, fsRes] = await Promise.all([
    get(STATE_META_URL),
    get(STATE_URL),
    get(FS_JSON_URL),
  ]);
  if (!metaRes || !stateRes || !fsRes) return null;
  const [meta, state, fsJson] = await Promise.all([
    metaRes.json() as Promise<{ fsJsonSha256?: string }>,
    stateRes.arrayBuffer(),
    fsRes.arrayBuffer(),
  ]);
  return meta.fsJsonSha256 === (await sha256Hex(fsJson)) ? state : null;
}

/**
 * Boots the committed Alpine 9p image in a v86 VM wired to serial0, resuming from
 * public/terminal/state.bin.zst when one matches the image (see scripts/terminal/save-state.mjs).
 * Options are copied from scripts/terminal/README.md — `bios` is NOT optional: without it the
 * machine hangs silently and emits no serial output at all. They must also stay identical to
 * save-state.mjs, since a state only restores into the machine it was taken from.
 */
export async function createVM({
  signal,
  attempt = 0,
  skipRestore = false,
}: CreateVMOptions = {}): Promise<TerminalVM> {
  const { V86 } = await loadV86(moduleUrl(attempt));
  // Nothing is allocated until the constructor runs, so a doomed mount stops here
  // instead of booting a second 128 MB machine alongside the one that survives.
  signal?.throwIfAborted();

  // Started before construction so the download overlaps v86's own asset loading.
  const savedState = skipRestore || restoreSpent ? Promise.resolve(null) : loadSavedState(signal);

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
    // The machine waits for the snapshot to get its one chance, then runs either way.
    // The constructor's own initial_state option restores inside async init where a bad
    // state can only be reported by a console message, so it is deliberately not used.
    autostart: false,
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
  let destroyed = false;

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

  // One machine, one path: restore if there is something valid to restore, then run. Every
  // failure (missing file, stale image, bad magic, version mismatch) leaves a cold boot.
  const restored = (async () => {
    const state = await savedState.catch((err) => {
      if (!signal?.aborted) console.warn("Terminal snapshot unavailable, cold booting:", err);
      return null;
    });
    const started = await Promise.race([
      ready.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), READY_DEADLINE_MS)),
    ]);
    // A machine that never announced itself is not going to run; let the snapshot go.
    if (!started) return false;
    let ok = false;
    if (state && !destroyed && !signal?.aborted) {
      try {
        await emulator.restore_state(state);
        ok = true;
      } catch (err) {
        console.warn("Terminal snapshot rejected, cold booting:", err);
      }
    }
    // A fetch that lost its race with teardown must not start a machine nobody holds.
    if (destroyed || signal?.aborted) return ok;
    await emulator.run();
    if (ok) {
      // Spent only once a restored machine actually started, so an aborted StrictMode
      // double-mount does not cost the surviving one its restore.
      restoreSpent = true;
      // The restored guest is parked at a prompt it printed before the snapshot, so it says
      // nothing until poked — and an unpoked session looks identical to a dead one.
      emulator.serial0_send("\n");
    }
    return ok;
  })().catch((err) => {
    if (!destroyed && !signal?.aborted) console.error("Terminal VM failed to start:", err);
    return false;
  });

  return {
    restored,

    send: (data) => emulator.serial0_send(data),

    onOutput(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async destroy() {
      destroyed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      pending = [];
      listeners.clear();
      // A boot that never reaches "emulator-ready" (missing asset) must not strand
      // the teardown; past the timeout v86 throws and the caller swallows it.
      await Promise.race([ready, new Promise((r) => setTimeout(r, READY_TIMEOUT_MS))]);
      try {
        await emulator.destroy();
      } finally {
        // v86's teardown terminates the worker that drives its main loop but leaves the
        // machine flagged idle, so a 9p reply still in flight raises an interrupt that tries
        // to wake it and throws on the dead worker. The wake-up is guarded by that very flag
        // (`idle && next_tick()`), so clearing it turns the late arrival into a no-op.
        const machine = (emulator as unknown as { v86?: { idle?: boolean } }).v86;
        if (machine) machine.idle = false;
      }
    },
  };
}
