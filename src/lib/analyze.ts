/**
 * Client-side game analysis using Stockfish WASM in a Web Worker.
 * Browser-only — never import this on the server side.
 */

import { Chess } from "chess.js";
import { StockfishEngine, type GameAnalysis, type MoveAnalysis } from "./engine";
import {
  cpToWinPercent,
  classifyMove,
  calculateAccuracy,
  accuracyToRating,
  uciToSan,
} from "./analysis-utils";

export { accuracyToRating } from "./analysis-utils";

export async function analyzeGame(
  pgn: string,
  depth = 18,
  onProgress?: (current: number, total: number) => void
): Promise<GameAnalysis> {
  const gameFull = new Chess();
  gameFull.loadPgn(pgn);
  const moves = gameFull.history({ verbose: true });

  if (moves.length === 0) {
    return { moves: [], whiteAccuracy: 100, blackAccuracy: 100, whiteRating: 0, blackRating: 0 };
  }

  const engine = new StockfishEngine();
  await engine.init();

  try {
    const analysis: MoveAnalysis[] = [];
    const replay = new Chess();

    // Evaluate starting position — reuse each afterResult as the next
    // move's "before" evaluation to cut total evals roughly in half.
    let prevResult = await engine.evaluate(replay.fen(), depth);

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fenBefore = replay.fen();
      const evalBefore = prevResult.eval;
      const bestMove = prevResult.bestMove;
      const bestPv = prevResult.pv;

      replay.move(move.san);
      const afterResult = await engine.evaluate(replay.fen(), depth);
      const evalAfter = afterResult.eval;

      const bestMoveSan = uciToSan(fenBefore, bestMove);
      const isPlayedBest =
        move.from + move.to + (move.promotion ?? "") === bestMove;
      const wpBefore = cpToWinPercent(evalBefore);
      const wpAfter = cpToWinPercent(evalAfter);
      const winPercentLoss =
        move.color === "w"
          ? Math.max(0, wpBefore - wpAfter)
          : Math.max(0, (100 - wpBefore) - (100 - wpAfter));
      const classification = classifyMove(winPercentLoss, isPlayedBest);

      analysis.push({
        moveNumber: Math.floor(i / 2) + 1,
        color: move.color,
        san: move.san,
        uci: move.from + move.to + (move.promotion ?? ""),
        evalBefore,
        evalAfter,
        bestMove,
        bestMoveSan,
        classification,
        topLines: bestPv.length > 0
          ? [{ moves: bestPv, eval: evalBefore }]
          : [],
      });

      prevResult = afterResult;
      onProgress?.(i + 1, moves.length);
    }

    const whiteMoves = analysis.filter((m) => m.color === "w");
    const blackMoves = analysis.filter((m) => m.color === "b");
    const whiteAccuracy = calculateAccuracy(whiteMoves);
    const blackAccuracy = calculateAccuracy(blackMoves);

    return {
      moves: analysis,
      whiteAccuracy,
      blackAccuracy,
      whiteRating: accuracyToRating(whiteAccuracy),
      blackRating: accuracyToRating(blackAccuracy),
    };
  } finally {
    engine.quit();
  }
}
