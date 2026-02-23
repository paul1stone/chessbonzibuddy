/**
 * Shared analysis utility functions used by both client-side and server-side
 * analysis modules. These are pure functions with no browser or Node.js
 * dependencies (except chess.js which works in both environments).
 */

import { Chess } from "chess.js";
import type { MoveAnalysis, MoveClassification } from "./engine";

// ---------------------------------------------------------------------------
// Win probability conversion
// ---------------------------------------------------------------------------

/** Logistic regression constant from Lichess (calibrated on real game data). */
const WIN_PERCENT_MULTIPLIER = -0.00368208;

/**
 * Convert a centipawn evaluation (from White's perspective) to a win
 * probability percentage (0–100) for White.
 */
export function cpToWinPercent(cp: number): number {
  const clamped = Math.max(-10000, Math.min(10000, cp));
  const winningChances =
    2 / (1 + Math.exp(WIN_PERCENT_MULTIPLIER * clamped)) - 1;
  return 50 + 50 * winningChances;
}

// ---------------------------------------------------------------------------
// Move classification
// ---------------------------------------------------------------------------

/**
 * Classify a move based on how much **win probability** was lost.
 *
 * Using win% instead of raw centipawns means the classification is
 * context-aware: losing 80cp when already +500 barely changes win% (~3%,
 * "good"), but losing 80cp in an equal position is ~7% ("inaccuracy").
 */
export function classifyMove(
  winPercentLoss: number,
  isBest: boolean
): MoveClassification {
  if (isBest) return "best";
  if (winPercentLoss <= 2) return "great";
  if (winPercentLoss <= 5) return "good";
  if (winPercentLoss <= 10) return "inaccuracy";
  if (winPercentLoss <= 20) return "mistake";
  return "blunder";
}

// ---------------------------------------------------------------------------
// Accuracy
// ---------------------------------------------------------------------------

/**
 * Per-move accuracy: exponential decay on win% loss.
 */
function moveAccuracy(winDiff: number): number {
  if (winDiff <= 0) return 100;
  const raw =
    103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) -
    3.166924740191411;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Standard deviation of an array of numbers.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute accuracy with Lichess-style volatility weighting.
 *
 * Moves in contested positions (high win% variance in a sliding window)
 * count more than moves in already-decided positions where any move
 * maintains high win%.
 */
export function calculateAccuracy(moves: MoveAnalysis[]): number {
  if (moves.length === 0) return 100;

  // Build per-move win% from the moving player's perspective and accuracy
  const winPercents: number[] = [];
  const accuracies: number[] = [];

  for (const m of moves) {
    const wpBefore = cpToWinPercent(m.evalBefore);
    const wpAfter = cpToWinPercent(m.evalAfter);

    // Win% from the perspective of the player who moved
    const myWpBefore = m.color === "w" ? wpBefore : 100 - wpBefore;
    winPercents.push(myWpBefore);

    const winDiff =
      m.color === "w"
        ? wpBefore - wpAfter
        : (100 - wpBefore) - (100 - wpAfter);

    accuracies.push(moveAccuracy(winDiff));
  }

  // Sliding-window volatility weights (window size = 5 moves)
  const WINDOW = 5;
  const weights: number[] = [];

  for (let i = 0; i < moves.length; i++) {
    const start = Math.max(0, i - Math.floor(WINDOW / 2));
    const end = Math.min(moves.length, i + Math.ceil(WINDOW / 2) + 1);
    const windowWp = winPercents.slice(start, end);
    const vol = stddev(windowWp);
    // Clamp weight: minimum 0.5 (already-decided), max 12 (contested)
    weights.push(Math.max(0.5, Math.min(12, vol)));
  }

  // Volatility-weighted mean
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < accuracies.length; i++) {
    weightedSum += accuracies[i] * weights[i];
    totalWeight += weights[i];
  }
  const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Harmonic mean (penalizes low outliers)
  const positives = accuracies.filter((a) => a > 0);
  const harmonicMean =
    positives.length > 0
      ? positives.length / positives.reduce((sum, a) => sum + 1 / a, 0)
      : 0;

  // Blend: 60% volatility-weighted, 40% harmonic
  const blended = weightedMean * 0.6 + harmonicMean * 0.4;
  return Math.round(blended * 10) / 10;
}

// ---------------------------------------------------------------------------
// Performance rating
// ---------------------------------------------------------------------------

/**
 * Map an accuracy percentage to an approximate Elo rating ("played like").
 *
 * Calibrated reference points (Chess.com approximate):
 *   50% → ~700,  65% → ~1000,  75% → ~1300,  85% → ~1700,
 *   90% → ~2000, 95% → ~2500,  98% → ~2800
 */
export function accuracyToRating(accuracy: number): number {
  const clamped = Math.max(1, Math.min(99.5, accuracy));
  const raw = 590 * Math.log(clamped / (100 - clamped)) + 700;
  const bounded = Math.max(200, Math.min(2900, raw));
  return Math.round(bounded / 25) * 25;
}

// ---------------------------------------------------------------------------
// UCI -> SAN helper
// ---------------------------------------------------------------------------

/**
 * Convert a UCI move string (e.g. "e2e4") to standard algebraic notation
 * (e.g. "e4") given the FEN of the position before the move.
 */
export function uciToSan(fen: string, uci: string): string {
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
