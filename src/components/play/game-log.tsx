"use client";

import { useEffect, useMemo, useRef } from "react";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import type { LogEntry } from "@/stores/bonzi-play-store";

type MoveEntry = Extract<LogEntry, { type: "move" }>;

interface MoveRow {
  moveNum: number;
  white?: MoveEntry;
  black?: MoveEntry;
}

export function GameLog() {
  const gameLog = useBonziPlayStore((s) => s.gameLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const moves = gameLog.filter((e): e is MoveEntry => e.type === "move");
    const map = new Map<number, MoveRow>();
    for (const m of moves) {
      if (!map.has(m.moveNum)) {
        map.set(m.moveNum, { moveNum: m.moveNum });
      }
      const row = map.get(m.moveNum)!;
      if (m.color === "w") row.white = m;
      else row.black = m;
    }
    return Array.from(map.values()).sort((a, b) => a.moveNum - b.moveNum);
  }, [gameLog]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length]);

  return (
    <div className="r-bevel-in r-scroll min-h-0 flex-1 bg-[var(--r-paper)]">
      <div className="px-1 py-1">
        <div className="mb-1 grid grid-cols-[2rem_1fr_1fr] gap-x-1 border-b border-[var(--r-shadow)] pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--r-shadow)]">
          <span>#</span>
          <span>White</span>
          <span>Black</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.moveNum}
            className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 py-0.5 font-mono text-xs"
          >
            <span className="text-[var(--r-shadow)]">{row.moveNum}.</span>
            <span className={row.white?.isEngine ? "text-[var(--r-shadow)]" : undefined}>
              {row.white?.san ?? ""}
            </span>
            <span className={row.black?.isEngine ? "text-[var(--r-shadow)]" : undefined}>
              {row.black?.san ?? ""}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
