"use client";

import { useCallback, useMemo, type Ref } from "react";
import { Chess } from "chess.js";
import { BoardPanel } from "@/components/chess/board-panel";
import { ReviewPanel } from "./review-panel";
import type { MoveAnalysis, GameAnalysis } from "@/lib/engine";
import type { WindowId } from "@/stores/window-store";

interface ReviewViewProps {
  pgn: string;
  analysis: GameAnalysis | null;
  currentMove: number;
  onMoveChange: (move: number) => void;
  isAnalyzing: boolean;
  analysisProgress: number; // 0-100
  /** Scopes board keyboard nav to the owning window. */
  windowId?: WindowId;
  /** Board column container, measured by the window's useBoardSize. */
  boardRef?: Ref<HTMLDivElement>;
  /** Board width in px from useBoardSize; 0 means "not measured yet". */
  boardWidth?: number;
}

export function ReviewView({
  pgn,
  analysis,
  currentMove,
  onMoveChange,
  isAnalyzing,
  analysisProgress,
  windowId,
  boardRef,
  boardWidth,
}: ReviewViewProps) {
  const moves = analysis?.moves ?? [];
  const whiteAccuracy = analysis?.whiteAccuracy ?? 0;
  const blackAccuracy = analysis?.blackAccuracy ?? 0;
  const whiteRating = analysis?.whiteRating;
  const blackRating = analysis?.blackRating;

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
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
      {/* Left column: Board */}
      <div
        ref={boardRef}
        className="flex min-h-0 min-w-0 items-center justify-center"
      >
        {/* boardWidth 0 = ResizeObserver has not measured yet; skip the flash. */}
        {boardWidth !== 0 && (
          <BoardPanel
            pgn={pgn}
            currentMove={currentMove}
            onMoveChange={onMoveChange}
            moves={moves.length > 0 ? moves : undefined}
            windowId={windowId}
            boardWidth={boardWidth}
          />
        )}
      </div>

      {/* Right column: Review panel with optional overlay */}
      <div className="r-bevel-in relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--r-face-light)]">
        {/* Review panel content */}
        {analysis ? (
          <ReviewPanel
            moves={moves}
            currentMove={currentMove > 0 ? currentMove - 1 : -1}
            onMoveClick={handleMoveClick}
            whiteAccuracy={whiteAccuracy}
            blackAccuracy={blackAccuracy}
            whiteRating={whiteRating}
            blackRating={blackRating}
            currentMoveAnalysis={currentMoveAnalysis}
          />
        ) : !isAnalyzing ? (
          <div className="flex h-full flex-1 items-center justify-center p-8">
            <p className="text-center text-sm text-[var(--r-shadow)]">
              Run analysis to see move evaluations
            </p>
          </div>
        ) : null}

        {/* Analysis progress overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(0,0,0,0.45)]">
            <div className="r-face r-bevel-out flex flex-col items-center gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/coolmonkey.gif"
                alt="Loading"
                className="h-24 w-24 object-contain"
              />
              <p className="text-lg font-bold">Analyzing...</p>

              {/* Progress bar */}
              <div className="r-progress w-64">
                <div
                  className="r-progress-fill"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              <p className="text-sm text-[var(--r-shadow)]">
                Move {currentAnalysisMove} of {totalMoves}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
