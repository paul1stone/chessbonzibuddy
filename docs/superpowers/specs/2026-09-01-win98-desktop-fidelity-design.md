# Win98 Desktop Fidelity Design

Approved in chat 2026-09-01. Round 2 of the retro overhaul: make `/app` mirror a Windows 98 desktop 1:1, plus site-wide "alive" animations and two optimizations.

## Context

`/app` today: window manager (`src/stores/window-store.ts`, `src/components/desktop/`), six windows, icons in a fixed left column with per-icon local selection (click select, blur deselect, double-click open), no right-click anywhere, no marquee, no multi-select. Mobile hides icons and maximizes a single window. The landing page owns stepped-outline machinery (`src/components/landing/cascade/cascade-timeline.ts`) and an idle watcher (`src/components/landing/easter/idle.ts`).

## 1. Desktop selection model

- A new desktop store coordinates selection: click selects one icon, ctrl/cmd+click toggles, clicking empty desktop clears, marquee selects everything it sweeps.
- **Marquee**: pointer-drag on empty desktop draws a 1px dotted rectangle with a faint translucent blue fill (period note: pure Win98 was dotted-only; the blue fill is the remembered look and was requested). Icons highlight live while the rect intersects them.
- Selected icons render the classic treatment: label on `--r-title-a` blue, icon tinted via the blue selection overlay.
- Double-click/Enter still opens. Desktop-only (mobile hides icons already).

## 2. Draggable icons

- Icons have store-backed positions; default layout equals today's left column. Drag repositions anywhere on the desktop; positions persist in `localStorage` (guarded accessor).
- "Line up Icons" (context menu) snaps all icons back to the default grid.
- A drag is not a click: small movement threshold before drag starts, and a completed drag neither selects nor opens.

## 3. Context menus (functional entries only — no greyed filler)

One reusable retro menu primitive (bevel-out panel, blue hover, viewport-clamped, closes on outside click/Escape, stepped slide-in under motion). Targets:

- **Desktop background**: Arrange Icons, Line up Icons, Refresh (brief repaint gag: selection clears and icons flicker once), Properties → Display Properties.
- **Desktop icon**: Open, Properties → small per-app dialog (icon, name, "BonziWare application", fictional size/install date).
- **Taskbar** (bar itself) : Cascade Windows, Tile Windows, Minimize All Windows, Properties → Display Properties. **Taskbar window buttons**: Restore/Minimize (state-appropriate), Close.
- **Window title bar** (system menu): Minimize, Maximize/Restore, Close.

Cascade/Tile/Minimize All are real `window-store` actions over the open windows (sizes stay fixed; Tile arranges positions in a grid).

## 4. Display Properties

- A real window (new `display` window id): listed in the taskbar, **no desktop icon**, opened only via the context menus.
- Contents: desktop color swatches from the Win98 palette (teal default) plus 2–3 original tiled pixel patterns, a small preview, Apply / OK / Cancel (Apply keeps the window open; Cancel reverts unapplied changes).
- Appearance persists in `localStorage` and is applied to the desktop surface on `/app`.

## 5. "Alive" animations

- **(a) Zoom traces** on `/app` window transitions — the Win98 stepped outline: open (desktop icon → window), minimize (window → its taskbar button), restore (button → window), maximize/restore-down (window ↔ viewport). Reuses the stepped-outline math, generalized into a shared lib.
- **(b) Start-menu slide-up**: ~120ms stepped, both taskbars (shared `retro/taskbar.tsx`).
- **(c) Bonzi peek**: after long idle on `/app`, Bonzi peeks from a screen edge (`peek.gif`), waves, and hides; any input dismisses; hard-throttled (once per ~3 min at most). Reuses the idle watcher.
- **(d) `/app` boot cascade**: once per session — taskbar slides up, icons pop in staggered (~700ms total), any input fast-forwards. Mirrors the landing boot pattern (no pre-paint gate needed if the animation is additive: icons animate FROM hidden only when the boot runs).
- **(e) Hourglass cursors**: `cursor: wait`/`progress` on the terminal window while booting and on the desktop while analysis is running.
- **(f) Icon open-flash**: on double-click the icon label inverts for a couple of frames before its window opens.

All animation-only behaviors are absent under `prefers-reduced-motion`; functional UI (menus, marquee, selection) still works there.

## 6. Optimizations

- **Terminal instant boot**: a build-time script boots the committed image headless, captures a v86 saved state at the `C:\>` prompt, compresses it, and commits it under `public/terminal/`. `create-vm` restores the state for a ~1s open, with automatic fall back to the existing cold boot (fetch failure, restore failure, or stale state). The state must be regenerated whenever the image or the pinned v86 version changes (documented + scripted).
- **Window-drag snappiness**: dragging a window currently writes the store per pointermove, re-rendering every open window (including recharts) per frame. Dragging moves the frame via direct transform on the element and commits the position to the store once on release (and on nudge-key steps).

## Constraints

- Mobile: every new pointer interaction (marquee, icon drag, context menus, traces) is desktop-only; mobile behavior is unchanged.
- No audio.
- Right-click must suppress the browser's native context menu only where a retro menu exists.
- Keyboard access: menus operable with arrows/Enter/Escape; system menu reachable via the existing title-bar focus.
- New CSS lives in the retro styles with existing tokens; no border-radius; stepped easings.

## Out of scope

- Greyed period-filler menu entries (explicitly declined).
- Marquee/right-click on the marketing homepage.
- A landing performance pass (declined).
- Wallpaper images beyond generated pixel patterns; sounds; Active Desktop.
