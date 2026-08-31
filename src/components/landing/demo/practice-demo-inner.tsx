"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/chess/board";
import { RetroButton } from "@/components/retro";
import { classificationArrowColor } from "@/lib/classification-colors";
import { DEMO, demoPositions, worstLossIndex } from "./demo-utils";

const INDEX = worstLossIndex();
const PUZZLE = DEMO.analysis.moves[INDEX];
const POSITION = demoPositions()[INDEX];
const TO_MOVE = POSITION.split(" ")[1] === "w" ? "White" : "Black";
const ORIENTATION = TO_MOVE === "White" ? "white" : "black";
const BEST_ARROW: Array<[string, string, string?]> = [
  [PUZZLE.bestMove.slice(0, 2), PUZZLE.bestMove.slice(2, 4), classificationArrowColor("best")],
];

export default function PracticeDemoInner() {
  const [position, setPosition] = useState(POSITION);
  const [solved, setSolved] = useState(false);
  const [misses, setMisses] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // The answer stays hidden until it is asked for, or a second try misses.
  const answerShown = revealed || misses >= 2;
  const done = solved || answerShown;

  function handleDrop(from: string, to: string) {
    if (done) return false;
    const chess = new Chess(POSITION);
    let played;
    try {
      played = chess.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    if (played.from + played.to + (played.promotion ?? "") !== PUZZLE.bestMove) {
      setMisses((count) => count + 1);
      return false;
    }
    setPosition(chess.fen());
    setSolved(true);
    return true;
  }

  function reset() {
    setPosition(POSITION);
    setSolved(false);
    setMisses(0);
    setRevealed(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Board
        position={position}
        boardWidth={260}
        interactive={!done}
        boardOrientation={ORIENTATION}
        onPieceDrop={handleDrop}
        customArrows={done ? BEST_ARROW : undefined}
      />
      <p className="text-center">
        {TO_MOVE} to move. {PUZZLE.moveNumber}
        {PUZZLE.color === "w" ? "." : "..."}{PUZZLE.san} was a {PUZZLE.classification}. Find the better move.
      </p>
      <div className="flex min-h-[52px] items-center gap-2">
        {(solved || misses > 0) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={solved ? "/bonzi/clap.gif" : "/bonzi/sad.gif"} alt="" className="h-12 w-12" />
        )}
        <p className="text-center">
          {solved
            ? `Correct: ${PUZZLE.bestMoveSan}.`
            : answerShown
              ? `Not quite. Best was ${PUZZLE.bestMoveSan}.`
              : misses > 0
                ? "Not quite. Try another move."
                : "Drag a piece to play your move."}
        </p>
      </div>
      <div className="flex gap-2">
        {!done && (
          <RetroButton onClick={() => setRevealed(true)}>Show answer</RetroButton>
        )}
        {(solved || misses > 0 || revealed) && <RetroButton onClick={reset}>Try again</RetroButton>}
      </div>
    </div>
  );
}
