import { describe, expect, test } from "vitest";
import {
  OUTLINE_SHARE,
  OUTLINE_STEPS,
  SEGMENTS,
  outlineRect,
  segmentPhase,
  type Segment,
} from "./cascade-timeline";

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
    expect(segmentPhase(seg.start + span * OUTLINE_SHARE * 0.5, seg).outlineT).toBeCloseTo(0.5, 10);
    expect(segmentPhase(seg.start + span * OUTLINE_SHARE * 0.999, seg).outlineT).toBeCloseTo(0.999, 10);
  });

  test("segments never overlap and stay ordered", () => {
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i].start).toBeGreaterThan(SEGMENTS[i - 1].end);
  });

  // The pinned section shows nothing but its heading until the cascade puts something up,
  // which is what left the audit's ~900px dead zone. Three separate things keep it closed.
  test("the blank opening beat is a sliver of the pin", () => {
    expect(SEGMENTS[0].start).toBeLessThanOrEqual(0.02);
  });

  test("the outline flight is a flourish, not the beat", () => {
    expect(OUTLINE_SHARE).toBeLessThanOrEqual(0.5);
  });

  test("the first window is revealed well inside the opening third of the pin", () => {
    expect(firstRevealAt(SEGMENTS[0])).toBeLessThan(0.2);
  });

  // The real risk is a hole between segments: one outline has finished and the next has not
  // started, so nothing would be drawn unless a predecessor is still holding its window open.
  test("the gaps between segments are held open by the previous window", () => {
    for (let i = 1; i < SEGMENTS.length; i++) {
      const gap = (SEGMENTS[i - 1].end + SEGMENTS[i].start) / 2;
      expect(segmentPhase(gap, SEGMENTS[i]).outlineT, `segment ${i} draws in the gap`).toBeNull();
      expect(segmentPhase(gap, SEGMENTS[i - 1]).revealed, `gap at ${gap.toFixed(3)} is empty`).toBe(true);
    }
  });

  // Stepping off the reveal boundary itself: it lands one float ulp short of OUTLINE_SHARE.
  test("a window stays revealed for the whole pin once the first one is up", () => {
    for (let p = firstRevealAt(SEGMENTS[0]) + 1e-9; p <= 1.0001; p += 0.005) {
      const shown = SEGMENTS.some((s) => segmentPhase(p, s).revealed);
      expect(shown, `progress ${p.toFixed(3)} reveals no window`).toBe(true);
    }
  });
});

const firstRevealAt = (seg: Segment) => seg.start + (seg.end - seg.start) * OUTLINE_SHARE;
