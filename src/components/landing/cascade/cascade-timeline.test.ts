import { describe, expect, test } from "vitest";
import { OUTLINE_SHARE, OUTLINE_STEPS, SEGMENTS, outlineRect, segmentPhase } from "./cascade-timeline";

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

  test("outlineT spans 0..1 over the outline share of the segment", () => {
    const span = seg.end - seg.start;
    expect(segmentPhase(seg.start, seg).outlineT).toBe(0);
    expect(segmentPhase(seg.start + span * OUTLINE_SHARE * 0.5, seg).outlineT).toBeCloseTo(0.5);
    expect(segmentPhase(seg.start + span * OUTLINE_SHARE * 0.999, seg).outlineT).toBeCloseTo(0.999);
  });

  test("segments never overlap and stay ordered", () => {
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i].start).toBeGreaterThan(SEGMENTS[i - 1].end);
  });

  // The pinned section shows nothing but its heading until the cascade puts something up,
  // which is what left the audit's ~900px dead zone. Both halves of the fix are pinned here:
  // the opening beat is short, and from there on some outline or window is always drawn.
  test("the blank opening beat is a sliver of the pin", () => {
    expect(SEGMENTS[0].start).toBeLessThanOrEqual(0.02);
  });

  test("something is on screen for every frame after the opening beat", () => {
    for (let p = SEGMENTS[0].start; p <= 1.0001; p += 0.005) {
      const live = SEGMENTS.some((s) => {
        const { outlineT, revealed } = segmentPhase(p, s);
        return outlineT !== null || revealed;
      });
      expect(live, `progress ${p.toFixed(3)} draws nothing`).toBe(true);
    }
  });

  test("the first window is revealed well inside the opening third of the pin", () => {
    const firstReveal = SEGMENTS[0].start + (SEGMENTS[0].end - SEGMENTS[0].start) * OUTLINE_SHARE;
    expect(firstReveal).toBeLessThan(0.2);
  });
});
