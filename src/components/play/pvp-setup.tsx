"use client";

import { Swords, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePvpPlayStore } from "@/stores/pvp-play-store";
import { TIME_CONTROLS } from "@/stores/bonzi-play-store";

interface PvpSetupProps {
  onStart: () => void;
  onBack: () => void;
}

export function PvpSetup({ onStart, onBack }: PvpSetupProps) {
  const whiteName = usePvpPlayStore((s) => s.whiteName);
  const blackName = usePvpPlayStore((s) => s.blackName);
  const setWhiteName = usePvpPlayStore((s) => s.setWhiteName);
  const setBlackName = usePvpPlayStore((s) => s.setBlackName);
  const timeControl = usePvpPlayStore((s) => s.timeControl);
  const setTimeControl = usePvpPlayStore((s) => s.setTimeControl);
  const autoFlip = usePvpPlayStore((s) => s.autoFlip);
  const setAutoFlip = usePvpPlayStore((s) => s.setAutoFlip);

  const swapNames = () => {
    setWhiteName(blackName);
    setBlackName(whiteName);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="stagger-children flex w-full max-w-md flex-col items-center gap-7">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 animate-glow">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-shimmer-gold">1v1 a Friend</h2>
          <p className="text-sm text-muted-foreground">
            Pass and play on this device
          </p>
        </div>

        {/* Player names */}
        <div className="flex w-full items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-3 w-3 rounded-sm border border-border bg-white" />
              White
            </label>
            <Input
              placeholder="Player 1"
              value={whiteName}
              onChange={(e) => setWhiteName(e.target.value)}
              maxLength={20}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground transition-transform duration-300 hover:rotate-180 hover:text-foreground"
            onClick={swapNames}
            aria-label="Swap colors"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-3 w-3 rounded-sm border border-zinc-600 bg-zinc-900" />
              Black
            </label>
            <Input
              placeholder="Player 2"
              value={blackName}
              onChange={(e) => setBlackName(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        {/* Time control selection */}
        <div className="flex w-full flex-col items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Time control
          </label>
          <div className="grid w-full grid-cols-3 gap-2">
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

        {/* Auto-flip toggle */}
        <button
          onClick={() => setAutoFlip(!autoFlip)}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-primary/40"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
              autoFlip ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background transition-transform duration-200 ${
                autoFlip ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
          <span className="text-sm text-foreground/90">
            Flip board each turn
          </span>
        </button>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button
            onClick={onStart}
            size="lg"
            className="transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Swords className="mr-1 h-4 w-4" />
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
