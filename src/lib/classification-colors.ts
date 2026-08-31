import type { MoveClassification } from "@/lib/engine";

/** Win98-palette color per move classification. */
export const CLASSIFICATION_COLORS: Record<MoveClassification, { hex: string; label: string }> = {
  brilliant:  { hex: "#008080", label: "Brilliant" },
  great:      { hex: "#008080", label: "Great" },
  best:       { hex: "#000080", label: "Best" },
  good:       { hex: "#008000", label: "Good" },
  book:       { hex: "#808000", label: "Book" },
  forced:     { hex: "#808080", label: "Forced" },
  inaccuracy: { hex: "#c08000", label: "Inaccuracy" },
  mistake:    { hex: "#c04000", label: "Mistake" },
  blunder:    { hex: "#800000", label: "Blunder" },
};

/** Board arrow color for a classification: its hex at 0.8 alpha. */
export function classificationArrowColor(c: MoveClassification): string {
  const hex = CLASSIFICATION_COLORS[c].hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.8)`;
}
