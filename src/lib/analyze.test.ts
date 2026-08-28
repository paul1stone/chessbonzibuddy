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
