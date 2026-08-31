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
      className="r-bevel-in w-8 flex-shrink-0 bg-[var(--r-face)] p-[2px]"
      style={{ height }}
    >
      {/* Absolute children anchor to this inner box, so the 2px frame stays visible. */}
      <div className="relative h-full w-full overflow-hidden">
      {/* Black section (top) */}
      <div
        className="absolute top-0 left-0 right-0 bg-[#2b2b2b] transition-all duration-300"
        style={{ height: `${blackPercent}%` }}
      />

      {/* White section (bottom) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#f0e6d2] transition-all duration-300"
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
            labelOnWhite ? "text-[#2b2b2b]" : "text-[#f0e6d2]"
          )}
        >
          {evalText}
        </span>
      </div>
      </div>
    </div>
  );
}
