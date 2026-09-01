"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RetroButton, RetroWindow } from "@/components/retro";
import TerminalWindow from "@/components/windows/terminal-window";
import { useDrag } from "@/hooks/use-drag";

interface MarketingTerminalProps {
  onClose: () => void;
}

export function MarketingTerminal({ onClose }: MarketingTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ dx: 0, dy: 0 });

  const onMove = useCallback((dx: number, dy: number) => {
    setPos((p) => ({ dx: p.dx + dx, dy: p.dy + dy }));
  }, []);
  const { onPointerDown } = useDrag({ onMove });

  // Inside the VM Esc belongs to vi, so only close when focus is outside the window.
  // Capture phase, because React commits the taskbar's menu close synchronously inside its
  // document-level handler: by the bubble phase #start-menu is gone and that spent Esc,
  // which only dismissed the menu, would also kill a booted VM.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.getElementById("start-menu")) return;
      if (document.querySelector("[data-screensaver]")) return;
      if (containerRef.current?.contains(document.activeElement)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed left-1/2 top-1/2 z-[70] w-[min(94vw,700px)]"
      style={{ transform: `translate(calc(-50% + ${pos.dx}px), calc(-50% + ${pos.dy}px))` }}
    >
      <RetroWindow
        title="MS-DOS Prompt"
        titleBarProps={{ onPointerDown, className: "cursor-default touch-none" }}
        statusBar={
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">Esc closes (when the prompt isn&apos;t focused)</span>
            <RetroButton onClick={onClose}>Close</RetroButton>
          </div>
        }
      >
        {/* TerminalWindow fills a flex column, so the overlay owns the height. */}
        <div className="flex h-[min(60vh,380px)] min-h-0 flex-col">
          <TerminalWindow />
        </div>
      </RetroWindow>
    </div>
  );
}
