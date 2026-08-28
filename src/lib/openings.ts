// Book detection against the vendored lichess opening EPDs (see scripts/generate-openings.mjs).

let cache: Set<string> | null = null;

/** Position identity without the clocks: the first 4 FEN fields. */
export function epdFromFen(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Lazy singleton — the 236K JSON is only pulled into the bundle during analysis. */
export async function loadOpenings(): Promise<Set<string>> {
  if (cache) return cache;
  const mod = await import("@/data/openings.json");
  cache = new Set(mod.default);
  return cache;
}
