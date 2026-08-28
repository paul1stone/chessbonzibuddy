"use client";

import { useEffect, useRef, useState } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { RetroWindow } from "@/components/retro";
import { getBonziReaction } from "@/lib/bonzi/bonzi-engine";
import { QUIP_MAP } from "@/lib/bonzi/quips";
import type { BonziEvent, BonziGifState } from "@/lib/bonzi/types";
import { usePrefersReducedMotion } from "@/lib/motion";

const SCRIPT: BonziEvent[] = ["game_start", "bonzi_capture", "bonzi_check", "bonzi_checkmate"];
const STEP_MS = 2800;
const LOOP_PAUSE_MS = 4000;
const MAX_LOG = 8;

interface LogLine {
  key: number;
  event: BonziEvent;
  gif: BonziGifState;
  quip: string;
}

// Deterministic first line so server and client render the same markup.
const FIRST_LINE: LogLine = { key: 0, event: "game_start", gif: "wave", quip: QUIP_MAP.game_start.quips[0] };
const STATIC_LINES: LogLine[] = SCRIPT.map((event, i) => ({
  key: i,
  event,
  gif: QUIP_MAP[event].gif,
  quip: QUIP_MAP[event].quips[0],
}));

const LABELS: Partial<Record<BonziEvent, string>> = {
  game_start: "game start",
  bonzi_capture: "capture",
  bonzi_check: "check",
  bonzi_checkmate: "checkmate",
};

export function BonziShowcase() {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const [log, setLog] = useState<LogLine[]>([FIRST_LINE]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.5), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;
    let step = 1;
    let timer = 0;
    const next = () => {
      const event = SCRIPT[step % SCRIPT.length];
      const reaction = getBonziReaction(event);
      setLog((lines) => [...lines.slice(-(MAX_LOG - 1)), { key: Date.now(), event, gif: reaction.gif, quip: reaction.quip }]);
      step += 1;
      timer = window.setTimeout(next, event === "bonzi_checkmate" ? STEP_MS + LOOP_PAUSE_MS : STEP_MS);
    };
    timer = window.setTimeout(next, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [reduced, inView]);

  const lines = reduced ? STATIC_LINES : log;
  const current = lines[lines.length - 1];

  return (
    <RetroWindow ref={ref} title="BonziBUDDY.exe" className="mx-auto w-[min(92vw,860px)]" aria-labelledby="showcase-heading">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center justify-center gap-3">
          {reduced ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/bonzi/idle-still.png" alt="Bonzi Buddy" className="h-24 w-24" />
          ) : (
            <BonziAvatar gif={current.gif} quip={current.quip} size="lg" />
          )}
        </div>
        <div>
          <h2 id="showcase-heading" className="text-[22px] font-bold leading-tight">
            Stockfish moves, playground mouth.
          </h2>
          <p className="r-body mt-2">
            Every capture, check, and checkmate gets a comment. The lines are hand-written and he never repeats one within three turns.
          </p>
          <ol className="r-paper r-bevel-in r-term mt-4 h-[180px] overflow-hidden p-3" aria-label="Game log">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-3">
                <span className="text-[var(--r-disabled)]">[{LABELS[line.event] ?? line.event}]</span>
                <span>Bonzi: {line.quip}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </RetroWindow>
  );
}
