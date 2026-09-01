import { describe, expect, test } from "vitest";
import { MOVE_END, MOVE_START, SCHOLARS_MATE } from "../hero/hero-timeline";
import { evalAtProgress, FADE_START } from "./eval-map";

const slice = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;
const plyEnd = (i: number) => MOVE_START + (i + 1) * slice;

describe("evalAtProgress", () => {
  test("clamps and follows the game", () => {
    expect(evalAtProgress(-1).label).toBe("+0.3");
    expect(evalAtProgress(0).whiteShare).toBeCloseTo(0.53);
    // Label reflects the last COMPLETED move: still +0.4 while 3...Nf6 is in flight.
    expect(evalAtProgress(plyEnd(4) + slice / 2).label).toBe("+0.4");
    expect(evalAtProgress(plyEnd(5)).label).toBe("M1");
    expect(evalAtProgress(plyEnd(6)).label).toBe("1-0");
    expect(evalAtProgress(plyEnd(6)).whiteShare).toBe(1);
    expect(evalAtProgress(2).label).toBe("1-0");
  });

  test("share stays in [0,1] and mates at 1", () => {
    for (let p = 0; p <= 1; p += 0.005) {
      const share = evalAtProgress(p).whiteShare;
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
    expect(evalAtProgress(1).whiteShare).toBe(1);
  });

  test("holds after mate, then fades out", () => {
    expect(evalAtProgress(plyEnd(6)).opacity).toBe(1);
    expect(evalAtProgress(FADE_START).opacity).toBe(1);
    expect(evalAtProgress((FADE_START + 1) / 2).opacity).toBeCloseTo(0.5);
    expect(evalAtProgress(1).opacity).toBe(0);
    expect(evalAtProgress(2).opacity).toBe(0);
    // Fade is monotone non-increasing so reverse scrubbing brings it back cleanly.
    let prev = 1;
    for (let p = FADE_START; p <= 1; p += 0.005) {
      const o = evalAtProgress(p).opacity;
      expect(o).toBeLessThanOrEqual(prev);
      prev = o;
    }
  });
});
