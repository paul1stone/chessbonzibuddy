/**
 * Game analysis functions that use the Stockfish engine wrapper.
 *
 * This module is browser-only. It relies on {@link StockfishEngine} which
 * creates a Web Worker internally. Never import this on the server side.
 */

import { Chess } from "chess.js";
import {
  StockfishEngine,
  type GameAnalysis,
  type MoveAnalysis,
  type MoveClassification,
} from "./engine";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse every move of a PGN game using Stockfish.
 *
 * @param pgn        - Full PGN text (including headers) of the game.
 * @param depth      - Engine search depth per position. Default 18.
 * @param onProgress - Optional callback invoked after each move is evaluated.
 *                     Receives `(currentMove, totalMoves)`.
 * @returns A {@link GameAnalysis} containing per-move evaluations and
 *          accuracy scores for both sides.
 */
export async function analyzeGame(
  pgn: string,
  depth = 18,
  onProgress?: (current: number, total: number) => void
): Promise<GameAnalysis> {
  // ------------------------------------------------------------------
  // 1. Parse the PGN to extract the list of moves
  // ------------------------------------------------------------------
  const gameFull = new Chess();
  gameFull.loadPgn(pgn);
  const moves = gameFull.history({ verbose: true });

  if (moves.length === 0) {
    return { moves: [], whiteAccuracy: 100, blackAccuracy: 100 };
  }

  // ------------------------------------------------------------------
  // 2. Initialise the engine
  // ------------------------------------------------------------------
  const engine = new StockfishEngine();
  await engine.init();

  try {
    // ------------------------------------------------------------------
    // 3. Replay the game move-by-move, evaluating each position
    // ------------------------------------------------------------------
    const analysis: MoveAnalysis[] = [];
    const replay = new Chess(); // starts at the initial position

    // Evaluate the starting position to get the baseline eval.
    let prevEval = (await engine.evaluate(replay.fen(), depth)).eval;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fenBefore = replay.fen();
      const evalBefore = prevEval;

      // --- Find the engine's best move BEFORE this move is played ---
      const bestResult = await engine.evaluate(fenBefore, depth);

      // Play the actual move
      replay.move(move.san);

      // --- Evaluate the position AFTER the move is played ---
      const afterResult = await engine.evaluate(replay.fen(), depth);
      const evalAfter = afterResult.eval;

      // --- Convert best move from UCI to SAN ---
      const bestMoveSan = uciToSan(fenBefore, bestResult.bestMove);

      // --- Classify the move ---
      const isPlayedBest = move.from + move.to + (move.promotion ?? "") === bestResult.bestMove;
      const evalDiff = calculateEvalDifference(evalBefore, evalAfter, move.color);
      const classification = classifyMove(evalDiff, isPlayedBest);

      analysis.push({
        moveNumber: Math.floor(i / 2) + 1,
        color: move.color,
        san: move.san,
        uci: move.from + move.to + (move.promotion ?? ""),
        evalBefore,
        evalAfter,
        bestMove: bestResult.bestMove,
        bestMoveSan,
        classification,
        topLines: bestResult.pv.length > 0
          ? [{ moves: bestResult.pv, eval: bestResult.eval }]
          : [],
      });

      prevEval = evalAfter;
      onProgress?.(i + 1, moves.length);
    }

    // ------------------------------------------------------------------
    // 4. Calculate accuracy
    // ------------------------------------------------------------------
    const whiteMoves = analysis.filter((m) => m.color === "w");
    const blackMoves = analysis.filter((m) => m.color === "b");

    return {
      moves: analysis,
      whiteAccuracy: calculateAccuracy(whiteMoves),
      blackAccuracy: calculateAccuracy(blackMoves),
    };
  } finally {
    engine.quit();
  }
}

// ---------------------------------------------------------------------------
// Move classification
// ---------------------------------------------------------------------------

/**
 * Classify a move based on how much evaluation was lost compared to the
 * engine's best line.
 *
 * @param evalDiff  - Centipawn loss for the side that moved (always >= 0).
 * @param isBest    - Whether the played move matches the engine's top choice.
 */
function classifyMove(
  evalDiff: number,
  isBest: boolean
): MoveClassification {
  if (isBest) return "best";
  if (evalDiff <= 10) return "great"; // within 0.10 pawns
  if (evalDiff <= 30) return "good"; // within 0.30 pawns
  if (evalDiff <= 80) return "inaccuracy"; // 0.30 - 0.80 pawns
  if (evalDiff <= 200) return "mistake"; // 0.80 - 2.00 pawns
  return "blunder"; // > 2.00 pawns
}

// ---------------------------------------------------------------------------
// Eval difference
// ---------------------------------------------------------------------------

/**
 * Calculate how much centipawn value the moving side lost with this move.
 *
 * For White a drop in eval is bad; for Black a rise in eval is bad.
 * The returned value is always >= 0 (higher = worse move).
 */
function calculateEvalDifference(
  evalBefore: number,
  evalAfter: number,
  color: "w" | "b"
): number {
  if (color === "w") {
    // White wants eval to stay the same or go up.
    return Math.max(0, evalBefore - evalAfter);
  }
  // Black wants eval to stay the same or go down (more negative).
  return Math.max(0, evalAfter - evalBefore);
}

// ---------------------------------------------------------------------------
// Accuracy
// ---------------------------------------------------------------------------

/**
 * Compute a Chess.com-style accuracy percentage from a list of moves.
 *
 * Uses an exponential decay model:
 *   per-move accuracy = max(0, 103.1668 * e^(-0.04354 * |cpLoss|) - 3.1668)
 *
 * The overall accuracy is the mean of per-move accuracies, rounded to one
 * decimal place.
 */
function calculateAccuracy(moves: MoveAnalysis[]): number {
  if (moves.length === 0) return 100;

  const total = moves.reduce((sum, m) => {
    const diff = Math.abs(
      m.color === "w"
        ? m.evalBefore - m.evalAfter
        : m.evalAfter - m.evalBefore
    );
    const accuracy = Math.max(
      0,
      103.1668 * Math.exp(-0.04354 * diff) - 3.1668
    );
    return sum + accuracy;
  }, 0);

  return Math.round((total / moves.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// UCI -> SAN helper
// ---------------------------------------------------------------------------

/**
 * Convert a UCI move string (e.g. "e2e4") to standard algebraic notation
 * (e.g. "e4") given the FEN of the position before the move.
 *
 * Returns the UCI string unchanged if conversion fails.
 */
function uciToSan(fen: string, uci: string): string {
  if (!uci || uci === "(none)") return "";

  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const result = chess.move({ from, to, promotion });
    return result?.san ?? uci;
  } catch {
    return uci;
  }
}
