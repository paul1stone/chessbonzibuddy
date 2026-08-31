import { describe, expect, test } from "vitest";
import { evalAtProgress } from "./eval-map";

describe("evalAtProgress", () => {
  test("clamps and hits the anchors", () => {
    expect(evalAtProgress(-1).label).toBe("+0.2");
    expect(evalAtProgress(0).whiteShare).toBeCloseTo(0.52);
    expect(evalAtProgress(0.5).label).toBe("+2.1");
    expect(evalAtProgress(0.95).label).toBe("M4");
    expect(evalAtProgress(2).whiteShare).toBeCloseTo(0.98);
  });
  test("whiteShare is monotonically non-decreasing", () => {
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const share = evalAtProgress(p).whiteShare;
      expect(share).toBeGreaterThanOrEqual(prev);
      prev = share;
    }
  });
});
