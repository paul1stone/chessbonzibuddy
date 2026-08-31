"use client";

import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Play,
  Pause,
} from "lucide-react";
import { RetroButton } from "@/components/retro";

interface MoveControlsProps {
  currentMove: number;
  totalMoves: number;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

// Win98 toolbar buttons: square-ish, so the .r-btn 75px floor has to go.
const ICON_BTN =
  "min-w-[32px]! px-1! disabled:cursor-default disabled:text-[var(--r-disabled)]!";

export function MoveControls({
  currentMove,
  totalMoves,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  isPlaying = false,
  onTogglePlay,
}: MoveControlsProps) {
  const atStart = currentMove === 0;
  const atEnd = currentMove === totalMoves;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="r-bevel-in flex items-center gap-1 bg-[var(--r-face-light)] p-1">
        <RetroButton
          onClick={onFirst}
          disabled={atStart || isPlaying}
          aria-label="First move"
          className={ICON_BTN}
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </RetroButton>

        <RetroButton
          onClick={onPrevious}
          disabled={atStart || isPlaying}
          aria-label="Previous move"
          className={ICON_BTN}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </RetroButton>

        {onTogglePlay && (
          <RetroButton
            onClick={onTogglePlay}
            disabled={atEnd && !isPlaying}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={ICON_BTN}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </RetroButton>
        )}

        <RetroButton
          onClick={onNext}
          disabled={atEnd || isPlaying}
          aria-label="Next move"
          className={ICON_BTN}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </RetroButton>

        <RetroButton
          onClick={onLast}
          disabled={atEnd || isPlaying}
          aria-label="Last move"
          className={ICON_BTN}
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </RetroButton>
      </div>

      <span className="r-bevel-in bg-[var(--r-face-light)] px-3 text-[11px]">
        Move {currentMove} of {totalMoves}
      </span>
    </div>
  );
}
