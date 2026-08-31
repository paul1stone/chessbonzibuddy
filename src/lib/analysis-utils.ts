/**
 * Pure analysis math: win probability, win%-loss, move classification,
 * accuracy, rating estimation, and small formatting/selection helpers.
 *
 * No browser or Node.js dependencies (chess.js works in both).
 *
 * Every eval in this module is white-relative centipawns with mate folded,
 * matching what `uci.ts` produces and what `MoveAnalysis` stores.
 */

import { Chess } from "chess.js";
import type { MoveAnalysis, MoveClassification } from "./engine";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Win probability
// ---------------------------------------------------------------------------

/** Logistic regression constant from Lichess (calibrated on real game data). */
const WIN_PERCENT_MULTIPLIER = -0.00368208;

/** Evals beyond ±10 pawns are all "winning"; clamping keeps the curve honest. */
const CP_CLAMP = 1000;

/**
 * Convert a centipawn evaluation (White's perspective) to White's win
 * probability percentage (0–100).
 */
export function cpToWinPercent(cp: number): number {
  const clamped = clamp(cp, -CP_CLAMP, CP_CLAMP);
  const winningChances =
    2 / (1 + Math.exp(WIN_PERCENT_MULTIPLIER * clamped)) - 1;
  return 50 + 50 * winningChances;
}

/**
 * White's win probability for an eval that may be a mate score.
 *
 * `mate === 0` means the position is already checkmate; the sign of `cp` says
 * who delivered it.
 */
export function winPercent(cp: number, mate: number | null): number {
  if (mate !== null) {
    if (mate > 0) return 100;
    if (mate < 0) return 0;
    return cp >= 0 ? 100 : 0;
  }
  return cpToWinPercent(cp);
}

/**
 * Win probability the mover gave up, 0–100, floored at 0.
 *
 * Improving your own position is never a "loss", so gains clamp to 0.
 */
export function computeWinPercentLoss(args: {
  color: "w" | "b";
  evalBefore: number;
  mateBefore: number | null;
  evalAfter: number;
  mateAfter: number | null;
}): number {
  const wpB = winPercent(args.evalBefore, args.mateBefore);
  const wpA = winPercent(args.evalAfter, args.mateAfter);
  return args.color === "w" ? Math.max(0, wpB - wpA) : Math.max(0, wpA - wpB);
}

// ---------------------------------------------------------------------------
// Move classification
// ---------------------------------------------------------------------------

export interface ClassifyContext {
  color: "w" | "b";
  /** White-relative eval and mate before the move */
  evalBefore: number;
  mateBefore: number | null;
  /** White-relative eval and mate after the move */
  evalAfter: number;
  mateAfter: number | null;
  isTopMove: boolean;
  isForced: boolean;
  isBook: boolean;
  deliversMate: boolean;
  /** Mover POV, from computeWinPercentLoss */
  winPercentLoss: number;
}

/**
 * Classify a move from win%-loss, with mate and book cases handled first.
 *
 * Win%-loss rather than raw centipawns makes the bands context-aware: giving
 * up 80cp when already +500 barely moves win%, but the same 80cp in an equal
 * position is an inaccuracy.
 */
export function classifyMove(ctx: ClassifyContext): MoveClassification {
  if (ctx.deliversMate) return "best";
  if (ctx.isForced) return "forced";
  if (ctx.isBook) return "book";

  // Mover POV: flip white-relative numbers for black.
  const sign = ctx.color === "w" ? 1 : -1;
  const mB = ctx.mateBefore === null ? null : sign * ctx.mateBefore;
  const mA = ctx.mateAfter === null ? null : sign * ctx.mateAfter;
  const cpB = sign * ctx.evalBefore;
  const cpA = sign * ctx.evalAfter;

  if (mB !== null && mB > 0) {
    // Had a forced mate.
    if (mA !== null && mA > 0) {
      // Still mating — a slower mate is never punished.
      return ctx.isTopMove || mA < mB ? "best" : "great";
    }
    if (mA === null) {
      // Mate lost; how bad depends on what is left.
      return cpA >= 999 ? "inaccuracy" : cpA >= 700 ? "mistake" : "blunder";
    }
    // Fell from mating into being mated.
    return "blunder";
  }

  if (mB === null && mA !== null && mA < 0) {
    // Allowed a mate; softer if the position was already lost.
    return cpB <= -999 ? "inaccuracy" : cpB <= -700 ? "mistake" : "blunder";
  }

  // mB < 0 (already being mated) falls through to the bands below.
  if (ctx.isTopMove) return "best";

  const l = ctx.winPercentLoss;
  if (l < 1) return "best";
  if (l < 3.5) return "great";
  if (l < 7) return "good";
  if (l < 10) return "inaccuracy";
  if (l < 20) return "mistake";
  return "blunder";
}

// ---------------------------------------------------------------------------
// Accuracy
// ---------------------------------------------------------------------------

/** Lichess `Cp.initial` — the assumed eval of the starting position. */
const INITIAL_CP = 15;

/** Per-move accuracy curve, plus lichess's +1 uncertainty bonus. */
function moveAccuracy(winPercentLoss: number): number {
  if (winPercentLoss <= 0) return 100;
  const raw =
    103.1668100711649 * Math.exp(-0.04354415386753951 * winPercentLoss) -
    3.166924740191411 +
    1;
  return clamp(raw, 0, 100);
}

/** Population standard deviation. */
function populationStddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Lichess-style per-colour accuracy over the whole game.
 *
 * Moves in volatile positions weigh more than moves in already-decided ones,
 * and the harmonic mean keeps a single blunder from being averaged away.
 * Takes every move of the game in order; a colour with no moves scores 100.
 */
export function calculateGameAccuracy(moves: MoveAnalysis[]): {
  white: number;
  black: number;
} {
  if (moves.length === 0) return { white: 100, black: 100 };

  // White-POV win% before each move, plus the position after the last one.
  const series = [cpToWinPercent(INITIAL_CP)];
  for (const m of moves) series.push(winPercent(m.evalAfter, m.mateAfter));

  // One window per move, not per series entry.
  const windowSize = clamp(Math.floor(moves.length / 10), 2, 8);
  const ws = Math.min(windowSize, series.length);

  const weights: number[] = [];
  const accuracies: number[] = [];
  for (let i = 0; i < moves.length; i++) {
    // Early moves reuse the first full window instead of a shrunken one.
    const window =
      i < ws - 2 ? series.slice(0, ws) : series.slice(i - (ws - 2), i + 2);
    weights.push(clamp(populationStddev(window), 0.5, 12));
    accuracies.push(moveAccuracy(moves[i].winPercentLoss));
  }

  const forColor = (color: "w" | "b"): number => {
    const indices = moves
      .map((m, i) => (m.color === color ? i : -1))
      .filter((i) => i >= 0);
    if (indices.length === 0) return 100;

    let weightedSum = 0;
    let totalWeight = 0;
    let reciprocalSum = 0;
    for (const i of indices) {
      weightedSum += accuracies[i] * weights[i];
      totalWeight += weights[i];
      reciprocalSum += 1 / Math.max(accuracies[i], 1);
    }
    const volWeighted = weightedSum / totalWeight;
    const harmonic = indices.length / reciprocalSum;
    return Math.round(((volWeighted + harmonic) / 2) * 10) / 10;
  };

  return { white: forColor("w"), black: forColor("b") };
}

// ---------------------------------------------------------------------------
// Performance rating
// ---------------------------------------------------------------------------

/**
 * Map an accuracy percentage to an approximate Elo rating ("played like").
 *
 * Reference points this curve actually produces:
 *   65% → ~1075,  75% → ~1350,  85% → ~1725,  90% → 2000,  95% → ~2425
 */
export function accuracyToRating(accuracy: number): number {
  const clamped = clamp(accuracy, 1, 99.5);
  const raw = 590 * Math.log(clamped / (100 - clamped)) + 700;
  const bounded = clamp(raw, 200, 2900);
  return Math.round(bounded / 25) * 25;
}

// ---------------------------------------------------------------------------
// Formatting and selection
// ---------------------------------------------------------------------------

/**
 * Render an eval for display: `"#"` for a delivered mate, `"M3"` for a forced
 * mate, otherwise signed pawns. Mate text carries no sign — the surrounding UI
 * conveys which side is mating.
 *
 * Anything that rounds to zero renders as a signless "0.0"; a "-0.0" or
 * "+0.0" eval bar reads as a real edge when there isn't one.
 */
export function formatEval(cp: number, mate: number | null): string {
  if (mate === 0) return "#";
  if (mate !== null) return `M${Math.abs(mate)}`;
  const pawns = (cp / 100).toFixed(1);
  if (pawns === "0.0" || pawns === "-0.0") return "0.0";
  return pawns.startsWith("-") ? pawns : `+${pawns}`;
}

/**
 * The `count` biggest win% losses of the game, returned in game order.
 *
 * Ordering is by array index, not `moveNumber` — that repeats across each
 * white/black pair.
 */
export function selectKeyMoments(
  moves: MoveAnalysis[],
  count = 5
): MoveAnalysis[] {
  return moves
    .map((move, index) => ({ move, index }))
    .sort((a, b) => b.move.winPercentLoss - a.move.winPercentLoss)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.move);
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
