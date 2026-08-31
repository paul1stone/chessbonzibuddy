"use client";

import { useEffect, useRef } from "react";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import type { PlayerColor } from "@/stores/bonzi-play-store";

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);

  if (ms < 10_000) {
    // Under 10 seconds: show SS.t
    const secs = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${secs}.${tenths}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface ClockDisplayProps {
  timeMs: number;
  isActive: boolean;
  label: string;
}

function ClockDisplay({ timeMs, isActive, label }: ClockDisplayProps) {
  const isLow = timeMs < 30_000 && timeMs > 0;
  const isCritical = timeMs < 10_000 && timeMs > 0;

  const digitColor = !isActive
    ? "text-[var(--r-shadow)]"
    : isCritical
      ? "text-[#800000]"
      : isLow
        ? "text-[#c08000]"
        : "text-[var(--r-dark)]";

  return (
    <div
      className={`r-bevel-in flex items-center justify-between px-2 py-1 ${
        isActive ? "bg-[var(--r-paper)]" : "bg-[var(--r-face-light)]"
      }`}
    >
      <span className="text-[11px] text-[var(--r-shadow)]">{label}</span>
      <span
        className={`r-term tabular-nums ${digitColor} ${
          isCritical && isActive ? "animate-pulse" : ""
        }`}
      >
        {formatTime(timeMs)}
      </span>
    </div>
  );
}

interface ChessClockProps {
  playerColor: PlayerColor;
}

export function ChessClock({ playerColor }: ChessClockProps) {
  const whiteTimeMs = useBonziPlayStore((s) => s.whiteTimeMs);
  const blackTimeMs = useBonziPlayStore((s) => s.blackTimeMs);
  const activeClockColor = useBonziPlayStore((s) => s.activeClockColor);
  const phase = useBonziPlayStore((s) => s.phase);
  const tickClock = useBonziPlayStore((s) => s.tickClock);

  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    if (phase !== "playing" || !activeClockColor) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();

    function tick() {
      const now = performance.now();
      // Only tick every ~100ms to avoid excessive re-renders
      if (now - lastTime >= 100) {
        tickClock(now);
        lastTime = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, activeClockColor, tickClock]);

  // Top clock = opponent, bottom clock = player
  const opponentColor: PlayerColor = playerColor === "w" ? "b" : "w";

  return (
    <div className="flex flex-col gap-1">
      <ClockDisplay
        timeMs={opponentColor === "w" ? whiteTimeMs : blackTimeMs}
        isActive={activeClockColor === opponentColor}
        label={opponentColor === "w" ? "White (Bonzi)" : "Black (Bonzi)"}
      />
      <ClockDisplay
        timeMs={playerColor === "w" ? whiteTimeMs : blackTimeMs}
        isActive={activeClockColor === playerColor}
        label={playerColor === "w" ? "White (You)" : "Black (You)"}
      />
    </div>
  );
}
