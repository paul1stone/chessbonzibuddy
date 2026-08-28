import { describe, expect, it } from "vitest";
import {
  boardAt,
  cameraAt,
  CAM_LOW,
  CAM_TOP,
  INITIAL_PIECES,
  MOVE_END,
  MOVE_START,
  SCHOLARS_MATE,
  squareToXZ,
} from "./hero-timeline";

const byId = (id: string, progress: number) => {
  const piece = boardAt(progress).find((p) => p.id === id);
  if (!piece) throw new Error(`missing ${id}`);
  return piece;
};

describe("squareToXZ", () => {
  it("centers the board on the origin with rank 1 nearest +z", () => {
    expect(squareToXZ("a1")).toEqual([-3.5, 3.5]);
    expect(squareToXZ("h8")).toEqual([3.5, -3.5]);
    expect(squareToXZ("e4")).toEqual([0.5, 0.5]);
  });
});

describe("boardAt", () => {
  it("starts with all 32 pieces on their squares at rest", () => {
    const pieces = boardAt(0);
    expect(pieces).toHaveLength(32);
    for (const p of pieces) {
      const init = INITIAL_PIECES.find((i) => i.id === p.id)!;
      const [x, z] = squareToXZ(init.square);
      expect(p.x).toBeCloseTo(x);
      expect(p.z).toBeCloseTo(z);
      expect(p.y).toBe(0);
      expect(p.captured).toBe(false);
    }
  });

  it("lifts the e2 pawn mid-way through the first ply", () => {
    const slice = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;
    const mid = MOVE_START + slice / 2;
    const pawn = byId("wp4", mid);
    expect(pawn.y).toBeGreaterThan(0.3);
    expect(pawn.z).toBeLessThan(squareToXZ("e2")[1]);
    expect(pawn.z).toBeGreaterThan(squareToXZ("e4")[1]);
  });

  it("ends with the queen on f7 and the f7 pawn captured and falling", () => {
    const queen = byId("wq3", 1);
    const [fx, fz] = squareToXZ("f7");
    expect(queen.x).toBeCloseTo(fx);
    expect(queen.z).toBeCloseTo(fz);
    expect(queen.y).toBe(0);

    const victim = byId("bp5", 1);
    expect(victim.captured).toBe(true);
    expect(victim.y).toBeLessThan(0);

    expect(byId("bp4", 1).z).toBeCloseTo(squareToXZ("e5")[1]);
    expect(byId("bn1", 1).x).toBeCloseTo(squareToXZ("c6")[0]);
    expect(byId("wb5", 1).x).toBeCloseTo(squareToXZ("c4")[0]);
    expect(byId("bn6", 1).z).toBeCloseTo(squareToXZ("f6")[1]);
  });

  it("clamps progress outside [0, 1]", () => {
    expect(boardAt(-1)).toEqual(boardAt(0));
    expect(boardAt(2)).toEqual(boardAt(1));
  });
});

describe("cameraAt", () => {
  it("interpolates from the top view to the low view by MOVE_END", () => {
    expect(cameraAt(0).position).toEqual(CAM_TOP.position);
    expect(cameraAt(MOVE_END).position).toEqual(CAM_LOW.position);
    expect(cameraAt(1).position).toEqual(CAM_LOW.position);
    const mid = cameraAt(MOVE_END / 2).position;
    expect(mid[1]).toBeLessThan(CAM_TOP.position[1]);
    expect(mid[1]).toBeGreaterThan(CAM_LOW.position[1]);
  });
});
