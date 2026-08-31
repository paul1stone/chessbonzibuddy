# Win98 Desktop App and Live Homepage Demos (Frontend Overhaul, Part 2)

Date: 2026-08-28. Status: user chose "full Win98 desktop app" and "scripted import animation" in conversation; remaining sections decided by the plan author and presented at the plan check-in. Builds on part 1 (`2026-08-28-retro-landing-design.md`).

## 1. Goal

The app at `/app` becomes a Windows 98 desktop: every feature is a draggable window on the teal desktop with a taskbar, replacing the dark-purple sidebar dashboard. The homepage walkthrough windows become live, honest demos, and homepage windows become draggable too. Queued cleanups ship alongside: next-themes removed, "Chess Analyzer" chrome renamed, shadcn tooltip deleted.

Every existing feature survives unchanged in behavior: linking accounts, import by URL and bulk, SSE analysis with live board scrubbing, review (moves/summary/engine), practice, play vs Bonzi with clocks and taunts, delete games, profile settings.

Out of scope: window resizing by edge-drag (windows have fixed per-type sizes plus maximize), multi-monitor persistence, new features, any API/DB change, Bonzi voice.

## 2. Window manager

### 2.1 Store (`src/stores/window-store.ts`, Zustand, not persisted)

```ts
type WindowId = "games" | "import" | "review" | "practice" | "play" | "profile";
interface WindowState { id: WindowId; open: boolean; minimized: boolean; maximized: boolean; x: number; y: number; z: number }
interface WindowStore {
  windows: Record<WindowId, WindowState>;
  focused: WindowId | null;
  open(id, opts?: { at?: {x,y} }): void;   // opens (or un-minimizes) and focuses
  close(id): void;
  minimize(id): void;                       // hides via CSS (window stays MOUNTED so live state — engine worker, clocks, game ref — survives); taskbar button stays
  toggleMaximize(id): void;
  focus(id): void;                          // bumps z to top
  move(id, x, y): void;
}
```
Default sizes per window (CSS width/height, px): games 360x520, import 520x560, review 960x640, practice 900x560, play 960x640, profile 400x380. Initial cascade: each newly opened window lands at `(48 + 24n, 48 + 24n)` where n counts currently open windows, clamped to the desktop. `z` is a monotonically increasing counter.

Reading `?view=play-bonzi` (existing `ViewParamSync`) now calls `open("play")`.

### 2.2 Drag (`src/hooks/use-drag.ts`)

`useDrag({ onMove(dx, dy), onEnd?, disabled? })` returns `onPointerDown` for the handle. Pointer capture on the handle, `pointermove` deltas, `pointerup`/`pointercancel` end. During drag the window gets `will-change: transform` and the body gets `user-select: none`. Touch works via pointer events; `touch-action: none` on the title bar only. Disabled when `matchMedia("(max-width: 767px)")` matches (mobile is single-window, section 2.4) or under reduced motion (windows still open; they just don't drag). Position clamps so at least 40px of the title bar stays on screen.

Used by both the app desktop and the homepage walkthrough windows (homepage windows keep their cascade layout as their initial position and become `position: relative` + transform-translated on first drag; no store, local state only).

### 2.3 Chrome (`src/components/desktop/`)

- `DesktopWindow({ id, title, icon?, children, className? })`: wraps `RetroWindow` with a title bar that is the drag handle, real minimize/maximize/close buttons (replacing the decorative glyphs in the app context; the marketing `RetroWindow` keeps decorative glyphs), focus-on-pointerdown anywhere in the window, inactive-title styling when not focused (grey gradient, re-added to `retro.css` as `.r-title--inactive`, dropped in part 1 because it had no consumer). Body is `display:flex; flex-direction:column; min-height:0` so interior `h-full`/`min-h-0` chains work. Keyboard: title bar is focusable; when focused, arrow keys nudge the window 16px, Enter toggles maximize, Escape minimizes. `role="dialog"`, `aria-labelledby` the title.
- `Desktop`: the teal surface (`position: fixed; inset: 0 0 var(--r-taskbar-h) 0; overflow: hidden`), desktop icons column at top-left, renders every open non-minimized window absolutely positioned via `transform: translate(x,y)` with `z-index: z`. Clicking the empty desktop clears focus.
- `DesktopIcon({ label, icon, onOpen })`: 32px pixel icon + label, white text with 1px black text-shadow on teal (period-accurate and the way Win98 got contrast), double-click or Enter opens; single click selects (navy highlight box).
- `AppTaskbar`: extends the retro `Taskbar` with a "running windows" strip: one sunken-when-focused button per open window (minimized ones raised), click focuses or restores; Start menu items become window openers (Play Bonzi Buddy, My games, Import, Practice, Profile) plus Home (`/`), Privacy, Terms, GitHub. The marketing `Taskbar` is refactored to accept `items` and `children` so both surfaces share one implementation.
- Icons: 6 hand-drawn 32x32 pixel SVGs in `src/components/desktop/icons.tsx` (games: folder with a knight; import: floppy with a down arrow; review: magnifier over a board; practice: target; play: Bonzi's still frame; profile: an ID card). Own artwork, inline SVG, `shape-rendering: crispEdges`.

### 2.4 Mobile (under 768px)

The desktop metaphor degrades to exactly today's view switching: every open window renders maximized, only the focused one is visible, taskbar buttons switch between them, no dragging, no desktop icons (the Start menu opens windows). This preserves the current mobile UX with zero new gestures.

### 2.5 Keyboard scoping

`board-panel.tsx`'s global `keydown` (ArrowLeft/Right/Home/End/Space) is scoped: it only fires when its window is focused (`useWindowFocused(id)` from the store) and the event target is not an input/textarea/contenteditable. Same for the practice view's board. Escape with a window focused minimizes it (title-bar handler); Escape in a text input does nothing special.

## 3. Windows (feature mapping)

| Window | Source today | Notes |
|---|---|---|
| My games (`games`) | `sidebar.tsx` list, delete, accuracy badges, "New analysis" | Opens `review` on row click. Empty/no-account states link to `profile`. Opened by default on desktop when an account is linked. |
| Import (`import`) | `page.tsx` `ImportView` + `recent-games.tsx` | Tabs become two `RetroButton` tab strips styled as Win98 tabs (`.r-tabs`). The 300px fixed list becomes `flex-1 min-h-0`. Success toasts stay. |
| Game review (`review`) | `page.tsx` review branch + `review/*` | Title reads "{white} vs {black}". The three top bars collapse into one status bar row (status bar slot of the window): result, "Analyze"/"Practice mistakes" buttons, analysis progress as a Win98 segmented progress bar (`.r-progress`, blue blocks). Board sizes from window size (section 4). |
| Practice (`practice`) | `practice-view.tsx` + `feedback-card.tsx` | Opens from review; exit closes the window. |
| Play Bonzi Buddy (`play`) | `play/*` | Setup screen then board; clocks; game-over overlay stays contained. Minimizing keeps the game running (clocks tick). |
| Profile (`profile`) | `profile-settings.tsx` + `LoginScreen` | One window: link/unlink Chess.com and Lichess, ratings. "Sign in" language becomes "Link accounts". |

First visit with no linked account: desktop opens `profile` and `games` (empty state explains linking). Deep link `/app?view=play-bonzi` opens `play` only.

Sonner toasts stay (they are the one portal) but get Win98 styling: `theme="light"`, `--normal-bg: var(--r-face)`, border via bevel class, square corners, MS Sans font, position bottom-right above the taskbar (`offset` = taskbar height + 8).

## 4. Restyle mechanics

- **Scope**: `(app)/layout.tsx` wraps in `.retro.app` (plus `--font-ui`/`--font-term` variables), dropping `.dark`, Geist, and `[color-scheme:dark]`. Body copy inside windows uses `.r-body` (Verdana 13px in-app: `--r-body-size: 13px` override).
- **Token remap** (`src/styles/retro-app.css`, imported from globals.css): under `.retro.app`, redeclare the shadcn tokens to the Win98 palette: `--background: var(--r-face)`, `--foreground: var(--r-dark)`, `--card: var(--r-face)`, `--popover: var(--r-face)`, `--primary: var(--r-title-a)`, `--primary-foreground: var(--r-title-text)`, `--secondary: var(--r-face)`, `--muted: var(--r-face-light)`, `--muted-foreground: var(--r-shadow)`, `--accent: var(--r-title-a)`, `--accent-foreground: var(--r-title-text)`, `--border: var(--r-shadow)`, `--input: var(--r-paper)`, `--ring: var(--r-dark)`, `--destructive: #800000`, `--radius: 0`. `--chart-1..5` to a 5-hue Win98 chart set: navy `#000080`, teal `#008080`, olive `#808000`, maroon `#800000`, purple `#800080`.
- **Component swaps**: shadcn `Button` → `RetroButton` in every app file; `Input` gets `.r-input` (sunken bevel, paper bg); `Card` → `RetroPanel` (a new tiny retro primitive: raised group box with an optional caption, Win98 "group box" look); `Tabs` → `.r-tabs`; `Badge` → `.r-badge` (flat navy/grey label); `ScrollArea` → native `overflow-auto` with `.r-scroll` (Win98 scrollbar via `::-webkit-scrollbar` + `scrollbar-color` fallback); `Separator` → `.r-sep`; `Skeleton` → `.r-skeleton` (striped grey). After the swap, `src/components/ui/{card,tabs,badge,scroll-area,separator,skeleton,tooltip}.tsx` are deleted; `button.tsx`, `input.tsx`, `sonner.tsx` remain (button/input still used by nothing in-app after the swap — delete them too if the grep is clean; the plan verifies).
- **Purple sweep**: every `purple-*`, `blue-*` selection accent, `bg-purple-950/…` overlay, `shadow-*`, and `rounded-*` in the app trees (`chess/`, `review/`, `practice/`, `import/`, `play/`, `bonzi/bonzi-review-mascot.tsx`, the six window files) is replaced with retro tokens/classes. Classification colors unify into one map in `src/lib/classification-colors.ts` (best navy `#000080`, great teal `#008080`, good `#008000`, book `#808000`, inaccuracy `#c08000`, mistake `#c04000`, blunder `#800000`, brilliant `#008080` bold) consumed by move-badge, game-summary, engine-panel, board-panel arrows, eval-chart. `eval-chart.tsx` hex literals map to the chart tokens. `eval-bar.tsx`'s private sigmoid is replaced by `cpToWinPercent` from `analysis-utils` (behavior change is a stated correction: the bar and the chart now agree).
- **Board**: `board.tsx` loses `rounded-lg shadow-xl`, gains a sunken bevel frame; square colors become `#d9c9a3`/`#6e4b2a` (the hero scene's palette). `boardWidth` is supplied by the window: `useBoardSize(windowId, reservedPx)` computes `min(bodyWidth - reserved, bodyHeight - reserved)` from a `ResizeObserver` on the window body; the three viewport-anchored caps are removed.
- **Sizing hazards removed**: every `h-screen`/`min-h-screen`/`50vh` in the six window bodies becomes `h-full`/`flex-1 min-h-0`.

## 5. Homepage: live demos and draggable windows

### 5.1 Demo fixture (`scripts/generate-demo-analysis.mjs`, `npm run demo-fixture`)

Runs the repo's `ServerStockfishEngine` (the `.stockfish/` lite build from postinstall) over a fixed public-domain miniature — the Opera Game, Morphy vs Duke of Brunswick and Count Isouard, Paris 1858 (17 moves, PGN embedded in the script) — at depth 12 with the exact loop from `api/games/[id]/analyze/route.ts:73-138`, and writes `src/components/landing/demo/opera-game.json`: `{ pgn, analysis: GameAnalysis }`. The JSON is committed; the script is run by a developer, not at build time (CI has no engine). The demo is therefore real Stockfish output for a real game; the footer credits say so.

### 5.2 Review demo (`ReviewDemo`, client)

Inside the "Review" walkthrough window: a small read-only `Board` (from `chess/board.tsx`, `interactive={false}`, `boardWidth` 260) plus a compact move strip with classification colors and a Win98 slider-style scrubber (range input styled `.r-slider`). Auto-plays one move per 1.4 s while in view (IntersectionObserver ≥ 0.5), pauses out of view, any scrub takes manual control. Arrow shows the best move when the played move was not best. A one-line caption: "Morphy vs Duke Karl / Count Isouard, 1858. Real Stockfish 18 analysis." Reduced motion: no autoplay; the scrubber still works.

### 5.3 Practice demo (`PracticeDemo`, client)

Inside "Practice": the position before the fixture's worst black-side loss of win% among moves classified mistake/blunder (Morphy's moves grade near-best; the losing side supplies the puzzle) (computed at module load from the JSON; if none, the position before move 12), an interactive `Board` (drag or click-to-move, orientation to the side to move), prompt "Find the best move.", `chess.js` validation against `analysis.moves[i].bestMove`; correct → clap gif + "Correct: {san}." ; wrong → sad gif + "Not quite. Best was {san}." with a Try again button. Fully client-side.

### 5.4 Import demo (`ImportDemo`, client, scripted)

Inside "Import": a labeled scripted sequence ("Demo" tag in the window status bar): a Win98 input "types" `https://www.chess.com/game/live/…` character by character, a segmented `.r-progress` fills over 1.2 s, then three game rows appear one by one with checkboxes ticking. Loops after 3 s while in view. Every string is visibly fake-but-generic (players "you" and "opponent"), no real usernames. Reduced motion: renders the end state statically.

### 5.5 Draggable homepage windows

`WindowStack` items and the hero window get the `useDrag` handle on their title bars (desktop widths only; disabled under reduced motion). Dragging a walkthrough window lifts it to the top (local z counter). The hero window's drag is disabled while the scroll choreography is running past `p > 0.05` (it is being animated).

### 5.6 Placeholder retirement

`screenshots.json`, the "Screenshot pending" frames, and the `import/review/practice` branches of `scripts/capture-screenshots.mjs` are removed (the script keeps only the hero poster capture). `next/image` usage in the walkthrough goes away.

## 6. Cleanups

- Delete `src/components/theme-provider.tsx`, remove `next-themes` from `package.json`.
- Rename remaining "Chess Analyzer" UI strings to "Chess Bonzi Buddy"; `package.json` `name` becomes `chess-bonzi-buddy`. The localStorage key `chess-analyzer-profile` is kept (renaming would unlink every existing user).
- Delete `src/components/layout/{dashboard-layout,sidebar}.tsx` and `src/app/(app)/app/view-param-sync.tsx`'s view mapping is replaced by window opening.
- Remove the dead `isFetching` field from profile-store; remove the unused `games` selector in the old page.

## 7. Performance and honesty

- `/app` stays a static client page; the window-manager bundle adds under 8 KB gzip. `react-chessboard` + `chess.js` now load on `/` for the demos: lazy (`next/dynamic`, `ssr: false`) inside each demo, mounted on first intersection, so the landing initial bundle is unchanged; the demo chunk budget is 80 KB gzip.
- The demos say what they are: the review/practice caption names the game and "Real Stockfish 18 analysis"; the import window carries a visible "Demo" tag.
- No layout shift: each demo reserves its box (fixed heights) before its chunk mounts and renders a `.r-skeleton` inside.

## 8. Accessibility and responsiveness

- Windows are `role="dialog"` with labelled titles; title-bar buttons have names ("Minimize", "Maximize", "Close"); focus moves into a window when opened ; on close, focus falls to the next top window (or the Start button when none remain).
- Keyboard window management per 2.3; taskbar buttons are real buttons in tab order.
- Mobile per 2.4; all boards remain fully usable at 375px (board width from the maximized window body).
- Contrast: black on face 11.6:1 everywhere for body text; desktop-icon labels white on teal with shadow.

## 9. Testing

- Unit (vitest): window-store reducer behaviors (open cascades/clamps, focus bumps z, minimize/restore, close removes focus), `useBoardSize` math, demo selectors (worst-loss position picker), classification color map completeness (all 8 classifications present).
- E2E (Playwright), added to the existing suite: `/app` shows the desktop with taskbar and icons; opening Play from an icon opens a window, Start Game boots the board with no console errors; dragging a window's title bar by (120, 80) moves it (transform assertion); minimize hides and taskbar restores; 375px shows a single maximized window and switching via taskbar works; `/` review demo scrubber changes the board position; practice demo accepts the best move; import demo shows the Demo tag; reduced motion: no autoplay, demo end states rendered; no console errors on `/` and `/app`.
- Gates as part 1 (typecheck, lint baseline, unit, e2e, static build, Lighthouse recorded).

## 10. Risks

- The window/keyboard scoping touches `board-panel.tsx`, which has one of the two pre-existing lint errors; the plan fixes that file's error while there.
- `react-chessboard` inside a transform-translated ancestor: drag-and-drop uses pointer coordinates and works under transforms; verified in the plan's smoke step before the desktop task lands.
- Persisting window positions is deliberately not done; a refresh returns to the default cascade.
