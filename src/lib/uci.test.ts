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
