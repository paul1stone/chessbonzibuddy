"use client";

import { Button } from "@/components/ui/button";
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
    if (gameOverReason === "stalemate") resultText = "Draw by Stalemate";
    if (gameOverReason === "insufficient") resultText = "Draw by Insufficient Material";
    if (gameOverReason === "threefold") resultText = "Draw by Repetition";
    if (gameOverReason === "fifty_moves") resultText = "Draw by 50-Move Rule";
  } else if (playerWon) {
    resultText = "You Win!";
    if (gameOverReason === "checkmate") resultText = "Checkmate - You Win!";
    if (gameOverReason === "timeout") resultText = "Bonzi Ran Out of Time!";
    if (gameOverReason === "resign") resultText = "You Win by Resignation!";
  } else {
    resultText = "You Lose!";
    if (gameOverReason === "checkmate") resultText = "Checkmate - Bonzi Wins!";
    if (gameOverReason === "timeout") resultText = "You Ran Out of Time!";
  }

  // Determine Bonzi's GIF based on outcome if store hasn't set one
  let displayGif: BonziGifState = bonziGif;
  if (displayGif === "idle") {
    if (isDraw) displayGif = "talk";
    else if (playerWon) displayGif = "sad";
    else displayGif = "backflip";
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-purple-950/90">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-purple-700 bg-purple-900 p-8 shadow-xl">
        <BonziAvatar gif={displayGif} quip={bonziQuip} size="lg" />

        <h2
          className={`text-2xl font-bold ${
            playerWon
              ? "text-green-400"
              : isDraw
                ? "text-purple-300"
                : "text-red-400"
          }`}
        >
          {resultText}
        </h2>

        <div className="flex gap-3 pt-2">
          <Button onClick={onPlayAgain} variant="default">
            Play Again
          </Button>
          <Button onClick={onExit} variant="outline">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
