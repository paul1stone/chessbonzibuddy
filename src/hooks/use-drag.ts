"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseDragOptions {
  onMove: (dx: number, dy: number) => void;
  onEnd?: () => void;
  disabled?: boolean;
}

/** Pointer-capture drag for a title-bar handle. Attach the returned handler to the handle. */
export function useDrag({ onMove, onEnd, disabled }: UseDragOptions) {
  const last = useRef<{ x: number; y: number } | null>(null);

  // Unmounting mid-drag releases pointer capture without firing pointerup on the
  // removed handle, which would strand user-select:none on the body page-wide.
  useEffect(() => {
    return () => {
      if (last.current) document.body.style.userSelect = "";
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      // Buttons inside the handle (minimize/close) must keep working.
      if ((e.target as HTMLElement).closest("button")) return;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      last.current = { x: e.clientX, y: e.clientY };
      document.body.style.userSelect = "none";

      const move = (ev: PointerEvent) => {
        if (!last.current) return;
        onMove(ev.clientX - last.current.x, ev.clientY - last.current.y);
        last.current = { x: ev.clientX, y: ev.clientY };
      };
      const up = () => {
        last.current = null;
        document.body.style.userSelect = "";
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        onEnd?.();
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    },
    [onMove, onEnd, disabled]
  );

  return { onPointerDown };
}
