import { describe, expect, it } from "vitest";
import { Box3 } from "three";
import { createPieceGeometry, PIECE_HEIGHTS } from "./piece-geometry";
import type { PieceType } from "./hero-timeline";

const TYPES: PieceType[] = ["p", "n", "b", "r", "q", "k"];

describe("createPieceGeometry", () => {
  it.each(TYPES)("builds a bounded, low-poly %s", (type) => {
    const geo = createPieceGeometry(type);
    geo.computeBoundingBox();
    const box = geo.boundingBox as Box3;
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(PIECE_HEIGHTS[type], 1);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThan(0.8);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    expect(tris).toBeGreaterThan(20);
    expect(tris).toBeLessThan(1200);
    expect(geo.attributes.normal).toBeDefined();
  });

  it("makes the king taller than the queen, and the queen taller than the rest", () => {
    expect(PIECE_HEIGHTS.k).toBeGreaterThan(PIECE_HEIGHTS.q);
    for (const t of ["p", "n", "b", "r"] as PieceType[]) {
      expect(PIECE_HEIGHTS.q).toBeGreaterThan(PIECE_HEIGHTS[t]);
    }
  });
});
