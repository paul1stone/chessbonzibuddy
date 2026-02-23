"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBonziPlayStore } from "@/stores/bonzi-play-store";
import type { LogEntry } from "@/stores/bonzi-play-store";

function formatEval(entry: Extract<LogEntry, { type: "engine" }>): string {
  const evalStr = entry.mate !== null
    ? `M${entry.mate}`
    : `${entry.eval >= 0 ? "+" : ""}${(entry.eval / 100).toFixed(2)}`;
  const time = (entry.thinkTimeMs / 1000).toFixed(1);
  return `Engine: ${evalStr} d${entry.depth} ${time}s`;
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  switch (entry.type) {
    case "game":
      return (
        <div className="px-1 py-0.5 text-xs font-bold text-purple-200">
          {entry.message}
        </div>
      );
    case "move": {
      const prefix = entry.color === "w"
        ? `${entry.moveNum}. `
        : `${entry.moveNum}... `;
      return (
        <div
          className={`px-1 py-0.5 font-mono text-xs ${
            entry.isEngine ? "text-purple-400" : "text-purple-100"
          }`}
        >
          {prefix}
          {entry.san}
        </div>
      );
    }
    case "engine":
      return (
        <div className="px-1 py-0.5 font-mono text-xs text-purple-600">
          {formatEval(entry)}
        </div>
      );
    case "bonzi":
      return (
        <div className="px-1 py-0.5 text-xs italic text-purple-300">
          Bonzi [{entry.gif}]: &quot;{entry.quip}&quot;
        </div>
      );
  }
}

export function GameLog() {
  const gameLog = useBonziPlayStore((s) => s.gameLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameLog.length]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-0">
        {gameLog.map((entry, i) => (
          <LogEntryRow key={i} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
