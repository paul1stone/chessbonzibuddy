import { create } from "zustand";
import type { Game } from "@/db/schema";

interface GameState {
  games: Game[];
  activeGame: Game | null;
  activeMove: number;
  isAnalyzing: boolean;
  analysisProgress: number;
  view: "import" | "review" | "practice";
}

interface GameActions {
  setGames: (games: Game[]) => void;
  setActiveGame: (game: Game | null) => void;
  addGame: (game: Game) => void;
  setActiveMove: (move: number) => void;
  setIsAnalyzing: (val: boolean) => void;
  setAnalysisProgress: (progress: number) => void;
  setView: (view: GameState["view"]) => void;
}

export const useGameStore = create<GameState & GameActions>((set) => ({
  games: [],
  activeGame: null,
  activeMove: 0,
  isAnalyzing: false,
  analysisProgress: 0,
  view: "import",
  setGames: (games) => set({ games }),
  setActiveGame: (game) =>
    set({ activeGame: game, activeMove: 0, view: game ? "review" : "import" }),
  addGame: (game) => set((state) => ({ games: [game, ...state.games] })),
  setActiveMove: (move) => set({ activeMove: move }),
  setIsAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setView: (view) => set({ view }),
}));
