"use client";

import { useEffect, useRef, useState } from "react";
import { createIdleWatcher, IDLE_EVENTS } from "@/components/landing/easter/idle";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "./use-is-mobile";

const IDLE_MS = 180_000;
// Time on screen, slide-in included.
const HOLD_MS = 2_500;
// Matches the .bonzi-peek--out keyframes.
const OUT_MS = 240;
const CAPTURE = { capture: true } as const;

type Phase = "hidden" | "in" | "out";

// After a long idle Bonzi peeks up from behind the taskbar, waves, and drops back out of sight.
export function BonziPeek() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState<Phase>("hidden");
  const watcherRef = useRef<{ arm: () => void; disarm: () => void } | null>(null);

  useEffect(() => {
    if (reduced || isMobile) return;
    const watcher = createIdleWatcher(IDLE_MS, () => setPhase("in"));
    watcherRef.current = watcher;
    watcher.arm();
    return () => {
      watcher.disarm();
      watcherRef.current = null;
      setPhase("hidden");
    };
  }, [reduced, isMobile]);

  useEffect(() => {
    if (phase === "hidden") return;
    const timer = setTimeout(() => {
      if (phase === "in") {
        setPhase("out");
        return;
      }
      setPhase("hidden");
      // The watcher only schedules from an input event, so restart it by hand: a full IDLE_MS
      // of silence has to pass again before the next peek.
      const watcher = watcherRef.current;
      watcher?.disarm();
      watcher?.arm();
    }, phase === "in" ? HOLD_MS : OUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Any input sends him away early. Capture phase: xterm swallows bubbling keydown.
  useEffect(() => {
    if (phase !== "in") return;
    const dismiss = () => setPhase("out");
    for (const type of IDLE_EVENTS)
      window.addEventListener(type, dismiss, { passive: true, ...CAPTURE });
    return () => {
      for (const type of IDLE_EVENTS) window.removeEventListener(type, dismiss, CAPTURE);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      data-bonzi-peek
      aria-hidden="true"
      // Absolute inside the desktop, whose bottom edge is the taskbar top: its overflow-hidden
      // clips the slide, so he rises from behind the bar instead of painting over it.
      className={cn(
        "pointer-events-none absolute right-6 bottom-0 z-[45]",
        phase === "in" ? "bonzi-peek--in" : "bonzi-peek--out"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bonzi/peek.gif" alt="" width={125} height={100} className="h-[100px] w-[125px]" />
    </div>
  );
}
