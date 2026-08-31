"use client";

import { RetroButton } from "@/components/retro";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import type { BonziGifState } from "@/lib/bonzi/types";

interface GameOverOverlayProps {
  onPlayAgain: () => void;
  onExit: () => void;
}

export function GameOverOverlay({ onPlayAgain, onExit }: GameOverOverlayProps) {
  const gameOverReason = useBonziPlayStore((s) => s.gameOverReason);
  const gameOverWinner = useBonziPlayStore((s) => s.gameOverWinner);
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const bonziGif = useBonziPlayStore((s) => s.bonziGif);
  const bonziQuip = useBonziPlayStore((s) => s.bonziQuip);

  const playerWon = gameOverWinner === playerColor;
  const isDraw = gameOverWinner === "draw";

  let resultText = "";
  if (isDraw) {
    resultText = "Draw";
    if (gameOverReason === "stalemate") resultText = "Draw by stalemate";
    if (gameOverReason === "insufficient") resultText = "Draw by insufficient material";
    if (gameOverReason === "threefold") resultText = "Draw by repetition";
    if (gameOverReason === "fifty_moves") resultText = "Draw by 50-move rule";
  } else if (playerWon) {
    resultText = "You win!";
    if (gameOverReason === "checkmate") resultText = "Checkmate - you win!";
    if (gameOverReason === "timeout") resultText = "Bonzi ran out of time!";
    if (gameOverReason === "resign") resultText = "You win by resignation!";
  } else {
    resultText = "You lose!";
    if (gameOverReason === "checkmate") resultText = "Checkmate - Bonzi wins!";
    if (gameOverReason === "timeout") resultText = "You ran out of time!";
  }

  // Determine Bonzi's GIF based on outcome if store hasn't set one
  let displayGif: BonziGifState = bonziGif;
  if (displayGif === "idle") {
    if (isDraw) displayGif = "talk";
    else if (playerWon) displayGif = "sad";
    else displayGif = "backflip";
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4">
      <div className="r-face r-bevel-out flex w-[min(320px,100%)] flex-col p-[3px]">
        <div className="r-title shrink-0">Game over</div>
        <div className="flex flex-col items-center gap-3 p-4">
          <BonziAvatar gif={displayGif} quip={bonziQuip} size="lg" />

          <h2
            className={`text-center text-lg font-bold ${
              playerWon
                ? "text-[#008000]"
                : isDraw
                  ? "text-[var(--r-shadow)]"
                  : "text-[#800000]"
            }`}
          >
            {resultText}
          </h2>

          <div className="flex gap-3 pt-1">
            <RetroButton onClick={onPlayAgain} variant="default">
              Play again
            </RetroButton>
            <RetroButton onClick={onExit}>Back</RetroButton>
          </div>
        </div>
      </div>
    </div>
  );
}
