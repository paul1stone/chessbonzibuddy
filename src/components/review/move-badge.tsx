"use client";

import { Badge } from "@/components/ui/badge";
import type { MoveClassification } from "@/lib/engine";

const classificationStyles: Record<
  MoveClassification,
  { bg: string; text: string; label: string }
> = {
  brilliant: { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Brilliant" },
  great: { bg: "bg-green-500/20", text: "text-green-400", label: "Great" },
  best: { bg: "bg-green-500/20", text: "text-green-400", label: "Best" },
  good: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "Good" },
  book: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Book" },
  inaccuracy: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    label: "Inaccuracy",
  },
  mistake: {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    label: "Mistake",
  },
  blunder: { bg: "bg-red-500/20", text: "text-red-400", label: "Blunder" },
};

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

  const style = classificationStyles[classification];

  return (
    <Badge
      variant="ghost"
      className={`${style.bg} ${style.text} border-0 px-1.5 py-0 text-[10px] leading-4`}
    >
      {style.label}
    </Badge>
  );
}
