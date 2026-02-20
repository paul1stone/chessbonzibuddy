"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { Chess } from "chess.js";
import { Board } from "./board";
import { MoveControls } from "./move-controls";
import { MoveBadge } from "@/components/review/move-badge";
import type { MoveAnalysis } from "@/lib/engine";
import { ArrowRight } from "lucide-react";

interface BoardPanelProps {
  pgn: string;
  currentMove: number;
  onMoveChange: (move: number) => void;
  interactive?: boolean;
  onPieceDrop?: (source: string, target: string, piece: string) => boolean;
  boardOrientation?: "white" | "black";
  /** Analysis data for showing arrows and move info during playback */
  moves?: MoveAnalysis[];
}

const PLAY_SPEED_MS = 1500;

/** Map classification to arrow color */
function classificationArrowColor(
  classification: MoveAnalysis["classification"]
): string {
  switch (classification) {
    case "blunder":
      return "rgba(239, 68, 68, 0.8)";
    case "mistake":
      return "rgba(249, 115, 22, 0.8)";
    case "inaccuracy":
      return "rgba(234, 179, 8, 0.8)";
    case "brilliant":
      return "rgba(6, 182, 212, 0.8)";
    case "great":
    case "best":
      return "rgba(34, 197, 94, 0.8)";
    default:
      return "rgba(150, 150, 150, 0.5)";
  }
}

export function BoardPanel({
  pgn,
  currentMove,
  onMoveChange,
  interactive = false,
  onPieceDrop,
  boardOrientation = "white",
  moves,
}: BoardPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parse the PGN and compute the FEN at each move position
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

  // Auto-play logic
  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
    } else {
      // If at end, restart from beginning
      if (currentMove >= totalMoves) {
        onMoveChange(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, stopPlaying, currentMove, totalMoves, onMoveChange]);

  // Keep a ref to currentMove so the interval callback always has the latest value
  const currentMoveRef = useRef(currentMove);
  currentMoveRef.current = currentMove;

  // Advance moves during playback
  useEffect(() => {
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      const next = currentMoveRef.current + 1;
      if (next > totalMoves) {
        stopPlaying();
      } else {
        onMoveChange(next);
      }
    }, PLAY_SPEED_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, totalMoves, onMoveChange, stopPlaying]);

  // Stop playback when reaching the end
  useEffect(() => {
    if (isPlaying && currentMove >= totalMoves) {
      stopPlaying();
    }
  }, [isPlaying, currentMove, totalMoves, stopPlaying]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isPlaying) stopPlaying();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isPlaying) stopPlaying();
        goToNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        if (isPlaying) stopPlaying();
        goToFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        if (isPlaying) stopPlaying();
        goToLast();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToFirst, goToPrevious, goToNext, goToLast, togglePlay, isPlaying, stopPlaying]);

  // Clamp currentMove to valid range
  const clampedMove = Math.max(0, Math.min(currentMove, totalMoves));
  const currentFen = positions[clampedMove];

  // Get analysis for the current move (moves array is 0-indexed, board is 1-indexed)
  const currentMoveAnalysis: MoveAnalysis | null =
    moves && clampedMove > 0 ? moves[clampedMove - 1] ?? null : null;

  // Build arrows: green for best move, colored for played move
  const arrows: Array<[string, string, string?]> = [];
  if (currentMoveAnalysis) {
    const played = currentMoveAnalysis.uci;
    const best = currentMoveAnalysis.bestMove;

    // Show best move arrow (green) if it differs from played move
    if (best && best !== played && best.length >= 4) {
      arrows.push([
        best.slice(0, 2),
        best.slice(2, 4),
        "rgba(34, 197, 94, 0.7)",
      ]);
    }

    // Show played move arrow (colored by classification)
    if (played && played.length >= 4) {
      arrows.push([
        played.slice(0, 2),
        played.slice(2, 4),
        classificationArrowColor(currentMoveAnalysis.classification),
      ]);
    }
  }

  return (
    <div className="flex flex-col items-center gap-0">
      <Board
        position={currentFen}
        interactive={interactive}
        onPieceDrop={onPieceDrop}
        boardOrientation={boardOrientation}
        customArrows={arrows.length > 0 ? arrows : undefined}
      />

      {/* Move info overlay: shows played vs best move with classification */}
      {currentMoveAnalysis && (
        <div className="mt-2 flex w-full items-center justify-center gap-3 rounded-lg bg-zinc-900/70 px-4 py-2">
          {/* Played move */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Played</span>
            <span className="font-mono text-sm font-semibold text-zinc-200">
              {currentMoveAnalysis.san}
            </span>
            <MoveBadge classification={currentMoveAnalysis.classification} />
          </div>

          {/* Separator + arrow */}
          {currentMoveAnalysis.bestMove !== currentMoveAnalysis.uci && currentMoveAnalysis.bestMoveSan && (
            <>
              <ArrowRight className="h-3 w-3 text-zinc-600" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Best</span>
                <span className="font-mono text-sm font-semibold text-green-400">
                  {currentMoveAnalysis.bestMoveSan}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <MoveControls
        currentMove={clampedMove}
        totalMoves={totalMoves}
        onFirst={goToFirst}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onLast={goToLast}
        isPlaying={isPlaying}
        onTogglePlay={moves && moves.length > 0 ? togglePlay : undefined}
      />
    </div>
  );
}
