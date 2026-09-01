import { describe, expect, test } from "vitest";
import { OUTLINE_STEPS, outlineRect } from "./outline-trace";

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

  test("the halfway step is the midpoint", () => {
    expect(outlineRect(from, to, 0.5)).toEqual({ x: 50, y: 50, w: 220, h: 160 });
  });

  test("runs backwards for minimize traces", () => {
    expect(outlineRect(to, from, 0)).toEqual(to);
    expect(outlineRect(to, from, 1)).toEqual(from);
    expect(outlineRect(to, from, 0.5)).toEqual(outlineRect(from, to, 0.5));
  });
});
