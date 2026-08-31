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
| `public/terminal/seabios.bin` | 128 KB | BIOS — **required**, see below |
| `public/terminal/vgabios.bin` | 36 KB | VGA BIOS |
| `public/v86/v86.wasm` | 2.1 MB | gitignored, written by `postinstall` |

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
Kernel messages scroll past for most of that; the spec treats this as charm, not a bug.

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
  autostart: true,
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

## Follow-up: state snapshot

A saved-state snapshot (v86's `initial_state`) would make the terminal open instantly
instead of booting for ~17 s. Upstream's `tools/docker/alpine/build-state.js` generates
one. Out of scope for v1 — the visible boot is part of the joke — but it is the obvious
next step if the wait ever becomes a problem.
