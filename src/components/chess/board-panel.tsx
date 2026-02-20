"use client";

import { useEffect, useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import { Board } from "./board";
import { MoveControls } from "./move-controls";

interface BoardPanelProps {
  pgn: string;
  currentMove: number;
  onMoveChange: (move: number) => void;
  interactive?: boolean;
  onPieceDrop?: (source: string, target: string, piece: string) => boolean;
  boardOrientation?: "white" | "black";
}

export function BoardPanel({
  pgn,
  currentMove,
  onMoveChange,
  interactive = false,
  onPieceDrop,
  boardOrientation = "white",
}: BoardPanelProps) {
  // Parse the PGN and compute the FEN at each move position
  const positions = useMemo(() => {
    const game = new Chess();
    const fens: string[] = [];

    try {
      game.loadPgn(pgn);
    } catch {
      // If PGN is invalid, return just the starting position
      return [game.fen()];
    }

    // Get the list of moves played (verbose so we can replay them)
    const moves = game.history();

    // Reset to starting position to replay
    game.reset();
    fens.push(game.fen());

    for (const move of moves) {
      game.move(move);
      fens.push(game.fen());
    }

    return fens;
  }, [pgn]);

  const totalMoves = positions.length - 1;

  const goToFirst = useCallback(() => onMoveChange(0), [onMoveChange]);
  const goToPrevious = useCallback(
    () => onMoveChange(Math.max(0, currentMove - 1)),
    [onMoveChange, currentMove]
  );
  const goToNext = useCallback(
    () => onMoveChange(Math.min(totalMoves, currentMove + 1)),
    [onMoveChange, currentMove, totalMoves]
  );
  const goToLast = useCallback(
    () => onMoveChange(totalMoves),
    [onMoveChange, totalMoves]
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        goToLast();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToFirst, goToPrevious, goToNext, goToLast]);

  // Clamp currentMove to valid range
  const clampedMove = Math.max(0, Math.min(currentMove, totalMoves));
  const currentFen = positions[clampedMove];

  return (
    <div className="flex flex-col items-center gap-0">
      <Board
        position={currentFen}
        interactive={interactive}
        onPieceDrop={onPieceDrop}
        boardOrientation={boardOrientation}
      />
      <MoveControls
        currentMove={clampedMove}
        totalMoves={totalMoves}
        onFirst={goToFirst}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onLast={goToLast}
      />
    </div>
  );
}
