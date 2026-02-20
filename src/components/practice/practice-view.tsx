"use client";

import { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Board } from "@/components/chess/board";
import { Button } from "@/components/ui/button";
import { FeedbackCard } from "./feedback-card";
import type { MoveAnalysis } from "@/lib/engine";

interface PracticeViewProps {
  pgn: string;
  moves: MoveAnalysis[]; // the analyzed moves
  onExit: () => void; // go back to review view
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
    arrows.push([from, to, "rgba(0, 180, 80, 0.8)"]);
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
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg text-zinc-400">
          No mistakes or blunders found in this game.
        </p>
        <Button
          variant="outline"
          onClick={onExit}
          className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
        >
          Back to Review
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Practice Mode
          </h2>
          <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
            Mistake {currentMistakeIndex + 1} of {mistakes.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
          Exit
        </Button>
      </div>

      {/* Main content: board + feedback */}
      <div className="flex flex-1 items-start gap-6">
        {/* Board — constrained to a max size */}
        <div className="w-[min(480px,50vh)] shrink-0">
          <Board
            position={positionFen}
            interactive={isCorrect === null && !showAnswer}
            onPieceDrop={handlePieceDrop}
            boardOrientation={boardOrientation}
            customArrows={arrows}
          />
        </div>

        {/* Feedback panel */}
        <div className="flex w-72 flex-col gap-4">
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <p className="text-xs text-zinc-500">
              Move {currentMistake?.moveNumber}.
              {currentMistake?.color === "b" ? ".." : ""}{" "}
              <span className="text-zinc-300">{currentMistake?.san}</span>{" "}
              was played (
              <span
                className={
                  currentMistake?.classification === "blunder"
                    ? "text-red-400"
                    : "text-orange-400"
                }
              >
                {currentMistake?.classification}
              </span>
              )
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevMistake}
          disabled={currentMistakeIndex === 0}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMistake}
          disabled={currentMistakeIndex >= mistakes.length - 1}
          className="text-zinc-400 hover:text-zinc-100"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
