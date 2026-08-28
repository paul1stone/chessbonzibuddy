# Analyzer rework — spec

Branch: `analyzer-rework` (worktree). Goal: make game analysis correct and trustworthy.
Plan: `docs/superpowers/plans/2026-08-28-analyzer-rework.md`

## Root causes found (code audit, 2026-08-28)

- **P0 — UCI perspective bug**: `score cp`/`score mate` are side-to-move relative; the code treats them as white-relative everywhere. Every eval at a black-to-move position is sign-flipped → classifications/accuracy/eval chart all poisoned. No negation exists anywhere in `src/`.
- **P0 — mate handling**: `mate 0` after a checkmating move yields eval −100000 → winning mate classified "blunder"; mate scores also perspective-flipped; `mate` never stored in `MoveAnalysis`, UI hardcodes `mate=null` and prints "+999.97" instead of "M3".
- **P1 — parse bug**: same-depth `lowerbound`/`upperbound` info lines can overwrite the final exact score (reverse-iterate + `<` skip logic in `parseEvaluation`).
- **P1 — search discipline**: hardcoded `go depth 12` (UI claims 18); no `ucinewgame` between positions; single 60s route timeout can't fit a full game and partial work is discarded on failure.
- **P2 — dead duplicate pipeline** in `src/lib/analyze.ts` (drifts from route copy).
- **P2 — classification bands**: `great` at ≤2% loss makes nearly every move green; `brilliant`/`book` in the union but never produced; key moments ranked by raw cp delta.
- **P2 — eval bar uses a different sigmoid** (cp/250) than the analyzer (cp/271.6).

## Approved direction (user, 2026-08-28)

1. Fix engine layer: normalize all evals to white-relative at parse time (flip when FEN says black to move), same for mate; keep `mate` as a first-class field through `MoveAnalysis` → UI; ignore `lowerbound`/`upperbound` lines; take the last exact info line at max depth; send `ucinewgame` per game.
2. Fixed nodes per position (lichess-style) with MultiPV 2 for the whole pass.
3. Classification on win%-loss with special cases first: forced (1 legal move), book (opening table), lichess-style mate-transition matrix (never punish a slower mate). Bands: best <1, great <3.5, good <7, inaccuracy <10, mistake <20, blunder ≥20 win%-points.
4. Accuracy: lichess formulas (win% sigmoid k=−0.00368208 with ±1000 cp clamp, accuracy curve with +1 bonus, 50/50 volatility-weighted + harmonic mean, first-full-window padding, `Cp.initial=15` seed).
5. Brilliant/great detection from MultiPV-2 gap + sacrifice check — **deferred to a later pass** (plan review: heuristic misfires on ordinary tactics; pipeline ships a permanent-for-now stub).
6. Runtime: client-side analysis in the browser worker (full Stockfish build already in `public/stockfish/`), persisted via `PUT /api/games/[id]/analysis`; server analyze route and server engine deleted.
7. Single pipeline in `src/lib/analyze.ts`; unify eval-bar sigmoid with `cpToWinPercent`; honest depth display; `GameAnalysis.version = 2` gating (old blobs treated as unanalyzed).
8. Verify: unit tests with canned UCI transcripts and injected fake engines; typecheck/lint/build; manual browser smoke on a real game.

## Accepted tradeoffs

- No partial persistence or resume: closing the tab mid-analysis loses the in-flight game and queue (each completed game persists at its own PUT; the old server route was strictly worse — 60s cap, all-or-nothing).
- Sidebar accuracy columns for v1-analyzed games keep showing old (corrupt) numbers until re-analysis.
- First analysis downloads ~110 MB of WASM; handshake timeouts sized for it and a loading notice shown.
