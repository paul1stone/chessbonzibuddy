"use client";

import { useState } from "react";
import { MoveList } from "./move-list";
import { GameSummary } from "./game-summary";
import { EnginePanel } from "./engine-panel";
import { BonziReviewMascot } from "@/components/bonzi/bonzi-review-mascot";
import type { MoveAnalysis } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface ReviewPanelProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteRating?: number;
  blackRating?: number;
  currentMoveAnalysis: MoveAnalysis | null;
}

type ReviewTab = "moves" | "summary" | "engine";

const TABS: Array<{ id: ReviewTab; label: string }> = [
  { id: "moves", label: "Moves" },
  { id: "summary", label: "Summary" },
  { id: "engine", label: "Engine" },
];

export function ReviewPanel({
  moves,
  currentMove,
  onMoveClick,
  whiteAccuracy,
  blackAccuracy,
  whiteRating,
  blackRating,
  currentMoveAnalysis,
}: ReviewPanelProps) {
  const [tab, setTab] = useState<ReviewTab>("moves");

  // Compute eval and mate for the EnginePanel from the current move analysis
  const evaluation = currentMoveAnalysis?.evalAfter ?? 0;
  const mate = currentMoveAnalysis?.mateAfter ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="r-tabs shrink-0 pt-1!" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`review-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`review-pane-${t.id}`}
            className={cn("r-tab", tab === t.id && "r-tab--active")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Only the active pane is mounted. */}
      <div
        className="min-h-0 flex-1"
        role="tabpanel"
        id={`review-pane-${tab}`}
        aria-labelledby={`review-tab-${tab}`}
      >
        {tab === "moves" && (
          <MoveList
            moves={moves}
            currentMove={currentMove}
            onMoveClick={onMoveClick}
          />
        )}

        {tab === "summary" && (
          <div className="r-scroll h-full">
            <div className="p-3">
              <GameSummary
                moves={moves}
                whiteAccuracy={whiteAccuracy}
                blackAccuracy={blackAccuracy}
                whiteRating={whiteRating}
                blackRating={blackRating}
                currentMove={currentMove}
                onMoveClick={onMoveClick}
              />
            </div>
          </div>
        )}

        {tab === "engine" && (
          <div className="r-scroll h-full">
            <div className="p-3">
              <EnginePanel
                currentMoveAnalysis={currentMoveAnalysis}
                eval={evaluation}
                mate={mate}
              />
            </div>
          </div>
        )}
      </div>

      <BonziReviewMascot
        classification={currentMoveAnalysis?.classification}
        currentMove={currentMove}
      />
    </div>
  );
}
