// The zoom-outline geometry is shared with the app's window traces; this module owns the
// landing-only scroll segmentation and re-exports the rest so its consumers stay put.
export { OUTLINE_STEPS, outlineRect } from "@/lib/outline-trace";
export type { Rect } from "@/lib/outline-trace";

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

// Share of a segment spent growing the outline; the rest holds the revealed window.
const OUTLINE_SHARE = 0.7;

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
