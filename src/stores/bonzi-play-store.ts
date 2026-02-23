import { create } from "zustand";
import type { BonziGifState } from "@/lib/bonzi/types";

export type PlayPhase = "setup" | "playing" | "game_over";
export type PlayerColor = "w" | "b";

export type LogEntry =
  | { type: "move"; color: "w" | "b"; san: string; uci: string; moveNum: number; isEngine: boolean }
  | { type: "engine"; eval: number; mate: number | null; depth: number; thinkTimeMs: number; bestMove: string }
  | { type: "bonzi"; event: string; gif: string; quip: string }
  | { type: "game"; message: string };
export type TimeControl = {
  label: string;
  initialMs: number;
  incrementMs: number;
};

export const TIME_CONTROLS: TimeControl[] = [
  { label: "1+0", initialMs: 60_000, incrementMs: 0 },
  { label: "2+1", initialMs: 120_000, incrementMs: 1_000 },
  { label: "3+0", initialMs: 180_000, incrementMs: 0 },
  { label: "3+2", initialMs: 180_000, incrementMs: 2_000 },
  { label: "5+0", initialMs: 300_000, incrementMs: 0 },
  { label: "5+3", initialMs: 300_000, incrementMs: 3_000 },
  { label: "10+0", initialMs: 600_000, incrementMs: 0 },
  { label: "15+10", initialMs: 900_000, incrementMs: 10_000 },
  { label: "30+0", initialMs: 1_800_000, incrementMs: 0 },
];

export type GameOverReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "threefold"
  | "fifty_moves"
  | "timeout"
  | "resign";

interface BonziPlayState {
  phase: PlayPhase;
  playerColor: PlayerColor;
  timeControl: TimeControl;
  fen: string;
  moveHistory: string[]; // SAN moves
  uciHistory: string[]; // UCI moves for engine
  whiteTimeMs: number;
  blackTimeMs: number;
  activeClockColor: PlayerColor | null;
  lastTickTimestamp: number | null;
  gameOverReason: GameOverReason | null;
  gameOverWinner: PlayerColor | "draw" | null;
  bonziGif: BonziGifState;
  bonziQuip: string | undefined;
  engineThinking: boolean;
  gameLog: LogEntry[];
}

interface BonziPlayActions {
  setPhase: (phase: PlayPhase) => void;
  setPlayerColor: (color: PlayerColor) => void;
  setTimeControl: (tc: TimeControl) => void;
  startGame: () => void;
  makeMove: (san: string, uci: string) => void;
  setFen: (fen: string) => void;
  tickClock: (now: number) => void;
  applyIncrement: (color: PlayerColor) => void;
  switchClock: () => void;
  stopClocks: () => void;
  setGameOver: (reason: GameOverReason, winner: PlayerColor | "draw") => void;
  setBonziReaction: (gif: BonziGifState, quip?: string) => void;
  setEngineThinking: (val: boolean) => void;
  addLogEntry: (entry: LogEntry) => void;
  resetGame: () => void;
  flagTimeout: (color: PlayerColor) => void;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const DEFAULT_TC = TIME_CONTROLS[4]; // 5+0

export const useBonziPlayStore = create<BonziPlayState & BonziPlayActions>(
  (set, get) => ({
    phase: "setup",
    playerColor: "w",
    timeControl: DEFAULT_TC,
    fen: START_FEN,
    moveHistory: [],
    uciHistory: [],
    whiteTimeMs: DEFAULT_TC.initialMs,
    blackTimeMs: DEFAULT_TC.initialMs,
    activeClockColor: null,
    lastTickTimestamp: null,
    gameOverReason: null,
    gameOverWinner: null,
    bonziGif: "idle",
    bonziQuip: undefined,
    engineThinking: false,
    gameLog: [],

    setPhase: (phase) => set({ phase }),
    setPlayerColor: (color) => set({ playerColor: color }),
    setTimeControl: (tc) =>
      set({ timeControl: tc, whiteTimeMs: tc.initialMs, blackTimeMs: tc.initialMs }),

    startGame: () => {
      const tc = get().timeControl;
      set({
        phase: "playing",
        fen: START_FEN,
        moveHistory: [],
        uciHistory: [],
        whiteTimeMs: tc.initialMs,
        blackTimeMs: tc.initialMs,
        activeClockColor: "w",
        lastTickTimestamp: performance.now(),
        gameOverReason: null,
        gameOverWinner: null,
        bonziGif: "idle",
        bonziQuip: undefined,
        engineThinking: false,
        gameLog: [],
      });
    },

    makeMove: (san, uci) =>
      set((s) => ({
        moveHistory: [...s.moveHistory, san],
        uciHistory: [...s.uciHistory, uci],
      })),

    setFen: (fen) => set({ fen }),

    tickClock: (now) => {
      const { activeClockColor, lastTickTimestamp, phase } = get();
      if (phase !== "playing" || !activeClockColor || lastTickTimestamp === null)
        return;

      const elapsed = now - lastTickTimestamp;
      if (elapsed <= 0) return;

      const key =
        activeClockColor === "w" ? "whiteTimeMs" : "blackTimeMs";
      const currentTime = get()[key];
      const newTime = Math.max(0, currentTime - elapsed);

      set({ [key]: newTime, lastTickTimestamp: now } as Partial<BonziPlayState>);

      if (newTime <= 0) {
        get().flagTimeout(activeClockColor);
      }
    },

    applyIncrement: (color) => {
      const inc = get().timeControl.incrementMs;
      if (inc <= 0) return;
      const key = color === "w" ? "whiteTimeMs" : "blackTimeMs";
      set({ [key]: get()[key] + inc } as Partial<BonziPlayState>);
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

    setBonziReaction: (gif, quip) => set({ bonziGif: gif, bonziQuip: quip }),

    setEngineThinking: (val) => set({ engineThinking: val }),

    addLogEntry: (entry) =>
      set((s) => ({ gameLog: [...s.gameLog, entry] })),

    resetGame: () => {
      const tc = get().timeControl;
      set({
        phase: "setup",
        fen: START_FEN,
        moveHistory: [],
        uciHistory: [],
        whiteTimeMs: tc.initialMs,
        blackTimeMs: tc.initialMs,
        activeClockColor: null,
        lastTickTimestamp: null,
        gameOverReason: null,
        gameOverWinner: null,
        bonziGif: "idle",
        bonziQuip: undefined,
        engineThinking: false,
        gameLog: [],
      });
    },

    flagTimeout: (color) => {
      const winner: PlayerColor = color === "w" ? "b" : "w";
      get().setGameOver("timeout", winner);
    },
  })
);
