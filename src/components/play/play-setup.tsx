"use client";

import { RetroButton, RetroPanel } from "@/components/retro";
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

// A 23px button is a miss on a finger, and the time grid packs three rows 8px apart — too dense
// for .hit-44's overlay to grow into without stealing its neighbour's taps. Height for real.
// The ! is for r-btn's unlayered min-height, which outranks a plain utility.
const TOUCH_H = "pointer-coarse:min-h-11!";

export function PlaySetup({ onStart, onBack }: PlaySetupProps) {
  const playerColor = useBonziPlayStore((s) => s.playerColor);
  const setPlayerColor = useBonziPlayStore((s) => s.setPlayerColor);
  const timeControl = useBonziPlayStore((s) => s.timeControl);
  const setTimeControl = useBonziPlayStore((s) => s.setTimeControl);

  return (
    <div className="r-scroll flex h-full min-h-0 items-center justify-center p-4">
      {/* A1: the settings sit in real Win98 group boxes, so the setup reads as a dialog
          instead of a column of text floating in a 960x640 window. */}
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
        <BonziAvatar gif="wave" quip="Ready to play? Pick your settings!" size="lg" />

        <h2 className="text-xl font-bold">Play Bonzi Buddy</h2>

        <RetroPanel caption="Choose your color" className="w-full">
          <div className="flex justify-center gap-2">
            {(["w", "b"] as PlayerColor[]).map((c) => (
              <RetroButton
                key={c}
                onClick={() => setPlayerColor(c)}
                aria-pressed={playerColor === c}
                style={playerColor === c ? SUNKEN : undefined}
                className={`w-24 gap-2 ${TOUCH_H}`}
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
        </RetroPanel>

        <RetroPanel caption="Time control" className="w-full">
          <div className="grid grid-cols-3 gap-2">
            {TIME_CONTROLS.map((tc: TimeControl) => (
              <RetroButton
                key={tc.label}
                onClick={() => setTimeControl(tc)}
                aria-pressed={timeControl.label === tc.label}
                style={timeControl.label === tc.label ? SUNKEN : undefined}
                className={TOUCH_H}
              >
                {tc.label}
              </RetroButton>
            ))}
          </div>
        </RetroPanel>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <RetroButton onClick={onStart} variant="default" size="lg" className="hit-44">
            Start game
          </RetroButton>
          <RetroButton onClick={onBack} size="lg" className="hit-44">
            Back
          </RetroButton>
        </div>
      </div>
    </div>
  );
}
