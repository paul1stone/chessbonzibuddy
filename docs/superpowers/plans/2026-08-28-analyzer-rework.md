# Analyzer Rework Implementation Plan

> **For agentic workers:** This plan is executed via the `build` skill pipeline (Opus implementers per task, one wave at a time, Opus step review per task, Fable final review). Steps use checkbox (`- [ ]`) syntax for tracking. Implementers do NOT commit — the main session commits after each wave's step reviews pass.

**Goal:** Make game analysis correct and trustworthy: fix the UCI perspective bug, mate handling, and parse bugs; move analysis client-side with fixed-nodes search; adopt lichess-faithful math and win%-loss classification.

**Architecture:** Analysis runs in the browser (Stockfish 18 full WASM build already shipped at `public/stockfish/`), one fixed-nodes MultiPV-2 search per position, results persisted through the existing `PUT /api/games/[id]/analysis` route. The server analyze route and server engine are deleted. A new pure `src/lib/uci.ts` owns UCI parsing with perspective normalization; `src/lib/analysis-utils.ts` owns all math; `src/lib/analyze.ts` becomes the single pipeline.

**Tech Stack:** Next.js 16 / React 19, chess.js 1.4, stockfish 18 npm build (Web Worker), drizzle + neon, vitest (tests co-located as `src/**/*.test.ts`, node environment — everything tested is engine-injected or pure).

**Spec:** `docs/superpowers/specs/2026-08-28-analyzer-rework.md` (audit + approved direction + accepted tradeoffs). Key spec points inlined here in Global Constraints and per-task sections.

## Global Constraints

- **All stored evals are white-relative centipawns.** UCI `score cp` / `score mate` are side-to-move relative and MUST be negated when the searched position has black to move. Mate scores fold to cp as `mate > 0 ? 100_000 - mate : -100_000 - mate` (after normalization).
- **Classification is on win%-loss, never raw centipawns.** Bands (mover POV, 0–100 win% points): best < 1, great < 3.5, good < 7, inaccuracy < 10, mistake < 20, blunder ≥ 20. Special cases run first: mate-delivery → best, forced, book, mate-transition matrix.
- **Engine discipline:** fixed nodes per position (`ANALYSIS_NODES = 400_000`), `MultiPV 2`, `ucinewgame` once per game, same settings for every position.
- **`GameAnalysis.version = 2`.** Stored analyses without `version === 2` are treated as absent (old data is corrupt — perspective bug).
- **UI contract preserved:** `GameAnalysis.moves` stays one entry per ply in game order; existing field names keep their meaning; new fields are additive except `MoveClassification` gains `"forced"` (every exhaustive switch/Record over it must be updated — TS will enforce).
- Verification commands: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`.
- Commit messages: plain, 3–5 words, no prefixes/colons (main session commits, not implementers).
- cp → win% uses the lichess sigmoid with **cp clamped to ±1000** (was ±10000).

---

## File structure (final state)

| File | Responsibility |
|---|---|
| `src/lib/uci.ts` (new) | Pure UCI output parsing + perspective normalization. No engine, no DOM. |
| `src/lib/engine.ts` | Shared analysis types + browser `StockfishEngine` wrapper (uses `uci.ts`). |
| `src/lib/analysis-utils.ts` | Pure math: win%, win%-loss, classification, accuracy, rating, uciToSan, formatEval, key moments. |
| `src/lib/openings.ts` (new) + `src/data/openings.json` (new) | Lazy-loaded EPD set for book detection. |
| `src/lib/analyze.ts` | The one game-analysis pipeline (client, engine-injectable). Brilliant detection is a permanent-for-now stub (deferred — see end of plan). |
| `src/app/(app)/app/page.tsx` | `runAnalysis` runs the client pipeline + persists via PUT. |
| `src/app/api/games/[id]/analysis/route.ts` | PUT with v2 shape validation. |
| deleted: `src/app/api/games/[id]/analyze/route.ts`, `src/lib/server/engine.ts` | dead after client-side switch |
| review components + bonzi | consume `mateAfter`, `depth`, `winPercentLoss`, `"forced"`. |

---

### Task A: UCI parsing module

**Files:**
- Create: `src/lib/uci.ts`
- Test: `src/lib/uci.test.ts`

**Interfaces:**
- Consumes: nothing (pure, self-contained; do NOT import from `./engine`).
- Produces (later tasks rely on these exact names):

```ts
export interface UciLine {
  multiPv: number;          // 1-based
  eval: number;             // white-relative cp; mate folded via foldMateToCp
  mate: number | null;      // white-relative moves-to-mate (+ = white mates)
  depth: number;
  moves: string[];          // the pv
}

export interface ParsedUciEval {
  eval: number;             // = lines[0].eval, or 0 if no info lines
  mate: number | null;      // = lines[0].mate, or null
  bestMove: string;         // from "bestmove X"; "" when missing or "(none)"
  depth: number;            // = lines[0].depth, or 0
  lines: UciLine[];         // sorted by multiPv ascending
}

export function foldMateToCp(mate: number): number;
export function sideToMoveFromFen(fen: string): "w" | "b";
export function parseUciEvaluation(rawLines: string[], sideToMove: "w" | "b"): ParsedUciEval;
```

**Parsing rules (these fix audit bugs 4.1, 4.3, 4.4):**
1. Consider only lines starting with `info` that contain ` score `.
2. **Skip any line containing ` lowerbound` or ` upperbound`** (aspiration-window bounds, not real scores).
3. Group by `multipv N` (absent ⇒ 1). Iterate **forward** (chronological); for each multipv slot keep the line whose `depth` is **≥** the best depth seen for that slot (later line at equal depth wins — the resolved score).
4. Extract `score cp X` or `score mate X` and the pv after ` pv `.
5. After selecting lines: if `sideToMove === "b"`, negate `eval`-source cp and `mate` for every line (normalize to white-relative). `mate === 0` stays 0.
6. `foldMateToCp(mate)`: `mate > 0 ? 100_000 - mate : -100_000 - mate`. Note `foldMateToCp(0) === -100_000` — callers that can see mate-0 (terminal positions) must set eval sign themselves; the pipeline (Task F) never feeds mate 0 through this fold.
7. `bestmove (none)` ⇒ `bestMove: ""`.

- [ ] **Step 1: Write failing tests** (`src/lib/uci.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { parseUciEvaluation, foldMateToCp, sideToMoveFromFen } from "./uci";

const bm = "bestmove e2e4 ponder e7e5";

describe("parseUciEvaluation", () => {
  it("negates cp and mate when black to move", () => {
    const lines = ["info depth 12 multipv 1 score cp 35 nodes 100 pv e7e5 g1f3", bm];
    const r = parseUciEvaluation(lines, "b");
    expect(r.eval).toBe(-35);
    const m = parseUciEvaluation(
      ["info depth 12 multipv 1 score mate 3 pv d8h4", bm], "b");
    expect(m.mate).toBe(-3);
    expect(m.eval).toBe(-100_000 + 3);
  });

  it("keeps white-to-move scores as-is", () => {
    const r = parseUciEvaluation(
      ["info depth 10 multipv 1 score cp -50 pv a2a3", bm], "w");
    expect(r.eval).toBe(-50);
    expect(r.mate).toBeNull();
    expect(r.bestMove).toBe("e2e4");
    expect(r.depth).toBe(10);
  });

  it("ignores lowerbound/upperbound and prefers the last exact line at max depth", () => {
    const lines = [
      "info depth 12 multipv 1 score cp 300 lowerbound nodes 1 pv e2e4",
      "info depth 12 multipv 1 score cp 80 nodes 2 pv d2d4 d7d5",
      bm,
    ];
    const r = parseUciEvaluation(lines, "w");
    expect(r.eval).toBe(80);
    expect(r.lines[0].moves).toEqual(["d2d4", "d7d5"]);
  });

  it("collects two multipv lines sorted ascending", () => {
    const lines = [
      "info depth 12 multipv 2 score cp 10 pv d2d4",
      "info depth 12 multipv 1 score cp 40 pv e2e4 e7e5",
      bm,
    ];
    const r = parseUciEvaluation(lines, "w");
    expect(r.lines.map((l) => l.multiPv)).toEqual([1, 2]);
    expect(r.lines[1].eval).toBe(10);
    expect(r.eval).toBe(40);
  });

  it("handles bestmove (none)", () => {
    const r = parseUciEvaluation(["info depth 0 score mate 0", "bestmove (none)"], "w");
    expect(r.bestMove).toBe("");
  });
});

it("foldMateToCp", () => {
  expect(foldMateToCp(3)).toBe(99_997);
  expect(foldMateToCp(-2)).toBe(-99_998);
});

it("sideToMoveFromFen", () => {
  expect(sideToMoveFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe("w");
  expect(sideToMoveFromFen("8/8/8/8/8/8/8/4k2K b - - 0 1")).toBe("b");
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/lib/uci.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `src/lib/uci.ts`** per the parsing rules above. Keep it dependency-free (`sideToMoveFromFen` = `fen.split(" ")[1] === "b" ? "b" : "w"`).
- [ ] **Step 4: Run to verify pass** — `npx vitest run src/lib/uci.test.ts` → PASS.

---

### Task B: Types + engine wrapper

**Files:**
- Modify: `src/lib/engine.ts` (whole file in scope)
- Read/modify if needed: `src/components/play/play-view.tsx:40-190` (eval-sign semantics check only)

**Interfaces:**
- Consumes (from Task A, exact): `parseUciEvaluation(rawLines, sideToMove)`, `sideToMoveFromFen(fen)`, `foldMateToCp(mate)`, types `ParsedUciEval`, `UciLine` from `./uci`.
- Produces (later tasks rely on these exact shapes):

```ts
export type MoveClassification =
  | "brilliant" | "great" | "best" | "good" | "book" | "forced"
  | "inaccuracy" | "mistake" | "blunder";

export interface TopLine { moves: string[]; eval: number; mate: number | null }

export interface MoveAnalysis {
  moveNumber: number;
  color: "w" | "b";
  san: string;
  uci: string;
  evalBefore: number;            // white-relative cp (mate folded)
  mateBefore: number | null;     // white-relative
  evalAfter: number;
  mateAfter: number | null;      // 0 = position after move is checkmate (winner = sign of evalAfter)
  winPercentLoss: number;        // mover POV, 0–100
  depth: number;                 // depth of the before-position search
  bestMove: string;
  bestMoveSan: string;
  classification: MoveClassification;
  topLines: TopLine[];           // from the before-position search, multipv order
}

export const ANALYSIS_VERSION = 2 as const;

export interface GameAnalysis {
  version: typeof ANALYSIS_VERSION;
  engine: { name: string; nodes: number; multiPv: number };
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteRating: number;
  blackRating: number;
}

export function isCurrentAnalysis(a: unknown): a is GameAnalysis;
// true iff a is an object with version === ANALYSIS_VERSION and Array.isArray(a.moves)

export interface EngineEvaluation {   // kept for play mode; now white-relative
  eval: number; bestMove: string; pv: string[]; depth: number; mate: number | null;
}
```

`StockfishEngine` changes:
1. Delete the private `parseEvaluation` and `extractInt`; all parsing goes through `parseUciEvaluation(lines, sideToMoveFromFen(fen))`. For `evaluateFromMoves`/`evaluateWithClock` (startpos + moves), side to move = `moves.length % 2 === 0 ? "w" : "b"`.
2. Add:

```ts
async newGame(): Promise<void>   // sends "ucinewgame" then "isready", awaits "readyok"
async evaluateNodes(fen: string, nodes: number, multiPv: number): Promise<ParsedUciEval>
// setoption MultiPV, "position fen ...", "go nodes <nodes>", waitFor("bestmove", 120_000)
```

3. `evaluate`/`evaluateFromMoves`/`evaluateWithClock` keep their signatures but return the new `EngineEvaluation` (map `ParsedUciEval` → `{ eval, bestMove, pv: lines[0]?.moves ?? [], depth, mate }`).
4. **Play-mode audit:** read `src/components/play/play-view.tsx` usage of the returned `eval`/`mate`. Its scores are now white-relative where they were side-to-move before. If play-view displays or branches on eval sign, adjust at the call site so behavior is unchanged. If it only uses `bestMove`/`pv` (plan review traced exactly that: eval only feeds an unrendered log entry), touch nothing.
5. **Raise the handshake timeouts:** `handshake()` currently allows 10s for `uciok`/`readyok` (`engine.ts:298-303`), but the worker's first message only arrives after the browser downloads + compiles `/stockfish/stockfish.wasm` — **~113 MB, served with `max-age=0`** — so first-time analysis on a slow connection would hard-fail. Use 180_000 for both waits.

- [ ] **Step 1:** Update types exactly as above; add `isCurrentAnalysis`.
- [ ] **Step 2:** Rewire the wrapper to `uci.ts`; add `newGame` and `evaluateNodes`.
- [ ] **Step 3:** Play-view audit per item 4.
- [ ] **Step 4:** `npm run typecheck` — expect NEW errors only in files later tasks own (`analyze.ts`, the analyze route, UI Records missing `"forced"`). List them in your report; do not fix files outside scope. (`npx vitest run src/lib/uci.test.ts` must still pass.)

---

### Task D: Openings data + loader

**Files:**
- Create: `scripts/generate-openings.mjs`, `src/data/openings.json`, `src/lib/openings.ts`
- Test: `src/lib/openings.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:

```ts
export function epdFromFen(fen: string): string;          // first 4 space-separated FEN fields
export async function loadOpenings(): Promise<Set<string>>; // lazy singleton over openings.json
```

- [ ] **Step 1:** Write `scripts/generate-openings.mjs`: fetch the five TSVs `https://raw.githubusercontent.com/lichess-org/chess-openings/master/{a,b,c,d,e}.tsv` (CC0). **The columns are `eco`, `name`, `pgn` — there is NO epd column.** For each row, replay the `pgn` column with chess.js (`new Chess()` + `loadPgn`) and emit the final position as `fen().split(" ").slice(0, 4).join(" ")` (same normalization `epdFromFen` applies at lookup — chess.js only writes an en-passant square when a capture is actually legal, so generating with chess.js guarantees runtime membership checks match). Dedupe, write sorted JSON string array to `src/data/openings.json`. Node ≥ 20 `fetch`, import chess.js from the repo's own dependency; skip (and count) rows whose pgn fails to parse.
- [ ] **Step 2:** Run it: `node scripts/generate-openings.mjs`. Sanity: file exists, > 3,000 entries, spot-check it contains `"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"` (1.e4). Commit the generated JSON (it is vendored, not fetched at runtime).
- [ ] **Step 3: Failing test** (`src/lib/openings.test.ts`):

```ts
import { it, expect } from "vitest";
import { epdFromFen, loadOpenings } from "./openings";

it("epdFromFen strips clocks", () => {
  expect(epdFromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"))
    .toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
});

it("loadOpenings contains 1.e4 and not a random midgame", async () => {
  const set = await loadOpenings();
  expect(set.has("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -")).toBe(true);
  expect(set.has("8/8/8/8/8/8/8/4k2K w - -")).toBe(false);
  expect(set.size).toBeGreaterThan(3000);
});
```

- [ ] **Step 4:** Implement `src/lib/openings.ts`: `epdFromFen = fen.split(" ").slice(0, 4).join(" ")`; `loadOpenings` = `let cache: Set<string> | null` + `await import("@/data/openings.json")` (dynamic import so the app bundle only pays for it during analysis). `npx vitest run src/lib/openings.test.ts` → PASS.

---

### Task E: Analysis math rewrite

**Files:**
- Modify: `src/lib/analysis-utils.ts` (whole file in scope)
- Test: `src/lib/analysis-utils.test.ts`

**Interfaces:**
- Consumes: `MoveAnalysis`, `MoveClassification` types from `./engine` (Task B shapes).
- Produces (Task F and H rely on these exact signatures):

```ts
export function cpToWinPercent(cp: number): number;   // clamp cp to ±1000, lichess sigmoid
export function winPercent(cp: number, mate: number | null): number;
// white POV: mate > 0 → 100; mate < 0 → 0; mate === 0 → cp >= 0 ? 100 : 0; else cpToWinPercent(cp)

export interface ClassifyContext {
  color: "w" | "b";
  evalBefore: number; mateBefore: number | null;   // white-relative
  evalAfter: number;  mateAfter: number | null;
  isTopMove: boolean;
  isForced: boolean;
  isBook: boolean;
  deliversMate: boolean;
  winPercentLoss: number;                          // mover POV
}
export function classifyMove(ctx: ClassifyContext): MoveClassification;

export function computeWinPercentLoss(args: {
  color: "w" | "b";
  evalBefore: number; mateBefore: number | null;
  evalAfter: number; mateAfter: number | null;
}): number;
// wpB = winPercent(evalBefore, mateBefore); wpA = winPercent(evalAfter, mateAfter);
// color "w" ? max(0, wpB - wpA) : max(0, wpA - wpB)

export function calculateGameAccuracy(moves: MoveAnalysis[]): { white: number; black: number };
export function accuracyToRating(accuracy: number): number;  // formula unchanged; fix docstring
export function uciToSan(fen: string, uci: string): string;  // unchanged

export function formatEval(cp: number, mate: number | null): string;
// mate === 0 → "#"; mate !== null → `M${Math.abs(mate)}`; else signed pawns to 1 decimal ("+1.3", "-0.5", "0.0" → "+0.0"? no: cp 0 → "0.0")

export function selectKeyMoments(moves: MoveAnalysis[], count?: number): MoveAnalysis[];
// top `count` (default 5) by winPercentLoss desc, re-sorted into game order by
// ORIGINAL ARRAY INDEX (moveNumber repeats across a white/black move pair)
```

**`classifyMove` — exact order and logic.** Define mover-POV helpers first: `sign = ctx.color === "w" ? 1 : -1`, `mB = ctx.mateBefore === null ? null : sign * ctx.mateBefore` (same for `mA`), `cpB = sign * ctx.evalBefore`, `cpA = sign * ctx.evalAfter`.

```ts
if (ctx.deliversMate) return "best";
if (ctx.isForced) return "forced";
if (ctx.isBook) return "book";
// mate transitions (lichess Advice-style)
if (mB !== null && mB > 0) {
  if (mA !== null && mA > 0)
    return ctx.isTopMove || mA < mB ? "best" : "great"; // slower mate never punished
  if (mA === null)
    return cpA >= 999 ? "inaccuracy" : cpA >= 700 ? "mistake" : "blunder"; // mate lost
  // mA < 0: fell from mating into being mated — worst case
  return "blunder";
}
if ((mB === null || mB < 0) === false) { /* unreachable, kept for clarity */ }
if (mB === null && mA !== null && mA < 0)
  return cpB <= -999 ? "inaccuracy" : cpB <= -700 ? "mistake" : "blunder"; // mate allowed
// mB < 0 (already being mated) falls through to the bands below
if (ctx.isTopMove) return "best";
const l = ctx.winPercentLoss;
if (l < 1) return "best";
if (l < 3.5) return "great";
if (l < 7) return "good";
if (l < 10) return "inaccuracy";
if (l < 20) return "mistake";
return "blunder";
```

(Drop the `/* unreachable */` line in the real implementation — it is shown only to make the case coverage explicit. `"brilliant"` is never produced here; the only would-be producer is the deferred `detectBrilliant` stub in Task F, which returns false.)

**`calculateGameAccuracy` — lichess-style, exact spec.** Input is ALL moves (both colors, game order).
1. If `moves.length === 0` return `{ white: 100, black: 100 }`.
2. Series (white POV): `series[0] = cpToWinPercent(15)` (lichess `Cp.initial`), then for each move `series[i + 1] = winPercent(m.evalAfter, m.mateAfter)`.
3. `const windowSize = Math.min(Math.max(Math.floor(moves.length / 10), 2), 8);` then `const ws = Math.min(windowSize, series.length);` (lila: `(cps.size / 10).squeeze(2, 8)` — one cp per MOVE; the series is moves+1 long and is not the divisor).
4. Per move i (0-based), lichess pads early moves with the FIRST FULL window rather than a shrunk one: `const window = i < ws - 2 ? series.slice(0, ws) : series.slice(i - (ws - 2), i + 2);` `weight[i] = clamp(populationStddev(window), 0.5, 12)`. (Check: at `i = ws - 2` both branches give `series.slice(0, ws)` — continuous.)
5. Per-move accuracy: `acc[i] = clamp(103.1668100711649 * Math.exp(-0.04354415386753951 * m.winPercentLoss) - 3.166924740191411 + 1, 0, 100)` — note the **+1 uncertainty bonus** (lichess `AccuracyPercent`); if `m.winPercentLoss <= 0`, `acc[i] = 100`.
6. Split indices by `m.color`. Per color: `volWeighted = Σ acc·w / Σ w`; `harmonic = n / Σ (1 / max(acc, 1))` (floor at 1 avoids division blowup); result `Math.round(((volWeighted + harmonic) / 2) * 10) / 10`. A color with no moves → 100.

`accuracyToRating`: keep the formula; replace the docstring reference points with what it actually produces (65 → ~1075, 75 → ~1350, 85 → ~1725, 90 → 2000, 95 → ~2425).

`formatEval` / `selectKeyMoments`: implement per the signatures above — these centralize what `eval-bar.tsx`, `engine-panel.tsx`, `eval-chart.tsx`, and `game-summary.tsx` currently each do locally (Task H swaps them in). `formatEval` spec: `(cp / 100).toFixed(1)` with a `+` prefix when positive — `(35, null) → "+0.3"`, `(0, null) → "0.0"`, `(-120, null) → "-1.2"`; mate text carries no sign (the surrounding UI conveys side) — `(99997, 3) → "M3"`, `(-99998, -2) → "M2"`, `(100000, 0) → "#"`.

- [ ] **Step 1: Failing tests** (`src/lib/analysis-utils.test.ts`) — cover at minimum:

```ts
import { describe, it, expect } from "vitest";
import {
  cpToWinPercent, winPercent, classifyMove, computeWinPercentLoss,
  calculateGameAccuracy, formatEval, selectKeyMoments,
} from "./analysis-utils";
import type { MoveAnalysis } from "./engine";

describe("winPercent", () => {
  it("sigmoid anchors", () => {
    expect(cpToWinPercent(0)).toBeCloseTo(50, 5);
    expect(cpToWinPercent(100)).toBeCloseTo(59.1, 0);
    expect(cpToWinPercent(5000)).toBeCloseTo(cpToWinPercent(1000), 5); // ±1000 clamp
  });
  it("mate handling", () => {
    expect(winPercent(99_997, 3)).toBe(100);
    expect(winPercent(-99_997, -3)).toBe(0);
    expect(winPercent(100_000, 0)).toBe(100);   // white delivered mate
    expect(winPercent(-100_000, 0)).toBe(0);
  });
});

const base = {
  color: "w" as const, evalBefore: 0, mateBefore: null, evalAfter: 0,
  mateAfter: null, isTopMove: false, isForced: false, isBook: false,
  deliversMate: false, winPercentLoss: 0,
};

describe("classifyMove", () => {
  it("checkmating move is best, never blunder", () =>
    expect(classifyMove({ ...base, deliversMate: true, winPercentLoss: 100 })).toBe("best"));
  it("forced and book precede bands", () => {
    expect(classifyMove({ ...base, isForced: true, winPercentLoss: 30 })).toBe("forced");
    expect(classifyMove({ ...base, isBook: true, winPercentLoss: 8 })).toBe("book");
  });
  it("slower forced mate is never punished", () =>
    expect(classifyMove({ ...base, mateBefore: 3, mateAfter: 5, evalBefore: 99_997, evalAfter: 99_995 }))
      .toBe("great"));
  it("losing a mate while still winning is softened", () =>
    expect(classifyMove({ ...base, mateBefore: 2, mateAfter: null, evalBefore: 99_998, evalAfter: 1200 }))
      .toBe("inaccuracy"));
  it("allowing mate from an equal position is a blunder", () =>
    expect(classifyMove({ ...base, mateAfter: -4, evalAfter: -99_996, winPercentLoss: 50 }))
      .toBe("blunder"));
  it("black POV: mate for black is not a black blunder", () =>
    expect(classifyMove({ ...base, color: "b", mateBefore: -3, mateAfter: -2,
      evalBefore: -99_997, evalAfter: -99_998, isTopMove: true })).toBe("best"));
  it("win%-loss bands", () => {
    expect(classifyMove({ ...base, winPercentLoss: 0.5 })).toBe("best");
    expect(classifyMove({ ...base, winPercentLoss: 3 })).toBe("great");
    expect(classifyMove({ ...base, winPercentLoss: 6 })).toBe("good");
    expect(classifyMove({ ...base, winPercentLoss: 9 })).toBe("inaccuracy");
    expect(classifyMove({ ...base, winPercentLoss: 15 })).toBe("mistake");
    expect(classifyMove({ ...base, winPercentLoss: 25 })).toBe("blunder");
  });
});

it("computeWinPercentLoss is mover-relative and floored at 0", () => {
  expect(computeWinPercentLoss({ color: "w", evalBefore: 0, mateBefore: null,
    evalAfter: -100, mateAfter: null })).toBeCloseTo(9.1, 0);
  expect(computeWinPercentLoss({ color: "b", evalBefore: 0, mateBefore: null,
    evalAfter: -100, mateAfter: null })).toBe(0); // black improved, no loss
});

function mv(over: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    moveNumber: 1, color: "w", san: "e4", uci: "e2e4", evalBefore: 15,
    mateBefore: null, evalAfter: 15, mateAfter: null, winPercentLoss: 0,
    depth: 20, bestMove: "e2e4", bestMoveSan: "e4", classification: "best",
    topLines: [], ...over,
  };
}

describe("calculateGameAccuracy", () => {
  it("perfect play on both sides is 100/100", () => {
    const moves = Array.from({ length: 20 }, (_, i) =>
      mv({ color: i % 2 === 0 ? "w" : "b", winPercentLoss: 0 }));
    expect(calculateGameAccuracy(moves)).toEqual({ white: 100, black: 100 });
  });
  it("a blundering side scores clearly lower", () => {
    const moves = Array.from({ length: 20 }, (_, i) =>
      mv({ color: i % 2 === 0 ? "w" : "b", winPercentLoss: i % 2 === 0 ? 20 : 0 }));
    const r = calculateGameAccuracy(moves);
    expect(r.white).toBeLessThan(60);
    expect(r.black).toBe(100);
  });
});

it("formatEval covers cp, mate, and terminal mate", () => {
  expect(formatEval(35, null)).toBe("+0.3");
  expect(formatEval(0, null)).toBe("0.0");
  expect(formatEval(-120, null)).toBe("-1.2");
  expect(formatEval(99_997, 3)).toBe("M3");
  expect(formatEval(-99_998, -2)).toBe("M2");
  expect(formatEval(100_000, 0)).toBe("#");
});

it("selectKeyMoments takes top losses in game order", () => {
  const moves = [5, 30, 2, 45, 10, 25].map((loss, i) =>
    mv({ moveNumber: i + 1, winPercentLoss: loss }));
  const picked = selectKeyMoments(moves, 3);
  expect(picked.map((m) => m.winPercentLoss)).toEqual([30, 45, 25]); // chronological
});
```

- [ ] **Step 2:** `npx vitest run src/lib/analysis-utils.test.ts` → FAIL.
- [ ] **Step 3:** Implement per spec above (rewrite the file; delete the old `classifyMove(winPercentLoss, isBest)` and `calculateAccuracy(moves)` signatures entirely).
- [ ] **Step 4:** `npx vitest run src/lib/analysis-utils.test.ts` → PASS. `npm run typecheck` may still fail in files owned by F/G/H — list, don't fix.

---

### Task F: Analysis pipeline

**Files:**
- Modify: `src/lib/analyze.ts` (full rewrite)
- Test: `src/lib/analyze.test.ts`

**Interfaces:**
- Consumes: Task A `ParsedUciEval`; Task B `StockfishEngine` (`init/newGame/evaluateNodes/quit`), types, `ANALYSIS_VERSION`; Task E `winPercent`, `computeWinPercentLoss`, `classifyMove`, `calculateGameAccuracy`, `accuracyToRating`, `uciToSan`; Task D `loadOpenings`, `epdFromFen`.
- Produces:

```ts
export const ANALYSIS_NODES = 400_000;
export const ANALYSIS_MULTIPV = 2;

export interface AnalysisEngine {
  init(): Promise<void>;
  newGame(): Promise<void>;
  evaluateNodes(fen: string, nodes: number, multiPv: number): Promise<ParsedUciEval>;
  quit(): void;
}

export interface AnalyzeOptions {
  nodes?: number;
  multiPv?: number;
  onProgress?: (current: number, total: number) => void;
  engine?: AnalysisEngine;      // injected in tests; defaults to new StockfishEngine()
}

export async function analyzeGame(pgn: string, opts?: AnalyzeOptions): Promise<GameAnalysis>;
```

**Pipeline spec:**
1. Load PGN, get verbose history. Empty game → `{ version: ANALYSIS_VERSION, engine: { name: "stockfish-18-wasm", nodes, multiPv }, moves: [], whiteAccuracy: 100, blackAccuracy: 100, whiteRating: 0, blackRating: 0 }`.
2. `engine = opts.engine ?? new StockfishEngine()`; `await engine.init(); await engine.newGame();` `try { … } finally { engine.quit(); }`.
3. `openings = await loadOpenings().catch(() => new Set<string>())` — book detection degrades to none on failure, never fails analysis.
4. **Terminal-aware evaluation** — the engine is never asked about a finished position:

```ts
async function evaluatePosition(chess: Chess): Promise<ParsedUciEval> {
  if (chess.isCheckmate()) {
    const winnerIsWhite = chess.turn() === "b"; // side to move is the mated side
    const cp = winnerIsWhite ? 100_000 : -100_000;
    return { eval: cp, mate: 0, bestMove: "", depth: 0, lines: [] };
  }
  // ONLY hard-terminal draws short-circuit. chess.js isDraw() also fires on
  // CLAIMABLE draws (threefold, 50-move) that real games play through — those
  // must still go to the engine (Stockfish scores true repetitions ~0 itself).
  if (chess.isStalemate() || chess.isInsufficientMaterial())
    return { eval: 0, mate: null, bestMove: "", depth: 0, lines: [] };
  return engine.evaluateNodes(chess.fen(), nodes, multiPv);
}
```

5. Main loop (chain `prevResult` exactly like today — one search per position):

```ts
let prevResult = await evaluatePosition(replay);
for (let i = 0; i < moves.length; i++) {
  const move = moves[i];
  const fenBefore = replay.fen();
  const isForced = replay.moves().length === 1;
  const moveNumber = parseInt(fenBefore.split(" ")[5], 10) || Math.floor(i / 2) + 1;
  replay.move(move.san);
  const deliversMate = replay.isCheckmate();
  const afterResult = await evaluatePosition(replay);
  const isBook = i < 24 && openings.has(epdFromFen(replay.fen()));
  const uci = move.from + move.to + (move.promotion ?? "");
  const isTopMove = prevResult.bestMove !== "" && uci === prevResult.bestMove;
  const winPercentLoss = computeWinPercentLoss({
    color: move.color,
    evalBefore: prevResult.eval, mateBefore: prevResult.mate,
    evalAfter: afterResult.eval, mateAfter: afterResult.mate,
  });
  let classification = classifyMove({
    color: move.color,
    evalBefore: prevResult.eval, mateBefore: prevResult.mate,
    evalAfter: afterResult.eval, mateAfter: afterResult.mate,
    isTopMove, isForced, isBook, deliversMate, winPercentLoss,
  });
  if (classification === "best" && isTopMove &&
      detectBrilliant({ fenBefore, uci, prevResult, afterResult, color: move.color }))
    classification = "brilliant";
  // push MoveAnalysis: moveNumber, color, san, uci,
  //   evalBefore/mateBefore from prevResult, evalAfter/mateAfter from afterResult,
  //   winPercentLoss, depth: prevResult.depth,
  //   bestMove: prevResult.bestMove, bestMoveSan: uciToSan(fenBefore, prevResult.bestMove),
  //   classification,
  //   topLines: prevResult.lines.map(l => ({ moves: l.moves, eval: l.eval, mate: l.mate }))
  prevResult = afterResult;
  opts.onProgress?.(i + 1, moves.length);
}
```

6. `detectBrilliant` is a local function with defined behavior "no brilliants": `const detectBrilliant = (_: BrilliantInput): boolean => false;` with `export interface BrilliantInput { fenBefore: string; uci: string; prevResult: ParsedUciEval; afterResult: ParsedUciEval; color: "w" | "b" }` exported. **Brilliant detection is deferred out of this branch entirely** (see "Deferred" at the end of the plan) — the stub and interface stay so a follow-up is a drop-in; `"brilliant"` remaining in the union but unproduced matches today's status quo and every UI Record already renders it.
7. Finish: `const { white, black } = calculateGameAccuracy(analysis);` ratings via `accuracyToRating`; return the `GameAnalysis` with `version: ANALYSIS_VERSION` and `engine: { name: "stockfish-18-wasm", nodes, multiPv }`.
8. Delete the `export { accuracyToRating }` re-export; if `npm run typecheck` shows anyone imported it from `@/lib/analyze`, update that import to `@/lib/analysis-utils`.

- [ ] **Step 1: Failing test** (`src/lib/analyze.test.ts`) with a scripted fake engine:

```ts
import { describe, it, expect } from "vitest";
import { analyzeGame, type AnalysisEngine } from "./analyze";
import type { ParsedUciEval } from "./uci";

// Fake engine: returns a fixed white-relative eval per call, echoing a plausible shape.
function fakeEngine(script: Array<Partial<ParsedUciEval>>): AnalysisEngine {
  let call = 0;
  return {
    async init() {}, async newGame() {}, quit() {},
    async evaluateNodes() {
      const s = script[Math.min(call++, script.length - 1)];
      const base: ParsedUciEval = {
        eval: 15, mate: null, bestMove: "a2a3", depth: 20,
        lines: [{ multiPv: 1, eval: 15, mate: null, depth: 20, moves: ["a2a3"] }],
      };
      return { ...base, ...s };
    },
  };
}

describe("analyzeGame", () => {
  it("flat white-relative evals produce zero loss for BOTH colors", async () => {
    // 1. e4 e5 2. Nf3 Nc6 — fake engine says +15 at every position
    const result = await analyzeGame("1. e4 e5 2. Nf3 Nc6", { engine: fakeEngine([]) });
    expect(result.version).toBe(2);
    expect(result.moves).toHaveLength(4);
    for (const m of result.moves) expect(m.winPercentLoss).toBe(0);
    expect(result.whiteAccuracy).toBe(100);
    expect(result.blackAccuracy).toBe(100);
  });

  it("checkmating move is best and evals are terminal, engine not consulted", async () => {
    // Scholar's mate: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#";
    const result = await analyzeGame(pgn, { engine: fakeEngine([]) });
    const last = result.moves[result.moves.length - 1];
    expect(last.classification).toBe("best");
    expect(last.mateAfter).toBe(0);
    expect(last.evalAfter).toBe(100_000);
  });

  it("book moves are labeled book", async () => {
    const result = await analyzeGame("1. e4 e5", { engine: fakeEngine([]) });
    expect(result.moves[0].classification).toBe("book");
  });

  it("a huge eval drop by white is a blunder with mover-POV loss", async () => {
    // 6 positions: start, e4, e5, Nf3, Nc6, Na3 — the crash lands AFTER white's Na3
    const script = [
      {}, {}, {}, {}, {}, { eval: -500, bestMove: "b1c3" },
    ];
    const result = await analyzeGame("1. e4 e5 2. Nf3 Nc6 3. Na3", { engine: fakeEngine(script) });
    const m = result.moves[4];
    expect(m.color).toBe("w");
    expect(m.winPercentLoss).toBeGreaterThan(20);
    expect(m.classification).toBe("blunder");
  });
});
```

Note: `vitest.config.ts` already aliases `@` → `src`, so the `@/data/openings.json` dynamic import resolves in tests as-is (use `mod.default` from the JSON module) — no config edit needed or wanted.

- [ ] **Step 2:** `npx vitest run src/lib/analyze.test.ts` → FAIL.
- [ ] **Step 3:** Implement the rewrite per spec.
- [ ] **Step 4:** `npx vitest run src/lib` → all lib tests PASS.

---

### Task G: Client-side wiring + route removal

**Files:**
- Modify: `src/app/(app)/app/page.tsx:324-427` (analysis parse + `runAnalysis` + one guard in the queue effect)
- Modify: `src/app/api/games/[id]/analysis/route.ts` (validation)
- Delete: `src/app/api/games/[id]/analyze/route.ts`, `src/lib/server/engine.ts`
- Modify: `package.json:6` (postinstall: drop the two `.stockfish` lite copies; keep `public/stockfish` copies)
- Modify: `next.config.ts` (delete the `outputFileTracingIncludes` block for the deleted route — `next.config.ts:4-6`), `.gitignore` (drop `/.stockfish/`), `eslint.config.mjs:15` (drop the `.stockfish/**` ignore), `README.md:28,119` (server-side-analysis and postinstall descriptions)
- Modify: `scripts/capture-screenshots.mjs:64-65` (calls the deleted SSE route)

**Interfaces:**
- Consumes: `analyzeGame` + `AnalyzeOptions` from `@/lib/analyze` (Task F), `isCurrentAnalysis` + `ANALYSIS_VERSION` from `@/lib/engine` (Task B).
- Produces: nothing new; SSE protocol is gone.

**Spec:**
1. Analysis parse gate (page.tsx:325-327) becomes:

```ts
const analysis: GameAnalysis | null =
  activeGame?.analysis && isCurrentAnalysis(activeGame.analysis)
    ? activeGame.analysis
    : null;
```

Old v1 blobs therefore render as "not analyzed"; the Analyze button re-runs them. (Stale `whiteAccuracy`/`blackAccuracy` columns in the sidebar remain until re-analysis — accepted.)
2. `runAnalysis` drops the SSE fetch entirely: dynamic-import the pipeline (`const { analyzeGame } = await import("@/lib/analyze")` — keeps Stockfish/openings out of the initial bundle and off the server). Before starting, surface the download stage: `toast.info("Warming up Stockfish — first analysis downloads the engine (~113 MB)")` (fires every run; harmless when cached, honest when not). Run with `onProgress: (current, total) => { setAnalysisProgress(Math.round((current / total) * 100)); setActiveMove(current); }`, then persist:

```ts
const res = await fetch(`/api/games/${game.id}/analysis`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    analysis: result,
    whiteAccuracy: result.whiteAccuracy,
    blackAccuracy: result.blackAccuracy,
  }),
});
if (!res.ok) throw new Error("Failed to save analysis");
const updatedGame = (await res.json()) as Game;
if (useGameStore.getState().activeGame?.id === game.id) setActiveGame(updatedGame);
```

The `id` guard stops a background queued game's completion from yanking the user out of whatever they're viewing (`setActiveGame` forces `view: "review"` — `game-store.ts:36-37`). Keep the existing toast/error/finally structure.
3. **One guard in the queue processor** (page.tsx:399-423): do not dequeue while the user is in play mode — analysis and Bonzi would otherwise run two full single-threaded engines concurrently (Bonzi lags on a real clock; two 113 MB WASM instances risk tab death on mobile). Read the store's actual view literal for play mode (the deep link uses `?view=play-bonzi`; confirm the exact value in `src/stores/game-store.ts`) and add it to the effect's early-return condition + dependency array.
4. PUT route validation replaces the current loose check: reject 400 unless `analysis` is an object with `analysis.version === 2`, `Array.isArray(analysis.moves)`, and both accuracies are finite numbers in [0, 100]. (Plain checks, no new deps.)
5. Delete the two dead server files; remove `mkdir -p … .stockfish` and both `stockfish-18-lite-single.*` copy commands from postinstall (public/ copies stay). Clean the four config/doc leftovers listed in Files (next.config.ts, .gitignore, eslint.config.mjs, README).
6. `scripts/capture-screenshots.mjs`: replace the POST-and-drain-SSE block with a `PUT /api/games/${id}/analysis` of a synthetic v2 blob built inline from the game's PGN (replay with chess.js; every move `classification: "good"`, evals 0/`mate: null`, `winPercentLoss: 0`, `depth: 0`, empty `topLines`, accuracies 90/90, `version: 2`, `engine: { name: "synthetic", nodes: 0, multiPv: 0 }`) — screenshots need a populated review UI, not a real analysis. The PUT body must be `{ analysis, whiteAccuracy: 90, blackAccuracy: 90 }` — point 4's validation 400s without the top-level accuracies.
7. **Accepted tradeoff (documented, not built):** no partial persistence or resume — closing the tab mid-analysis loses the in-flight game and the in-memory queue (`game-store.ts` has no persist middleware). Each completed game persists at its own PUT; the deleted server route was strictly worse (60s cap, all-or-nothing).

- [ ] **Step 1:** Implement points 1–6.
- [ ] **Step 2:** `grep -rn "server/engine\|games/\\[id\\]/analyze\|id}/analyze\|\.stockfish" --exclude-dir=node_modules --exclude-dir=.next .` (the `id}/analyze` alternative catches the template-literal call sites in `page.tsx` and `capture-screenshots.mjs`; whole repo on purpose, not just `src/`). Expected: the ONLY remaining hits are inside `docs/superpowers/` (this plan/spec's own text). README's prose contains none of these literals, so re-read `README.md:28,119` manually to confirm the copy was updated.
- [ ] **Step 3:** `npm run typecheck` — expect remaining errors only in Task H's files; list them.

---

### Task H: UI consumers

**Files (deliberately minimal — the app UI is being redesigned on main in "part 2"; every avoided touch here is an avoided merge conflict):**
- Modify: `src/components/review/review-panel.tsx` (2 lines), `eval-bar.tsx`, `engine-panel.tsx`, `game-summary.tsx`, `eval-chart.tsx` (tooltip only), `src/components/review/move-badge.tsx` (one Record entry), `src/lib/bonzi/bonzi-engine.ts` (one switch case)
- Do NOT touch: `src/components/review/move-list.tsx` (no classification structures — forwards to MoveBadge), `src/components/chess/board-panel.tsx` (its switch has a muted-gray `default:` that handles `"forced"` exactly as desired), `src/components/practice/practice-view.tsx` (only `===` comparisons; filters stay mistake/blunder), `src/lib/bonzi/types.ts`, `src/lib/bonzi/quips.ts`

**Interfaces:**
- Consumes: `MoveAnalysis.mateAfter`, `.depth`, `.winPercentLoss`, `TopLine.mate`, `MoveClassification` incl. `"forced"` (Task B); `cpToWinPercent`, `formatEval`, `selectKeyMoments` (Task E).
- Produces: nothing consumed later.

**Spec:**
1. `review-panel.tsx:33-35`: `const mate = currentMoveAnalysis?.mateAfter ?? null;` (delete the hardcoded-null comment). Nothing else.
2. `eval-bar.tsx`: delete local `evalToWhitePercent` and local `formatEval`; use `cpToWinPercent` and `formatEval` from `@/lib/analysis-utils`. Bar percent when `mate !== null`: `mate > 0 → 100`, `mate < 0 → 0`, `mate === 0 → cp >= 0 ? 100 : 0`.
3. `engine-panel.tsx`: add `"forced"` to its `Record<MoveClassification, …>` (label "Forced", muted/slate style); depth line shows `currentMoveAnalysis.depth` (render `"—"` when 0/absent) instead of hardcoded 18; replace local eval formatting with shared `formatEval`; render each `topLines` entry (now up to 2) with its own eval/mate label.
4. `game-summary.tsx`: add `"forced"` to its `Record` (muted, excluded from headline counts like "good" today); key moments become `selectKeyMoments(moves)` and each renders its loss as `-XX% win chance` (delete `formatEvalSwing`).
5. `eval-chart.tsx`: tooltip only — it prints `m.evalAfter / 100` unclamped, which shows "+999.97" on mate folds; use `formatEval(m.evalAfter, m.mateAfter)` for the tooltip text. No Record change needed (`Partial<Record>` + Set — forced correctly gets no dot automatically). No y-value change (the ±5-pawn clamp already handles folds).
6. `move-badge.tsx`: add the `"forced"` entry to its `Record<MoveClassification, …>` (label "Forced", muted/slate).
7. `bonzi-engine.ts` `classificationToEvent`: `case "forced": return "review_book";` (calm reaction; leaves BonziEvent union and quips untouched).

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** `npm run typecheck` → **zero errors repo-wide** (H is the last TS-touching task).
- [ ] **Step 3:** `npm run lint` → clean for touched files.

---

### Task J: Full verification

**Files:** none created; runs after waves 1–3 are merged.

- [ ] **Step 1:** `npm run typecheck` → 0 errors.
- [ ] **Step 2:** `npm run test` → all pass (including the two pre-existing landing tests).
- [ ] **Step 3:** `npm run lint` → no new violations.
- [ ] **Step 4:** `npm run build` → succeeds (confirms the deleted server route/engine leave no dangling imports and `openings.json` bundles).
- [ ] **Step 5:** Report any failure verbatim; fixes route back to the owning task's files.

Real-engine browser smoke (analyze an imported game end-to-end, watch eval bar/labels) is a manual follow-up with the user — the worker needs a real browser.

---

## Deferred (explicitly out of this branch)

- **Brilliant detection.** Plan review showed the conservative 5-condition sacrifice gate still misfires on routine tactics (a piece landing on an attacked square that is tactically immune passes every condition), and the spec sanctions deferral. The pipeline ships `detectBrilliant → false` with the `BrilliantInput` interface fixed in Task F, so a follow-up branch — validated against real games, after the part-2 UI merge — is a drop-in. `"brilliant"` stays in the union unproduced (today's status quo; all UI Records render it).
- Partial persistence / resume of in-flight analysis (accepted tradeoff, Task G point 7).
- Nulling stale v1 accuracy columns (sidebar shows old numbers until a game is re-analyzed).
- Practice-mode eval-diff display: `practice-view.tsx:188-190` + `feedback-card.tsx:147` render mate folds as raw pawns ("+1005.0 pawns") for mistakes that allowed mate. Pre-existing behavior, both files owned by the part-2 UI redesign — fix there (use the stored `winPercentLoss` instead of the cp delta).
- Unsigned mate text ("M3") in the engine-panel top-lines list has no side cue — plan-sanctioned formatEval tradeoff; revisit in part 2 if confusing.

## Parallelization map

| Wave | Tasks | Why they can share a wave |
|---|---|---|
| 1 | A (`uci.ts`), B (`engine.ts` + play-view audit), D (openings) | Disjoint files. B codes against A's pinned signatures. |
| 2 | E (`analysis-utils.ts`), F (`analyze.ts`) | Disjoint files; F codes against E's pinned signatures. Both need B's types from wave 1. |
| 3 | G (page + API routes + configs + scripts), H (UI components + bonzi switch) | Disjoint files. |
| 4 | J (verification), then Fable final review | Sequential barrier. |

Main session commits after each wave once its step reviews are clean (plain 3–5-word messages, e.g. "uci parsing perspective fix", "client side analysis pipeline", "forced badge ui support").
