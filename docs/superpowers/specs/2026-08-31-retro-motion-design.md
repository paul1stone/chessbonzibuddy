# Retro Motion & Terminal Design

Approved in chat 2026-08-31. Five features that extend the landing page's Win98 metaphor with more scroll choreography, ambient charm, and one large easter egg.

## Context

The landing page already has: a 300vh scroll-scrubbed 3D Scholar's Mate hero (`src/components/landing/hero/`), a time-based Bonzi quip showcase, three draggable demo windows in a static cascade, and a live taskbar with a working Start menu (`src/components/retro/taskbar.tsx`). GSAP is dynamically imported; reduced-motion and mobile are handled via `matchMedia` gates throughout. All new work follows those rails.

## 1. Minimize-to-taskbar scroll choreography

- The hero window's existing scroll-shrink retargets to land on the taskbar: when the window fades out (~35% of hero scroll), a **"Chess Bonzi Buddy" taskbar button pops in** at the spot the window flew to. Scrolling back up reverses it.
- Every major section docks a taskbar button when scrolled past: `Chess Bonzi Buddy` (hero), `BonziBUDDY.exe` (showcase), `Import`, `Review`, `Practice` (walkthrough windows). Scrolling back above a section un-docks it.
- The button for the section currently on screen renders depressed (Win98 focused-window style, same treatment as `app-taskbar.tsx`).
- Clicking a button smooth-scrolls to its section (instant under reduced motion).
- Reduced motion: all buttons always present, no choreography.
- State lives in a small zustand dock store; buttons render as `Taskbar` children via a new marketing taskbar client component.

## 2. Pinned walkthrough cascade

- "Then find out what went wrong." pins for ~250vh on `lg+` screens with motion allowed. A scrubbed timeline opens Import → Review → Practice in sequence.
- Each window opens with the **Win98 zoom-open effect**: a stepped outline rectangle (fixed-position bordered div, ~8 discrete frames, `steps()` timing) expanding from the taskbar dock area to the window's bounds, then the window snaps visible.
- Demos need no contract change: the pinned section is on screen, so their IntersectionObserver activation fires normally; windows are merely `visibility:hidden` until revealed.
- Below `lg`, under reduced motion, or if GSAP fails to load: today's static layout, unchanged.

## 3. Bonzi scroll companion

- A fixed Bonzi sprite rides the right page margin (only ≥1280px viewports, motion allowed). Vertical position tracks smoothed scroll progress (GSAP `quickTo`).
- States: `idle` at rest; `backflip` when scroll velocity spikes (debounced); section reactions driven by the dock store's active section (wave at showcase, point at import, shocked at review, talk at practice), each with a one-shot speech-bubble quip per pageview.
- `aria-hidden`, `pointer-events: none`, z-index below the taskbar. Absent on mobile and under reduced motion.

## 4. Easter-egg bundle

- **Screensaver**: 45s with no input on the landing page → full-screen black canvas with bouncing solid-color chess glyphs; any input dismisses; disarmed while the tab is hidden; never under reduced motion.
- **Shut Down…**: new Start-menu item → screen dims in steps, then orange-on-black "It is now safe to turn off your computer." Any click/key "reboots": clears the boot flag, reloads the page so the boot cascade replays. (No scroll-past-footer trigger — menu only.)
- **Eval-bar scroll progress**: a slim vertical eval bar fixed to the left edge maps page scroll progress to a fake eval that climbs from +0.2 to M4 (Bonzi plays White in the hero's Scholar's Mate). Desktop only, `aria-hidden`.
- **Boot cascade**: first visit per session (`sessionStorage` flag), landing page only (not `/privacy`/`/terms`), ≤900ms: taskbar slides up, hero window opens with a stepped scale zoom. A pre-paint inline script adds a `boot-pending` class so nothing flashes. Skipped under reduced motion; any input (including scroll) fast-forwards.

## 5. Linux terminal in the Start menu

- **Engine: v86** (BSD-2, npm package `v86`) booting a custom i686 Alpine image over a 9p filesystem — a real kernel and real BusyBox userland, so every standard command works. No network device is configured (fully sandboxed).
- **Assets** built by a documented Docker script (`scripts/terminal/`, based on v86's upstream `tools/docker/alpine` recipe: `virt` kernel + `linux-firmware-none`, keeping the committed image ~25–40MB), committed under `public/terminal/` (fs.json + content-addressed flat files; the kernel and initramfs are read from the filesystem's `/boot` via `bzimage_initrd_from_filesystem`). `postinstall` copies `v86.wasm` to a gitignored `public/v86/`, mirroring the existing Stockfish copy step.
- **Image easter eggs**: `/etc/motd` Bonzi ASCII art, `PS1='C:\> '` (a DOS-looking prompt that runs Linux — the joke), autologin `ash` on the serial console, `/home/bonzi/` lore files, a `bonzi` command that prints random quips.
- **UI**: xterm.js (`@xterm/xterm` + fit addon) in a RetroWindow titled "MS-DOS Prompt". Wired serial0 ⇄ xterm. Kernel boot messages scroll visibly (that's charm, not a bug). Failure → retro fatal-exception message with a retry button.
- **Entry points**: a new `terminal` window id on the `/app` desktop (icon + Start menu + taskbar), and an "MS-DOS Prompt" Start-menu item on the marketing page opening a centered draggable overlay window.
- Everything v86/xterm lazy-loads on first open; visitors who never open it fetch nothing.
- v1 boots cold (~15–30s with visible kernel output). A saved-state snapshot for instant open is a documented follow-up, not in scope.

## Out of scope / rejected

- CRT scanline overlays, interrupting Clippy-style popups, BSOD flashes (rejected in brainstorm).
- Scroll-past-footer shutdown trigger (flaky; Start-menu only).
- v86 state snapshot (follow-up).
- Network access inside the VM.
