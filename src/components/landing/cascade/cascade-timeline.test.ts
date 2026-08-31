import { describe, expect, test } from "vitest";
import { OUTLINE_STEPS, SEGMENTS, outlineRect, segmentPhase } from "./cascade-timeline";

describe("outlineRect", () => {
  const from = { x: 0, y: 100, w: 40, h: 20 };
  const to = { x: 100, y: 0, w: 400, h: 300 };

  test("snaps to discrete steps", () => {
    const a = outlineRect(from, to, 0.1);
    const b = outlineRect(from, to, 0.12); // same step at 8 steps
    expect(a).toEqual(b);
  });

  test("endpoints are exact", () => {
    expect(outlineRect(from, to, 0)).toEqual(from);
    expect(outlineRect(from, to, 1)).toEqual(to);
  });

  test("draws OUTLINE_STEPS + 1 distinct frames across the sweep", () => {
    const frames = new Set<string>();
    for (let t = 0; t <= 1.0001; t += 0.005) frames.add(JSON.stringify(outlineRect(from, to, t)));
    expect(frames.size).toBe(OUTLINE_STEPS + 1);
  });

  test("clamps out-of-range t to the endpoints", () => {
    expect(outlineRect(from, to, -1)).toEqual(from);
    expect(outlineRect(from, to, 2)).toEqual(to);
  });
});

describe("segmentPhase", () => {
  const seg = SEGMENTS[0];

  test("before, during, after", () => {
    expect(segmentPhase(0, seg)).toEqual({ outlineT: null, revealed: false });
    const mid = segmentPhase(seg.start + (seg.end - seg.start) * 0.35, seg);
    expect(mid.revealed).toBe(false);
    expect(mid.outlineT).toBeGreaterThan(0);
    expect(segmentPhase(seg.end, seg).revealed).toBe(true);
    expect(segmentPhase(1, seg).revealed).toBe(true);
  });

  test("outlineT spans 0..1 over the first 70% of the segment", () => {
    const span = seg.end - seg.start;
    expect(segmentPhase(seg.start, seg).outlineT).toBe(0);
    expect(segmentPhase(seg.start + span * 0.35, seg).outlineT).toBeCloseTo(0.5);
    expect(segmentPhase(seg.start + span * 0.699, seg).outlineT).toBeCloseTo(0.9986);
  });

  test("segments never overlap and stay ordered", () => {
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i].start).toBeGreaterThan(SEGMENTS[i - 1].end);
  });
});
