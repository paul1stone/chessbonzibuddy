import { create } from "zustand";
import type { Game } from "@/db/schema";

interface GameState {
  games: Game[];
  activeGame: Game | null;
  activeMove: number;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisQueue: Game[];
  view: "import" | "review" | "practice";
}

interface GameActions {
  setGames: (games: Game[]) => void;
  setActiveGame: (game: Game | null) => void;
  addGame: (game: Game) => void;
  removeGame: (id: string) => void;
  setActiveMove: (move: number) => void;
  setIsAnalyzing: (val: boolean) => void;
  setAnalysisProgress: (progress: number) => void;
  setView: (view: GameState["view"]) => void;
  enqueueAnalysis: (games: Game[]) => void;
  dequeueAnalysis: () => Game | undefined;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  games: [],
  activeGame: null,
  activeMove: 0,
  isAnalyzing: false,
  analysisProgress: 0,
  analysisQueue: [],
  view: "import",
  setGames: (games) => set({ games }),
  setActiveGame: (game) =>
    set({ activeGame: game, activeMove: 0, view: game ? "review" : "import" }),
  addGame: (game) => set((state) => ({ games: [game, ...state.games] })),
  removeGame: (id) =>
    set((state) => ({
      games: state.games.filter((g) => g.id !== id),
      activeGame: state.activeGame?.id === id ? null : state.activeGame,
      view: state.activeGame?.id === id ? "import" : state.view,
    })),
  setActiveMove: (move) => set({ activeMove: move }),
  setIsAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setView: (view) => set({ view }),
  enqueueAnalysis: (games) =>
    set((state) => ({
      analysisQueue: [...state.analysisQueue, ...games],
    })),
  dequeueAnalysis: () => {
    const queue = get().analysisQueue;
    if (queue.length === 0) return undefined;
    const [next, ...rest] = queue;
    set({ analysisQueue: rest });
    return next;
  },
}));
