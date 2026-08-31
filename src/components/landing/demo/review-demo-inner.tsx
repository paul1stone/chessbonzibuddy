"use client";

import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/chess/board";
import { CLASSIFICATION_COLORS, classificationArrowColor } from "@/lib/classification-colors";
import { DEMO, demoPositions, worstLossIndex } from "./demo-utils";

const MOVES = DEMO.analysis.moves;
const POSITIONS = demoPositions();
const LAST_PLY = MOVES.length;
const STEP_MS = 1400;
const STRIP_LENGTH = 6;
// Reduced motion gets a still frame with something to read: just past the game's worst move.
const STATIC_PLY = Math.min(worstLossIndex() + 1, LAST_PLY);
const BEST_ARROW_COLOR = classificationArrowColor("best");

function label(move: (typeof MOVES)[number]) {
  return `${move.moveNumber}${move.color === "w" ? "." : "..."} ${move.san}`;
}

export default function ReviewDemoInner({ inView, reduced }: { inView: boolean; reduced: boolean }) {
  const [ply, setPly] = useState(() => (reduced ? STATIC_PLY : 0));
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    if (!inView || reduced || userTouched) return;
    const timer = setInterval(() => setPly((current) => (current + 1) % (LAST_PLY + 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [inView, reduced, userTouched]);

  // The move about to be played from the position on the board.
  const next = ply < LAST_PLY ? MOVES[ply] : null;
  const strip = MOVES.slice(Math.max(0, ply - STRIP_LENGTH), ply);
  const arrows = useMemo(
    () =>
      next && next.uci !== next.bestMove
        ? ([[next.bestMove.slice(0, 2), next.bestMove.slice(2, 4), BEST_ARROW_COLOR]] as Array<
            [string, string, string?]
          >)
        : undefined,
    [next]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <Board position={POSITIONS[ply]} boardWidth={260} interactive={false} customArrows={arrows} />
      <input
        type="range"
        min={0}
        max={LAST_PLY}
        value={ply}
        aria-label="Scrub through the game"
        className="r-slider w-full max-w-[260px]"
        onChange={(event) => {
          setUserTouched(true);
          setPly(Number(event.target.value));
        }}
      />
      <div className="flex min-h-[16px] flex-wrap justify-center gap-x-3 gap-y-1">
        {strip.map((move, i) => (
          <span key={ply - strip.length + i} className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              title={CLASSIFICATION_COLORS[move.classification].label}
              className="inline-block h-[7px] w-[7px]"
              style={{ backgroundColor: CLASSIFICATION_COLORS[move.classification].hex }}
            />
            {label(move)}
          </span>
        ))}
      </div>
      <p className="min-h-[15px] text-center">
        {next && next.uci !== next.bestMove ? `Best here: ${next.bestMoveSan}` : " "}
      </p>
      <p className="text-center">Morphy vs Duke Karl and Count Isouard, 1858. Real Stockfish 18 analysis.</p>
    </div>
  );
}
