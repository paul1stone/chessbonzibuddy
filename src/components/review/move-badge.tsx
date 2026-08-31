"use client";

import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { MoveClassification } from "@/lib/engine";

/** Classifications that are notable enough to show a badge. */
const notableClassifications = new Set<MoveClassification>([
  "brilliant",
  "great",
  "best",
  "inaccuracy",
  "mistake",
  "blunder",
]);

interface MoveBadgeProps {
  classification: MoveClassification;
}

export function MoveBadge({ classification }: MoveBadgeProps) {
  if (!notableClassifications.has(classification)) {
    return null;
  }

  const { hex, label } = CLASSIFICATION_COLORS[classification];

  return (
    <span className="r-badge" style={{ background: hex }}>
      {label}
    </span>
  );
}
