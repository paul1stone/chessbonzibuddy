"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useDemoActivation } from "./use-in-view";

// Scripted, no chess dependency: one 80 ms tick drives type -> fetch -> list -> hold -> loop.
const TICK_MS = 80;
const GAME_URL = "https://www.chess.com/game/live/…";
const TYPE_TICKS = GAME_URL.length;
const PROGRESS_TICKS = 15; // 1.2s
const BEAT_TICKS = 4; // ~300ms between rows, then between ticks
const HOLD_TICKS = 38; // ~3s on the finished state
const END_TICK = TYPE_TICKS + PROGRESS_TICKS + BEAT_TICKS * 6;
const TOTAL_TICKS = END_TICK + HOLD_TICKS;

const ROWS = [
  "you vs opponent - 5 min blitz",
  "opponent vs you - 10 min rapid",
  "you vs opponent - 3 min blitz",
];

interface Frame {
  typed: string;
  caret: boolean;
  progress: number;
  rows: number;
  checked: number;
}

function beats(ticksIn: number): number {
  if (ticksIn < 0) return 0;
  return Math.min(ROWS.length, Math.floor(ticksIn / BEAT_TICKS) + 1);
}

function frameAt(tick: number): Frame {
  const sinceType = tick - TYPE_TICKS;
  const sinceProgress = sinceType - PROGRESS_TICKS;
  return {
    typed: GAME_URL.slice(0, Math.min(tick, TYPE_TICKS)),
    caret: tick < TYPE_TICKS,
    progress: sinceType < 0 ? 0 : Math.min(1, sinceType / PROGRESS_TICKS),
    rows: beats(sinceProgress),
    checked: beats(sinceProgress - BEAT_TICKS * ROWS.length),
  };
}

const END_FRAME = frameAt(END_TICK);

export function ImportDemo() {
  const { ref, inView, reduced } = useDemoActivation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = setInterval(() => setTick((current) => (current + 1) % TOTAL_TICKS), TICK_MS);
    return () => clearInterval(timer);
  }, [reduced, inView]);

  const frame = reduced ? END_FRAME : frameAt(tick);

  return (
    <div ref={ref}>
      <p className="sr-only">
        Demo: a Chess.com game link is pasted, then three recent games are listed and ticked for import.
      </p>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <span>Game link</span>
        {/* Clipped, never wrapped: a long URL must not widen the window at 375px. */}
        <div className="r-input min-w-0 overflow-hidden whitespace-nowrap">
          {frame.typed}
          {frame.caret && <span className="ml-[1px] inline-block h-[11px] w-[6px] bg-[var(--r-dark)] align-middle" />}
        </div>
        <div className="r-progress">
          <div className="r-progress-fill" style={{ width: `${frame.progress * 100}%` }} />
        </div>
        <span>Recent games</span>
        <div className="r-bevel-in flex flex-col gap-1 bg-[var(--r-paper)] p-2">
          {ROWS.map((row, i) => (
            <div key={row} className={cn("flex min-w-0 items-center gap-2", i >= frame.rows && "invisible")}>
              <span className="r-bevel-in flex h-[13px] w-[13px] shrink-0 items-center justify-center bg-[var(--r-paper)]">
                {i < frame.checked && <span className="h-[7px] w-[7px] bg-[var(--r-dark)]" />}
              </span>
              <span className="truncate">{row}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
