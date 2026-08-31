"use client";

import { ReviewView } from "@/components/review/review-view";
import { RetroButton } from "@/components/retro";
import { useBoardSize } from "@/hooks/use-board-size";
import { isCurrentAnalysis } from "@/lib/engine";
import { useGameStore } from "@/stores/game-store";
import { useWindowStore } from "@/stores/window-store";
import type { Game } from "@/db/schema";

interface ReviewWindowProps {
  isAnalyzing: boolean;
  analysisProgress: number; // 0-100
}

/** Review window body: board plus the moves / summary / engine panel. */
export function ReviewWindow({
  isAnalyzing,
  analysisProgress,
}: ReviewWindowProps) {
  const activeGame = useGameStore((s) => s.activeGame);
  const open = useWindowStore((s) => s.open);

  // Never mount ReviewBody without a pgn (cold open, or the game was deleted).
  if (!activeGame) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p>No game selected.</p>
        <RetroButton onClick={() => open("games")}>Open my games</RetroButton>
      </div>
    );
  }

  return (
    <ReviewBody
      game={activeGame}
      isAnalyzing={isAnalyzing}
      analysisProgress={analysisProgress}
    />
  );
}

/**
 * Split from ReviewWindow so useBoardSize mounts with the board column: the
 * hook observes ref.current once, so it must not run while the empty state is up.
 */
function ReviewBody({
  game,
  isAnalyzing,
  analysisProgress,
}: ReviewWindowProps & { game: Game }) {
  const activeMove = useGameStore((s) => s.activeMove);
  const setActiveMove = useGameStore((s) => s.setActiveMove);

  // Controls above the board plus the move info bar below it.
  const { ref, width } = useBoardSize({ h: 117 }) // measured: MoveControls 72 + info bar 44 + 1 slack; info bar can wrap taller at very narrow widths;

  // Pre-v2 blobs count as absent: their evals were side-to-move relative.
  const analysis = isCurrentAnalysis(game.analysis) ? game.analysis : null;

  return (
    <ReviewView
      pgn={game.pgn}
      analysis={analysis}
      currentMove={activeMove}
      onMoveChange={setActiveMove}
      isAnalyzing={isAnalyzing}
      analysisProgress={analysisProgress}
      windowId="review"
      boardRef={ref}
      boardWidth={width}
    />
  );
}

interface ReviewStatusBarProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisProgress: number; // 0-100
}

/** Status bar slot for the review window (rendered by DesktopWindow chrome). */
export function ReviewStatusBar({
  onAnalyze,
  isAnalyzing,
  analysisProgress,
}: ReviewStatusBarProps) {
  const activeGame = useGameStore((s) => s.activeGame);
  const analysisQueue = useGameStore((s) => s.analysisQueue);
  const open = useWindowStore((s) => s.open);

  if (!activeGame) return null;

  const hasAnalysis = isCurrentAnalysis(activeGame.analysis);

  return (
    <div className="flex items-center gap-3">
      <span>{activeGame.result}</span>

      {analysisQueue.length > 0 && (
        <span className="text-[var(--r-shadow)]">
          +{analysisQueue.length} queued
        </span>
      )}

      {isAnalyzing && (
        <div className="r-progress ml-auto w-32 shrink-0">
          <div
            className="r-progress-fill"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}

      {hasAnalysis ? (
        <RetroButton
          className={isAnalyzing ? undefined : "ml-auto"}
          onClick={() => open("practice")}
        >
          Practice mistakes
        </RetroButton>
      ) : (
        // Hidden while analyzing: the progress fill takes its place.
        !isAnalyzing && (
          <RetroButton className="ml-auto" onClick={onAnalyze}>
            Analyze
          </RetroButton>
        )
      )}
    </div>
  );
}
