"use client";

import { useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Board } from "@/components/chess/board";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { ChessClock } from "./chess-clock";
import { GameLog } from "./game-log";
import { GameOverOverlay } from "./game-over-overlay";
import { PlaySetup } from "./play-setup";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import { getBonziReaction } from "@/lib/bonzi/bonzi-engine";
import { StockfishEngine } from "@/lib/engine";
import { useBoardSize } from "@/hooks/use-board-size";
import { RetroButton } from "@/components/retro";
import type { BonziEvent } from "@/lib/bonzi/types";
import type { PlayerColor } from "@/stores/bonzi-play-store";

interface PlayViewProps {
  onExit: () => void;
}

export function PlayView({ onExit }: PlayViewProps) {
  const phase = useBonziPlayStore((s) => s.phase);
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
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
  const addLogEntry = useBonziPlayStore((s) => s.addLogEntry);
  const resetGame = useBonziPlayStore((s) => s.resetGame);

  const engineRef = useRef<StockfishEngine | null>(null);
  // Resolves to the configured engine once init completes (null on failure/unmount),
  // so a move made during the ~3.5s init WAITS instead of being silently dropped.
  const engineReadyRef = useRef<Promise<StockfishEngine | null> | null>(null);
  const gameRef = useRef<Chess>(new Chess());
  const bonziTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    let mounted = true;

    engineReadyRef.current = engine.init().then(() => {
      if (!mounted) {
        engine.quit();
        return null;
      }
      // Configure for max strength
      engine.setOption("Skill Level", 20);
      engine.setOption("Hash", 128);
      // Account for browser Web Worker message-passing overhead
      engine.setOption("Move Overhead", 150);
      engineRef.current = engine;
      return engine;
    }).catch((err) => {
      // Suppress init errors from strict-mode double-mount (engine was quit mid-init)
      if (mounted) {
        console.error("Engine init failed:", err);
      }
      return null;
    });

    return () => {
      mounted = false;
      // Quit the engine whether it's finished init or still loading
      engine.quit();
      engineRef.current = null;
      engineReadyRef.current = null;
    };
  }, []);

  // Fire a Bonzi reaction with auto-revert
  const fireBonziReaction = useCallback(
    (event: BonziEvent) => {
      if (bonziTimerRef.current) clearTimeout(bonziTimerRef.current);
      const reaction = getBonziReaction(event);
      setBonziReaction(reaction.gif, reaction.quip);

      if (reaction.quip) {
        addLogEntry({ type: "bonzi", event, gif: reaction.gif, quip: reaction.quip });
      }

      bonziTimerRef.current = setTimeout(() => {
        setBonziReaction("idle", undefined);
      }, reaction.duration);
    },
    [setBonziReaction, addLogEntry]
  );

  // Detect game-ending conditions
  const checkGameOver = useCallback(
    (chess: Chess): boolean => {
      let reason: string | null = null;
      let winner: PlayerColor | "draw" | null = null;

      if (chess.isCheckmate()) {
        const loser: PlayerColor = chess.turn() === "w" ? "w" : "b";
        winner = loser === "w" ? "b" : "w";
        reason = "checkmate";
        setGameOver("checkmate", winner);
        if (winner === playerColor) {
          fireBonziReaction("player_checkmate");
        } else {
          fireBonziReaction("bonzi_checkmate");
        }
      } else if (chess.isStalemate()) {
        reason = "stalemate";
        winner = "draw";
        setGameOver("stalemate", "draw");
        fireBonziReaction("game_over_draw");
      } else if (chess.isInsufficientMaterial()) {
        reason = "insufficient material";
        winner = "draw";
        setGameOver("insufficient", "draw");
        fireBonziReaction("game_over_draw");
      } else if (chess.isThreefoldRepetition()) {
        reason = "threefold repetition";
        winner = "draw";
        setGameOver("threefold", "draw");
        fireBonziReaction("game_over_draw");
      } else if (chess.isDraw()) {
        reason = "fifty-move rule";
        winner = "draw";
        setGameOver("fifty_moves", "draw");
        fireBonziReaction("game_over_draw");
      }

      if (reason) {
        const result = winner === "draw" ? "Draw" : winner === "w" ? "White wins" : "Black wins";
        addLogEntry({ type: "game", message: `Game over — ${result} by ${reason}` });
        const pgn = chess.pgn();
        addLogEntry({ type: "game", message: `PGN: ${pgn}` });
        console.log("[Game PGN]", pgn);
        return true;
      }
      return false;
    },
    [setGameOver, fireBonziReaction, playerColor, addLogEntry]
  );

  // Engine move
  const doEngineMove = useCallback(async () => {
    // Wait out engine init rather than dropping the move (a drop bricked the game).
    const engine = engineRef.current ?? (await (engineReadyRef.current ?? Promise.resolve(null)));
    if (!engine || useBonziPlayStore.getState().phase !== "playing") return;

    setEngineThinking(true);
    fireBonziReaction("bonzi_thinking");

    try {
      const state = useBonziPlayStore.getState();
      const bonziColor = playerColor === "w" ? "b" : "w";

      const thinkStart = performance.now();
      const result = await engine.evaluateWithClock(
        state.uciHistory,
        state.whiteTimeMs,
        state.blackTimeMs,
        timeControl.incrementMs,
        timeControl.incrementMs
      );
      const thinkTimeMs = Math.round(performance.now() - thinkStart);

      // Check if game is still in playing state
      if (useBonziPlayStore.getState().phase !== "playing") return;

      const bestMove = result.bestMove;
      if (!bestMove || bestMove === "(none)") return;

      // Log engine evaluation
      addLogEntry({
        type: "engine",
        eval: result.eval,
        mate: result.mate,
        depth: result.depth,
        thinkTimeMs,
        bestMove,
      });

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

      // Log engine's move (state.moveHistory is pre-makeMove snapshot)
      const moveNum = Math.floor(state.moveHistory.length / 2) + 1;
      addLogEntry({
        type: "move",
        color: bonziColor,
        san: moveResult.san,
        uci: bestMove,
        moveNum,
        isEngine: true,
      });

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
    addLogEntry,
  ]);

  // Handle game start
  const handleStart = useCallback(() => {
    gameRef.current = new Chess();
    startGame();

    const colorLabel = playerColor === "w" ? "white" : "black";
    addLogEntry({ type: "game", message: `Game started — Player: ${colorLabel}, Time: ${timeControl.label}` });
    fireBonziReaction("game_start");

    // If player is black, engine moves first
    if (playerColor === "b") {
      // Small delay for UX
      setTimeout(() => doEngineMove(), 500);
    }
  }, [startGame, fireBonziReaction, playerColor, doEngineMove, addLogEntry, timeControl.label]);

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

      // Log player's move
      const state = useBonziPlayStore.getState();
      const moveNum = Math.ceil(state.moveHistory.length / 2);
      addLogEntry({
        type: "move",
        color: playerColor,
        san: moveResult.san,
        uci,
        moveNum,
        isEngine: false,
      });

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
      addLogEntry,
    ]
  );

  // Handle resign
  const handleResign = useCallback(() => {
    const winner: PlayerColor = playerColor === "w" ? "b" : "w";
    setGameOver("resign", winner);
    const result = winner === "w" ? "White wins" : "Black wins";
    addLogEntry({ type: "game", message: `Game over — ${result} by resignation` });
    const pgn = gameRef.current.pgn();
    addLogEntry({ type: "game", message: `PGN: ${pgn}` });
    console.log("[Game PGN]", pgn);
    fireBonziReaction("player_resign");
  }, [playerColor, setGameOver, fireBonziReaction, addLogEntry]);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    gameRef.current = new Chess();
    resetGame();
  }, [resetGame]);

  // Handle game over from timeout (watch store)
  useEffect(() => {
    if (phase === "game_over" && gameOverReason === "timeout") {
      const state = useBonziPlayStore.getState();
      const result = state.gameOverWinner === "w" ? "White wins" : "Black wins";
      addLogEntry({ type: "game", message: `Game over — ${result} on time` });
      const pgn = gameRef.current.pgn();
      addLogEntry({ type: "game", message: `PGN: ${pgn}` });
      console.log("[Game PGN]", pgn);
      if (state.gameOverWinner === playerColor) {
        fireBonziReaction("game_over_lose");
      } else {
        fireBonziReaction("game_over_win");
      }
    }
  }, [phase, gameOverReason, playerColor, fireBonziReaction, addLogEntry]);

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

  return (
    <PlayBoard
      onPieceDrop={handlePieceDrop}
      onResign={handleResign}
      onPlayAgain={handlePlayAgain}
      onExit={onExit}
    />
  );
}

interface PlayBoardProps {
  onPieceDrop: (source: string, target: string, piece: string) => boolean;
  onResign: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
}

/**
 * Live-game body. Split from PlayView so useBoardSize mounts with the board
 * container in the tree (PlayView also renders the setup screen, where it isn't).
 */
function PlayBoard({ onPieceDrop, onResign, onPlayAgain, onExit }: PlayBoardProps) {
  const phase = useBonziPlayStore((s) => s.phase);
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
  const fen = useBonziPlayStore((s) => s.fen);
  const bonziGif = useBonziPlayStore((s) => s.bonziGif);
  const bonziQuip = useBonziPlayStore((s) => s.bonziQuip);
  const engineThinking = useBonziPlayStore((s) => s.engineThinking);

  // Board fills its grid cell; 8px reserves the board's bevel frame.
  const { ref: boardAreaRef, width: boardWidth } = useBoardSize({ h: 8 });

  const boardOrientation = playerColor === "w" ? "white" : "black";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <div className="r-face flex shrink-0 items-center justify-between px-2 py-1">
        <span className="font-bold">Play vs Bonzi Buddy</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--r-shadow)]">{timeControl.label}</span>
          {phase === "playing" && (
            <RetroButton
              onClick={onResign}
              className="min-w-0! px-2! text-[11px]!"
            >
              Resign
            </RetroButton>
          )}
        </div>
      </div>
      <div className="r-sep shrink-0" />

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,50%)] gap-2 pt-2 lg:grid-cols-[1fr_300px] lg:grid-rows-1">
        {/* Board */}
        <div
          ref={boardAreaRef}
          className="relative flex min-h-0 items-center justify-center"
        >
          {boardWidth > 0 && (
            <Board
              position={fen}
              interactive={phase === "playing" && !engineThinking}
              onPieceDrop={onPieceDrop}
              boardOrientation={boardOrientation}
              boardWidth={boardWidth}
            />
          )}

          {/* Game over overlay */}
          {phase === "game_over" && (
            <GameOverOverlay onPlayAgain={onPlayAgain} onExit={onExit} />
          )}
        </div>

        {/* Side panel */}
        <div className="r-bevel-in flex min-h-0 flex-col gap-2 overflow-hidden bg-[var(--r-face-light)] p-2">
          {/* Bonzi avatar + clocks: side by side until the panel moves to the right column */}
          <div className="flex shrink-0 items-end gap-2 lg:flex-col lg:items-stretch">
            <div className="flex shrink-0 justify-center lg:w-full">
              <BonziAvatar gif={bonziGif} quip={bonziQuip} size="md" />
            </div>
            <div className="min-w-0 flex-1 lg:w-full">
              <ChessClock playerColor={playerColor} />
            </div>
          </div>

          {/* Move list */}
          <div className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--r-shadow)]">
            Moves
          </div>
          <GameLog />
        </div>
      </div>
    </div>
  );
}
