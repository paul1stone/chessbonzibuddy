"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Chess } from "chess.js";
import { Flag, Handshake } from "lucide-react";
import { Board } from "@/components/chess/board";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClockDisplay } from "./chess-clock";
import { PvpSetup } from "./pvp-setup";
import { PvpGameOverOverlay } from "./pvp-game-over-overlay";
import { usePvpPlayStore } from "@/stores/pvp-play-store";
import type { PvpMove } from "@/stores/pvp-play-store";
import type { PlayerColor } from "@/stores/bonzi-play-store";

interface PvpViewProps {
  onExit: () => void;
}

function PvpMoveList({ moves }: { moves: PvpMove[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const map = new Map<number, { moveNum: number; white?: string; black?: string }>();
    for (const m of moves) {
      if (!map.has(m.moveNum)) map.set(m.moveNum, { moveNum: m.moveNum });
      const row = map.get(m.moveNum)!;
      if (m.color === "w") row.white = m.san;
      else row.black = m.san;
    }
    return Array.from(map.values()).sort((a, b) => a.moveNum - b.moveNum);
  }, [moves]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="px-1 py-1">
        <div className="mb-1 grid grid-cols-[2rem_1fr_1fr] gap-x-1 border-b border-border pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          <span>#</span>
          <span>White</span>
          <span>Black</span>
        </div>
        {rows.map((row, i) => {
          const isLastRow = i === rows.length - 1;
          return (
            <div
              key={row.moveNum}
              className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 rounded px-0 py-0.5 font-mono text-xs transition-colors hover:bg-secondary/40"
            >
              <span className="text-muted-foreground/60">{row.moveNum}.</span>
              <span
                className={`text-foreground ${isLastRow && !row.black ? "animate-pop-move" : ""}`}
              >
                {row.white ?? ""}
              </span>
              <span
                className={`text-foreground ${isLastRow && row.black ? "animate-pop-move" : ""}`}
              >
                {row.black ?? ""}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

export function PvpView({ onExit }: PvpViewProps) {
  const phase = usePvpPlayStore((s) => s.phase);
  const fen = usePvpPlayStore((s) => s.fen);
  const whiteName = usePvpPlayStore((s) => s.whiteName);
  const blackName = usePvpPlayStore((s) => s.blackName);
  const timeControl = usePvpPlayStore((s) => s.timeControl);
  const autoFlip = usePvpPlayStore((s) => s.autoFlip);
  const moveHistory = usePvpPlayStore((s) => s.moveHistory);
  const lastMove = usePvpPlayStore((s) => s.lastMove);
  const whiteTimeMs = usePvpPlayStore((s) => s.whiteTimeMs);
  const blackTimeMs = usePvpPlayStore((s) => s.blackTimeMs);
  const activeClockColor = usePvpPlayStore((s) => s.activeClockColor);

  const startGame = usePvpPlayStore((s) => s.startGame);
  const recordMove = usePvpPlayStore((s) => s.recordMove);
  const applyIncrement = usePvpPlayStore((s) => s.applyIncrement);
  const switchClock = usePvpPlayStore((s) => s.switchClock);
  const setGameOver = usePvpPlayStore((s) => s.setGameOver);
  const resetGame = usePvpPlayStore((s) => s.resetGame);
  const tickClock = usePvpPlayStore((s) => s.tickClock);

  const gameRef = useRef<Chess>(new Chess());
  const rafRef = useRef<number>(undefined);

  const sideToMove: PlayerColor = (fen.split(" ")[1] as PlayerColor) ?? "w";

  // Clock ticker
  useEffect(() => {
    if (phase !== "playing" || !activeClockColor) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();

    function tick() {
      const now = performance.now();
      if (now - lastTime >= 100) {
        tickClock(now);
        lastTime = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, activeClockColor, tickClock]);

  const checkGameOver = useCallback(
    (chess: Chess): boolean => {
      if (chess.isCheckmate()) {
        const winner: PlayerColor = chess.turn() === "w" ? "b" : "w";
        setGameOver("checkmate", winner);
        return true;
      }
      if (chess.isStalemate()) {
        setGameOver("stalemate", "draw");
        return true;
      }
      if (chess.isInsufficientMaterial()) {
        setGameOver("insufficient", "draw");
        return true;
      }
      if (chess.isThreefoldRepetition()) {
        setGameOver("threefold", "draw");
        return true;
      }
      if (chess.isDraw()) {
        setGameOver("fifty_moves", "draw");
        return true;
      }
      return false;
    },
    [setGameOver]
  );

  const handleStart = useCallback(() => {
    gameRef.current = new Chess();
    startGame();
  }, [startGame]);

  const handlePieceDrop = useCallback(
    (source: string, target: string, piece: string): boolean => {
      if (usePvpPlayStore.getState().phase !== "playing") return false;

      const chess = gameRef.current;
      const moverColor = chess.turn() as PlayerColor;

      const promotion =
        piece === "p" || piece === "P" || piece.toLowerCase().endsWith("p")
          ? target[1] === "8" || target[1] === "1"
            ? "q"
            : undefined
          : undefined;

      let moveResult;
      try {
        moveResult = chess.move({ from: source, to: target, promotion });
      } catch {
        return false;
      }
      if (!moveResult) return false;

      const moveNum = Math.ceil(chess.history().length / 2);
      recordMove(
        { san: moveResult.san, color: moverColor, moveNum },
        chess.fen(),
        source,
        target
      );
      applyIncrement(moverColor);
      switchClock();

      checkGameOver(chess);
      return true;
    },
    [recordMove, applyIncrement, switchClock, checkGameOver]
  );

  const handleResign = useCallback(() => {
    const chess = gameRef.current;
    const resigner = chess.turn() as PlayerColor;
    const winner: PlayerColor = resigner === "w" ? "b" : "w";
    setGameOver("resign", winner);
  }, [setGameOver]);

  const handleAgreeDraw = useCallback(() => {
    setGameOver("draw_agreed", "draw");
  }, [setGameOver]);

  const handlePlayAgain = useCallback(() => {
    gameRef.current = new Chess();
    resetGame();
  }, [resetGame]);

  if (phase === "setup") {
    return <PvpSetup onStart={handleStart} onBack={onExit} />;
  }

  const whiteLabel = whiteName || "White";
  const blackLabel = blackName || "Black";

  // Board follows the player to move when auto-flip is on
  const boardOrientation =
    autoFlip && phase === "playing"
      ? sideToMove === "w"
        ? "white"
        : "black"
      : "white";

  // Top clock shows the player at the top of the board
  const topColor: PlayerColor = boardOrientation === "white" ? "b" : "w";
  const bottomColor: PlayerColor = topColor === "w" ? "b" : "w";
  const labelFor = (c: PlayerColor) =>
    c === "w" ? `♔ ${whiteLabel}` : `♚ ${blackLabel}`;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 animate-fade-in-soft">
        <span className="text-sm font-medium text-foreground">
          {whiteLabel} <span className="text-muted-foreground">vs</span>{" "}
          {blackLabel}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
            {timeControl.label}
          </span>
          {phase === "playing" && (
            <>
              <Button variant="outline" size="sm" onClick={handleAgreeDraw}>
                <Handshake className="mr-1 h-3.5 w-3.5" />
                Draw
              </Button>
              <Button variant="outline" size="sm" onClick={handleResign}>
                <Flag className="mr-1 h-3.5 w-3.5" />
                Resign
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-2 sm:p-4 lg:grid-cols-[1fr_320px]">
        {/* Board */}
        <div className="relative flex items-center justify-center">
          <div className="w-[90%] max-w-[calc(100vh-14rem)] animate-scale-in">
            <Board
              position={fen}
              interactive={phase === "playing"}
              onPieceDrop={handlePieceDrop}
              boardOrientation={boardOrientation}
              lastMove={lastMove}
            />
          </div>

          {phase === "game_over" && (
            <PvpGameOverOverlay
              getPgn={() => gameRef.current.pgn()}
              onPlayAgain={handlePlayAgain}
              onExit={onExit}
            />
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 animate-slide-in-right">
          {/* Turn indicator */}
          <div className="flex items-center justify-center gap-2 rounded-md bg-secondary/60 px-3 py-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                sideToMove === "w"
                  ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                  : "bg-zinc-900 ring-1 ring-zinc-500"
              }`}
            />
            <span className="text-sm font-medium text-foreground/90">
              {phase === "playing"
                ? `${sideToMove === "w" ? whiteLabel : blackLabel} to move`
                : "Game over"}
            </span>
          </div>

          {/* Clocks */}
          <div className="flex flex-col gap-1">
            <ClockDisplay
              timeMs={topColor === "w" ? whiteTimeMs : blackTimeMs}
              isActive={activeClockColor === topColor}
              label={labelFor(topColor)}
            />
            <ClockDisplay
              timeMs={bottomColor === "w" ? whiteTimeMs : blackTimeMs}
              isActive={activeClockColor === bottomColor}
              label={labelFor(bottomColor)}
            />
          </div>

          {/* Move list */}
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Moves
          </div>
          <PvpMoveList moves={moveHistory} />
        </div>
      </div>
    </div>
  );
}
