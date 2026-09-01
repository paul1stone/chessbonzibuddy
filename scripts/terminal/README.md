# Terminal image pipeline

Builds the Alpine Linux 9p image that the in-browser [v86](https://github.com/copy/v86)
VM boots for the "MS-DOS Prompt" easter egg. A real i686 kernel and a real BusyBox
userland, with no network device configured.

Adapted from v86's own recipe (`tools/docker/alpine/`), pinned at commit
**`180830d539dcc87db1a191febf6c914f516d102f`** (master, 2026-08-31). `vendor/fs2json.py`
and `vendor/copy-to-sha256.py` are copied verbatim from that commit.

## Artifacts

Everything under `public/terminal/` is generated and **committed** — CI and Vercel never
run Docker. `public/v86/v86.wasm` is *not* committed; `postinstall` copies it out of
`node_modules/v86` the same way it copies Stockfish.

| Path | Size | What |
|---|---|---|
| `public/terminal/fs.json` | 120 KB | 9p filesystem index (2033 entries) |
| `public/terminal/rootfs-flat/` | 39 MB | 1280 content-addressed `*.bin.zst` files, fetched lazily |
| `public/terminal/state.bin.zst` | 20 MB | saved VM state, restored on the first terminal open |
| `public/terminal/state.meta.json` | 168 B | the fs.json hash and v86 version the state was taken from |
| `public/terminal/seabios.bin` | 128 KB | BIOS — **required**, see below |
| `public/terminal/vgabios.bin` | 36 KB | VGA BIOS |
| `public/v86/v86.wasm` | 2.1 MB | gitignored, written by `postinstall` |
| `public/v86/libv86.mjs` | 350 KB | gitignored, written by `postinstall`; loaded at runtime by `create-vm.ts` (bypasses the bundler) |

Known nit: the committed image still carries a 0-byte `/.dockerenv`, because the strip step
was a silent no-op on macOS until it was fixed; it is harmless and goes away on the next rebuild.

The kernel and initramfs are **not** separate artifacts. They live at `/boot` inside the
9p filesystem and v86 pulls them out itself via `bzimage_initrd_from_filesystem: true`.

Because the flat files are content-addressed, every rebuild that changes any file adds a
new blob to git history. Rebuild only when `Dockerfile` or `rootfs-extra/` actually change.

## Rebuilding

Needs Docker (the `linux/386` build is emulated on Apple Silicon) and Python 3. On
Python ≥3.14 the stdlib `compression.zstd` is used; on older versions the script creates
`.venv/` and installs `zstandard` there.

```sh
bash scripts/terminal/build-image.sh
```

Roughly 3 minutes end to end on an M-series Mac, most of it zstd level-19 compression.
The script wipes `rootfs-flat/` and `fs.json` first so stale blobs can't linger, fetches
the BIOS files if they're missing, and prints the artifact sizes at the end.

## Boot configuration — copy this exactly

Measured **16–18 s** cold boot to the `C:\>` prompt (headless Chromium, M-series Mac).
Kernel messages scroll past for most of that; the spec treats this as charm, not a bug. The
saved state below skips it — measured **0.2–0.7 s** — on the first open of a page.

Every option here except `autostart` must stay identical in `src/lib/terminal/create-vm.ts`
and `scripts/terminal/save-state.mjs`: a state only restores into a machine built the same
way, and `memory_size` in particular is baked into the snapshot.

```js
new V86({
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
  cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0 tsc=reliable",
  autostart: true, // create-vm.ts uses false and calls run() itself, after the restore attempt
});
```

**`bios` is not optional.** Without it the machine never executes anything: no serial
output at all, just a silent hang. This was verified both ways — omitting `bios` produced
zero serial bytes in 150 s, adding it booted in 18 s. The npm package ships no BIOS
images, which is why they are committed here.

`vga_bios` *is* optional for a serial-only terminal (verified booting without it), but it
is kept to match upstream and to keep the option of attaching a `screen_container` later.

Wire the terminal to **serial0**, not the VGA screen: `console=ttyS0` in the cmdline sends
kernel output there, and `/etc/inittab` autologins root on `ttyS0`. Use
`serial_container_xtermjs` or the `serial0-output-byte` event plus `serial0_send()`.

## What's in the image

`Dockerfile` follows upstream, minus the `nodejs` package and the networking helper
script, plus the easter eggs. Two upstream details are load-bearing for size and must not
be changed casually: `ENV KERNEL=virt` (not `lts`) and `linux-firmware-none`. Swapping
either balloons the rootfs past 500 MB.

`rootfs-extra/` is copied over the image root:

- `etc/motd` — Bonzi ASCII art and the "BonziOS 1.0 (definitely MS-DOS)" banner
- `etc/profile.d/bonzi.sh` — sets `PS1` to `C:\>` and drops the user in `/home/bonzi`
- `usr/local/bin/bonzi` — prints a random quip, copied from `src/lib/bonzi/quips.ts`
- `home/bonzi/README.TXT`, `home/bonzi/chess_openings.txt` — lore

### The PS1 four-backslash thing

`etc/profile.d/bonzi.sh` contains `export PS1='C:\\\\> '` — four backslashes to render
one. BusyBox ash unescapes the prompt twice, so two backslashes render as none. Verified
in-container: four in the file → `C:\>` on screen. Don't "fix" this.

## Saved state

`state.bin.zst` is a snapshot of the booted machine, taken at the prompt. Restoring it opens
the terminal in a fraction of a second instead of ~17 s.

```sh
node scripts/terminal/save-state.mjs
```

The script serves `public/` on an ephemeral port, boots the image in headless Chromium with
the config above, waits for `C:\>`, settles 3 s, stops the machine, and writes the state
zstd-compressed at level 19 (72 MB raw → 20 MB). Anything over 60 MB is refused rather than
written, since it has to be committed and served; the fix would be dropping `memory_size` to
64 MB in **both** the script and `create-vm.ts`.

**Regenerate whenever the image or the v86 pin changes.** A state carries v86's own format
version, and it holds 9p handles into the content-addressed rootfs, so a rebuilt `fs.json`
leaves it pointing at blobs that moved. `state.meta.json` records the fs.json hash and the
v86 version; `create-vm.ts` re-hashes the live `fs.json` before restoring and cold boots on a
mismatch, so a stale state degrades to today's boot rather than to a broken guest.

### Why not `initial_state`

The constructor's `initial_state` option restores inside v86's async init, where a bad state
can only be reported by a console message — there is nothing to catch. `create-vm.ts`
constructs with `autostart: false` instead, restores on `emulator-ready`, and calls `run()`
either way, so every failure (missing file, stale hash, bad magic, version mismatch) leaves
the same instance cold booting. `restore_state` accepts the raw `.zst` bytes directly: it
sniffs the zstd magic number and inflates them itself.

A restored guest prints nothing unprompted — it already printed its prompt before the
snapshot — so `create-vm.ts` sends a bare newline to make it echo, and the window falls back
to a cold boot if nothing comes back within 5 s.

### Tearing a machine down

`destroy()` terminates the worker that drives v86's main loop but leaves the machine flagged
idle, and a 9p blob fetch still in flight will land afterwards, raise an interrupt, and try to
wake it — throwing `Cannot read properties of null (reading 'postMessage')` from v86's own
callback, where nothing can catch it. `create-vm.ts` clears the idle flag after destroying,
which is exactly what v86's wake-up guards on (`idle && next_tick()`). Reproduced by closing
the window mid-boot with rootfs responses delayed 400 ms: 4 crashes in 5 teardowns before,
none after. It has nothing to do with saved state — any cold boot torn down mid-fetch hits it.

### One restore per page

A second restore in the same document comes up broken: the kernel is alive and echoes serial
input, but userspace is never scheduled again, so the shell never reprints its prompt. It
reproduces against a bare v86 in a scratch page with no React, no teardown between instances,
and regardless of when the guest is poked — the only variable is whether an earlier restored
machine in that document ever ran. Root cause unknown; it is inside v86's restore, not here.

`create-vm.ts` therefore restores at most once per page load and cold boots on later opens,
which is exactly what they did before saved state existed. Reopening the terminal in one
session is the only path that pays the ~17 s boot.
