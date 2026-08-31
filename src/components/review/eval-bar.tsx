"use client";

import { formatEval, winPercent } from "@/lib/analysis-utils";
import { cn } from "@/lib/utils";

interface EvalBarProps {
  /** Evaluation in centipawns (positive = white advantage) */
  eval: number;
  /** Moves to mate, or null if no forced mate */
  mate: number | null;
  /** Bar height in pixels */
  height?: number;
}

export function EvalBar({ eval: evaluation, mate, height = 400 }: EvalBarProps) {
  const whitePercent = winPercent(evaluation, mate);

  const blackPercent = 100 - whitePercent;
  const evalText = formatEval(evaluation, mate);

  // Pin the label to the leading side's end of the bar. A mate saturates one
  // section to zero height, so the label can't live inside either one.
  const labelOnWhite = whitePercent >= 50;

  return (
    <div
      className="relative w-8 flex-shrink-0 overflow-hidden rounded-md"
      style={{ height }}
    >
      {/* Black section (top) */}
      <div
        className="absolute top-0 left-0 right-0 bg-purple-800 transition-all duration-300"
        style={{ height: `${blackPercent}%` }}
      />

      {/* White section (bottom) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-purple-100 transition-all duration-300"
        style={{ height: `${whitePercent}%` }}
      />

      {/* Eval label, overlaying both sections */}
      <div
        className={cn(
          "absolute right-0 left-0 flex justify-center py-1.5",
          labelOnWhite ? "bottom-0" : "top-0"
        )}
      >
        <span
          className={cn(
            "text-[10px] font-bold leading-none",
            "writing-mode-vertical [writing-mode:vertical-rl] rotate-180",
            labelOnWhite ? "text-purple-900" : "text-white"
          )}
        >
          {evalText}
        </span>
      </div>
    </div>
  );
}
