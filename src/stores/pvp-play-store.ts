import { create } from "zustand";
import {
  TIME_CONTROLS,
  type PlayerColor,
  type TimeControl,
} from "@/stores/bonzi-play-store";

export type PvpPhase = "setup" | "playing" | "game_over";

export type PvpGameOverReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "threefold"
  | "fifty_moves"
  | "timeout"
  | "resign"
  | "draw_agreed";

export interface PvpMove {
  san: string;
  color: PlayerColor;
  moveNum: number;
}

interface PvpPlayState {
  phase: PvpPhase;
  whiteName: string;
  blackName: string;
  timeControl: TimeControl;
  autoFlip: boolean;
  fen: string;
  moveHistory: PvpMove[];
  lastMove: { from: string; to: string } | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  activeClockColor: PlayerColor | null;
  lastTickTimestamp: number | null;
  gameOverReason: PvpGameOverReason | null;
  gameOverWinner: PlayerColor | "draw" | null;
}

interface PvpPlayActions {
  setWhiteName: (name: string) => void;
  setBlackName: (name: string) => void;
  setTimeControl: (tc: TimeControl) => void;
  setAutoFlip: (val: boolean) => void;
  startGame: () => void;
  recordMove: (move: PvpMove, fen: string, from: string, to: string) => void;
  tickClock: (now: number) => void;
  applyIncrement: (color: PlayerColor) => void;
  switchClock: () => void;
  stopClocks: () => void;
  setGameOver: (reason: PvpGameOverReason, winner: PlayerColor | "draw") => void;
  resetGame: () => void;
  flagTimeout: (color: PlayerColor) => void;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const DEFAULT_TC = TIME_CONTROLS[4]; // 5+0

export const usePvpPlayStore = create<PvpPlayState & PvpPlayActions>(
  (set, get) => ({
    phase: "setup",
    whiteName: "",
    blackName: "",
    timeControl: DEFAULT_TC,
    autoFlip: true,
    fen: START_FEN,
    moveHistory: [],
    lastMove: null,
    whiteTimeMs: DEFAULT_TC.initialMs,
    blackTimeMs: DEFAULT_TC.initialMs,
    activeClockColor: null,
    lastTickTimestamp: null,
    gameOverReason: null,
    gameOverWinner: null,

    setWhiteName: (name) => set({ whiteName: name }),
    setBlackName: (name) => set({ blackName: name }),
    setTimeControl: (tc) =>
      set({
        timeControl: tc,
        whiteTimeMs: tc.initialMs,
        blackTimeMs: tc.initialMs,
      }),
    setAutoFlip: (val) => set({ autoFlip: val }),

    startGame: () => {
      const tc = get().timeControl;
      set({
        phase: "playing",
        fen: START_FEN,
        moveHistory: [],
        lastMove: null,
        whiteTimeMs: tc.initialMs,
        blackTimeMs: tc.initialMs,
        activeClockColor: "w",
        lastTickTimestamp: performance.now(),
        gameOverReason: null,
        gameOverWinner: null,
      });
    },

    recordMove: (move, fen, from, to) =>
      set((s) => ({
        moveHistory: [...s.moveHistory, move],
        fen,
        lastMove: { from, to },
      })),

    tickClock: (now) => {
      const { activeClockColor, lastTickTimestamp, phase } = get();
      if (phase !== "playing" || !activeClockColor || lastTickTimestamp === null)
        return;

      const elapsed = now - lastTickTimestamp;
      if (elapsed <= 0) return;

      const key = activeClockColor === "w" ? "whiteTimeMs" : "blackTimeMs";
      const currentTime = get()[key];
      const newTime = Math.max(0, currentTime - elapsed);

      set({ [key]: newTime, lastTickTimestamp: now } as Partial<PvpPlayState>);

      if (newTime <= 0) {
        get().flagTimeout(activeClockColor);
      }
    },

    applyIncrement: (color) => {
      const inc = get().timeControl.incrementMs;
      if (inc <= 0) return;
      const key = color === "w" ? "whiteTimeMs" : "blackTimeMs";
      set({ [key]: get()[key] + inc } as Partial<PvpPlayState>);
    },

    switchClock: () => {
      const { activeClockColor } = get();
      if (!activeClockColor) return;
      const next: PlayerColor = activeClockColor === "w" ? "b" : "w";
      set({ activeClockColor: next, lastTickTimestamp: performance.now() });
    },

    stopClocks: () => set({ activeClockColor: null, lastTickTimestamp: null }),

    setGameOver: (reason, winner) => {
      get().stopClocks();
      set({
        phase: "game_over",
        gameOverReason: reason,
        gameOverWinner: winner,
      });
    },

    resetGame: () => {
      const tc = get().timeControl;
      set({
        phase: "setup",
        fen: START_FEN,
        moveHistory: [],
        lastMove: null,
        whiteTimeMs: tc.initialMs,
        blackTimeMs: tc.initialMs,
        activeClockColor: null,
        lastTickTimestamp: null,
        gameOverReason: null,
        gameOverWinner: null,
      });
    },

    flagTimeout: (color) => {
      const winner: PlayerColor = color === "w" ? "b" : "w";
      get().setGameOver("timeout", winner);
    },
  })
);
