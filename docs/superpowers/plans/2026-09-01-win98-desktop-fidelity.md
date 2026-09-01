# Win98 Desktop Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Revision 2 — incorporates the 2026-09-01 three-lens plan review (correctness, regression, simplicity).

**Goal:** Make `/app` mirror a Windows 98 desktop 1:1 (marquee selection, draggable icons, four context-menu targets, Display Properties) plus zoom-trace window animations, boot cascade, Bonzi peek, hourglass cursors, a drag-perf fix, and instant terminal boot via a v86 saved state.

**Architecture:** A new zustand desktop store (selection, icon positions, appearance) beside the existing window store; one reusable retro context-menu primitive; the landing cascade's stepped-outline math extracted into a shared lib and driven by a rAF runner for window zoom traces; the terminal restores a committed zstd v86 state on the same instance that cold-boots on any failure.

**Tech Stack:** Next.js 16 App Router, React 19, zustand 5, retro.css tokens, v86 0.5.451 (pinned), node zlib zstd (node 24), Playwright, vitest (node env — DOM-injectable modules only).

**Spec:** `docs/superpowers/specs/2026-09-01-win98-desktop-fidelity-design.md`

## Global Constraints

- Everything from the previous plan's Global Constraints carries over verbatim (reduced-motion policy, node-env vitest, commit-message style, single-line comments, per-task gates typecheck/lint/vitest, e2e via `E2E_PORT`, dev server at `http://localhost:4110`, retro tokens/no-radius/stepped easings, `safeSessionStorage`, localStorage ONLY through a guarded accessor). This round needs NO gsap: rAF + CSS steps only.
- Mobile (`useIsMobile()`, max-width 767px): every new pointer interaction is skipped; mobile rendering byte-identical to today.
- New CSS classes are ALL defined in Task 2 (`src/styles/retro-app.css`) — the complete inventory is enumerated there; later tasks only consume. No other task edits CSS files.
- Right-click: `preventDefault()` only where a retro menu opens; the desktop's own `onContextMenu` must guard `e.target === e.currentTarget` so right-clicks inside window bodies keep the native menu.
- Fixed-position overlays (menus, traces, marquee) render/append inside `.retro` so tokens resolve.
- Persistence NEVER loads at store/module creation — defaults first, rehydrate in a client effect (SSR hydration must match; the repo patterns are use-is-mobile's useSyncExternalStore and the Clock's suppressHydrationWarning).
- StrictMode-safe effects; no `git add -A`; stage listed files only; index.lock retry.
- Zustand collections are replaced immutably (new `Set`/objects per update) — reference equality drives re-renders.

---

## Parallelization map

| Wave | Tasks | Rationale |
|---|---|---|
| 1 | T1 (stores + Display Properties), T2 (outline lib + retro menu + ALL CSS), T3 (terminal snapshot), T4 (drag perf) | Disjoint: T1 = stores/icons.tsx/display-window/page defs + 1-line desktop.tsx swap; T2 = lib/retro-menu/css + cascade-timeline import swap; T3 = scripts/terminal + create-vm + inner; T4 = desktop-window.tsx only |
| 2 | T5 (desktop surface), T6 (window+taskbar chrome), T7 (app boot + peek + hourglass + idle capture fix) | Disjoint: T5 = desktop.tsx/desktop-icon.tsx/new files; T6 = desktop-window.tsx/app-taskbar.tsx/retro/taskbar.tsx; T7 = (app)/layout.tsx/new comps/(app)/app/page.tsx/terminal-window-inner.tsx/easter/idle.ts. T6/T7 icon-rect-dependent manual checks re-run in T8 if T5 lands after them. |
| 3 | T8 (e2e + full verification + `npm run build`) | Needs everything |

---

### Task 1: Desktop store, window-store extensions, Display Properties

**Files:**
- Create: `src/stores/desktop-store.ts` + Test: `src/stores/desktop-store.test.ts`
- Modify: `src/stores/window-store.ts` + `src/stores/window-store.test.ts`
- Modify: `src/components/desktop/icons.tsx` (DisplayIcon + label/icon entries)
- Create: `src/components/windows/display-properties-window.tsx`
- Modify: `src/app/(app)/app/page.tsx` (defs entry)
- Modify: `src/components/desktop/desktop.tsx` (ONE line: icon loop iterates `DESKTOP_ICON_IDS` — nothing else; T5 owns the rest next wave)

**Interfaces (later tasks compile against these):**
```ts
// desktop-store.ts
export interface IconPos { x: number; y: number }
export const GRID = { x: 8, y: 8, stepY: 76 }; // uniform column; APPROXIMATES today's flex layout (which
// had variable per-icon heights) — implementer eyeballs the pitch, no pixel-equality claim
export const DESKTOP_ICON_IDS: WindowId[]; // the SEVEN current ids (games, import, review, practice, play, profile, terminal) — excludes "display"
export const WIN98_COLORS: { name: string; value: string }[]; // teal #008080 first, then 5-6 Win98 palette colors
export type DesktopPattern = "none" | "checks" | "weave";
interface DesktopStore {
  selected: ReadonlySet<WindowId>;
  positions: Partial<Record<WindowId, IconPos>>; // absent = default grid slot
  appearance: { color: string; pattern: DesktopPattern };
  hydrated: boolean; // false until rehydrate() ran (SSR/first client render use defaults)
  select: (id: WindowId, opts?: { toggle?: boolean }) => void;
  setSelection: (ids: WindowId[]) => void;
  clearSelection: () => void;
  moveIcon: (id: WindowId, pos: IconPos) => void;
  lineUpIcons: () => void;
  setAppearance: (a: { color: string; pattern: DesktopPattern }) => void;
  rehydrate: () => void; // loads positions+appearance from safeLocalStorage; called from a client effect, NEVER at module scope
  reset: () => void;
}
export const useDesktopStore: …;
export function defaultIconPos(index: number): IconPos;
export function desktopBackgroundStyle(a: { color: string; pattern: DesktopPattern }): CSSProperties;
export function safeLocalStorage(): Storage | null;
// RULES: every selection update creates a NEW Set (tested via reference inequality).
// Persistence: positions + appearance saved SYNCHRONOUSLY on each mutating action (no debounce —
// each is a discrete user action); last-writer-wins across tabs (one-line comment).
// Build as createDesktopStore(storage: Storage | null) factory + singleton export, so node-env
// tests inject a fake storage and never touch window.
```
```ts
// window-store.ts additions
export type WindowId = … | "display";
// WINDOW_IDS gains "display" (last); WINDOW_SIZES.display = { w: 404, h: 420 };
cascadeAll: () => void;   // 24px stair over open windows, focuses top
tileAll: (viewport?: { w: number; h: number }) => void; // grid of positions, sizes fixed; viewport
// injectable (defaults to window dims via a guarded helper) so node-env tests pass one explicitly
minimizeAll: () => void;
```
- `display-properties-window.tsx`: default export; local draft state; swatches + pattern picker + preview using `desktopBackgroundStyle`; OK = apply+close, Apply = apply, Cancel = close.
- `icons.tsx`: `ICON_LABELS.display = "Display"`, `WINDOW_ICONS.display` = monitor pixel icon (16×16 rect grid).

**Steps (condensed TDD):**
- [ ] 1. Failing tests: selection semantics (single, toggle, marquee replace, clear, NEW-Set reference inequality on every update), moveIcon/lineUp, appearance, rehydrate-from-fake-storage (positions+appearance restored, `hydrated` flips; empty storage = defaults), synchronous persistence writes observed on the fake storage, defaultIconPos math; window-store: "display" present, sizes, cascadeAll/tileAll (explicit viewport)/minimizeAll semantics with 2-3 open windows, length invariant already present stays green.
- [ ] 2. Implement; green.
- [ ] 3. DisplayIcon + entries; DisplayPropertiesWindow; defs entry; the one-line `DESKTOP_ICON_IDS` swap (icon column renders exactly the SEVEN current icons, unchanged visually).
- [ ] 4. Manual at :4110/app: `useWindowStore.getState().open("display")` from console — window renders, Apply changes the preview, taskbar button appears, no desktop icon, no hydration warnings in console.
- [ ] 5. Gates; commit `add desktop store and display window`.

---

### Task 2: Outline-trace lib, retro menu primitive, the COMPLETE CSS inventory

**Files:**
- Create: `src/lib/outline-trace.ts` + Test: `src/lib/outline-trace.test.ts`
- Modify: `src/components/landing/cascade/cascade-timeline.ts` (import `outlineRect`/`Rect`/`OUTLINE_STEPS` from the lib and re-export them — its tests and use-cascade-scroll stay byte-untouched)
- Create: `src/components/retro/retro-menu.tsx`
- Modify: `src/styles/retro-app.css`

**Interfaces:**
```ts
// outline-trace.ts
export interface Rect { x: number; y: number; w: number; h: number }
export const OUTLINE_STEPS = 8;
export function outlineRect(from: Rect, to: Rect, t: number): Rect; // moved verbatim from cascade-timeline
export function runZoomTrace(opts: {
  from: Rect; to: Rect; parent: HTMLElement; durationMs?: number; // default 180
  className?: string; // default "zoom-trace"
  onDone?: () => void;
}): () => void; // cancel fn; rAF-driven; NO-OP (immediate onDone) under prefersReducedMotion()
```
```ts
// retro-menu.tsx
export interface MenuItem { label: string; onSelect?: () => void; separator?: boolean; disabled?: boolean }
export function RetroMenu(props: { items: MenuItem[]; x: number; y: number; onClose: () => void }): JSX.Element;
// .r-menu panel, fixed, viewport-clamped (flip near edges), role=menu/menuitem, arrow keys + Enter,
// Escape closes AND calls e.stopPropagation() (the desktop window's own Escape handler would
// otherwise minimize the window as the menu closes), closes on outside pointerdown + scroll,
// .r-menu--in stepped slide (skipped under reduced motion). Rendered by callers INSIDE .retro.
export function useContextMenu(): {
  menu: { x: number; y: number; key: string } | null;
  openAt: (e: React.MouseEvent, key: string) => void; // preventDefault + stopPropagation; when
  // clientX/Y are 0 (keyboard-synthesized contextmenu: Shift+F10/menu key) falls back to
  // e.currentTarget.getBoundingClientRect() bottom-left
  close: () => void;
};
```

**COMPLETE CSS inventory (every class any later task consumes — nothing else may add CSS):**
- `.r-menu` (face bg, bevel-out, min-width 160px, padding 2px), `.r-menu-item` + `[data-disabled]`, `.r-menu-sep`, `.r-menu--in` (steps(3), 90ms, translateY 6px→0)
- `.start-menu--in` (steps(4), 120ms, translateY 12px→0) — consumed by T6 for the Start menu
- `.zoom-trace` (fixed, 2px solid `--r-dark`, 1px dotted `--r-highlight` outline, z-index 60, pointer-events none)
- `.marquee` (fixed, 1px dotted `--r-highlight`, background rgba(0,0,128,0.18), z-index 5, pointer-events none)
- `.icon-flash` (steps(2), 120ms, label invert keyframes) — the SAME 120ms is used by T5's double-click flash and Refresh gag
- `.icon-art { position: relative }` and `.icon-selected .icon-art::after { position:absolute; inset:0; … }` — selection tint as a 2px checkerboard dither of `--r-title-a` (repeating-conic-gradient, the period-accurate Win98 treatment; a `color-mix` translucent fill is the fallback if the dither reads badly at 32px). `.icon-selected` also sets the label bg `--r-title-a` / white text. T5 puts class `icon-art` on the icon span.
- `.taskbar-boot` (steps(4), 200ms, translateY 100%→0) — T7 applies to `[data-taskbar]`
- `.boot-pop` (steps(3), ~180ms, scale 0.6→1 + opacity 0→1) — T7 staggers on `[data-desktop-icon]`
- `.bonzi-peek--in` / `.bonzi-peek--out` (stepped translateY rise/drop for the peek sprite)
- `body.cursor-progress, body.cursor-progress * { cursor: progress !important }` and `.cursor-wait-all, .cursor-wait-all * { cursor: wait !important }`

**Steps:**
- [ ] 1. Failing tests for outlineRect (same semantics as the cascade tests: snapping, exact endpoints); the DOM runner is NOT unit-tested (node env) — manual in T6.
- [ ] 2. Implement lib; swap cascade-timeline to import + re-export; `npm test -- cascade-timeline` stays green with zero edits to that test file.
- [ ] 3. RetroMenu + useContextMenu + the full CSS inventory.
- [ ] 4. Gates; commit `add outline lib and retro menu`.

---

### Task 3: Terminal instant boot (saved state) — SINGLE-PATH design

Review-verified v86 facts (v86 0.5.451; types at `node_modules/v86/v86.d.ts`, source `build/libv86.mjs`): `restore_state(ArrayBuffer)` detects zstd by MAGIC NUMBER and inflates internally — raw `.zst` bytes are accepted directly, no client decompression; it throws synchronously catchable errors on bad magic AND on version mismatch (free staleness guard). The constructor `initial_state` path restores inside async init with NO catchable surface — do NOT use it. Node 24 has `zlib.zstdCompressSync` — the script emits real `.zst`.

**Files:**
- Create: `scripts/terminal/save-state.mjs`
- Modify: `scripts/terminal/build-image.sh` (final echo reminds to re-run save-state), `scripts/terminal/README.md`
- Create (generated, committed): `public/terminal/state.bin.zst` + `public/terminal/state.meta.json` (`{ fsJsonSha256, v86Version, createdAt }`)
- Modify: `src/lib/terminal/create-vm.ts`, `src/components/windows/terminal-window-inner.tsx`

**The one runtime path (create-vm.ts):**
1. Construct the emulator with the EXISTING config but `autostart: false`. In parallel, fetch `/terminal/state.meta.json` + `/terminal/state.bin.zst`.
2. Before restoring: compare `meta.fsJsonSha256` against a hash of the live `/terminal/fs.json` (fetch it — it is 120KB and already needed by v86; hash via `crypto.subtle.digest`). Mismatch → skip restore entirely (stale image).
3. On `emulator-ready`: `try { await emulator.restore_state(zstBytes); restored = true } catch { /* log once */ }` then `emulator.run()` either way — success resumes at the prompt; any failure (fetch non-200, magic, version mismatch, skipped-stale) runs the SAME instance as a cold boot. No second VM, no reconstruction.
4. Abort correctness: the existing `signal?.throwIfAborted()` before construction stays; state-fetch rejection caused by teardown must NOT be treated as "fall back and boot" — check `signal?.aborted` before `run()`.
5. After a successful restore, send a bare `"\n"` so the prompt echoes (the restored guest prints nothing unprompted — without this the 60s silence watchdog in terminal-window-inner would fatal a healthy session). Belt: the 5s no-echo check lives in terminal-window-inner (it already owns retry plumbing): on a restored session with no `C:\>` within 5s, tear down and recreate via the existing attempt path, passing a new `skipRestore?: boolean` createVM option that bypasses the state path entirely.
6. `TerminalVM` gains `restored: boolean` (or a `mode: "restored" | "cold"` resolved value) so the inner shows `Resuming MS-DOS…` vs the existing boot copy.

**save-state.mjs:** serve `public/` (node http, ephemeral port); Playwright chromium headless; page loads `/v86/libv86.mjs` with the exact create-vm config (autostart true, no state); wait for `C:\>` in serial (10 min ceiling); settle 3s; `save_state()` → ArrayBuffer → `zlib.zstdCompressSync` → write `state.bin.zst` + meta (hash the fs.json it served). Print raw + compressed sizes. HARD GATE: compressed > 60 MB → do NOT commit; report to team-lead (contingency: lower memory_size to 64 MB in BOTH the script and create-vm — they must match — and re-run the full smoke matrix; keep 128 MB unless the gate trips).

**Steps:**
- [ ] 1. save-state.mjs; run; verify gate; commit artifacts.
- [ ] 2. create-vm single path + meta guard + abort handling + restored flag; inner copy + `Resuming MS-DOS…`.
- [ ] 3. Manual at :4110/app: open MS-DOS Prompt — measure time to prompt (target ≤ 3s); `ls /home/bonzi` + `bonzi` work on the restored session; rename state.bin.zst locally → cold boot end-to-end unchanged → restore file; corrupt the meta hash → cold boot (stale path); StrictMode double-mount boots exactly one VM.
- [ ] 4. README: artifact rows, regen instructions, "regenerate when the image OR the v86 pin changes", the single-path rationale. Gates; commit `restore terminal from state`.

---

### Task 4: Window drag performance

**Files:** `src/components/desktop/desktop-window.tsx` only.

During a title-bar drag: accumulate delta in a ref, write `transform` directly on the section element rAF-batched (clamped with the SAME bounds as the commit so the visual never exceeds what release would snap to); on `onEnd` cancel any pending rAF FIRST (a queued write landing after commit would re-apply the drag transform), then commit ONCE via `move(id, x, y)` and clear the inline override (values identical → no jump). Keyboard nudges keep writing the store. Maximized/mobile unchanged.

**Steps:**
- [ ] 1. Implement.
- [ ] 2. Manual at :4110/app with Review open on a long chart: drag = no per-frame re-render (React DevTools highlight or console.count in ReviewWindow), no jump on release, clamps hold, maximize-during-drag edge left sane (rAF cancelled).
- [ ] 3. Gates; commit `commit window drag on release`.

---

### Task 5: Desktop surface — selection, marquee, icon drag, desktop/icon menus

**Files:**
- Modify: `src/components/desktop/desktop.tsx`, `src/components/desktop/desktop-icon.tsx`
- Create: `src/components/desktop/desktop-marquee.tsx`, `src/components/desktop/desktop-menus.tsx`

**Consumes:** desktop-store (T1), RetroMenu/useContextMenu + CSS inventory (T2), `desktopBackgroundStyle` (T1).

**Behavior contracts:**
- Icons stay `<button>`s (e2e queries `getByRole("button", { name: … })`), absolutely positioned from `positions[id] ?? defaultIconPos(i)`, `data-desktop-icon={id}` on the root, class `icon-art` on the icon span AND `icon-label` on the label span; the state classes (`.icon-selected`, `.icon-flash`) go on the icon ROOT — the CSS selectors are descendant-based and silently no-op otherwise.
- Selection: click → `select(id, { toggle: e.ctrlKey || e.metaKey })`; selected renders `.icon-selected`. KEYBOARD focus only (`:focus-visible` or modality tracking) also selects — pointer-down focus must NOT trigger the focus-select (a drag would otherwise change selection at press).
- Double-click: `.icon-flash` 120ms then `open(id)` (immediate under reduced motion). Drag: 4px threshold; inline transform while dragging; commit `moveIcon` on release; a completed drag suppresses the following click-select AND the dblclick-open (browser dblclick tolerance can exceed 4px — the movedRef guards both).
- Marquee: pointerdown (button 0, `e.target === e.currentTarget`) on the desktop div starts it; `.marquee` div rendered inside the desktop container; live `setSelection` by rect intersection with icon rects; sub-4px release = plain click = `clearSelection()`. Mount the desktop's `rehydrate()` effect here too (store hydration, T1 contract).
- Desktop `onContextMenu`: guard `e.target === e.currentTarget` (right-clicks inside windows keep the native menu); menu: Arrange Icons (`lineUpIcons`), Line up Icons (`lineUpIcons`), Refresh (clearSelection + `.icon-flash` on all icons, 120ms), separator, Properties (`open("display")`).
- Icon `onContextMenu`: select it first, then Open / separator / Properties (small dialog: 32px icon, label, "Type: BonziWare application", "Size: 4.09 MB", "Installed: 4/23/1999", OK).
- Desktop background div gets `desktopBackgroundStyle(appearance)` (only after `hydrated` — pre-hydration renders the default so SSR matches; this is what makes Display Properties real).
- Everything `!isMobile`.

**Steps:**
- [ ] 1. Rework desktop-icon.tsx (controlled selection, positioning, drag, flash, data attr, keyboard-only focus-select). 2. Marquee + desktop wiring + background + menus + rehydrate effect.
- [ ] 3. Manual matrix (Playwright at :4110/app): marquee sweeps select live; ctrl+click toggles; empty click clears; icon drag persists across reload WITH ZERO console errors (hydration); a 5px sloppy double-click does not both move and open; Line up snaps; Refresh flickers; both menus open clamped, Escape closes menu WITHOUT minimizing anything; native menu inside window bodies intact; double-click flash→open; reduced motion functional without flash/slide; 375px unchanged.
- [ ] 4. Gates; commit `add marquee selection and icon drag`.

---

### Task 6: Window & taskbar chrome — system menu, zoom traces, taskbar menus, start-menu slide

**Files:** `src/components/desktop/desktop-window.tsx`, `src/components/desktop/app-taskbar.tsx`, `src/components/retro/taskbar.tsx`

**Consumes:** RetroMenu/useContextMenu, `runZoomTrace` (T2), window-store actions (T1), `[data-desktop-icon]` (T5 — if not yet merged, use the taskbar-rect fallback during development and re-verify icon-origin traces in T8).

**Behavior contracts:**
- `data-taskbar-button={id}` on each app-taskbar window button.
- Zoom traces (desktop only; reduced-motion no-op lives inside runZoomTrace): maintain a `lastVisibleRect` ref updated via layout effect on every commit WHILE the window is visible — the post-commit DOM is useless for minimize (already display:none → 0×0 rect) and maximize (already resized). Transitions via prev-refs: open-mount → trace `[data-desktop-icon="${id}"]` rect (fallback: taskbar button rect; deep-link `?view=play-bonzi` may trace from the fallback — acceptable, note it) → window rect; minimized false→true → lastVisibleRect → `[data-taskbar-button]` rect; true→false → reverse; maximize toggle → lastVisibleRect ↔ viewport. Trace parent: the desktop container (fallback `closest(".retro")`). Traces are decoration ON TOP — state changes stay instant.
- Title-bar `onContextMenu` → system menu: Minimize, Maximize/Restore (hidden on mobile), separator, Close. MOUNT CONTRACT (review-verified): every RetroMenu renders at the DESKTOP-CONTAINER level (lift menu state or portal within `.retro`), NEVER inside the window `<section>` or taskbar subtree — both are their own stacking contexts (absolute+z / fixed+z-50) that trap the menu's z-1000 below sibling windows. Window z is renormalized ≤8 in the store, so desktop-level menus and traces always paint above.
- Taskbar-button `onContextMenu` → Restore/Minimize (per state), Close. Taskbar BAR: add an optional `onBarContextMenu?: (e: React.MouseEvent) => void` prop to `Taskbar` (retro/taskbar.tsx root div; default undefined so the marketing taskbar is untouched); AppTaskbar passes a handler (guard: not on a button/start/menu) → Cascade Windows, Tile Windows, Minimize All Windows, separator, Properties (`open("display")`).
- Start-menu slide: apply `.start-menu--in` (T2, 120ms) to the menu nav on open in retro/taskbar.tsx — both taskbars inherit; Escape/focus behavior untouched (landing e2e guards it).

**Steps:**
- [ ] 1. lastVisibleRect + transition detection + traces (StrictMode-safe; no spurious trace on hydration).
- [ ] 2. System + taskbar menus + data attrs + Taskbar prop.
- [ ] 3. Start-menu slide; run landing e2e start-menu test if port free, else note.
- [ ] 4. Manual matrix: icon→window trace on open; minimize traces into the exact button; restore back; maximize trace; menus correct per state; cascade/tile/minimize-all with 3 windows; Escape in system menu closes menu only (window NOT minimized); reduced motion = no traces/slide; mobile unchanged.
- [ ] 5. Gates; commit `add zoom traces and system menus`.

---

### Task 7: App boot cascade, Bonzi peek, hourglass cursors, idle-capture fix

**Files:**
- Create: `src/components/desktop/app-boot.tsx`, `src/components/desktop/bonzi-peek.tsx`
- Modify: `src/app/(app)/layout.tsx` (mount both inside the retro wrapper), `src/app/(app)/app/page.tsx` (analysis cursor), `src/components/windows/terminal-window-inner.tsx` (boot cursor), `src/components/landing/easter/idle.ts` (+ its test), `src/components/landing/easter/boot-flag.ts` (+ its test)

**Behavior contracts:**
- boot-flag: add optional key param (`shouldBoot(storage, key = BOOT_FLAG)` etc.) — existing callers untouched; new key `cbb-app-booted`.
- App boot (desktop + motion + flag unset): apply `.taskbar-boot` to `[data-taskbar]` and stagger `.boot-pop` on `[data-desktop-icon]` nodes (60ms apart), total ≤ 700ms; elements visible by default (truth note: the pre-hydration paint shows the final state for potentially hundreds of ms before the animation runs — accepted by spec §5d as the additive trade-off). Fast-forward on `pointerup | keydown | wheel | scroll` (POINTERUP, not down — the landing learned this the hard way: a down-skip moves elements mid-click and eats the click). StrictMode: module-level ran-guard for the double effect; the session flag is written at completion/fast-forward, not at start.
- Bonzi peek (desktop + motion): `createIdleWatcher(180_000)`; on idle, fixed `peek.gif` (~100px) bottom-right just above the taskbar, `.bonzi-peek--in`, hold 2.5s, `.bonzi-peek--out`; any watched input dismisses instantly; re-arm with a 180s floor; `aria-hidden`, pointer-events none, z-45.
- **idle.ts fix (required for the peek):** register the idle listeners with `capture: true` — xterm's textarea cancels keydown before it bubbles (verified in xterm source), so a user typing in the DOS prompt would count as idle; capture-phase listeners run first. `removeEventListener` in disarm must pass the same capture flag or the listener leaks. Landing screensaver inherits the fix harmlessly. Update the idle test's fake-target expectations if the options object changes shape.
- Hourglass: terminal-window-inner root gets the `.cursor-wait-all` CLASS while phase is booting/restoring (inline cursor style does not cascade past xterm's own cursor rules); analysis: effect in (app)/app/page.tsx toggles `body.cursor-progress` while `isAnalyzing`, cleared on unmount.

**Steps:**
- [ ] 1. boot-flag key param (+ test); idle capture fix (+ test); app-boot choreography + fast-forward + session-once.
- [ ] 2. Bonzi peek. 3. Hourglass both places.
- [ ] 4. Manual: fresh session boots once (reload = nothing; input mid-boot fast-forwards on release without eating the click); idle 5s (temporarily lowered — RESTORE 180000 and verify the committed value) → peek, any input dismisses, typing inside the xterm PREVENTS the peek; wait-cursor during terminal boot, normal at prompt; progress cursor during analysis; reduced motion/mobile: none of it.
- [ ] 5. Gates; commit `add app boot and bonzi peek`.

---

### Task 8: E2E + full verification

**Files:** `e2e/desktop.spec.ts` (+ `e2e/landing.spec.ts` only if a regression fix requires it)

**Steps:**
- [ ] 1. FIRST: make existing desktop tests immune to the new boot cascade — INTRODUCE a shared goto helper (or beforeEach; none exists today) seeding `cbb-app-booted` via `page.addInitScript` (pattern: landing.spec.ts's latch), keeping ONE dedicated boot test that runs without the seed and latches the animation classes.
- [ ] 2. New tests: marquee drag selects two icons (`.icon-selected` count); ctrl+click toggles; desktop right-click menu opens, Escape closes it AND no window minimized; Properties → Display window → Apply changes the desktop background (computed style); icon drag persists across reload with ZERO console errors; taskbar right-click → Minimize All; title-bar right-click → Close; instant boot: the boot notice ([data-testid=terminal-boot-notice]) disappears within 8s — ON A FRESH PAGE ONLY (v86 states restore once per document; a same-page reopen legitimately cold boots — never assert instant timing on a reopen; xterm renders to canvas — never assert on terminal text).
- [ ] 3. Existing tests: update ONLY where behavior legitimately changed (icons are absolutely positioned now; single-click select semantics via store) — never weaken; T6/T7 icon-origin traces re-verified here if their waves ran before T5 merged.
- [ ] 4. Full gates + full e2e (worktree if `.next` is dev-locked) + `npm run build` LAST + prod spot-check (marquee, traces, instant boot, boot cascade).
- [ ] 5. Commit `cover desktop fidelity e2e`.

---

## Review triage record (2026-09-01)

All three reviewer verdicts were REVISE; every blocking/important finding is folded in above: complete CSS inventory in T2 (+`.icon-art` contract, checkerboard dither); seven icons not six; lastVisibleRect for trace from-rects; rehydrate-in-effect (no hydration mismatch) + hydrated flag; immutable Set rule + test; injectable tileAll viewport; keyboard-only focus-select; Taskbar onBarContextMenu prop; app-boot StrictMode ran-guard + flag-at-completion + POINTERUP fast-forward + T8 seeding; desktop contextmenu target guard; RetroMenu Escape stopPropagation; T3 rewritten to the verified single-path zstd restore (constructor initial_state rejected as uncatchable; node zstdCompressSync; meta fs.json hash staleness guard; abort-aware fallback; restored flag; post-restore newline + 5s echo belt); sloppy-dblclick movedRef guard; idle capture:true fix; T4 rAF-cancel-before-commit; duration unification (flash 120ms everywhere, menu 90ms, start menu 120ms); GRID approximation truth; e2e asserts the boot notice not terminal text; keyboard contextmenu coord fallback; synchronous persistence (debounce dropped); multi-tab comment; TerminalVM restored signal; icons stay buttons.

## Self-review notes

- Spec §1→T1/T5, §2→T1/T5, §3→T2/T5/T6, §4→T1/T5, §5a→T2/T6, §5b→T2/T6, §5c→T7, §5d→T7, §5e→T7, §5f→T5, §6→T3/T4. Constraints (keyboard menus, native-menu preservation, mobile, reduced motion) each land in a named contract.
- Cross-task names checked: store APIs, `RetroMenu`/`useContextMenu`, `runZoomTrace`/`outlineRect`, CSS inventory names, data attrs, boot-flag key param, `restored` flag.
- Known risks: v86 state size gate (T3), deep-link open-trace fallback (T6), pre-hydration boot flash truthfully labeled (T7).
