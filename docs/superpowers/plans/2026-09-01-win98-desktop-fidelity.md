# Win98 Desktop Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/app` mirror a Windows 98 desktop 1:1 (marquee selection, draggable icons, four context-menu targets, Display Properties) plus zoom-trace window animations, boot cascade, Bonzi peek, hourglass cursors, a drag-perf fix, and instant terminal boot via a v86 saved state.

**Architecture:** A new zustand desktop store (selection, icon positions, appearance) beside the existing window store; one reusable retro context-menu primitive; the landing cascade's stepped-outline math extracted into a shared lib and driven by a rAF runner for window zoom traces; the terminal restores a committed compressed v86 state with cold boot as fallback.

**Tech Stack:** Next.js 16 App Router, React 19, zustand 5, retro.css tokens, v86 0.5.451 (pinned), Playwright, vitest (node env — DOM-injectable modules only).

**Spec:** `docs/superpowers/specs/2026-09-01-win98-desktop-fidelity-design.md`

## Global Constraints

- Everything from the previous plan's Global Constraints carries over verbatim (reduced-motion policy, gsap-loader rule — though this round needs NO gsap: use rAF + CSS steps, node-env vitest, commit-message style, single-line comments, per-task gates typecheck/lint/vitest, e2e port guard via `E2E_PORT`, dev server at `http://localhost:4110`, retro tokens/no-radius/stepped easings, `safeSessionStorage` for sessionStorage, localStorage access ONLY through a guarded accessor).
- Mobile (`useIsMobile()`, max-width 767px): every new pointer interaction is skipped; mobile rendering byte-identical to today.
- New CSS classes are ALL defined in Task 2 (`src/styles/retro-app.css`); later tasks only consume them. No other task edits CSS files.
- Right-click: call `preventDefault()` only where a retro menu opens; browser menu stays available elsewhere (e.g., inside window bodies, the xterm).
- The `/app` desktop is rendered inside `.retro` — fixed-position overlays (menus, traces, marquee) must be appended/rendered within it so tokens resolve (lesson from round 1).
- StrictMode-safe effects; no `git add -A`; stage listed files only; index.lock retry.

---

## Parallelization map

| Wave | Tasks | Rationale |
|---|---|---|
| 1 | T1 (stores + Display Properties), T2 (outline lib + retro menu + CSS), T3 (terminal snapshot), T4 (drag perf) | Disjoint: T1 = stores/icons/display-window/page defs + 1-line desktop.tsx icon-list swap; T2 = lib/retro/css + cascade-timeline import swap; T3 = scripts/terminal + create-vm + inner; T4 = desktop-window.tsx only |
| 2 | T5 (desktop surface: marquee/selection/icon drag/menus), T6 (window+taskbar chrome: system menu, traces, taskbar menus, start-menu slide), T7 (app boot + Bonzi peek + hourglass) | T5: desktop.tsx/desktop-icon.tsx/new files; T6: desktop-window.tsx/app-taskbar.tsx/retro/taskbar.tsx; T7: (app)/layout.tsx/new components/(app)/app/page.tsx/terminal-window-inner.tsx — disjoint sets |
| 3 | T8 (e2e + full verification + `npm run build`) | Needs everything |

---

### Task 1: Desktop store, window-store extensions, Display Properties

**Files:**
- Create: `src/stores/desktop-store.ts` + Test: `src/stores/desktop-store.test.ts`
- Modify: `src/stores/window-store.ts` + `src/stores/window-store.test.ts`
- Modify: `src/components/desktop/icons.tsx` (DisplayIcon + label/icon entries)
- Create: `src/components/windows/display-properties-window.tsx`
- Modify: `src/app/(app)/app/page.tsx` (defs entry)
- Modify: `src/components/desktop/desktop.tsx` (ONE line: icon loop iterates `DESKTOP_ICON_IDS` instead of `WINDOW_IDS` — nothing else; T5 owns the rest of this file next wave)

**Interfaces (later tasks compile against these):**
```ts
// desktop-store.ts
export interface IconPos { x: number; y: number }
export const GRID = { x: 8, y: 8, stepY: 76 }; // default column geometry, matches today's layout
export const DESKTOP_ICON_IDS: WindowId[]; // the six original ids — excludes "display"
export const WIN98_COLORS: { name: string; value: string }[]; // teal #008080 first, then 5-6 Win98 palette colors
export type DesktopPattern = "none" | "checks" | "weave";
interface DesktopStore {
  selected: Set<WindowId>;
  positions: Partial<Record<WindowId, IconPos>>; // absent = default grid slot
  appearance: { color: string; pattern: DesktopPattern };
  select: (id: WindowId, opts?: { toggle?: boolean }) => void; // toggle = ctrl/cmd-click semantics
  setSelection: (ids: WindowId[]) => void; // marquee result, replaces
  clearSelection: () => void;
  moveIcon: (id: WindowId, pos: IconPos) => void;
  lineUpIcons: () => void; // clears positions back to grid
  setAppearance: (a: { color: string; pattern: DesktopPattern }) => void;
  reset: () => void;
}
export const useDesktopStore: …;
export function defaultIconPos(index: number): IconPos; // grid slot for the i-th icon
export function safeLocalStorage(): Storage | null; // same try/catch shape as safeSessionStorage
// persistence: positions + appearance load once at store creation (guarded), save on change
// (subscribe in the store module, debounced ~250ms); selection is never persisted.
```
```ts
// window-store.ts additions
export type WindowId = … | "display";
// WINDOW_IDS gains "display" (order: last); WINDOW_SIZES.display = { w: 404, h: 420 };
cascadeAll: () => void;   // repositions all open windows in the classic 24px stair, focuses top
tileAll: () => void;      // arranges open windows in a viewport grid (positions only, sizes fixed)
minimizeAll: () => void;
```
- `display-properties-window.tsx`: default export `<DisplayPropertiesWindow />`; local draft state; swatch grid + pattern picker + a small preview div; OK = apply+close, Apply = apply, Cancel = close without applying (uses `useWindowStore.getState().close("display")`).
- `icons.tsx`: `ICON_LABELS.display = "Display"`, `WINDOW_ICONS.display` = monitor pixel icon (16×16 rect grid, matches neighbors).
- The desktop surface reads `appearance` and renders `backgroundColor: color` plus a `backgroundImage` for the two patterns (tiny inline data-URI or repeating-gradient — patterns are generated, no assets). Wiring the desktop div itself happens in T5; THIS task only ships the store + window, so build the preview in the window with the same helper: export `desktopBackgroundStyle(appearance): CSSProperties` from desktop-store.ts.

**Steps (condensed TDD):**
- [ ] 1. Failing tests: desktop-store (selection semantics incl. toggle, marquee replace, clear; moveIcon/lineUp; appearance set; persistence via injected fake storage — export a `createDesktopStore(storage: Storage | null)` factory used by the singleton so tests never touch window; defaultIconPos math), window-store (`"display"` present, sizes, cascadeAll/tileAll/minimizeAll reposition/focus semantics with 2–3 windows open, `WINDOW_IDS.length === Object.keys(WINDOW_SIZES).length`).
- [ ] 2. Implement both stores; run green.
- [ ] 3. DisplayIcon + entries; DisplayPropertiesWindow; defs entry in page.tsx; the one-line `DESKTOP_ICON_IDS` swap in desktop.tsx (icon column renders exactly the six original icons).
- [ ] 4. Manual: open via `useWindowStore.getState().open("display")` in the console at :4110/app — window renders, Apply changes the PREVIEW (desktop surface wiring lands in T5), taskbar button appears, no desktop icon.
- [ ] 5. Gates; commit `add desktop store and display window`.

---

### Task 2: Outline-trace lib, retro menu primitive, all new CSS

**Files:**
- Create: `src/lib/outline-trace.ts` + Test: `src/lib/outline-trace.test.ts`
- Modify: `src/components/landing/cascade/cascade-timeline.ts` (import `outlineRect`/`Rect` from the lib, re-export for its existing consumers/tests — behavior identical, its tests stay green)
- Create: `src/components/retro/retro-menu.tsx`
- Modify: `src/styles/retro-app.css` (ALL new classes)

**Interfaces:**
```ts
// outline-trace.ts — pure math + a DOM runner
export interface Rect { x: number; y: number; w: number; h: number }
export const OUTLINE_STEPS = 8;
export function outlineRect(from: Rect, to: Rect, t: number): Rect; // moved from cascade-timeline verbatim (same snapping)
export function runZoomTrace(opts: {
  from: Rect; to: Rect; parent: HTMLElement; durationMs?: number; // default 180
  className?: string; // default "zoom-trace"
  onDone?: () => void;
}): () => void; // returns cancel; rAF-driven, appends one div, steps through OUTLINE_STEPS, removes itself
// NO-OP under prefers-reduced-motion (checks prefersReducedMotion() itself and calls onDone immediately).
```
```ts
// retro-menu.tsx
export interface MenuItem { label: string; onSelect?: () => void; separator?: boolean; disabled?: boolean }
export function RetroMenu(props: {
  items: MenuItem[]; x: number; y: number; onClose: () => void;
}): JSX.Element;
// bevel-out .r-menu panel, fixed at (x,y) clamped to viewport (measure after mount, flip up/left near edges),
// role="menu"/"menuitem", arrow-key navigation + Enter + Escape, closes on outside pointerdown and on scroll,
// stepped slide-in via .r-menu--in (skipped under reduced motion), item hover/focus = blue bar.
// Rendered by the caller INSIDE .retro (no portal to body — tokens are scoped).
export function useContextMenu(): { menu: { x: number; y: number; key: string } | null; openAt: (e: React.MouseEvent, key: string) => void; close: () => void };
// helper: preventDefault + stopPropagation, records position + which target key was hit
```
- CSS added (all consumed later): `.r-menu` (face bg, bevel-out, min-width 160px, padding 2px), `.r-menu-item` (+ `[data-disabled]`), `.r-menu-sep`, `.r-menu--in` (steps(3) 90ms translateY), `.zoom-trace` (fixed, 2px solid `--r-dark`, dotted `--r-highlight` outline, z 60, pointer-events none), `.marquee` (fixed, 1px dotted `--r-highlight`, background rgba(0,0,128,0.18), z 5, pointer-events none), `.icon-flash` (steps(2) 120ms invert keyframes on the label), `.cursor-wait-all * { cursor: wait !important }` helper, icon blue-tint selection class `.icon-selected` (label bg `--r-title-a`; icon span gets a blue overlay via CSS mask-free technique: `filter: sepia(1) hue-rotate(190deg) saturate(3) brightness(0.9)` is NOT period — instead overlay a semi-transparent `--r-title-a` rectangle over the icon span via `.icon-selected .icon-art::after`; keep simple + reversible).

**Steps:**
- [ ] 1. Failing tests for `outlineRect` move (copy the cascade tests' semantics: snapping, exact endpoints) + `runZoomTrace` step math via an injectable `now`/raf? Keep the runner untested in node (DOM) — test only the pure parts; the runner gets a manual check in T6.
- [ ] 2. Implement lib; swap cascade-timeline to import + re-export (`export { outlineRect, OUTLINE_STEPS, type Rect } from "@/lib/outline-trace"`); `npm test -- cascade-timeline` must stay green untouched.
- [ ] 3. RetroMenu + useContextMenu + CSS; manual check with a scratch usage (not committed).
- [ ] 4. Gates; commit `add outline lib and retro menu`.

---

### Task 3: Terminal instant boot (saved state)

**Files:**
- Create: `scripts/terminal/save-state.mjs`
- Modify: `scripts/terminal/build-image.sh` (final echo reminds to re-run save-state), `scripts/terminal/README.md`
- Create (generated, committed): `public/terminal/state.bin.gz` (name may differ per findings below — record in README)
- Modify: `src/lib/terminal/create-vm.ts`, `src/components/windows/terminal-window-inner.tsx`

**Decision tree the implementer must verify against `node_modules/v86/build/libv86.d.ts` + Readme (record findings in scripts/terminal/README.md):**
1. Preferred: construct with the EXISTING config plus `initial_state: { url: "/terminal/state.bin.zst" }` if the pinned build auto-decompresses zstd state URLs (upstream demos do this — verify in libv86 source, search "zst").
2. Else: fetch `/terminal/state.bin.gz` in create-vm, decompress via `DecompressionStream("gzip")`, pass buffer: `initial_state: { buffer }` if the option accepts buffers, else construct normally with `autostart: false` and call `emulator.restore_state(buffer)` on `emulator-ready`, then `emulator.run()`.
3. Cold boot stays the fallback on ANY failure (fetch non-200, decompress throw, restore throw): log once, proceed with the current path unchanged.

**save-state.mjs:** serve `public/` on a local port (node http), launch Playwright chromium headless, a data:/temp HTML page loading `/v86/libv86.mjs` with the EXACT create-vm config (minus initial_state), wait for `C:\>` in accumulated serial output (10 min timeout — emulated boot under CI load), let the guest settle 3s, `await emulator.save_state()` → ArrayBuffer → gzip (node zlib, level 9) → write artifact; print raw + compressed sizes. HARD GATE: if the compressed artifact exceeds 60 MB, do NOT commit — report to team-lead instead (memory_size may need lowering to 64 MB for BOTH the snapshot and create-vm — they must match — and that change needs a fresh smoke boot).

**terminal-window-inner.tsx:** while restoring show `Resuming MS-DOS…` instead of the boot line; on restored boot the prompt-detection/watchdog logic still applies (the restored guest prints nothing until a key — send a bare `\n` after restore so the prompt echoes and the watchdog clears). Cold-boot fallback keeps today's copy.

**Steps:**
- [ ] 1. Verify the decision tree against the pinned v86; record findings.
- [ ] 2. Write + run save-state.mjs; verify artifact size gate; commit artifact.
- [ ] 3. Wire create-vm restore path + fallback; inner copy changes.
- [ ] 4. Manual at :4110/app: open MS-DOS Prompt — measure time to `C:\>` (target ≤ 3s), run `ls /home/bonzi` + `bonzi`; kill the state file locally (rename) → cold boot still works end-to-end; restore file.
- [ ] 5. README: new artifact row, regen instructions, "regenerate when image OR v86 pin changes" warning. Gates; commit `restore terminal from state`.

---

### Task 4: Window drag performance

**Files:**
- Modify: `src/components/desktop/desktop-window.tsx`

Today `clampedMove` writes the store per pointermove → every open window re-renders per frame. Change: during a title-bar drag, accumulate delta in a ref and write `transform: translate(x+dx, y+dy)` directly on the section element (rAF-batched); on `onEnd` (useDrag already supports it) commit ONCE via `move(id, finalX, finalY)` with the existing clamping, and clear the inline override so the store value takes over seamlessly. Keyboard nudges keep writing the store directly (they're discrete). Maximized/mobile unchanged.

**Steps:**
- [ ] 1. Implement; make sure the element's styled transform during drag and the store-driven transform after commit are the same value (no jump on release), including the clamp (clamp during drag too so the visual never exceeds bounds the commit would snap back from).
- [ ] 2. Manual at :4110/app with Review open on a long analysis chart: drag — no content re-render jank (React DevTools highlight or console.count in ReviewWindow), no jump on release, clamps hold at edges.
- [ ] 3. Gates; commit `commit window drag on release`.

---

### Task 5: Desktop surface — selection, marquee, icon drag, desktop/icon menus

**Files:**
- Modify: `src/components/desktop/desktop.tsx`, `src/components/desktop/desktop-icon.tsx`
- Create: `src/components/desktop/desktop-marquee.tsx`, `src/components/desktop/desktop-menus.tsx`

**Consumes:** desktop-store (T1), RetroMenu/useContextMenu + CSS classes (T2), `desktopBackgroundStyle` (T1).

**Behavior contracts:**
- Icons: absolutely positioned from `positions[id] ?? defaultIconPos(i)`; `data-desktop-icon={id}` on the root (T6/T7 read rects from this). Click → `select(id, { toggle: e.ctrlKey || e.metaKey })`; selected via store (`.icon-selected`); double-click → `.icon-flash` for 120ms then `open(id)` (immediately under reduced motion); drag = pointerdown + 4px threshold, moves via inline transform, commits `moveIcon` on release, suppresses the click/select that follows (a moved icon stays where dropped, selection unchanged).
- Marquee: pointerdown on the bare desktop div (not an icon/window/taskbar) starts it (button 0 only, desktop only); renders `.marquee` div INSIDE the desktop container; on move, `setSelection` of every icon whose rect intersects; pointerup removes it; a sub-4px drag = plain click = `clearSelection()`.
- Desktop right-click (`onContextMenu` on the desktop div): RetroMenu with Arrange Icons (`lineUpIcons` — alias), Line up Icons (`lineUpIcons`), Refresh (clearSelection + a 150ms `.icon-flash` on all icons — the gag), separator, Properties (`open("display")`).
- Icon right-click: select it first (Win98 does), then menu: Open (`open(id)`), separator, Properties → a small `RetroDialog`-style popup rendered by desktop-menus.tsx (icon at 32px, label, "Type: BonziWare application", "Size: 4.09 MB", "Installed: 4/23/1999") with an OK button.
- Desktop background div: apply `desktopBackgroundStyle(appearance)` (this makes T1's Display Properties actually change the desktop).
- All of it `!isMobile` only.

**Steps:**
- [ ] 1. Rework desktop-icon.tsx: controlled selection from the store (drop local state/blur), absolute positioning, drag, flash, data attr. Keep keyboard behavior (Enter opens; add focus → select).
- [ ] 2. Marquee component + desktop wiring + background style + context menus.
- [ ] 3. Manual matrix at :4110/app (Playwright script): marquee sweep selects 3 icons live; ctrl+click adds/removes; empty click clears; drag icon → persists across reload; Line up snaps back; Refresh flickers; right-click menus all open clamped in-viewport and close on Escape/outside; double-click flashes then opens; icon drag does not open or re-select; native context menu still available inside an open window body. Reduced motion: no flash/slide, everything functional. 375px: unchanged (no icons).
- [ ] 4. Gates; commit `add marquee selection and icon drag`.

---

### Task 6: Window & taskbar chrome — system menu, zoom traces, taskbar menus, start-menu slide

**Files:**
- Modify: `src/components/desktop/desktop-window.tsx`, `src/components/desktop/app-taskbar.tsx`, `src/components/retro/taskbar.tsx`

**Consumes:** RetroMenu/useContextMenu, `runZoomTrace` (T2), window-store actions (T1), `[data-desktop-icon]` attr (T5).

**Behavior contracts:**
- `data-taskbar-button={id}` on each app-taskbar window button.
- Zoom traces (desktop only, reduced-motion no-op is inside runZoomTrace): in DesktopWindow, watch transitions with prev-refs — on open-mount: trace from the icon rect (`[data-desktop-icon="${id}"]`, fallback: taskbar rect) to the window rect; minimized false→true: window → its `[data-taskbar-button]` rect; true→false: reverse; maximize toggle: window ↔ viewport rect. Parent for the trace div: the desktop container (`section.closest(".retro")` fallback). Traces are fire-and-forget (~180ms) and never delay the actual state change (the window appears/disappears immediately, matching Win98 — the trace is decoration ON TOP).
- Title-bar right-click → system menu: Minimize, Maximize/Restore (label per state, hidden on mobile), separator, Close.
- Taskbar-button right-click → Restore/Minimize (per state), Close. Taskbar-bar right-click (not on a button/start/clock) → Cascade Windows, Tile Windows, Minimize All Windows, separator, Properties (`open("display")`). App taskbar only — the marketing taskbar gets none of this.
- Start-menu slide: in retro/taskbar.tsx, the menu nav gets `.r-menu--in`-style stepped slide-up on open (reuse the class or a dedicated `.start-menu--in`; both taskbars inherit; skipped under reduced motion).
- system/taskbar menus render inside `.retro`.

**Steps:**
- [ ] 1. Traces + prev-ref transition detection (StrictMode-safe: refs seeded on first commit, no trace on initial mount EXCEPT the open-trace which is exactly the initial mount — seed a module-level "app just booted" guard? No: open-trace on mount is wanted every time a window opens; suppress only for windows already open on hydration — there are none, windows open post-mount. Verify the deep-link `?view=play-bonzi` path: window opens in the first effect; icon rect exists; acceptable to trace or skip via a `performance.now() < bootMs` guard — implementer's call, note it).
- [ ] 2. Menus (system + taskbar) + data attrs.
- [ ] 3. Start-menu slide in retro/taskbar.tsx (marketing regression check: landing start menu still opens/closes with Escape — the existing e2e covers it).
- [ ] 4. Manual matrix: open from icon → trace runs icon→window; minimize → trace into the exact button; restore ← back; maximize trace; all three context menus; cascade/tile/minimize-all reposition correctly with 3 windows open; reduced motion: no traces/slide, menus fine; mobile: nothing new.
- [ ] 5. Gates; commit `add zoom traces and system menus`.

---

### Task 7: App boot cascade, Bonzi peek, hourglass cursors

**Files:**
- Create: `src/components/desktop/app-boot.tsx`, `src/components/desktop/bonzi-peek.tsx`
- Modify: `src/app/(app)/layout.tsx` (mount both), `src/app/(app)/app/page.tsx` (analysis cursor), `src/components/windows/terminal-window-inner.tsx` (boot cursor)

**Consumes:** `createIdleWatcher` (existing easter lib), `safeSessionStorage` + flag helpers (existing), `[data-taskbar]`, `[data-desktop-icon]` attrs.

**Behavior contracts:**
- App boot: session flag `cbb-app-booted` (reuse boot-flag helpers with a second key — generalize `shouldBoot(storage, key)`? boot-flag helpers are single-key; add optional key param defaulting to BOOT_FLAG, existing callers untouched). Runs only with motion + desktop + flag unset: rAF/CSS-driven (no gsap): add a class to `[data-taskbar]` (translateY slide, steps(4), 200ms) and stagger `.boot-pop` on each `[data-desktop-icon]` (60ms apart, steps(3) scale/opacity pop). Elements are VISIBLE by default — the component adds hidden state only when it actually runs (no pre-paint gate needed; a one-frame flash is acceptable here per spec §5d "additive"). Any pointerdown/keydown/wheel/scroll fast-forwards (remove classes). Total ≤ 700ms.
- Bonzi peek: desktop + motion only; idle watcher 180s; on idle, render a fixed img (`/bonzi/peek.gif`, ~100px) rising from the bottom-right corner just above the taskbar (translateY steps in, holds 2.5s, steps out), then re-arm with a 180s floor; ANY watched input dismisses instantly; `aria-hidden`, pointer-events none, z 45 (under taskbar 50); never while `document.visibilityState === "hidden"`.
- Hourglass: terminal-window-inner root gets `cursor: wait` style while `phase === "booting"` (or restoring); analysis: in (app)/app/page.tsx an effect toggles `document.body.classList` `cursor-progress` (define in T2's CSS: `body.cursor-progress, body.cursor-progress * { cursor: progress !important }`) while `isAnalyzing` — cleared on unmount.
- (app)/layout.tsx: read it first; mount `<AppBoot />` + `<BonziPeek />` inside the retro wrapper.

**Steps:**
- [ ] 1. Generalize boot-flag key param (+ test line); app-boot + CSS-class choreography; fast-forward; session-once.
- [ ] 2. Bonzi peek with idle watcher (inject nothing — component code, not unit-tested; keep logic thin).
- [ ] 3. Hourglass wiring both places.
- [ ] 4. Manual: fresh session → taskbar slides, icons pop staggered once; reload → nothing; input mid-boot fast-forwards; idle 5s (temporarily lower, restore 180s before commit — verify the committed value) → Bonzi peeks and any input dismisses; terminal shows wait cursor while booting, normal at prompt; analysis run shows progress cursor. Reduced motion: no boot/peek. Mobile: no boot/peek.
- [ ] 5. Gates; commit `add app boot and bonzi peek`.

---

### Task 8: E2E + full verification

**Files:**
- Modify: `e2e/desktop.spec.ts` (+ `e2e/landing.spec.ts` only if a regression fix needs it)

**Steps:**
- [ ] 1. New tests (desktop-only viewport 1280×720 default): marquee drag on empty desktop selects two icons (assert `.icon-selected` count); ctrl+click toggles; right-click desktop shows the menu and Escape closes it; Properties opens the Display window and Apply changes the desktop background color (assert computed style); icon drag persists across reload (localStorage); taskbar right-click → Minimize All minimizes open windows; title-bar right-click → Close closes; MS-DOS Prompt reaches `C:\>` in ≤ 8s (instant-boot path; keep a generous ceiling for CI noise — cold boot was 15-30s so this still proves the state restored).
- [ ] 2. Existing desktop tests must stay green (icon single/double click semantics changed subtly — update ONLY if behavior legitimately changed, never weaken).
- [ ] 3. Full gates + full e2e (worktree trick if the repo's `.next` is dev-locked) + `npm run build` LAST + a prod-server spot check of marquee + traces + instant boot.
- [ ] 4. Commit `cover desktop fidelity e2e`.

---

## Self-review notes

- Spec §1→T1/T5, §2→T1/T5, §3→T2/T5/T6, §4→T1(+T5 background apply), §5a→T2/T6, §5b→T6, §5c→T7, §5d→T7, §5e→T7, §5f→T5, §6 snapshot→T3, §6 drag→T4. No gaps.
- Cross-task names: `DESKTOP_ICON_IDS`, `defaultIconPos`, `desktopBackgroundStyle`, `safeLocalStorage`, `useDesktopStore` API, `cascadeAll/tileAll/minimizeAll`, `RetroMenu`/`MenuItem`/`useContextMenu`, `outlineRect`/`runZoomTrace`/`Rect`, `data-desktop-icon`/`data-taskbar-button`, CSS class names — defined once (T1/T2), consumed later; checked consistent.
- Known risks: v86 state-restore API surface (T3 decision tree + hard size gate), open-trace on deep-link mount (T6 step 1 note), marquee vs window pointerdown interplay (T5 targets the bare desktop div only), StrictMode double-run of app-boot (session flag is set on first run; second pass sees it — verify).
