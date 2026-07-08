"use client";

import { useState } from "react";
import { Copy, Check, Trophy, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePvpPlayStore } from "@/stores/pvp-play-store";

const CONFETTI_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--foreground)",
];

function Confetti() {
  // Deterministic pseudo-random spread so SSR/CSR markup match
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${((i * 53) % 200) / 100}s`,
    duration: `${2.4 + ((i * 29) % 140) / 100}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

interface PvpGameOverOverlayProps {
  getPgn: () => string;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function PvpGameOverOverlay({
  getPgn,
  onPlayAgain,
  onExit,
}: PvpGameOverOverlayProps) {
  const gameOverReason = usePvpPlayStore((s) => s.gameOverReason);
  const gameOverWinner = usePvpPlayStore((s) => s.gameOverWinner);
  const whiteName = usePvpPlayStore((s) => s.whiteName);
  const blackName = usePvpPlayStore((s) => s.blackName);

  const [copied, setCopied] = useState(false);

  const isDraw = gameOverWinner === "draw";
  const winnerName =
    gameOverWinner === "w"
      ? whiteName || "White"
      : gameOverWinner === "b"
        ? blackName || "Black"
        : null;

  let resultText = "";
  let detailText = "";
  if (isDraw) {
    resultText = "Draw";
    if (gameOverReason === "stalemate") detailText = "by stalemate";
    if (gameOverReason === "insufficient") detailText = "by insufficient material";
    if (gameOverReason === "threefold") detailText = "by repetition";
    if (gameOverReason === "fifty_moves") detailText = "by the 50-move rule";
    if (gameOverReason === "draw_agreed") detailText = "by agreement";
  } else {
    resultText = `${winnerName} Wins!`;
    if (gameOverReason === "checkmate") detailText = "by checkmate";
    if (gameOverReason === "timeout") detailText = "on time";
    if (gameOverReason === "resign") detailText = "by resignation";
  }

  const handleCopyPgn = async () => {
    try {
      await navigator.clipboard.writeText(getPgn());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing to do
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 backdrop-blur-sm animate-fade-in-soft">
      {!isDraw && <Confetti />}

      <div className="animate-overlay-card flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-2xl shadow-black/50">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            isDraw ? "bg-secondary" : "bg-primary/15 animate-glow"
          }`}
        >
          {isDraw ? (
            <Handshake className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Trophy className="h-8 w-8 text-primary" />
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2
            className={`text-2xl font-bold ${
              isDraw ? "text-foreground" : "text-primary"
            }`}
          >
            {resultText}
          </h2>
          {detailText && (
            <p className="text-sm text-muted-foreground">{detailText}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={onPlayAgain}
            className="transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Play Again
          </Button>
          <Button onClick={handleCopyPgn} variant="outline">
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                Copy PGN
              </>
            )}
          </Button>
          <Button onClick={onExit} variant="ghost">
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
