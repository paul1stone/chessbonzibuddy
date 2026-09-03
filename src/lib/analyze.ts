/**
 * The one game-analysis pipeline.
 *
 * Runs in the browser against Stockfish WASM, but the engine is injectable so
 * the pipeline itself is testable in node. Every eval that flows through here
 * is white-relative centipawns — `uci.ts` normalizes before we see it.
 */

import { Chess } from "chess.js";
import {
  StockfishEngine,
  ANALYSIS_VERSION,
  type GameAnalysis,
  type MoveAnalysis,
} from "./engine";
import type { ParsedUciEval } from "./uci";
import {
  classifyMove,
  computeWinPercentLoss,
  calculateGameAccuracy,
  accuracyToRating,
  uciToSan,
} from "./analysis-utils";
import { loadOpenings, epdFromFen } from "./openings";

/** Fixed node budget per position — same work everywhere makes evals comparable. */
export const ANALYSIS_NODES = 400_000;
/** Two candidate lines per position: enough for a "what else?" panel. */
export const ANALYSIS_MULTIPV = 2;

/** How deep into a game book detection is still plausible (plies). */
const BOOK_PLY_LIMIT = 24;

/** The slice of `StockfishEngine` the pipeline actually needs. */
export interface AnalysisEngine {
  init(): Promise<void>;
  newGame(): Promise<void>;
  evaluateNodes(
    fen: string,
    nodes: number,
    multiPv: number
  ): Promise<ParsedUciEval>;
  quit(): void;
}

export interface AnalyzeOptions {
  nodes?: number;
  multiPv?: number;
  onProgress?: (current: number, total: number) => void;
  /** Injected in tests; defaults to a real Stockfish worker. */
  engine?: AnalysisEngine;
}

/** Input to the deferred brilliant-move detector. */
export interface BrilliantInput {
  fenBefore: string;
  uci: string;
  prevResult: ParsedUciEval;
  afterResult: ParsedUciEval;
  color: "w" | "b";
}

// Brilliant detection is deferred out of this branch; "no brilliants" is the
// defined behaviour until a follow-up drops a real implementation in here.
const detectBrilliant: (input: BrilliantInput) => boolean = () => false;

export async function analyzeGame(
  pgn: string,
  opts: AnalyzeOptions = {}
): Promise<GameAnalysis> {
  const nodes = opts.nodes ?? ANALYSIS_NODES;
  const multiPv = opts.multiPv ?? ANALYSIS_MULTIPV;
  const engineInfo = { name: "stockfish-18-lite-wasm", nodes, multiPv };

  const gameFull = new Chess();
  gameFull.loadPgn(pgn);
  const moves = gameFull.history({ verbose: true });

  if (moves.length === 0) {
    return {
      version: ANALYSIS_VERSION,
      engine: engineInfo,
      moves: [],
      whiteAccuracy: 100,
      blackAccuracy: 100,
      whiteRating: 0,
      blackRating: 0,
    };
  }

  const engine = opts.engine ?? new StockfishEngine();
  await engine.init();

  try {
    await engine.newGame();
    // Book detection is a nicety — a failed opening load must not fail analysis.
    const openings = await loadOpenings().catch(() => new Set<string>());

    /**
     * Evaluate a position, never asking the engine about a finished one.
     *
     * Only hard-terminal draws short-circuit: chess.js `isDraw()` also fires on
     * CLAIMABLE draws (threefold, 50-move) that real games play through, and
     * those still deserve a real search — Stockfish scores true repetitions ~0
     * on its own.
     */
    const evaluatePosition = async (chess: Chess): Promise<ParsedUciEval> => {
      if (chess.isCheckmate()) {
        // The side to move is the mated side, so the winner is the other one.
        const winnerIsWhite = chess.turn() === "b";
        return {
          eval: winnerIsWhite ? 100_000 : -100_000,
          mate: 0,
          bestMove: "",
          depth: 0,
          lines: [],
        };
      }
      if (chess.isStalemate() || chess.isInsufficientMaterial()) {
        return { eval: 0, mate: null, bestMove: "", depth: 0, lines: [] };
      }
      return engine.evaluateNodes(chess.fen(), nodes, multiPv);
    };

    const analysis: MoveAnalysis[] = [];
    const replay = new Chess();

    // One search per position: each "after" eval is the next move's "before".
    let prevResult = await evaluatePosition(replay);

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fenBefore = replay.fen();
      const isForced = replay.moves().length === 1;
      const moveNumber =
        Number.parseInt(fenBefore.split(" ")[5], 10) || Math.floor(i / 2) + 1;

      replay.move(move.san);

      const deliversMate = replay.isCheckmate();
      const afterResult = await evaluatePosition(replay);
      const isBook =
        i < BOOK_PLY_LIMIT && openings.has(epdFromFen(replay.fen()));
      const uci = move.from + move.to + (move.promotion ?? "");
      const isTopMove = prevResult.bestMove !== "" && uci === prevResult.bestMove;

      const winPercentLoss = computeWinPercentLoss({
        color: move.color,
        evalBefore: prevResult.eval,
        mateBefore: prevResult.mate,
        evalAfter: afterResult.eval,
        mateAfter: afterResult.mate,
      });

      let classification = classifyMove({
        color: move.color,
        evalBefore: prevResult.eval,
        mateBefore: prevResult.mate,
        evalAfter: afterResult.eval,
        mateAfter: afterResult.mate,
        isTopMove,
        isForced,
        isBook,
        deliversMate,
        winPercentLoss,
      });

      if (
        classification === "best" &&
        isTopMove &&
        detectBrilliant({
          fenBefore,
          uci,
          prevResult,
          afterResult,
          color: move.color,
        })
      ) {
        classification = "brilliant";
      }

      analysis.push({
        moveNumber,
        color: move.color,
        san: move.san,
        uci,
        evalBefore: prevResult.eval,
        mateBefore: prevResult.mate,
        evalAfter: afterResult.eval,
        mateAfter: afterResult.mate,
        winPercentLoss,
        depth: prevResult.depth,
        bestMove: prevResult.bestMove,
        bestMoveSan: uciToSan(fenBefore, prevResult.bestMove),
        classification,
        topLines: prevResult.lines.map((l) => ({
          moves: l.moves,
          eval: l.eval,
          mate: l.mate,
        })),
      });

      prevResult = afterResult;
      opts.onProgress?.(i + 1, moves.length);
    }

    const { white, black } = calculateGameAccuracy(analysis);

    return {
      version: ANALYSIS_VERSION,
      engine: engineInfo,
      moves: analysis,
      whiteAccuracy: white,
      blackAccuracy: black,
      whiteRating: accuracyToRating(white),
      blackRating: accuracyToRating(black),
    };
  } finally {
    engine.quit();
  }
}
