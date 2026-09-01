import { MOVE_END, MOVE_START, SCHOLARS_MATE } from "../hero/hero-timeline";

export interface EvalPoint {
  label: string;
  whiteShare: number;
  opacity: number;
}

const slice = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;
const plyEnd = (i: number) => MOVE_START + (i + 1) * slice;

// The hero game's eval story, anchored to the actual ply boundaries (Bonzi is White).
const ANCHORS: { at: number; label: string; whiteShare: number }[] = [
  { at: 0, label: "+0.3", whiteShare: 0.53 },
  { at: plyEnd(0), label: "+0.3", whiteShare: 0.53 }, // 1.e4
  { at: plyEnd(1), label: "+0.3", whiteShare: 0.53 }, // 1...e5
  { at: plyEnd(2), label: "+0.2", whiteShare: 0.52 }, // 2.Qh5?!
  { at: plyEnd(3), label: "+0.3", whiteShare: 0.53 }, // 2...Nc6
  { at: plyEnd(4), label: "+0.4", whiteShare: 0.54 }, // 3.Bc4
  { at: plyEnd(5), label: "M1", whiteShare: 0.95 }, // 3...Nf6??
  { at: plyEnd(6), label: "1-0", whiteShare: 1 }, // 4.Qxf7#
];

// Hold "1-0" through the checkmate dialog's pop, then fade with the remaining scrub.
export const FADE_START = 0.93;

export function evalAtProgress(p: number): EvalPoint {
  const t = Math.min(1, Math.max(0, p));
  const opacity = t <= FADE_START ? 1 : Math.max(0, 1 - (t - FADE_START) / (1 - FADE_START));
  const last = ANCHORS[ANCHORS.length - 1];
  if (t >= last.at) return { label: last.label, whiteShare: last.whiteShare, opacity };

  let i = 0;
  while (i < ANCHORS.length - 2 && t >= ANCHORS[i + 1].at) i++;
  const a = ANCHORS[i];
  const b = ANCHORS[i + 1];
  const f = (t - a.at) / (b.at - a.at);
  return {
    // The bar tweens toward the coming move; the number waits for the piece to land.
    label: a.label,
    whiteShare: a.whiteShare + (b.whiteShare - a.whiteShare) * f,
    opacity,
  };
}
