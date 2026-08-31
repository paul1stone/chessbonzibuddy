"use client";

import { useEffect, useState } from "react";
import { evalAtProgress, type EvalPoint } from "./eval-map";

export function EvalProgress() {
  const [point, setPoint] = useState<EvalPoint>(() => evalAtProgress(0));

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPoint(evalAtProgress(max > 0 ? window.scrollY / max : 0));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-testid="eval-progress"
      className="pointer-events-none fixed left-3 top-1/2 hidden -translate-y-1/2 lg:block"
    >
      <div className="h-[40vh] w-[10px] border border-[var(--r-dark)] bg-black">
        {/* Scaling beats a height write: White's share grows from the bottom every frame. */}
        <div
          className="h-full w-full origin-bottom bg-white"
          style={{ transform: `scaleY(${point.whiteShare})` }}
        />
      </div>
      {/* retro.css is unlayered, so r-term's 18px beats a Tailwind text utility: size inline. */}
      <p className="r-term mt-1 text-center" style={{ fontSize: "10px" }}>
        {point.label}
      </p>
    </div>
  );
}
