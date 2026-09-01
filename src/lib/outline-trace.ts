import { prefersReducedMotion } from "@/lib/motion";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Win98 drew the zoom-open as a handful of discrete frames, never a smooth tween.
export const OUTLINE_STEPS = 8;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function outlineRect(from: Rect, to: Rect, t: number): Rect {
  const step = Math.round(clamp01(t) * OUTLINE_STEPS) / OUTLINE_STEPS;
  return {
    x: lerp(from.x, to.x, step),
    y: lerp(from.y, to.y, step),
    w: lerp(from.w, to.w, step),
    h: lerp(from.h, to.h, step),
  };
}

export interface ZoomTraceOptions {
  from: Rect;
  to: Rect;
  parent: HTMLElement;
  durationMs?: number;
  className?: string;
  onDone?: () => void;
}

/**
 * Flies a stepped Win98 outline from one rect to another and removes it.
 * Returns a cancel fn; cancelling drops the outline WITHOUT calling onDone.
 * Under reduced motion nothing is drawn and onDone fires synchronously.
 */
export function runZoomTrace({
  from,
  to,
  parent,
  durationMs = 180,
  className = "zoom-trace",
  onDone,
}: ZoomTraceOptions): () => void {
  if (prefersReducedMotion()) {
    onDone?.();
    return () => {};
  }

  const el = document.createElement("div");
  el.className = className;
  el.setAttribute("aria-hidden", "true");

  const draw = (t: number) => {
    const r = outlineRect(from, to, t);
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  draw(0);
  parent.appendChild(el);

  let frame: number | null = null;
  let done = false;
  const start = performance.now();

  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
    onDone?.();
  };

  const tick = (now: number) => {
    const t = durationMs > 0 ? (now - start) / durationMs : 1;
    if (t >= 1) {
      finish();
      return;
    }
    draw(t);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    if (done) return;
    done = true;
    if (frame !== null) cancelAnimationFrame(frame);
    el.remove();
  };
}
