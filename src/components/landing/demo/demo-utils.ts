import { Chess } from "chess.js";
import type { GameAnalysis } from "@/lib/engine";
import fixture from "./opera-game.json";

// Committed fixture: the Opera Game with real Stockfish 18 analysis (npm run demo-fixture).
// Bundle rule: this module pulls in chess.js and the fixture, so only the demo -inner
// files and this module's test may import it.
export const DEMO = fixture as { pgn: string; analysis: GameAnalysis };

/** FEN before every move, plus the final position, so positions[i] is what move i is played from. */
export function demoPositions(): string[] {
  const chess = new Chess();
  chess.loadPgn(DEMO.pgn);
  const history = chess.history({ verbose: true });
  return [...history.map((m) => m.before), history[history.length - 1].after];
}

/**
 * Index of the black mistake/blunder with the biggest win-percent loss that the engine
 * would have answered differently. Black-side because Morphy's own moves grade near-best,
 * and `uci !== bestMove` because the fixture's worst blunder allows mate with the move the
 * engine itself prefers, which makes a nonsensical puzzle.
 */
export function worstLossIndex(): number {
  const moves = DEMO.analysis.moves;
  let worst = -1;
  moves.forEach((move, i) => {
    if (move.color !== "b") return;
    if (move.classification !== "mistake" && move.classification !== "blunder") return;
    if (move.uci === move.bestMove) return;
    if (worst < 0 || move.winPercentLoss > moves[worst].winPercentLoss) worst = i;
  });
  if (worst < 0) throw new Error("demo fixture has no black mistake with a different best move");
  return worst;
}
