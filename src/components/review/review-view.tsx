"use client";

import { useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import { BoardPanel } from "@/components/chess/board-panel";
import { ReviewPanel } from "./review-panel";
import type { MoveAnalysis, GameAnalysis } from "@/lib/engine";

interface ReviewViewProps {
  pgn: string;
  analysis: GameAnalysis | null;
  currentMove: number;
  onMoveChange: (move: number) => void;
  isAnalyzing: boolean;
  analysisProgress: number; // 0-100
}

export function ReviewView({
  pgn,
  analysis,
  currentMove,
  onMoveChange,
  isAnalyzing,
  analysisProgress,
}: ReviewViewProps) {
  const moves = analysis?.moves ?? [];
  const whiteAccuracy = analysis?.whiteAccuracy ?? 0;
  const blackAccuracy = analysis?.blackAccuracy ?? 0;

  // Compute total number of moves from the PGN for the progress overlay
  const totalMoves = useMemo(() => {
    try {
      const game = new Chess();
      game.loadPgn(pgn);
      return game.history().length;
    } catch {
      return 0;
    }
  }, [pgn]);

  // Current move in the analysis progress (based on percentage)
  const currentAnalysisMove = Math.round((analysisProgress / 100) * totalMoves);

  // The current move analysis for the EnginePanel
  // currentMove is 1-indexed from the board (move 0 = starting position),
  // but analysis.moves is 0-indexed (index 0 = first move).
  // So the analysis for board position N corresponds to moves[N-1].
  const currentMoveAnalysis: MoveAnalysis | null =
    currentMove > 0 && moves.length > 0
      ? moves[currentMove - 1] ?? null
      : null;

  const handleMoveClick = useCallback(
    (moveIndex: number) => {
      // MoveList indexes are 0-based into analysis.moves array.
      // Board position = moveIndex + 1 (since position 0 = starting position).
      onMoveChange(moveIndex + 1);
    },
    [onMoveChange]
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
      {/* Left column: Board */}
      <div className="flex items-start justify-center">
        <BoardPanel
          pgn={pgn}
          currentMove={currentMove}
          onMoveChange={onMoveChange}
        />
      </div>

      {/* Right column: Review panel with optional overlay */}
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {/* Review panel content */}
        {analysis ? (
          <ReviewPanel
            moves={moves}
            currentMove={currentMove > 0 ? currentMove - 1 : -1}
            onMoveClick={handleMoveClick}
            whiteAccuracy={whiteAccuracy}
            blackAccuracy={blackAccuracy}
            currentMoveAnalysis={currentMoveAnalysis}
          />
        ) : !isAnalyzing ? (
          <div className="flex h-full flex-1 items-center justify-center p-8">
            <p className="text-center text-sm text-zinc-500">
              Run analysis to see move evaluations
            </p>
          </div>
        ) : null}

        {/* Analysis progress overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80">
            <div className="flex flex-col items-center gap-4">
              <p className="animate-pulse text-lg font-semibold text-zinc-200">
                Analyzing...
              </p>

              {/* Progress bar */}
              <div className="h-2 w-64 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              <p className="text-sm text-zinc-400">
                Move {currentAnalysisMove} of {totalMoves}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
