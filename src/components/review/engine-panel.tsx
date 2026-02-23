"use client";

import type { MoveAnalysis, MoveClassification } from "@/lib/engine";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvalBar } from "@/components/review/eval-bar";
import { cn } from "@/lib/utils";

interface EnginePanelProps {
  currentMoveAnalysis: MoveAnalysis | null;
  eval: number;
  mate: number | null;
}

/** Classification colour mapping for badges */
const classificationColors: Record<
  MoveClassification,
  { bg: string; text: string; label: string }
> = {
  brilliant: { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Brilliant" },
  great: { bg: "bg-green-500/20", text: "text-green-400", label: "Great" },
  best: { bg: "bg-green-500/20", text: "text-green-400", label: "Best" },
  good: { bg: "bg-purple-500/20", text: "text-purple-300", label: "Good" },
  book: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Book" },
  inaccuracy: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Inaccuracy" },
  mistake: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Mistake" },
  blunder: { bg: "bg-red-500/20", text: "text-red-400", label: "Blunder" },
};

function formatEval(cp: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `M${mate}` : `M${mate}`;
  }
  const pawns = cp / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

function formatLineEval(evalCp: number): string {
  const pawns = evalCp / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export function EnginePanel({
  currentMoveAnalysis,
  eval: evaluation,
  mate,
}: EnginePanelProps) {
  if (!currentMoveAnalysis) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex h-full items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Select a move to see engine analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  const { bestMoveSan, classification, topLines } = currentMoveAnalysis;
  const classStyle = classificationColors[classification];

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex gap-4 py-4">
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
            <span className="inline-block rounded bg-green-500/20 px-2 py-0.5 text-sm font-semibold text-green-400">
              {bestMoveSan}
            </span>
          </div>

          {/* Classification */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Classification
            </p>
            <Badge
              variant="ghost"
              className={cn(
                classStyle.bg,
                classStyle.text,
                "mt-1 border-0 px-2 py-0.5 text-xs"
              )}
            >
              {classStyle.label}
            </Badge>
          </div>

          {/* Top lines */}
          {topLines.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top lines
              </p>
              <div className="mt-1 flex flex-col gap-1">
                {topLines.slice(0, 3).map((line, idx) => (
                  <div key={idx} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 font-mono font-semibold text-foreground">
                      {formatLineEval(line.eval)}
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
            Depth: {currentMoveAnalysis.moveNumber > 0 ? 18 : "---"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
