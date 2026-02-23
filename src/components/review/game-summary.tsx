"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccuracyRing } from "./accuracy-ring";
import { EvalChart } from "./eval-chart";
import { MoveBadge } from "./move-badge";
import type { MoveAnalysis, MoveClassification } from "@/lib/engine";

interface GameSummaryProps {
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteRating?: number;
  blackRating?: number;
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
}

/** Classification badge color mapping (mirrors move-badge.tsx). */
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

/** The classifications we display in the summary counts. */
const displayClassifications: MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "blunder",
  "mistake",
  "inaccuracy",
];

interface ClassificationCount {
  classification: MoveClassification;
  count: number;
}

interface KeyMoment {
  index: number;
  move: MoveAnalysis;
  evalSwing: number; // absolute centipawn swing
}

export function GameSummary({
  moves,
  whiteAccuracy,
  blackAccuracy,
  whiteRating,
  blackRating,
  currentMove,
  onMoveClick,
}: GameSummaryProps) {
  // Count classifications per player
  const whiteCounts = useMemo(() => countClassifications(moves, "w"), [moves]);
  const blackCounts = useMemo(() => countClassifications(moves, "b"), [moves]);

  // Find key moments (biggest eval swings)
  const keyMoments = useMemo(() => getKeyMoments(moves, 5), [moves]);

  return (
    <div className="flex flex-col gap-6">
      {/* Accuracy section */}
      <Card className="border-purple-800 bg-purple-900/50">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm text-purple-300">Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <AccuracyRing
                accuracy={whiteAccuracy}
                label="White"
                color="stroke-purple-100"
                size={100}
              />
              {whiteRating != null && (
                <span className="mt-1 rounded-md bg-purple-800 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                  Played like ~{whiteRating}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <AccuracyRing
                accuracy={blackAccuracy}
                label="Black"
                color="stroke-purple-300"
                size={100}
              />
              {blackRating != null && (
                <span className="mt-1 rounded-md bg-purple-800 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                  Played like ~{blackRating}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Move classification counts */}
      <Card className="border-purple-800 bg-purple-900/50">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm text-purple-300">
            Move Classifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* White */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-purple-200">White</p>
              <div className="flex flex-wrap gap-1.5">
                {whiteCounts.map((c) => (
                  <ClassificationBadge
                    key={c.classification}
                    classification={c.classification}
                    count={c.count}
                  />
                ))}
                {whiteCounts.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No notable moves
                  </span>
                )}
              </div>
            </div>
            {/* Black */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-purple-200">Black</p>
              <div className="flex flex-wrap gap-1.5">
                {blackCounts.map((c) => (
                  <ClassificationBadge
                    key={c.classification}
                    classification={c.classification}
                    count={c.count}
                  />
                ))}
                {blackCounts.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No notable moves
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eval chart */}
      <Card className="border-purple-800 bg-purple-900/50">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm text-purple-300">
            Evaluation Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EvalChart
            moves={moves}
            currentMove={currentMove}
            onMoveClick={onMoveClick}
          />
        </CardContent>
      </Card>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <Card className="border-purple-800 bg-purple-900/50">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm text-purple-300">
              Key Moments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keyMoments.map((moment) => (
                <button
                  key={moment.index}
                  type="button"
                  onClick={() => onMoveClick(moment.index)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-purple-800"
                >
                  <span className="min-w-[3rem] text-xs text-muted-foreground">
                    {moment.move.color === "w"
                      ? `${moment.move.moveNumber}.`
                      : `${moment.move.moveNumber}...`}
                  </span>
                  <span className="min-w-[3.5rem] text-sm font-medium text-purple-100">
                    {moment.move.san}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatEvalSwing(moment.move.evalBefore, moment.move.evalAfter)}
                  </span>
                  <span className="ml-auto">
                    <MoveBadge classification={moment.move.classification} />
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countClassifications(
  moves: MoveAnalysis[],
  color: "w" | "b"
): ClassificationCount[] {
  const playerMoves = moves.filter((m) => m.color === color);
  const counts = new Map<MoveClassification, number>();

  for (const m of playerMoves) {
    counts.set(m.classification, (counts.get(m.classification) ?? 0) + 1);
  }

  return displayClassifications
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ classification: c, count: counts.get(c)! }));
}

function getKeyMoments(moves: MoveAnalysis[], limit: number): KeyMoment[] {
  const moments: KeyMoment[] = moves.map((m, i) => ({
    index: i,
    move: m,
    evalSwing: Math.abs(m.evalAfter - m.evalBefore),
  }));

  // Sort by largest eval swing descending
  moments.sort((a, b) => b.evalSwing - a.evalSwing);

  // Take top N, then re-sort by move order
  return moments
    .slice(0, limit)
    .sort((a, b) => a.index - b.index);
}

function formatEvalSwing(evalBefore: number, evalAfter: number): string {
  const before = evalBefore / 100;
  const after = evalAfter / 100;
  const diff = after - before;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}

function ClassificationBadge({
  classification,
  count,
}: {
  classification: MoveClassification;
  count: number;
}) {
  const style = classificationColors[classification];
  return (
    <Badge
      variant="ghost"
      className={`${style.bg} ${style.text} border-0 px-1.5 py-0 text-[10px] leading-4`}
    >
      {count} {count === 1 ? style.label : `${style.label}s`}
    </Badge>
  );
}
