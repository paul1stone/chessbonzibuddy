import { describe, expect, it } from "vitest";
import type { MoveClassification } from "@/lib/engine";
import {
  CLASSIFICATION_COLORS,
  classificationArrowColor,
} from "@/lib/classification-colors";

const ALL: MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "good",
  "book",
  "forced",
  "inaccuracy",
  "mistake",
  "blunder",
];

describe("CLASSIFICATION_COLORS", () => {
  it("covers all 9 classifications", () => {
    expect(Object.keys(CLASSIFICATION_COLORS).sort()).toEqual([...ALL].sort());
  });

  it("uses lowercase 6-digit hex colors and non-empty labels", () => {
    for (const c of ALL) {
      expect(CLASSIFICATION_COLORS[c].hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(CLASSIFICATION_COLORS[c].label.length).toBeGreaterThan(0);
    }
  });
});

describe("classificationArrowColor", () => {
  it("returns the blunder hex as rgba at 0.8 alpha", () => {
    expect(classificationArrowColor("blunder")).toBe("rgba(128, 0, 0, 0.8)");
  });

  it("returns an rgba string for every classification", () => {
    for (const c of ALL) {
      expect(classificationArrowColor(c)).toMatch(
        /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0\.8\)$/
      );
    }
  });
});
