# Retro Landing Page and Design System (Frontend Overhaul, Part 1)

Date: 2026-08-28. Status: approved in conversation (architecture), remaining sections decided by the plan author and presented at the plan check-in.

## 1. Goal

Replace the app-first `/` route with a marketing landing page for **Chess Bonzi Buddy** whose signature element is a scroll-driven, pixelated, flat-shaded 3D chess game playing out behind Windows-98-style window chrome. Ship a small retro design system that part 2 (rebuilding the app screens) will reuse. Keep every existing feature working at `/app`.

Out of scope for part 1: restyling the app screens (play, import, review, practice), splitting `/app` into real routes, Bonzi voice/TTS, removing any dependency.

## 2. Product and tone

- Product name everywhere: **Chess Bonzi Buddy**. "Chess Analyzer" is retired from titles and metadata.
- Tone: full late-'90s desktop. The page is a Windows 98 desktop: teal background, grey beveled windows, navy title bars, a taskbar with a Start button. Bonzi is the classic purple gorilla GIF set already in `public/bonzi/`.
- Copy: sentence case, active voice, plain verbs, no em-dashes in body copy, no "it's not X, it's Y". The taunts are real strings from `src/lib/bonzi/quips.ts`, never invented for marketing.
- Honesty rules from the Website Brief: no fake testimonials/logos/metrics; real screenshots or an explicit, visible "screenshot pending" note; privacy and terms pages exist because usernames and games are stored.

## 3. Architecture (approved)

```
src/app/
  layout.tsx                      html/body/globals.css only (no fonts, no theme, no shell)
  (marketing)/
    layout.tsx                    retro fonts, `.retro` scope, Taskbar
    page.tsx                      landing: Hero, BonziShowcase, AnalyzerWalkthrough, Footer
    privacy/page.tsx              privacy policy in a RetroWindow
    terms/page.tsx                terms in a RetroWindow
  (app)/
    layout.tsx                    Geist fonts, `.dark` wrapper (next-themes dropped; Toaster hardcoded dark), DashboardLayout, Toaster
    app/page.tsx                  the existing src/app/page.tsx moved verbatim; ?view= synced in (app) layout
  api/...                         unchanged
src/components/
  retro/                          design system: window, title bar, button, menu, taskbar, dialog
  landing/                        hero/, bonzi-showcase, analyzer-walkthrough, footer
  bonzi/, chess/, play/, ...      unchanged (avatar + speech bubble get lint-only fixes)
src/styles/retro.css              tokens + bevel utilities, imported from globals.css
src/fonts/                        ms-sans-serif woff2 + license files
public/screenshots/               captured product screenshots + hero poster
e2e/                              Playwright specs
```

Routing:
- `/` landing (static). `/privacy`, `/terms` (static). `/app` the existing app. `/app?view=play-bonzi` opens the play view directly (a `ViewParamSync` client component in the `(app)` layout reads `view` from `useSearchParams` in a layout effect and calls `setView`).
- Root layout no longer forces `class="dark"` on `<html>`; the `(app)` layout wraps its children in `<div className="dark">` and owns the `Toaster` (next-themes is dropped entirely — its forcedTheme would write the class onto `<html>` and leak into marketing pages on client-side navigation), so marketing pages never pick up shadcn dark tokens or a theme flash.

New dependencies (exact versions verified on npm 2026-08-28):
`three@0.185.1`, `@react-three/fiber@9.7.0`, `postprocessing@6.39.4`, `@react-three/postprocessing@3.1.1`, `gsap@3.15.0`, `@gsap/react@2.1.2`. No Lenis: native scrolling with ScrollTrigger `scrub: 0.3` for smoothing (avoids wheel hijack on legal pages and a class of mount-order bugs; decided in plan review). Dev: `@playwright/test@1.62.1`, `vitest` (4.x), `@types/three`, `sharp`. No drei: nothing from it is needed.
No GLB/GLTF assets: pieces are procedural geometry (section 6).

## 4. Design system ("retro")

Tokens (CSS custom properties in `src/styles/retro.css`, all hex, period-accurate Windows 98 values):

| Token | Value | Use |
|---|---|---|
| `--r-desktop` | `#008080` | page background (teal) |
| `--r-face` | `#C0C0C0` | window/button face |
| `--r-face-light` | `#DFDFDF` | bevel light |
| `--r-highlight` | `#FFFFFF` | bevel highlight |
| `--r-shadow` | `#808080` | bevel shadow |
| `--r-dark` | `#000000` | bevel dark edge, text |
| `--r-title-a` | `#000080` | title bar start |
| `--r-title-b` | `#1084D0` | title bar end |
| `--r-title-text` | `#FFFFFF` | title text |
| `--r-paper` | `#FFFFFF` | document/content area inside a window |
| `--r-disabled` | `#808080` | disabled text |
| `--r-bonzi` | `#7B4FB5` | reserved for Bonzi's speech bubble only |

Brief exceptions, stated: the title bar uses a two-stop navy-to-blue gradient because that is the literal Windows 98 title bar; pure white appears only inside window content areas, never as the page background; all corners are square (radius scale is `0` only).

Bevels: `.r-bevel-out` (raised: highlight top-left, dark bottom-right, 2px) and `.r-bevel-in` (sunken) implemented with `box-shadow` insets, copied from the 98.css technique, scoped under `.retro`.

Typography:
- Display and UI: **Pixelated MS Sans Serif** (FontStruct "MS Sans Serif" by lou, CC BY-SA 3.0, shipped in 98.css 0.1.21 as `ms_sans_serif.woff2` 6.5 KB and bold). Loaded with `next/font/local` as `--font-ui`. Used at pixel-multiple sizes: 11px base, 22px, 33px, 44px headline; `-webkit-font-smoothing: none` on `.retro`. Attribution line in the footer credits.
- Terminal/log voice: **VT323** (OFL) via `next/font/google` as `--font-term`, used for the game log and taunt console.
- Body copy: `Verdana, Tahoma, "DejaVu Sans", sans-serif` system stack. Zero bytes, era-correct, readable at 13-15px.

Focus: `:focus-visible { outline: 1px dotted var(--r-dark); outline-offset: -4px }` (the Win98 focus rect), plus a 2px solid outline on links over teal so it is visible on the desktop.

Components (`src/components/retro/`, all server-compatible unless noted):
- `RetroWindow({ title, children, className?, style?, statusBar?, ref?, id?, aria-labelledby? })`: face + bevel, `TitleBar` with title text and decorative minimize/maximize/close glyphs (text glyphs, `aria-hidden`), optional status bar row.
- `RetroButton`: `<button>` or `<Link>` (via `href`), raised bevel, active state sunken, 1px dotted focus rect inside. Sizes: default (min 75x23px like Win98) and `lg`.
- `RetroDialog({ title, children, actions })`: a `RetroWindow` variant with an icon slot and centered buttons.
- `Taskbar` (client): fixed bottom bar, `StartButton` + `StartMenu` (links: Play Bonzi Buddy, Analyze my games, Privacy, Terms, GitHub), a clock rendered only after mount. Escape closes the menu; menu is a `<nav>` with a `<ul>` of links; button has `aria-expanded`.
- No icon library on marketing pages. Any glyph is text or a tiny inline SVG we draw.

## 5. Landing page sections

### 5.1 Hero (signature element)

Layout: a `<section>` 300vh tall. Inside, a `position: sticky; top: 0; height: 100vh` stage. The stage stacks: (back) `HeroCanvas`, (front) a centered `RetroWindow` titled "Chess Bonzi Buddy".

Window content:
- h1: "Play chess against a purple gorilla from 1999."
- p: "Bonzi Buddy runs on Stockfish and talks trash the whole game. Lose, then import the game and find out exactly where it went wrong."
- Buttons: `RetroButton href="/app?view=play-bonzi"` "Play Bonzi Buddy" (default button, bold bevel) and `RetroButton href="/app"` "Analyze my games".
- Bonzi: `BonziAvatar gif="wave" size="lg"` anchored bottom-right of the window with quip `"Bonzi Buddy wants to play chess! Click OK to lose."` (from `QUIP_MAP.game_start`, index 4; chosen deterministically to avoid hydration mismatch).
- Status bar: "Scroll to watch a game".

Scroll choreography (progress `p` in [0,1] over the 300vh):
- Canvas plays Scholar's mate, Bonzi as White: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#. Seven piece moves, one capture. Each move occupies an equal slice of `p` from 0.10 to 0.85; a piece lifts (y up), travels in a straight line, and drops; the captured f7 pawn pops upward and tumbles off the board over the final slice.
- Camera: at `p=0` a high, nearly top-down view slightly rotated; eases to a low three-quarter view by `p=0.85`; a slow idle orbit (±3 degrees, 12 s period) is always added on top so the scene never looks frozen while the canvas is in view.
- The hero window scales from 1 to 0.15 and translates toward the taskbar Start button between `p=0.05` and `p=0.35` (a "minimize"); its opacity reaches 0 at 0.35.
- At `p>=0.9` a `RetroDialog` fades in, centered: title "Chess Bonzi Buddy", text "Checkmate. Bonzi wins in four moves.", actions "Rematch" (`/app?view=play-bonzi`) and "Show me why" (`/app`).

Rendering (approach A):
- `HeroCanvas` is loaded with `next/dynamic(..., { ssr: false })` from a client file, mounted on `requestIdleCallback` (fallback `setTimeout 200`) after hydration. Until then, and permanently under `prefers-reduced-motion: reduce` or when WebGL is unavailable, `HeroPoster` renders `public/screenshots/hero-poster.webp` (a captured frame of the scene at `p=0.85`) as a plain `<img>` with alt text "Pixelated 3D chessboard after Scholar's mate".
- Internal render resolution: width 400px (height by aspect), achieved with `<Canvas dpr={400 / viewportWidth}>` clamped to [0.15, 1]; canvas element CSS `image-rendering: pixelated`, `width/height: 100%`.
- Materials: `MeshLambertMaterial` with `flatShading: true`. One `DirectionalLight` (warm, from upper-left) + `AmbientLight` 0.7. No shadows, no antialiasing (`gl={{ antialias: false }}`).
- Post-processing: `EffectComposer` with one custom `DitherEffect` (4x4 Bayer ordered dither, quantizing each channel with levels = 6). ~30 lines of GLSL.
- Frame loop: `frameloop="always"` only while the hero is in the viewport (IntersectionObserver); otherwise `frameloop="never"`. Hidden tabs are already throttled by rAF, so no visibilitychange handling. Target: under 2 ms GPU per frame on a 2020 phone at 400px internal width.
- Scroll input: one GSAP `ScrollTrigger` timeline on the hero section (`start: "top top"`, `end: "bottom bottom"`, `scrub: 0.3`): a full-length linear proxy tween publishes smoothed progress to a `useRef` read by the R3F `useFrame`, and the same timeline animates the DOM window's transform/autoAlpha and the dialog's autoAlpha (autoAlpha keeps invisible elements out of the tab order). Wrapped in `gsap.matchMedia()`; under reduced motion there is no ScrollTrigger and no canvas: the hero renders the poster, the window at full size, and the dialog directly below the window in normal flow.

Colors in the scene: board light `#D9C9A3`, dark `#6E4B2A`, rim `#3A2A1A`; white pieces `#F0E6D2`; black pieces `#2B2B2B`; background transparent over the teal desktop.

### 5.2 Bonzi showcase

A `RetroWindow` titled "BonziBUDDY.exe" with two panes: left, `BonziAvatar size="lg"`; right, a VT323 "game log" (`--r-paper` background, sunken bevel). Heading (h2): "Stockfish moves, playground mouth." Sub: "Every capture, check, and checkmate gets a comment. The lines are hand-written and he never repeats one within three turns."

Behavior (`BonziShowcase`, client): when the window enters the viewport (IntersectionObserver, threshold 0.5) it plays a scripted sequence of real events through `getBonziReaction`: `game_start`, `bonzi_capture`, `bonzi_check`, `bonzi_checkmate`, one every 2.8 s, appending each quip to the log and swapping the avatar gif; loops after a 4 s pause. Leaves the viewport: sequence pauses. Under reduced motion: no cycling; the log shows the four quips at once and the avatar shows `public/bonzi/idle-still.png` (a still frame extracted from `idle.gif` with ffmpeg and committed; also used as the Start button icon).

### 5.3 Analyzer walkthrough

Heading (h2): "Then find out what went wrong." Three `RetroWindow`s laid out as a static diagonal cascade (each stepped 48px right of the previous, fully visible, no overlap — copy stays readable at rest; on screens under 768px they stack vertically with no offset). This is a deliberate alternative to the three-cards-in-a-row default.

| Window title | Copy | Image |
|---|---|---|
| Import | Paste a Chess.com game link, or pull your last 50 games from Chess.com or Lichess and pick the ones worth a look. | `public/screenshots/import.png` |
| Review | Stockfish 18 grades every move from best to blunder, scores accuracy for both sides, and estimates the rating you played at. | `public/screenshots/review.png` |
| Practice | Every mistake becomes a puzzle. Find the move you should have played. | `public/screenshots/practice.png` |

Screenshots: captured by `scripts/capture-screenshots.ts` (Playwright) from the running app. Import/Review/Practice require `DATABASE_URL` and a real game URL; when it is absent the script writes nothing for those three and the component renders a sunken grey frame with the visible text "Screenshot pending. This screen is being redesigned in part 2." in place of the image. The component checks for file presence at build time via a small generated manifest `src/components/landing/screenshots.json` (written by the script; `{ hero: boolean, import: boolean, review: boolean, practice: boolean }`; `hero` false makes `HeroPoster` render a plain teal panel instead of a broken image). No fake UI is ever rendered.

### 5.4 Footer

A grey face strip with a raised bevel: "Chess Bonzi Buddy is a hobby project. Not affiliated with Bonzi Software, Chess.com, or Lichess." Links: Privacy, Terms, GitHub (`https://github.com/paul1stone/chessbonzibuddy`), Credits (inline text: "Stockfish 18, chess.js, react-chessboard. MS Sans Serif pixel font by lou, CC BY-SA 3.0."). Sits above the fixed taskbar (page has `padding-bottom` equal to taskbar height).

## 6. Procedural chess pieces

`src/components/landing/hero/piece-geometry.ts` exports `createPieceGeometry(type: PieceType): THREE.BufferGeometry` where `PieceType = "p" | "n" | "b" | "r" | "q" | "k"`.

- p, r, b, q, k: `THREE.LatheGeometry(points, 10)` from a hard-coded 2D profile per piece (radius, height pairs, 8 to 14 points each, heights: p 0.55, b 0.8, n 0.75, r 0.7, q 0.98, k 1.12 in board-square units). Ten segments keeps facets visible under flat shading, which is the look.
- n: `THREE.ExtrudeGeometry` of a hard-coded 12-point knight silhouette `THREE.Shape` (base 0.5 wide, height 0.75), depth 0.3, no bevel, centered. The silhouette is our own polyline, not traced from a licensed set.
- Rook's lathe profile ends in a recessed cup rim (reads as the crenellated top at the render resolution); queen/king add a small sphere/cross via merged geometry using `BufferGeometryUtils.mergeGeometries`.
- All geometries call `computeVertexNormals()`; flat shading comes from the material.

Board: 64 `BoxGeometry(1, 0.1, 1)` instanced via `InstancedMesh` with per-instance color, plus a rim box. Total scene about 6k triangles.

## 7. Hero timeline (pure logic, unit-tested)

`src/components/landing/hero/hero-timeline.ts`:
- `SCHOLARS_MATE: Ply[]` where `Ply = { from: Square; to: Square; captures?: Square }` and `Square` is algebraic (`"e2"`).
- `INITIAL_PIECES: PieceState[]`, `PieceState = { id: string; type: PieceType; color: "w" | "b"; square: Square }`.
- `boardAt(progress: number): RenderPiece[]`, `RenderPiece = { id, type, color, x, z, y, yaw, captured: boolean }` with x/z in board coordinates (file 0..7, rank 0..7 centered), y the lift (0 on the board, max 0.6 mid-travel using a sine ease), and the captured pawn's y/x/yaw following a tumble arc after its capture ply.
- `cameraAt(progress: number): { position: [x,y,z]; target: [x,y,z] }` interpolating between `TOP = position [0, 11, 2.5]` and `LOW = position [6, 3.2, 7]`, target always `[0, 0, 0]`, with `easeInOutCubic`.
- Move slices: `MOVE_START = 0.10`, `MOVE_END = 0.85`, seven equal slices; inside a slice `t` eases with `easeInOutQuad`.

Tests (vitest): `boardAt(0)` equals the initial position; at the midpoint of ply 1 the e2 pawn has `y > 0` and `z` between e2 and e4; at `progress = 1` the white queen is on f7, the black f7 pawn is `captured: true` with `y < 0`, every other piece is where Scholar's mate leaves it; `cameraAt(0)` and `cameraAt(1)` equal the endpoints; progress is clamped to [0,1].

## 8. Legal pages

`/privacy` and `/terms`, each a `RetroWindow` with an `<article>` in body type. Content is written from what the code actually does (verified in `src/db/schema.ts`, `src/stores/profile-store.ts`, `src/app/api/*`):
- Stored in the browser (`localStorage` key `chess-analyzer-profile`): Chess.com and Lichess usernames and cached ratings. Cleared by clearing site data in the browser (the store's clearProfile action has no UI; do not claim one).
- Stored in the database (Neon Postgres, hosted in the US): for each imported game, the source URL, PGN, player names, result, date, and Stockfish analysis. Users delete games from the sidebar; deletion is immediate and permanent.
- Third parties: public Chess.com and Lichess APIs are called with the username you enter; Vercel hosts the site and keeps standard request logs. No analytics scripts, no advertising, no cookies set by the app.
- Requests: via GitHub issues at the repo URL.
- Terms: hobby project, provided as-is, no accounts, do not import games you do not have the right to share, analysis is approximate (mirrors the README disclaimer), not affiliated with Bonzi Software, Chess.com, or Lichess.
The user reviews both pages before deploy; they are real copy, not placeholders.

## 9. Performance and loading

- `/`, `/privacy`, `/terms` are statically generated (no dynamic APIs used in marketing routes). Verified after build by `next build` output showing `○ (Static)` for those routes.
- Initial landing JS budget: 130 KB gzip (framework + GSAP + retro components). The 3D chunk (three, fiber, postprocessing, scene) is a separate dynamic chunk, budget 260 KB gzip, requested after idle.
- Images: `next/image` for screenshots (`sizes` set, lazy), poster as `<img loading="eager" fetchpriority="low">` behind text. Hero text is the LCP candidate.
- Fonts: `next/font` self-hosts both faces with `display: swap`; the UI font is preloaded.
- Compression: brotli confirmed at Vercel's edge on 2026-08-28 (`content-encoding: br`); no middleware.
- Skeletons: the only async views on marketing pages are the showcase (renders immediately with the first quip) and the canvas (poster beneath, same box size); no layout shift.

## 10. Accessibility and responsiveness

- Canvas `aria-hidden="true"`; all copy is DOM text. Bonzi `<img alt="Bonzi Buddy">` already; screenshots get descriptive alt.
- Keyboard: Start button opens the menu, arrow keys are not required (tab order through links), Escape closes and returns focus to the button. All buttons show the dotted focus rect.
- Reduced motion: as specified per section; verified by an e2e test with `reducedMotion: "reduce"` asserting no `<canvas>` exists and the dialog is in normal flow.
- 375px: hero window is `width: min(92vw, 560px)`; cascade stacks; taskbar stays; no horizontal overflow (e2e asserts `document.documentElement.scrollWidth <= 375`).
- Contrast: black on `#C0C0C0` 11.6:1; white on `#000080` 15.4:1; white text on teal desktop only at 14px bold or larger (4.6:1).

## 11. Testing and verification

- Unit: vitest for `hero-timeline.ts` and `piece-geometry.ts` (geometry has finite bounds and expected triangle count ranges).
- E2E (Playwright, chromium, `webServer: next dev`): landing renders h1 and both CTAs; CTA hrefs are `/app?view=play-bonzi` and `/app`; `/app?view=play-bonzi` shows the play setup; Start menu opens/closes with keyboard; `/privacy` and `/terms` render their h1; reduced motion shows poster and no canvas; 375px has no horizontal scroll; no console errors on `/`.
- Build: `npm run typecheck`, `npm run lint` (errors only in the two pre-existing `board.tsx`/`board-panel.tsx` react-hooks findings), `next build` succeeds, marketing routes are static.
- Manual: Lighthouse mobile on `/` with performance >= 85 and accessibility >= 95 recorded in the plan's final report.

## 12. Risks and notes

- BonziBuddy name and art (verified 2026-08-28, not legal advice): the BONZIBUDDY US word mark (Reg. 2447561) was cancelled in 2008 and cannot be revived; Bonzi Software, Inc. is out of business. Copyright in the original gorilla artwork technically subsists with whoever holds the defunct company's assets; no rights-holder is visible and no enforcement has occurred in 20+ years of memes and fan sites. The repo already ships the original sprites, so this work adds no new exposure. The footer disclaims affiliation. The user decides whether to keep the name and sprites; the safest long-term path is an original purple-gorilla drawing.
- WebGL unavailable or context lost: `HeroCanvas` catches creation failure and shows the poster.
- Safari: `image-rendering: pixelated` is supported; `requestIdleCallback` is polyfilled with `setTimeout`.
- Three.js in vitest runs under node without WebGL for geometry-only tests; no jsdom needed.
