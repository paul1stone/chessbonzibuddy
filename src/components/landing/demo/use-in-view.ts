"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Shared gate for the homepage demos: they animate only while on screen, and never under
 * reduced motion. `activated` latches on the first intersection, so a demo mounts its lazy
 * chunk once and keeps its state when it scrolls back off.
 */
export function useDemoActivation(threshold = 0.5) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState({ inView: false, activated: false });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.intersectionRatio >= threshold;
        setSeen((prev) =>
          prev.inView === inView && prev.activated ? prev : { inView, activated: prev.activated || inView }
        );
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView: seen.inView, activated: seen.activated, reduced };
}
