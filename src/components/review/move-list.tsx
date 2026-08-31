"use client";

import { useEffect, useRef, type Ref } from "react";
import { MoveBadge } from "./move-badge";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { MoveAnalysis } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface MoveListProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
}

interface MoveEntry {
  move: MoveAnalysis;
  index: number;
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
    white: MoveEntry | null;
    black: MoveEntry | null;
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
    <div className="r-scroll h-full">
      <div className="text-sm">
        {/* Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_1fr] gap-0 border-b border-[var(--r-shadow)] bg-[var(--r-face)] px-2 py-1.5 text-xs font-bold text-[var(--r-shadow)]">
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
            <span className="flex items-center px-2 py-1 text-xs text-[var(--r-shadow)]">
              {row.moveNumber}.
            </span>

            {row.white ? (
              <MoveCell
                entry={row.white}
                active={row.white.index === currentMove}
                cellRef={row.white.index === currentMove ? activeRef : undefined}
                onSelect={onMoveClick}
              />
            ) : (
              <div className="px-2 py-1 text-[var(--r-shadow)]">&hellip;</div>
            )}

            {row.black ? (
              <MoveCell
                entry={row.black}
                active={row.black.index === currentMove}
                cellRef={row.black.index === currentMove ? activeRef : undefined}
                onSelect={onMoveClick}
              />
            ) : (
              <div className="px-2 py-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCell({
  entry,
  active,
  cellRef,
  onSelect,
}: {
  entry: MoveEntry;
  active: boolean;
  cellRef?: Ref<HTMLDivElement>;
  onSelect: (moveIndex: number) => void;
}) {
  return (
    <div
      ref={cellRef}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry.index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entry.index);
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 px-2 py-1 font-mono text-sm hover:bg-[var(--r-face-light)]",
        active && "bg-[var(--r-title-a)] text-[var(--r-title-text)]"
      )}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 border border-[var(--r-shadow)]"
        style={{
          background: CLASSIFICATION_COLORS[entry.move.classification].hex,
        }}
      />
      <span>{entry.move.san}</span>
      <MoveBadge classification={entry.move.classification} />
    </div>
  );
}
