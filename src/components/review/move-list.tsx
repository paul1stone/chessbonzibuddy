"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoveBadge } from "./move-badge";
import type { MoveAnalysis } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface MoveListProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
}

export function MoveList({ moves, currentMove, onMoveClick }: MoveListProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active move into view when currentMove changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentMove]);

  // Group moves into pairs: [white, black?] per move number.
  const rows: Array<{
    moveNumber: number;
    white: { move: MoveAnalysis; index: number } | null;
    black: { move: MoveAnalysis; index: number } | null;
  }> = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.color === "w") {
      rows.push({
        moveNumber: move.moveNumber,
        white: { move, index: i },
        black: null,
      });
    } else {
      // Attach to the last row if it exists and has the same move number
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.moveNumber === move.moveNumber && !lastRow.black) {
        lastRow.black = { move, index: i };
      } else {
        // Black move without a preceding white move (e.g. game starting from black)
        rows.push({
          moveNumber: move.moveNumber,
          white: null,
          black: { move, index: i },
        });
      }
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="text-sm">
        {/* Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_1fr] gap-0 border-b border-purple-800 bg-purple-950 px-2 py-1.5 text-xs font-medium text-purple-400">
          <span>#</span>
          <span>White</span>
          <span>Black</span>
        </div>

        {/* Move rows */}
        {rows.map((row) => (
          <div
            key={row.moveNumber}
            className="grid grid-cols-[2.5rem_1fr_1fr] gap-0"
          >
            {/* Move number */}
            <span className="flex items-center px-2 py-1 text-xs text-purple-500">
              {row.moveNumber}.
            </span>

            {/* White move */}
            {row.white ? (
              <div
                ref={row.white.index === currentMove ? activeRef : undefined}
                role="button"
                tabIndex={0}
                onClick={() => onMoveClick(row.white!.index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMoveClick(row.white!.index);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-sm text-purple-200 hover:bg-purple-800/60",
                  row.white.index === currentMove &&
                    "border-l-2 border-blue-500 bg-purple-800"
                )}
              >
                <span>{row.white.move.san}</span>
                <MoveBadge classification={row.white.move.classification} />
              </div>
            ) : (
              <div className="px-2 py-1 text-purple-500">&hellip;</div>
            )}

            {/* Black move */}
            {row.black ? (
              <div
                ref={row.black.index === currentMove ? activeRef : undefined}
                role="button"
                tabIndex={0}
                onClick={() => onMoveClick(row.black!.index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMoveClick(row.black!.index);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-sm text-purple-200 hover:bg-purple-800/60",
                  row.black.index === currentMove &&
                    "border-l-2 border-blue-500 bg-purple-800"
                )}
              >
                <span>{row.black.move.san}</span>
                <MoveBadge classification={row.black.move.classification} />
              </div>
            ) : (
              <div className="px-2 py-1" />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
