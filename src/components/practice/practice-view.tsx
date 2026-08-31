"use client";

import { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Board } from "@/components/chess/board";
import { RetroButton } from "@/components/retro";
import { useBoardSize } from "@/hooks/use-board-size";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { FeedbackCard } from "./feedback-card";
import type { MoveAnalysis } from "@/lib/engine";

interface PracticeViewProps {
  pgn: string;
  moves: MoveAnalysis[]; // the analyzed moves
  onExit: () => void; // leave practice (the window closes itself)
}

/**
 * Parse a UCI move string (e.g. "e2e4") into source and target squares.
 */
function parseUciMove(uci: string): { from: string; to: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };
}

export function PracticeView({ pgn, moves, onExit }: PracticeViewProps) {
  // ---------------------------------------------------------------------------
  // Derived: filter to only mistakes and blunders
  // ---------------------------------------------------------------------------
  const mistakes = useMemo(
    () =>
      moves.filter(
        (m) => m.classification === "mistake" || m.classification === "blunder"
      ),
    [moves]
  );

  // ---------------------------------------------------------------------------
  // Compute all FEN positions from the PGN (position[i] = FEN after i-th move)
  // position[0] = starting position
  // ---------------------------------------------------------------------------
  const positions = useMemo(() => {
    const game = new Chess();
    const fens: string[] = [];

    try {
      game.loadPgn(pgn);
    } catch {
      return [game.fen()];
    }

    const history = game.history();
    game.reset();
    fens.push(game.fen());

    for (const move of history) {
      game.move(move);
      fens.push(game.fen());
    }

    return fens;
  }, [pgn]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);
  const [userMove, setUserMove] = useState<string | null>(null); // UCI string
  const [userMoveSan, setUserMoveSan] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [displayFen, setDisplayFen] = useState<string | null>(null);

  // Board fills the window column; 40px reserves the frame and breathing room.
  const { ref: boardRef, width: boardWidth } = useBoardSize({ h: 40 });

  // ---------------------------------------------------------------------------
  // Current mistake data
  // ---------------------------------------------------------------------------
  const currentMistake = mistakes[currentMistakeIndex] ?? null;

  /**
   * Index into the `positions` array that gives the FEN *before* the mistake
   * was played. The move analysis array is 0-indexed: moves[0] is the first
   * move of the game. The position *before* move i is positions[i] (where
   * positions[0] is the starting position, positions[1] is after the first
   * move, etc.).
   *
   * MoveAnalysis stores moveNumber (1-based) and color. We can compute the
   * half-move index as: (moveNumber - 1) * 2 + (color === "b" ? 1 : 0).
   * The FEN before that move is positions[halfMoveIndex].
   */
  const halfMoveIndex = currentMistake
    ? (currentMistake.moveNumber - 1) * 2 +
      (currentMistake.color === "b" ? 1 : 0)
    : 0;

  const positionFen = positions[halfMoveIndex] ?? positions[0];

  // Board orientation matches the side that made the mistake
  const boardOrientation: "white" | "black" = currentMistake?.color === "b" ? "black" : "white";

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const resetAttempt = useCallback(() => {
    setUserMove(null);
    setUserMoveSan(null);
    setIsCorrect(null);
    setShowAnswer(false);
    setDisplayFen(null);
  }, []);

  const goToMistake = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, mistakes.length - 1));
      setCurrentMistakeIndex(clamped);
      resetAttempt();
    },
    [mistakes.length, resetAttempt]
  );

  const handleNextMistake = useCallback(() => {
    goToMistake(currentMistakeIndex + 1);
  }, [currentMistakeIndex, goToMistake]);

  const handlePrevMistake = useCallback(() => {
    goToMistake(currentMistakeIndex - 1);
  }, [currentMistakeIndex, goToMistake]);

  const handleTryAgain = useCallback(() => {
    resetAttempt();
  }, [resetAttempt]);

  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
    setIsCorrect(false);
  }, []);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string, _piece: string): boolean => {
      if (!currentMistake || isCorrect !== null) return false;

      // Build UCI string for the user's move
      const uci = sourceSquare + targetSquare;

      // Validate the move is legal using chess.js
      const game = new Chess(positionFen);
      let sanMove: string | null = null;
      try {
        const result = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        sanMove = result.san;
      } catch {
        // Illegal move
        return false;
      }

      // Show the piece on its new square
      setDisplayFen(game.fen());
      setUserMove(uci);
      setUserMoveSan(sanMove);

      // Compare to best move (first 4 chars to handle promotion suffix)
      const bestUci = currentMistake.bestMove.slice(0, 4);
      const correct = uci === bestUci;
      setIsCorrect(correct);

      if (!correct) {
        setShowAnswer(true);
      }

      return true;
    },
    [currentMistake, isCorrect, positionFen]
  );

  // ---------------------------------------------------------------------------
  // Arrow annotations
  // ---------------------------------------------------------------------------
  const arrows: Array<[string, string, string?]> = [];

  if (showAnswer && currentMistake) {
    const { from, to } = parseUciMove(currentMistake.bestMove);
    arrows.push([from, to, "rgba(0, 128, 0, 0.8)"]);
  }

  // ---------------------------------------------------------------------------
  // Eval difference in pawns
  // ---------------------------------------------------------------------------
  const evalDiff = currentMistake
    ? Math.abs(currentMistake.evalBefore - currentMistake.evalAfter) / 100
    : 0;

  // ---------------------------------------------------------------------------
  // Empty state: no mistakes found
  // ---------------------------------------------------------------------------
  if (mistakes.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p>No mistakes or blunders found in this game.</p>
        <RetroButton onClick={onExit}>Exit practice</RetroButton>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[13px] font-bold">Practice mode</h2>
          <span className="r-badge r-badge--flat">
            Mistake {currentMistakeIndex + 1} of {mistakes.length}
          </span>
        </div>
        <RetroButton onClick={onExit} className="gap-1">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Exit
        </RetroButton>
      </div>

      {/* Main content: board + feedback */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        {/* Board — sized by the window, never the viewport */}
        <div
          ref={boardRef}
          className="flex min-h-[200px] min-w-0 flex-1 items-center justify-center lg:items-start"
        >
          {boardWidth > 0 && (
            <Board
              position={displayFen ?? positionFen}
              interactive={isCorrect === null && !showAnswer}
              onPieceDrop={handlePieceDrop}
              boardOrientation={boardOrientation}
              customArrows={arrows}
              boardWidth={boardWidth}
            />
          )}
        </div>

        {/* Feedback panel */}
        <div className="r-scroll flex w-full shrink-0 flex-col gap-3 lg:w-72">
          <FeedbackCard
            isCorrect={isCorrect}
            bestMoveSan={currentMistake?.bestMoveSan ?? ""}
            playedMoveSan={userMoveSan}
            evalDiff={evalDiff}
            onNextMistake={handleNextMistake}
            onTryAgain={handleTryAgain}
            onShowAnswer={handleShowAnswer}
            hasNextMistake={currentMistakeIndex < mistakes.length - 1}
            sideToMove={currentMistake?.color ?? "w"}
          />

          {/* Mistake context info */}
          <div className="r-bevel-in bg-[var(--r-face-light)] px-3 py-2">
            <p className="text-[var(--r-shadow)]">
              Move {currentMistake?.moveNumber}.
              {currentMistake?.color === "b" ? ".." : ""}{" "}
              <span className="font-bold text-[var(--r-dark)]">
                {currentMistake?.san}
              </span>{" "}
              was played (
              <span
                className="font-bold"
                style={{
                  color: currentMistake
                    ? CLASSIFICATION_COLORS[currentMistake.classification].hex
                    : undefined,
                }}
              >
                {currentMistake?.classification}
              </span>
              )
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2">
        <RetroButton
          onClick={handlePrevMistake}
          disabled={currentMistakeIndex === 0}
          className="gap-1 disabled:cursor-default disabled:text-[var(--r-disabled)]!"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </RetroButton>
        <RetroButton
          onClick={handleNextMistake}
          disabled={currentMistakeIndex >= mistakes.length - 1}
          className="gap-1 disabled:cursor-default disabled:text-[var(--r-disabled)]!"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </RetroButton>
      </div>
    </div>
  );
}
