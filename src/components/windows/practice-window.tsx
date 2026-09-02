"use client";

import { PracticeView } from "@/components/practice/practice-view";
import { isCurrentAnalysis } from "@/lib/engine";
import { useGameStore } from "@/stores/game-store";
import { useWindowStore } from "@/stores/window-store";
import { WindowEmptyState } from "./window-empty-state";

/** Practice window body: drills the mistakes in the active game's analysis. */
export function PracticeWindow() {
  const activeGame = useGameStore((s) => s.activeGame);
  const open = useWindowStore((s) => s.open);
  const close = useWindowStore((s) => s.close);

  const analysis = activeGame?.analysis;

  // Never mount PracticeView without moves: no game, or an absent / pre-v2 analysis.
  if (!activeGame || !isCurrentAnalysis(analysis)) {
    return (
      <WindowEmptyState
        message="Mistakes from analyzed games become puzzles. Analyze a game first."
        actionLabel="Open My games"
        onAction={() => open("games")}
      />
    );
  }

  return (
    <PracticeView
      pgn={activeGame.pgn}
      moves={analysis.moves}
      onExit={() => close("practice")}
    />
  );
}
