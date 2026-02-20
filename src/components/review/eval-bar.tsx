"use client";

import { cn } from "@/lib/utils";

interface EvalBarProps {
  /** Evaluation in centipawns (positive = white advantage) */
  eval: number;
  /** Moves to mate, or null if no forced mate */
  mate: number | null;
  /** Bar height in pixels */
  height?: number;
}

/**
 * Map a centipawn evaluation to a white-percentage using a sigmoid-like curve.
 *
 * - eval =    0 -> 50%
 * - eval = +500 -> ~90%
 * - eval = -500 -> ~10%
 */
function evalToWhitePercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-cp / 250)) - 1);
}

/** Format an evaluation for display. */
function formatEval(cp: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `M${mate}` : `M${mate}`;
  }
  const pawns = cp / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export function EvalBar({ eval: evaluation, mate, height = 400 }: EvalBarProps) {
  // Compute white percentage of the bar
  const whitePercent =
    mate !== null
      ? mate > 0
        ? 100 // White is winning (mate in N)
        : 0 // Black is winning (mate in -N)
      : evalToWhitePercent(evaluation);

  const blackPercent = 100 - whitePercent;
  const evalText = formatEval(evaluation, mate);

  // Show the text on whichever side is smaller so it stays visible
  const showTextOnWhite = whitePercent <= 50;

  return (
    <div
      className="relative w-8 flex-shrink-0 overflow-hidden rounded-md"
      style={{ height }}
    >
      {/* Black section (top) */}
      <div
        className="absolute top-0 left-0 right-0 bg-zinc-800 transition-all duration-300"
        style={{ height: `${blackPercent}%` }}
      >
        {!showTextOnWhite && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-[10px] font-bold leading-none text-white",
                "writing-mode-vertical [writing-mode:vertical-rl] rotate-180"
              )}
            >
              {evalText}
            </span>
          </div>
        )}
      </div>

      {/* White section (bottom) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-100 transition-all duration-300"
        style={{ height: `${whitePercent}%` }}
      >
        {showTextOnWhite && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-[10px] font-bold leading-none text-zinc-800",
                "writing-mode-vertical [writing-mode:vertical-rl] rotate-180"
              )}
            >
              {evalText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
