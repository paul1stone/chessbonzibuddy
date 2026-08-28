// Vendors the lichess chess-openings book (CC0) into src/data/openings.json as EPDs.
// The TSVs have columns eco/name/pgn and no epd column, so each pgn is replayed with
// chess.js: generating with the same library the runtime looks up with guarantees the
// en-passant field matches (chess.js only writes one when the capture is actually legal).
import { Chess } from "chess.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const VOLUMES = ["a", "b", "c", "d", "e"];
const BASE = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const OUT = path.resolve("src/data/openings.json");

function epdFromFen(fen) {
  return fen.split(" ").slice(0, 4).join(" ");
}

const epds = new Set();
let rows = 0;
let skipped = 0;

for (const volume of VOLUMES) {
  const url = `${BASE}/${volume}.tsv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  const lines = (await res.text()).split("\n");

  // Header row is eco/name/pgn.
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    rows += 1;
    const pgn = line.split("\t")[2];
    if (!pgn) {
      skipped += 1;
      continue;
    }
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      epds.add(epdFromFen(chess.fen()));
    } catch {
      skipped += 1;
    }
  }
  console.log(`${volume}.tsv: ${lines.length - 1} lines`);
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify([...epds].sort(), null, 0)}\n`);

console.log(`rows: ${rows}, skipped: ${skipped}, unique epds: ${epds.size}`);
console.log(`wrote ${OUT}`);
