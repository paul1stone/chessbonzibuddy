/**
 * Pure UCI output parsing. No engine, no DOM, no dependencies.
 *
 * Engines report scores from the side-to-move's perspective; everything
 * downstream stores white-relative centipawns, so normalization happens here
 * and nowhere else.
 */

export interface UciLine {
  multiPv: number;
  /** White-relative cp; mate folded via foldMateToCp. */
  eval: number;
  /** White-relative moves-to-mate (+ = white mates). */
  mate: number | null;
  depth: number;
  moves: string[];
}

export interface ParsedUciEval {
  eval: number;
  mate: number | null;
  /** "" when the engine sent no bestmove or "(none)". */
  bestMove: string;
  depth: number;
  /** Sorted by multiPv ascending. */
  lines: UciLine[];
}

/** Collapse a moves-to-mate count into the cp scale, nearer mates scoring higher. */
export function foldMateToCp(mate: number): number {
  return mate > 0 ? 100_000 - mate : -100_000 - mate;
}

export function sideToMoveFromFen(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** Negate without producing -0, which breaks strict equality checks. */
function negate(n: number): number {
  return n === 0 ? 0 : -n;
}

function readInt(tokens: string[], key: string): number | null {
  const i = tokens.indexOf(key);
  if (i === -1) return null;
  const n = Number.parseInt(tokens[i + 1] ?? "", 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse the raw lines of one search into a white-relative evaluation.
 *
 * `sideToMove` is the side to move in the searched position, used to flip the
 * engine's side-relative scores.
 */
export function parseUciEvaluation(
  rawLines: string[],
  sideToMove: "w" | "b"
): ParsedUciEval {
  // multipv slot -> best line seen so far, still side-to-move relative
  const bySlot = new Map<number, { depth: number; cp: number; mate: number | null; moves: string[] }>();
  let bestMove = "";

  for (const raw of rawLines) {
    const line = raw.trim();

    if (line.startsWith("bestmove")) {
      const move = line.split(/\s+/)[1] ?? "";
      bestMove = move === "(none)" ? "" : move;
      continue;
    }

    if (!line.startsWith("info") || !line.includes(" score ")) continue;
    // Aspiration-window bounds are not resolved scores.
    if (line.includes(" lowerbound") || line.includes(" upperbound")) continue;

    const tokens = line.split(/\s+/);
    const scoreIndex = tokens.indexOf("score");
    const kind = tokens[scoreIndex + 1];
    const value = Number.parseInt(tokens[scoreIndex + 2] ?? "", 10);
    if ((kind !== "cp" && kind !== "mate") || Number.isNaN(value)) continue;

    const depth = readInt(tokens, "depth") ?? 0;
    const multiPv = readInt(tokens, "multipv") ?? 1;

    // Later line at equal depth wins: it is the resolved score for that slot.
    const existing = bySlot.get(multiPv);
    if (existing && depth < existing.depth) continue;

    const pvIndex = tokens.indexOf("pv");
    bySlot.set(multiPv, {
      depth,
      cp: kind === "cp" ? value : 0,
      mate: kind === "mate" ? value : null,
      moves: pvIndex === -1 ? [] : tokens.slice(pvIndex + 1),
    });
  }

  const lines: UciLine[] = [...bySlot.entries()]
    .map(([multiPv, l]) => {
      const cp = sideToMove === "b" ? negate(l.cp) : l.cp;
      const mate =
        l.mate === null ? null : sideToMove === "b" ? negate(l.mate) : l.mate;
      return {
        multiPv,
        eval: mate === null ? cp : foldMateToCp(mate),
        mate,
        depth: l.depth,
        moves: l.moves,
      };
    })
    .sort((a, b) => a.multiPv - b.multiPv);

  const top = lines[0];
  return {
    eval: top?.eval ?? 0,
    mate: top?.mate ?? null,
    bestMove,
    depth: top?.depth ?? 0,
    lines,
  };
}
