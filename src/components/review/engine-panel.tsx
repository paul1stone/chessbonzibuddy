"use client";

import type { MoveAnalysis } from "@/lib/engine";
import { EvalBar } from "@/components/review/eval-bar";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { formatEval } from "@/lib/analysis-utils";

interface EnginePanelProps {
  currentMoveAnalysis: MoveAnalysis | null;
  eval: number;
  mate: number | null;
}

export function EnginePanel({
  currentMoveAnalysis,
  eval: evaluation,
  mate,
}: EnginePanelProps) {
  if (!currentMoveAnalysis) {
    return (
      <div className="r-bevel-in flex items-center justify-center bg-[var(--r-face-light)] px-4 py-12">
        <p className="text-sm text-muted-foreground">
          Select a move to see engine analysis
        </p>
      </div>
    );
  }

  const { bestMoveSan, classification, topLines } = currentMoveAnalysis;
  const classColor = CLASSIFICATION_COLORS[classification];

  return (
    <div className="r-bevel-in flex gap-4 bg-[var(--r-face-light)] p-3">
      {/* Left: Eval Bar */}
      <EvalBar eval={evaluation} mate={mate} height={240} />

      {/* Right: Analysis details */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Evaluation */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Evaluation
          </p>
          <p className="text-2xl font-bold text-foreground">
            {formatEval(evaluation, mate)}
          </p>
        </div>

        {/* Best move */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Best move
          </p>
          <span
            className="r-badge mt-1 font-semibold"
            style={{ background: "#008000" }}
          >
            {bestMoveSan}
          </span>
        </div>

        {/* Classification */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Classification
          </p>
          <span
            className="r-badge mt-1"
            style={{ background: classColor.hex }}
          >
            {classColor.label}
          </span>
        </div>

        {/* Top lines */}
        {topLines.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Top lines
            </p>
            <div className="mt-1 flex flex-col gap-1">
              {topLines.map((line, idx) => (
                <div key={idx} className="flex items-baseline gap-2 text-xs">
                  <span className="shrink-0 font-mono font-semibold text-foreground">
                    {formatEval(line.eval, line.mate)}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {line.moves.join(" ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Depth */}
        <p className="mt-auto text-xs text-muted-foreground">
          Depth: {currentMoveAnalysis.depth || "-"}
        </p>
      </div>
    </div>
  );
}
