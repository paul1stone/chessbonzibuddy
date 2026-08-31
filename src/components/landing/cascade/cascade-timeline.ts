export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CASCADE_KEYS: ["import", "review", "practice"] = ["import", "review", "practice"];

export interface Segment {
  key: (typeof CASCADE_KEYS)[number];
  start: number;
  end: number;
}

// Gaps between segments let one window settle before the next outline starts.
export const SEGMENTS: Segment[] = [
  { key: "import", start: 0.04, end: 0.3 },
  { key: "review", start: 0.36, end: 0.62 },
  { key: "practice", start: 0.68, end: 0.94 },
];

// Win98 drew the zoom-open as a handful of discrete frames, never a smooth tween.
export const OUTLINE_STEPS = 8;

// Share of a segment spent growing the outline; the rest holds the revealed window.
const OUTLINE_SHARE = 0.7;

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

export interface SegmentPhase {
  outlineT: number | null;
  revealed: boolean;
}

export function segmentPhase(p: number, seg: Segment): SegmentPhase {
  if (p < seg.start) return { outlineT: null, revealed: false };
  const local = (p - seg.start) / (seg.end - seg.start);
  if (local >= OUTLINE_SHARE) return { outlineT: null, revealed: true };
  return { outlineT: local / OUTLINE_SHARE, revealed: false };
}
