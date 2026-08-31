"use client";

import { useMemo } from "react";
import { RetroPanel } from "@/components/retro";
import { AccuracyRing } from "./accuracy-ring";
import { EvalChart } from "./eval-chart";
import { MoveBadge } from "./move-badge";
import { selectKeyMoments } from "@/lib/analysis-utils";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
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

  // Find key moments (biggest win% losses)
  const keyMoments = useMemo<KeyMoment[]>(
    () =>
      selectKeyMoments(moves).map((move) => ({
        move,
        index: moves.indexOf(move),
      })),
    [moves]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Accuracy section */}
      <RetroPanel caption="Accuracy">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <AccuracyRing
              accuracy={whiteAccuracy}
              label="White"
              color="stroke-[#000080]"
              size={100}
            />
            {whiteRating != null && (
              <span className="r-badge r-badge--flat mt-1">
                Played like ~{whiteRating}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <AccuracyRing
              accuracy={blackAccuracy}
              label="Black"
              color="stroke-[#800000]"
              size={100}
            />
            {blackRating != null && (
              <span className="r-badge r-badge--flat mt-1">
                Played like ~{blackRating}
              </span>
            )}
          </div>
        </div>
      </RetroPanel>

      {/* Move classification counts */}
      <RetroPanel caption="Move quality">
        <div className="grid grid-cols-2 gap-4">
          {/* White */}
          <div className="space-y-2">
            <p className="text-xs font-bold">White</p>
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
            <p className="text-xs font-bold">Black</p>
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
      </RetroPanel>

      {/* Eval chart */}
      <RetroPanel caption="Evaluation">
        <EvalChart
          moves={moves}
          currentMove={currentMove}
          onMoveClick={onMoveClick}
        />
      </RetroPanel>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <RetroPanel caption="Key moments">
          <div className="space-y-1">
            {keyMoments.map((moment) => (
              <button
                key={moment.index}
                type="button"
                onClick={() => onMoveClick(moment.index)}
                className="flex w-full items-center gap-3 px-2 py-1.5 text-left hover:bg-[var(--r-face-light)]"
              >
                <span className="min-w-[3rem] text-xs text-muted-foreground">
                  {moment.move.color === "w"
                    ? `${moment.move.moveNumber}.`
                    : `${moment.move.moveNumber}...`}
                </span>
                <span className="min-w-[3.5rem] text-sm font-bold">
                  {moment.move.san}
                </span>
                <span className="text-xs text-muted-foreground">
                  -{Math.round(moment.move.winPercentLoss)}% win chance
                </span>
                <span className="ml-auto">
                  <MoveBadge classification={moment.move.classification} />
                </span>
              </button>
            ))}
          </div>
        </RetroPanel>
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

function ClassificationBadge({
  classification,
  count,
}: {
  classification: MoveClassification;
  count: number;
}) {
  const { hex, label } = CLASSIFICATION_COLORS[classification];
  return (
    <span className="r-badge" style={{ background: hex }}>
      {count} {count === 1 ? label : plural(label)}
    </span>
  );
}

/** "Inaccuracy" -> "Inaccuracies"; everything else takes a plain -s. */
function plural(label: string): string {
  return label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`;
}
