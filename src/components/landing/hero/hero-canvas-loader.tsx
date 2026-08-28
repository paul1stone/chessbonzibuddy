"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion, supportsWebGL } from "@/lib/motion";

const HeroCanvas = dynamic(() => import("./hero-canvas").then((m) => m.HeroCanvas), { ssr: false });

interface HeroCanvasLoaderProps {
  progressRef: RefObject<number>;
  stageRef: RefObject<HTMLElement | null>;
  poster: ReactNode;
}

type Status = "poster" | "canvas" | "failed";

export function HeroCanvasLoader({ progressRef, stageRef, poster }: HeroCanvasLoaderProps) {
  const [status, setStatus] = useState<Status>("poster");
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion() || !supportsWebGL()) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = w.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => setStatus("canvas"));
    return () => cancel(id);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [stageRef]);

  return (
    <>
      {poster}
      {status === "canvas" && (
        <div className="absolute inset-0" aria-hidden="true" data-testid="hero-canvas">
          <HeroCanvas progressRef={progressRef} active={inView} onContextLost={() => setStatus("failed")} />
        </div>
      )}
    </>
  );
}
