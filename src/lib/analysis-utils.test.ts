import { describe, it, expect } from "vitest";
import {
  cpToWinPercent,
  winPercent,
  classifyMove,
  computeWinPercentLoss,
  calculateGameAccuracy,
  accuracyToRating,
  uciToSan,
  formatEval,
  selectKeyMoments,
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
    expect(winPercent(100_000, 0)).toBe(100); // white delivered mate
    expect(winPercent(-100_000, 0)).toBe(0);
  });
});

const base = {
  color: "w" as const,
  evalBefore: 0,
  mateBefore: null,
  evalAfter: 0,
  mateAfter: null,
  isTopMove: false,
  isForced: false,
  isBook: false,
  deliversMate: false,
  winPercentLoss: 0,
};

describe("classifyMove", () => {
  it("checkmating move is best, never blunder", () =>
    expect(
      classifyMove({ ...base, deliversMate: true, winPercentLoss: 100 })
    ).toBe("best"));
  it("forced and book precede bands", () => {
    expect(classifyMove({ ...base, isForced: true, winPercentLoss: 30 })).toBe(
      "forced"
    );
    expect(classifyMove({ ...base, isBook: true, winPercentLoss: 8 })).toBe(
      "book"
    );
  });
  it("slower forced mate is never punished", () =>
    expect(
      classifyMove({
        ...base,
        mateBefore: 3,
        mateAfter: 5,
        evalBefore: 99_997,
        evalAfter: 99_995,
      })
    ).toBe("great"));
  it("losing a mate while still winning is softened", () =>
    expect(
      classifyMove({
        ...base,
        mateBefore: 2,
        mateAfter: null,
        evalBefore: 99_998,
        evalAfter: 1200,
      })
    ).toBe("inaccuracy"));
  it("allowing mate from an equal position is a blunder", () =>
    expect(
      classifyMove({
        ...base,
        mateAfter: -4,
        evalAfter: -99_996,
        winPercentLoss: 50,
      })
    ).toBe("blunder"));
  it("black POV: mate for black is not a black blunder", () =>
    expect(
      classifyMove({
        ...base,
        color: "b",
        mateBefore: -3,
        mateAfter: -2,
        evalBefore: -99_997,
        evalAfter: -99_998,
        isTopMove: true,
      })
    ).toBe("best"));
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
  expect(
    computeWinPercentLoss({
      color: "w",
      evalBefore: 0,
      mateBefore: null,
      evalAfter: -100,
      mateAfter: null,
    })
  ).toBeCloseTo(9.1, 0);
  expect(
    computeWinPercentLoss({
      color: "b",
      evalBefore: 0,
      mateBefore: null,
      evalAfter: -100,
      mateAfter: null,
    })
  ).toBe(0); // black improved, no loss
});

function mv(over: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    moveNumber: 1,
    color: "w",
    san: "e4",
    uci: "e2e4",
    evalBefore: 15,
    mateBefore: null,
    evalAfter: 15,
    mateAfter: null,
    winPercentLoss: 0,
    depth: 20,
    bestMove: "e2e4",
    bestMoveSan: "e4",
    classification: "best",
    topLines: [],
    ...over,
  };
}

describe("calculateGameAccuracy", () => {
  it("perfect play on both sides is 100/100", () => {
    const moves = Array.from({ length: 20 }, (_, i) =>
      mv({ color: i % 2 === 0 ? "w" : "b", winPercentLoss: 0 })
    );
    expect(calculateGameAccuracy(moves)).toEqual({ white: 100, black: 100 });
  });
  it("a blundering side scores clearly lower", () => {
    const moves = Array.from({ length: 20 }, (_, i) =>
      mv({
        color: i % 2 === 0 ? "w" : "b",
        winPercentLoss: i % 2 === 0 ? 20 : 0,
      })
    );
    expect(calculateGameAccuracy(moves)).toEqual({ white: 41, black: 100 });
  });
  /**
   * 40 alternating-colour moves whose evals swing across 0 with varying
   * magnitude, driving `swings` through the eval series and `losses` through
   * the accuracy curve. `windowSize` clamps to 4, so the first-full-window
   * padding is live for i = 0..2 (identical weights) and diverges at i = 3.
   */
  function volatileGame(swings: number[]): MoveAnalysis[] {
    const whiteLosses = [0, 4, 18, 1, 33];
    const blackLosses = [2, 0, 7, 0.5, 11];
    return Array.from({ length: 40 }, (_, i) => {
      const color = i % 2 === 0 ? ("w" as const) : ("b" as const);
      const losses = color === "w" ? whiteLosses : blackLosses;
      return mv({
        color,
        evalAfter: swings[i % swings.length],
        winPercentLoss: losses[Math.floor(i / 2) % losses.length],
      });
    });
  }

  it("weights volatile positions above decided ones", () => {
    // Weights span 5.85–10.31 here: every one is set by the window, none by
    // the [0.5, 12] clamp, so this pins the window slicing and the padding.
    const moves = volatileGame([40, -60, 120, -30, 150, -90, 60, 15, -200, 100]);
    expect(calculateGameAccuracy(moves)).toEqual({ white: 59.6, black: 82.9 });
  });

  it("caps the weight of wildly swinging positions", () => {
    // Same losses, larger swings: the sharpest windows saturate at the 12
    // ceiling while calmer ones stay below it, so the clamp changes the result.
    const moves = volatileGame([40, -60, 120, -30, 250, -180, 90, 15, -400, 300]);
    expect(calculateGameAccuracy(moves)).toEqual({ white: 59.6, black: 83 });
  });
  it("an empty game is 100/100", () => {
    expect(calculateGameAccuracy([])).toEqual({ white: 100, black: 100 });
  });
  it("a color with no moves scores 100", () => {
    expect(calculateGameAccuracy([mv({ color: "w", winPercentLoss: 0 })])).toEqual(
      { white: 100, black: 100 }
    );
  });
});

it("accuracyToRating hits its documented anchors", () => {
  expect(accuracyToRating(90)).toBe(2000);
  expect(accuracyToRating(65)).toBe(1075);
  expect(accuracyToRating(75)).toBe(1350);
  expect(accuracyToRating(85)).toBe(1725);
  expect(accuracyToRating(95)).toBe(2425);
});

it("uciToSan converts and degrades gracefully", () => {
  const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  expect(uciToSan(start, "e2e4")).toBe("e4");
  expect(uciToSan(start, "")).toBe("");
  expect(uciToSan(start, "(none)")).toBe("");
  expect(uciToSan(start, "e2e5")).toBe("e2e5"); // illegal, returned as-is
});

it("formatEval covers cp, mate, and terminal mate", () => {
  expect(formatEval(35, null)).toBe("+0.3");
  expect(formatEval(0, null)).toBe("0.0");
  expect(formatEval(-120, null)).toBe("-1.2");
  expect(formatEval(99_997, 3)).toBe("M3");
  expect(formatEval(-99_998, -2)).toBe("M2");
  expect(formatEval(100_000, 0)).toBe("#");
});

it("formatEval renders anything rounding to zero without a sign", () => {
  expect(formatEval(-4, null)).toBe("0.0"); // not "-0.0"
  expect(formatEval(4, null)).toBe("0.0"); // symmetric: not "+0.0"
  expect(formatEval(0, null)).toBe("0.0");
  expect(formatEval(5, null)).toBe("+0.1"); // first nonzero step still signed
  expect(formatEval(-5, null)).toBe("-0.1");
});

it("selectKeyMoments takes top losses in game order", () => {
  const moves = [5, 30, 2, 45, 10, 25].map((loss, i) =>
    mv({ moveNumber: i + 1, winPercentLoss: loss })
  );
  const picked = selectKeyMoments(moves, 3);
  expect(picked.map((m) => m.winPercentLoss)).toEqual([30, 45, 25]); // chronological
});
