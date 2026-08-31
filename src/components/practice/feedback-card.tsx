"use client";

import { Check, X, Eye, ArrowRight, RotateCcw } from "lucide-react";
import { RetroButton, RetroPanel } from "@/components/retro";

interface FeedbackCardProps {
  isCorrect: boolean | null;
  bestMoveSan: string;
  playedMoveSan: string | null;
  evalDiff: number; // how much better the best move is (in pawns)
  onNextMistake: () => void;
  onTryAgain: () => void;
  onShowAnswer: () => void;
  hasNextMistake: boolean;
  sideToMove: "w" | "b";
}

export function FeedbackCard({
  isCorrect,
  bestMoveSan,
  playedMoveSan,
  evalDiff,
  onNextMistake,
  onTryAgain,
  onShowAnswer,
  hasNextMistake,
  sideToMove,
}: FeedbackCardProps) {
  const side = sideToMove === "w" ? "White" : "Black";

  // Before attempt
  if (isCorrect === null && playedMoveSan === null) {
    return (
      <RetroPanel caption="Your move">
        <p className="text-[var(--r-shadow)]">
          Find the best move. {side} to move, drag a piece to play it.
        </p>
        <div className="r-bevel-in mt-2 flex items-center gap-2 bg-[var(--r-face-light)] px-3 py-2">
          <span
            className="h-3 w-3 border border-[var(--r-dark)]"
            style={{ background: sideToMove === "w" ? "#f0e6d2" : "#2b2b2b" }}
            aria-hidden="true"
          />
          <span>{side} to play</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <RetroButton onClick={onShowAnswer} className="gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Show answer
          </RetroButton>
          {hasNextMistake && (
            <RetroButton onClick={onNextMistake} className="gap-1">
              Skip
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </RetroButton>
          )}
        </div>
      </RetroPanel>
    );
  }

  // Correct
  if (isCorrect === true) {
    return (
      <RetroPanel caption="Result">
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#008000]">
          <Check className="h-4 w-4" aria-hidden="true" />
          Correct
        </p>
        <p className="mt-2 text-[var(--r-shadow)]">
          You found the best move:{" "}
          <span className="font-bold text-[#008000]">{bestMoveSan}</span>
        </p>
        <div className="mt-3">
          {hasNextMistake ? (
            <RetroButton variant="default" onClick={onNextMistake} className="gap-1">
              Next mistake
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </RetroButton>
          ) : (
            <span className="text-[var(--r-shadow)]">All mistakes reviewed.</span>
          )}
        </div>
      </RetroPanel>
    );
  }

  // Incorrect
  return (
    <RetroPanel caption="Result">
      <p className="flex items-center gap-2 text-[13px] font-bold text-[#800000]">
        <X className="h-4 w-4" aria-hidden="true" />
        Not quite
      </p>
      <p className="mt-2 text-[var(--r-shadow)]">
        {playedMoveSan && (
          <span>
            You played{" "}
            <span className="font-bold text-[var(--r-dark)]">{playedMoveSan}</span>.{" "}
          </span>
        )}
        The best move was:{" "}
        <span className="font-bold text-[#008000]">{bestMoveSan}</span>
      </p>
      {evalDiff > 0 && (
        <div className="r-bevel-in mt-2 bg-[var(--r-face-light)] px-3 py-2">
          <p className="text-[var(--r-shadow)]">
            The best move is{" "}
            <span className="font-bold text-[#c08000]">
              +{evalDiff.toFixed(1)} pawns
            </span>{" "}
            better
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <RetroButton onClick={onTryAgain} className="gap-1">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </RetroButton>
        {hasNextMistake && (
          <RetroButton variant="default" onClick={onNextMistake} className="gap-1">
            Next mistake
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </RetroButton>
        )}
      </div>
    </RetroPanel>
  );
}
