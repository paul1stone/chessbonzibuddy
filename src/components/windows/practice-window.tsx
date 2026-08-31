"use client";

import { PracticeView } from "@/components/practice/practice-view";
import { RetroButton } from "@/components/retro";
import { isCurrentAnalysis } from "@/lib/engine";
import { useGameStore } from "@/stores/game-store";
import { useWindowStore } from "@/stores/window-store";

/** Practice window body: drills the mistakes in the active game's analysis. */
export function PracticeWindow() {
  const activeGame = useGameStore((s) => s.activeGame);
  const open = useWindowStore((s) => s.open);
  const close = useWindowStore((s) => s.close);

  const analysis = activeGame?.analysis;

  // Never mount PracticeView without moves: no game, or an absent / pre-v2 analysis.
  if (!activeGame || !isCurrentAnalysis(analysis)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p>Analyze a game first.</p>
        <RetroButton onClick={() => open("games")}>Open my games</RetroButton>
      </div>
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
