"use client";

import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="flex items-center gap-1 rounded-lg bg-purple-900/50 p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onFirst}
          disabled={atStart || isPlaying}
          aria-label="First move"
          className="text-purple-300 hover:text-purple-100"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={atStart || isPlaying}
          aria-label="Previous move"
          className="text-purple-300 hover:text-purple-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {onTogglePlay && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
            disabled={atEnd && !isPlaying}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={
              isPlaying
                ? "text-blue-400 hover:text-blue-300"
                : "text-purple-300 hover:text-purple-100"
            }
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={atEnd || isPlaying}
          aria-label="Next move"
          className="text-purple-300 hover:text-purple-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onLast}
          disabled={atEnd || isPlaying}
          aria-label="Last move"
          className="text-purple-300 hover:text-purple-100"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      <span className="text-xs text-purple-400">
        Move {currentMove} of {totalMoves}
      </span>
    </div>
  );
}
