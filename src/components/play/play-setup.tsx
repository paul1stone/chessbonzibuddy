"use client";

import { RetroButton } from "@/components/retro";
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

// Same sunken bevel the taskbar uses for its pressed window buttons.
const SUNKEN = {
  boxShadow:
    "inset -1px -1px var(--r-highlight), inset 1px 1px var(--r-dark), inset -2px -2px var(--r-face-light), inset 2px 2px var(--r-shadow)",
};

export function PlaySetup({ onStart, onBack }: PlaySetupProps) {
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const setPlayerColor = useBonziPlayStore((s) => s.setPlayerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
  const setTimeControl = useBonziPlayStore((s) => s.setTimeControl);

  return (
    <div className="r-scroll flex h-full min-h-0 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <BonziAvatar gif="wave" quip="Ready to play? Pick your settings!" size="lg" />

        <h2 className="text-xl font-bold">Play Bonzi Buddy</h2>

        {/* Color selection */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--r-shadow)]">
            Choose your color
          </span>
          <div className="flex gap-2">
            {(["w", "b"] as PlayerColor[]).map((c) => (
              <RetroButton
                key={c}
                onClick={() => setPlayerColor(c)}
                aria-pressed={playerColor === c}
                style={playerColor === c ? SUNKEN : undefined}
                className="w-24 gap-2"
              >
                <span
                  className={`inline-block h-3 w-3 border border-[var(--r-dark)] ${
                    c === "w" ? "bg-[var(--r-paper)]" : "bg-[var(--r-dark)]"
                  }`}
                />
                {c === "w" ? "White" : "Black"}
              </RetroButton>
            ))}
          </div>
        </div>

        {/* Time control selection */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--r-shadow)]">
            Time control
          </span>
          <div className="grid grid-cols-3 gap-2">
            {TIME_CONTROLS.map((tc: TimeControl) => (
              <RetroButton
                key={tc.label}
                onClick={() => setTimeControl(tc)}
                aria-pressed={timeControl.label === tc.label}
                style={timeControl.label === tc.label ? SUNKEN : undefined}
                className="min-w-0 px-3"
              >
                {tc.label}
              </RetroButton>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <RetroButton onClick={onStart} variant="default" size="lg">
            Start game
          </RetroButton>
          <RetroButton onClick={onBack} size="lg">
            Back
          </RetroButton>
        </div>
      </div>
    </div>
  );
}
