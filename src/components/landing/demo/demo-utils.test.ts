import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { DEMO, demoPositions, worstLossIndex } from "./demo-utils";

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

describe("demoPositions", () => {
  it("returns one position per move plus the final position", () => {
    expect(demoPositions()).toHaveLength(DEMO.analysis.moves.length + 1);
  });

  it("lines each position up with the move played from it", () => {
    const positions = demoPositions();
    DEMO.analysis.moves.forEach((move, i) => {
      const chess = new Chess(positions[i]);
      const played = chess.move(move.san);
      expect(played.from + played.to + (played.promotion ?? "")).toBe(move.uci);
      expect(chess.fen()).toBe(positions[i + 1]);
    });
  });
});

describe("the fixture", () => {
  it("has parseable uci for every played and best move", () => {
    for (const move of DEMO.analysis.moves) {
      expect(move.uci).toMatch(UCI);
      expect(move.bestMove).toMatch(UCI);
    }
  });
});

describe("worstLossIndex", () => {
  it("picks a black mistake or blunder the engine would have played differently", () => {
    const move = DEMO.analysis.moves[worstLossIndex()];
    expect(move.color).toBe("b");
    expect(["mistake", "blunder"]).toContain(move.classification);
    expect(move.uci).not.toBe(move.bestMove);
  });

  it("picks the biggest such loss", () => {
    const candidates = DEMO.analysis.moves.filter(
      (m) =>
        m.color === "b" &&
        (m.classification === "mistake" || m.classification === "blunder") &&
        m.uci !== m.bestMove
    );
    expect(candidates.length).toBeGreaterThan(0);
    const max = Math.max(...candidates.map((m) => m.winPercentLoss));
    expect(DEMO.analysis.moves[worstLossIndex()].winPercentLoss).toBe(max);
  });

  it("lands on a puzzle whose answer is legal in its position", () => {
    const index = worstLossIndex();
    const move = DEMO.analysis.moves[index];
    const chess = new Chess(demoPositions()[index]);
    const best = chess.move({
      from: move.bestMove.slice(0, 2),
      to: move.bestMove.slice(2, 4),
      promotion: move.bestMove.slice(4) || undefined,
    });
    expect(best.san).toBe(move.bestMoveSan);
  });
});
