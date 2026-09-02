"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { heroProgressRef } from "../hero/hero-progress";
import { evalAtProgress, type EvalPoint } from "./eval-map";

export function EvalProgress() {
  const [point, setPoint] = useState<EvalPoint>(() => evalAtProgress(0));
  const reduced = usePrefersReducedMotion();

  // rAF, not a scroll listener: the scrub keeps easing after the wheel stops, and the
  // bar must ride the smoothed hero progress exactly as the board does.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = heroProgressRef.current;
      if (p === last) return;
      last = p;
      setPoint(evalAtProgress(p));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // No scrub under reduced motion means no game to score.
  if (reduced) return null;

  return (
    <div
      aria-hidden
      data-testid="eval-progress"
      className="pointer-events-none fixed left-3 top-1/2 hidden -translate-y-1/2 lg:block"
      style={{ opacity: point.opacity, visibility: point.opacity === 0 ? "hidden" : "visible" }}
    >
      {/* Bevelled frame + caption: an instrument on the desktop, not a stray scrollbar. */}
      <div className="eval-frame">
        <div className="mx-auto h-[40vh] w-[10px] border border-[var(--r-dark)] bg-black">
          {/* Scaling beats a height write: White's share grows from the bottom every frame. */}
          <div
            className="h-full w-full origin-bottom bg-white"
            style={{ transform: `scaleY(${point.whiteShare})` }}
          />
        </div>
        <div className="eval-frame-caption">EVAL</div>
      </div>
      {/* retro.css is unlayered, so r-term's 18px beats a Tailwind text utility: size inline. */}
      <p className="r-term mt-1 text-center" style={{ fontSize: "10px" }}>
        {point.label}
      </p>
    </div>
  );
}
