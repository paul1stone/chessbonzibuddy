export interface EvalPoint {
  label: string;
  whiteShare: number;
}

// Bonzi is White in the hero's Scholar's Mate, so his share only grows toward Qxf7#.
const ANCHORS: { at: number; label: string; whiteShare: number }[] = [
  { at: 0, label: "+0.2", whiteShare: 0.52 },
  { at: 0.25, label: "+0.8", whiteShare: 0.58 },
  { at: 0.5, label: "+2.1", whiteShare: 0.7 },
  { at: 0.75, label: "+5.8", whiteShare: 0.88 },
  { at: 0.9, label: "M4", whiteShare: 0.98 },
];

export function evalAtProgress(p: number): EvalPoint {
  const t = Math.min(1, Math.max(0, p));
  const last = ANCHORS[ANCHORS.length - 1];
  if (t >= last.at) return { label: last.label, whiteShare: last.whiteShare };

  let i = 0;
  while (i < ANCHORS.length - 2 && t >= ANCHORS[i + 1].at) i++;
  const a = ANCHORS[i];
  const b = ANCHORS[i + 1];
  const f = (t - a.at) / (b.at - a.at);
  return {
    // The bar interpolates continuously; the number snaps at the midpoint between anchors.
    label: f < 0.5 ? a.label : b.label,
    whiteShare: a.whiteShare + (b.whiteShare - a.whiteShare) * f,
  };
}
