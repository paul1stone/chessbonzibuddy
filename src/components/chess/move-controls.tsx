"use client";

import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoveControlsProps {
  currentMove: number;
  totalMoves: number;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}

export function MoveControls({
  currentMove,
  totalMoves,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: MoveControlsProps) {
  const atStart = currentMove === 0;
  const atEnd = currentMove === totalMoves;

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onFirst}
          disabled={atStart}
          aria-label="First move"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={atStart}
          aria-label="Previous move"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={atEnd}
          aria-label="Next move"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onLast}
          disabled={atEnd}
          aria-label="Last move"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      <span className="text-xs text-zinc-500">
        Move {currentMove} of {totalMoves}
      </span>
    </div>
  );
}
