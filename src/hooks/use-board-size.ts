"use client";

import { useEffect, useRef, useState } from "react";

/** Observes a container and yields the largest square board width that fits. */
export function useBoardSize(reserved: { w?: number; h?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { w = 0, h = 0 } = reserved;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      setWidth(Math.max(200, Math.floor(Math.min(cw - w, ch - h))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  return { ref, width };
}
