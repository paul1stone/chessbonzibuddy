"use client";

import { Button } from "@/components/ui/button";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import {
  useBonziPlayStore,
  TIME_CONTROLS,
} from "@/stores/bonzi-play-store";
import type { PlayerColor, TimeControl } from "@/stores/bonzi-play-store";

interface PlaySetupProps {
  onStart: () => void;
  onBack: () => void;
}

export function PlaySetup({ onStart, onBack }: PlaySetupProps) {
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const setPlayerColor = useBonziPlayStore((s) => s.setPlayerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
  const setTimeControl = useBonziPlayStore((s) => s.setTimeControl);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="stagger-children flex flex-col items-center gap-8">
        <div className="animate-float">
          <BonziAvatar gif="wave" quip="Ready to play? Pick your settings!" size="lg" />
        </div>

        <h2 className="text-2xl font-bold text-shimmer-gold">
          Play Bonzi Buddy
        </h2>

        {/* Color selection */}
        <div className="flex flex-col items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Choose your color
          </label>
          <div className="flex gap-2">
            {(["w", "b"] as PlayerColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setPlayerColor(c)}
                className={`flex h-12 w-24 items-center justify-center rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-[1.04] active:scale-95 ${
                  playerColor === c
                    ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span
                  className={`mr-2 inline-block h-4 w-4 rounded-sm ${
                    c === "w" ? "bg-white" : "bg-gray-800 border border-gray-600"
                  }`}
                />
                {c === "w" ? "White" : "Black"}
              </button>
            ))}
          </div>
        </div>

        {/* Time control selection */}
        <div className="flex flex-col items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Time control
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc.label}
                onClick={() => setTimeControl(tc)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.04] active:scale-95 ${
                  timeControl.label === tc.label
                    ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onStart}
            size="lg"
            className="transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Start Game
          </Button>
          <Button onClick={onBack} variant="outline" size="lg">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
