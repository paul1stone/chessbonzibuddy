"use client";

import { useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/chess/board";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { ChessClock } from "./chess-clock";
import { GameOverOverlay } from "./game-over-overlay";
import { PlaySetup } from "./play-setup";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import { getBonziReaction } from "@/lib/bonzi/bonzi-engine";
import { StockfishEngine } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BonziEvent } from "@/lib/bonzi/types";
import type { PlayerColor } from "@/stores/bonzi-play-store";

function computeEngineThinkTime(remainingMs: number, incrementMs: number): number {
  const time = Math.min(remainingMs * 0.02 + incrementMs * 0.8, 3000);
  return Math.max(300, Math.round(time));
}

interface PlayViewProps {
  onExit: () => void;
}

export function PlayView({ onExit }: PlayViewProps) {
  const phase = useBonziPlayStore((s) => s.phase);
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
  const fen = useBonziPlayStore((s) => s.fen);
  const moveHistory = useBonziPlayStore((s) => s.moveHistory);
  const uciHistory = useBonziPlayStore((s) => s.uciHistory);
  const bonziGif = useBonziPlayStore((s) => s.bonziGif);
  const bonziQuip = useBonziPlayStore((s) => s.bonziQuip);
  const engineThinking = useBonziPlayStore((s) => s.engineThinking);
  const gameOverReason = useBonziPlayStore((s) => s.gameOverReason);

  const startGame = useBonziPlayStore((s) => s.startGame);
  const makeMove = useBonziPlayStore((s) => s.makeMove);
  const setFen = useBonziPlayStore((s) => s.setFen);
  const applyIncrement = useBonziPlayStore((s) => s.applyIncrement);
  const switchClock = useBonziPlayStore((s) => s.switchClock);
  const setGameOver = useBonziPlayStore((s) => s.setGameOver);
  const setBonziReaction = useBonziPlayStore((s) => s.setBonziReaction);
  const setEngineThinking = useBonziPlayStore((s) => s.setEngineThinking);
  const resetGame = useBonziPlayStore((s) => s.resetGame);

  const engineRef = useRef<StockfishEngine | null>(null);
  const gameRef = useRef<Chess>(new Chess());
  const bonziTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    let mounted = true;

    engine.init().then(() => {
      if (!mounted) {
        engine.quit();
        return;
      }
      // Configure for max strength
      engine.setOption("Skill Level", 20);
      engine.setOption("Hash", 128);
      engineRef.current = engine;
    }).catch((err) => {
      // Suppress init errors from strict-mode double-mount (engine was quit mid-init)
      if (mounted) {
        console.error("Engine init failed:", err);
      }
    });

    return () => {
      mounted = false;
      // Quit the engine whether it's finished init or still loading
      engine.quit();
      engineRef.current = null;
    };
  }, []);

  // Fire a Bonzi reaction with auto-revert
  const fireBonziReaction = useCallback(
    (event: BonziEvent) => {
      if (bonziTimerRef.current) clearTimeout(bonziTimerRef.current);
      const reaction = getBonziReaction(event);
      setBonziReaction(reaction.gif, reaction.quip);

      bonziTimerRef.current = setTimeout(() => {
        setBonziReaction("idle", undefined);
      }, reaction.duration);
    },
    [setBonziReaction]
  );

  // Detect game-ending conditions
  const checkGameOver = useCallback(
    (chess: Chess): boolean => {
      if (chess.isCheckmate()) {
        const loser: PlayerColor = chess.turn() === "w" ? "w" : "b";
        const winner: PlayerColor = loser === "w" ? "b" : "w";
        setGameOver("checkmate", winner);

        if (winner === playerColor) {
          fireBonziReaction("player_checkmate");
        } else {
          fireBonziReaction("bonzi_checkmate");
        }
        return true;
      }
      if (chess.isStalemate()) {
        setGameOver("stalemate", "draw");
        fireBonziReaction("game_over_draw");
        return true;
      }
      if (chess.isInsufficientMaterial()) {
        setGameOver("insufficient", "draw");
        fireBonziReaction("game_over_draw");
        return true;
      }
      if (chess.isThreefoldRepetition()) {
        setGameOver("threefold", "draw");
        fireBonziReaction("game_over_draw");
        return true;
      }
      if (chess.isDraw()) {
        setGameOver("fifty_moves", "draw");
        fireBonziReaction("game_over_draw");
        return true;
      }
      return false;
    },
    [setGameOver, fireBonziReaction, playerColor]
  );

  // Engine move
  const doEngineMove = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || useBonziPlayStore.getState().phase !== "playing") return;

    setEngineThinking(true);
    fireBonziReaction("bonzi_thinking");

    try {
      const state = useBonziPlayStore.getState();
      const bonziColor = playerColor === "w" ? "b" : "w";
      const remainingMs =
        bonziColor === "w" ? state.whiteTimeMs : state.blackTimeMs;
      const thinkTime = computeEngineThinkTime(
        remainingMs,
        timeControl.incrementMs
      );

      const result = await engine.evaluateFromMoves(
        state.uciHistory,
        15,
        thinkTime
      );

      // Check if game is still in playing state
      if (useBonziPlayStore.getState().phase !== "playing") return;

      const bestMove = result.bestMove;
      if (!bestMove || bestMove === "(none)") return;

      const chess = gameRef.current;
      const from = bestMove.slice(0, 2);
      const to = bestMove.slice(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const moveResult = chess.move({ from, to, promotion });
      if (!moveResult) return;

      setFen(chess.fen());
      makeMove(moveResult.san, bestMove);
      applyIncrement(bonziColor);
      switchClock();

      // Detect events for Bonzi reaction
      if (chess.isCheckmate()) {
        checkGameOver(chess);
      } else if (chess.inCheck()) {
        fireBonziReaction("bonzi_check");
      } else if (moveResult.captured) {
        fireBonziReaction("bonzi_capture");
      } else {
        setBonziReaction("idle", undefined);
      }

      if (!chess.isGameOver()) {
        // No additional action needed, player's turn
      } else {
        checkGameOver(chess);
      }
    } catch (err) {
      console.error("Engine move failed:", err);
      setBonziReaction("idle", undefined);
    } finally {
      setEngineThinking(false);
    }
  }, [
    playerColor,
    timeControl.incrementMs,
    setEngineThinking,
    fireBonziReaction,
    setFen,
    makeMove,
    applyIncrement,
    switchClock,
    checkGameOver,
    setBonziReaction,
  ]);

  // Handle game start
  const handleStart = useCallback(() => {
    gameRef.current = new Chess();
    startGame();
    fireBonziReaction("game_start");

    // If player is black, engine moves first
    if (playerColor === "b") {
      // Small delay for UX
      setTimeout(() => doEngineMove(), 500);
    }
  }, [startGame, fireBonziReaction, playerColor, doEngineMove]);

  // Handle player move
  const handlePieceDrop = useCallback(
    (source: string, target: string, piece: string): boolean => {
      if (phase !== "playing" || engineThinking) return false;

      const chess = gameRef.current;

      // Only allow moves on player's turn
      if (chess.turn() !== playerColor) return false;

      const promotion = piece === "p" || piece === "P"
        ? (target[1] === "8" || target[1] === "1" ? "q" : undefined)
        : undefined;

      const moveResult = chess.move({ from: source, to: target, promotion });
      if (!moveResult) return false;

      const uci = source + target + (promotion ?? "");
      setFen(chess.fen());
      makeMove(moveResult.san, uci);
      applyIncrement(playerColor);
      switchClock();

      if (checkGameOver(chess)) return true;

      // Trigger engine move
      setTimeout(() => doEngineMove(), 50);
      return true;
    },
    [
      phase,
      engineThinking,
      playerColor,
      setFen,
      makeMove,
      applyIncrement,
      switchClock,
      checkGameOver,
      doEngineMove,
    ]
  );

  // Handle resign
  const handleResign = useCallback(() => {
    const winner: PlayerColor = playerColor === "w" ? "b" : "w";
    setGameOver("resign", winner);
    fireBonziReaction("player_resign");
  }, [playerColor, setGameOver, fireBonziReaction]);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    gameRef.current = new Chess();
    resetGame();
  }, [resetGame]);

  // Handle game over from timeout (watch store)
  useEffect(() => {
    if (phase === "game_over" && gameOverReason === "timeout") {
      const state = useBonziPlayStore.getState();
      if (state.gameOverWinner === playerColor) {
        fireBonziReaction("game_over_lose");
      } else {
        fireBonziReaction("game_over_win");
      }
    }
  }, [phase, gameOverReason, playerColor, fireBonziReaction]);

  // Cleanup bonzi timer
  useEffect(() => {
    return () => {
      if (bonziTimerRef.current) clearTimeout(bonziTimerRef.current);
    };
  }, []);

  // Setup screen
  if (phase === "setup") {
    return <PlaySetup onStart={handleStart} onBack={onExit} />;
  }

  // Format move history into pairs
  const movePairs: Array<{ num: number; white: string; black?: string }> = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1],
    });
  }

  const boardOrientation = playerColor === "w" ? "white" : "black";

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-purple-800 bg-purple-950 px-4 py-2">
        <span className="text-sm font-medium text-purple-100">
          Play vs Bonzi Buddy
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400">
            {timeControl.label}
          </span>
          {phase === "playing" && (
            <Button variant="outline" size="sm" onClick={handleResign}>
              Resign
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-2 sm:p-4 lg:grid-cols-[1fr_320px]">
        {/* Board */}
        <div className="relative flex items-center justify-center">
          <div className="w-[90%] max-w-[calc(100vh-14rem)]">
            <Board
              position={fen}
              interactive={phase === "playing" && !engineThinking}
              onPieceDrop={handlePieceDrop}
              boardOrientation={boardOrientation}
            />
          </div>

          {/* Game over overlay */}
          {phase === "game_over" && (
            <GameOverOverlay
              onPlayAgain={handlePlayAgain}
              onExit={onExit}
            />
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-lg border border-purple-800 bg-purple-950 p-3">
          {/* Bonzi avatar */}
          <div className="flex justify-center">
            <BonziAvatar gif={bonziGif} quip={bonziQuip} size="md" />
          </div>

          {/* Clocks */}
          <ChessClock playerColor={playerColor} />

          {/* Move history */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 font-mono text-xs">
              {movePairs.map((pair) => (
                <div
                  key={pair.num}
                  className="grid grid-cols-[2rem_1fr_1fr] gap-1 px-1"
                >
                  <span className="text-purple-500">{pair.num}.</span>
                  <span className="text-purple-200">{pair.white}</span>
                  <span className="text-purple-200">{pair.black ?? ""}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
