/**
 * Stockfish WASM engine wrapper for client-side chess analysis.
 *
 * This module is browser-only. It communicates with Stockfish via a Web Worker
 * and must never be imported in a server-side (Node.js) context. Components
 * that use it should be marked "use client" and import it dynamically or
 * conditionally guard against SSR.
 *
 * All evaluations returned here are white-relative — `uci.ts` normalizes the
 * engine's side-to-move scores before they reach any caller.
 */

import {
  parseUciEvaluation,
  sideToMoveFromFen,
  type ParsedUciEval,
} from "./uci";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineEvaluation {
  /** Evaluation in centipawns, white-relative (positive = white advantage) */
  eval: number;
  /** Best move in UCI notation, e.g. "e2e4" */
  bestMove: string;
  /** Principal variation - sequence of UCI moves */
  pv: string[];
  /** Search depth reached */
  depth: number;
  /** Moves to mate, or null if no forced mate (positive = white mates) */
  mate: number | null;
}

/** Flatten a parsed search into the single-line shape play mode consumes. */
function toEngineEvaluation(parsed: ParsedUciEval): EngineEvaluation {
  return {
    eval: parsed.eval,
    bestMove: parsed.bestMove,
    pv: parsed.lines[0]?.moves ?? [],
    depth: parsed.depth,
    mate: parsed.mate,
  };
}

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "book"
  | "forced"
  | "inaccuracy"
  | "mistake"
  | "blunder";

/** One candidate line from a MultiPV search. */
export interface TopLine {
  moves: string[];
  eval: number;
  mate: number | null;
}

export interface MoveAnalysis {
  moveNumber: number;
  color: "w" | "b";
  /** Standard algebraic notation, e.g. "e4" */
  san: string;
  /** UCI notation, e.g. "e2e4" */
  uci: string;
  /** Eval (white-relative centipawns, mate folded) before this move was played */
  evalBefore: number;
  /** Moves to mate before this move, white-relative, or null */
  mateBefore: number | null;
  /** Eval (white-relative centipawns, mate folded) after this move was played */
  evalAfter: number;
  /** 0 = the position after this move is checkmate (winner = sign of evalAfter) */
  mateAfter: number | null;
  /** Win probability given up by the mover, 0-100 */
  winPercentLoss: number;
  /** Depth of the before-position search */
  depth: number;
  /** Engine's best move in this position (UCI) */
  bestMove: string;
  /** Engine's best move in SAN */
  bestMoveSan: string;
  classification: MoveClassification;
  /** Candidate lines from the before-position search, multipv order */
  topLines: TopLine[];
}

export const ANALYSIS_VERSION = 2 as const;

export interface GameAnalysis {
  version: typeof ANALYSIS_VERSION;
  engine: { name: string; nodes: number; multiPv: number };
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  /** Estimated rating White "played like" based on accuracy */
  whiteRating: number;
  /** Estimated rating Black "played like" based on accuracy */
  blackRating: number;
}

/**
 * Whether a stored analysis blob was produced by the current pipeline.
 *
 * Anything older is treated as absent — pre-v2 evals were side-to-move
 * relative, so their numbers are not merely stale but wrong.
 */
export function isCurrentAnalysis(a: unknown): a is GameAnalysis {
  if (typeof a !== "object" || a === null) return false;
  const candidate = a as Partial<GameAnalysis>;
  return (
    candidate.version === ANALYSIS_VERSION && Array.isArray(candidate.moves)
  );
}

// ---------------------------------------------------------------------------
// StockfishEngine
// ---------------------------------------------------------------------------

/**
 * Wrapper around a Stockfish Web Worker.
 *
 * Loading strategy (tried in order):
 *  1. Inline Web Worker that uses `importScripts` to pull Stockfish from a CDN.
 *  2. If the CDN approach fails at init time, falls back to loading from a
 *     local copy at `/stockfish/stockfish.js` (which you can place in the
 *     Next.js `public/` directory).
 *
 * Usage:
 * ```ts
 * const engine = new StockfishEngine();
 * await engine.init();
 * const result = await engine.evaluate("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
 * engine.quit();
 * ```
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private messageHandler: ((data: string) => void) | null = null;

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async init(): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error(
        "StockfishEngine.init() must only be called in the browser."
      );
    }

    try {
      this.worker = this.createLocalWorker();
      await this.handshake();
    } catch (err) {
      this.worker?.terminate();
      this.worker = null;
      throw new Error(
        `Failed to initialise Stockfish engine. ` +
          `Make sure stockfish.js is available at /stockfish/stockfish.js. ` +
          `Original error: ${err}`
      );
    }

    this.isReady = true;
  }

  /**
   * Reset the engine's search state between games.
   *
   * Sent once per analysed game so hash entries from the previous game cannot
   * skew the first few positions of the next one.
   */
  async newGame(): Promise<void> {
    this.assertReady();
    this.sendCommand("ucinewgame");
    this.sendCommand("isready");
    await this.waitFor("readyok");
  }

  /**
   * Evaluate a position given as a FEN string.
   *
   * @param fen     - FEN of the position to evaluate
   * @param depth   - Search depth (higher = slower but stronger). Default 18.
   * @param multiPv - Number of principal variations to return. Default 1.
   */
  async evaluate(
    fen: string,
    depth = 18,
    multiPv = 1
  ): Promise<EngineEvaluation> {
    this.assertReady();

    this.sendCommand(`setoption name MultiPV value ${multiPv}`);
    this.sendCommand("position fen " + fen);
    this.sendCommand("go depth " + depth);

    const lines = await this.waitFor("bestmove");
    return toEngineEvaluation(parseUciEvaluation(lines, sideToMoveFromFen(fen)));
  }

  /**
   * Evaluate a position to a fixed node count.
   *
   * Nodes rather than depth so every position in a game gets the same amount
   * of work regardless of how tactical it is, making evals comparable.
   *
   * @param fen     - FEN of the position to evaluate
   * @param nodes   - Node budget for the search
   * @param multiPv - Number of principal variations to return
   */
  async evaluateNodes(
    fen: string,
    nodes: number,
    multiPv: number
  ): Promise<ParsedUciEval> {
    this.assertReady();

    this.sendCommand(`setoption name MultiPV value ${multiPv}`);
    this.sendCommand("position fen " + fen);
    this.sendCommand(`go nodes ${nodes}`);

    const lines = await this.waitFor("bestmove", 120_000);
    return parseUciEvaluation(lines, sideToMoveFromFen(fen));
  }

  /**
   * Send a UCI option command.
   */
  setOption(name: string, value: string | number): void {
    this.assertReady();
    this.sendCommand(`setoption name ${name} value ${value}`);
  }

  /**
   * Evaluate a position given as a sequence of UCI moves from the start position.
   * Uses `position startpos moves ...` for better hash table reuse during play.
   */
  async evaluateFromMoves(
    moves: string[],
    depth = 24,
    moveTimeMs?: number
  ): Promise<EngineEvaluation> {
    this.assertReady();

    this.sendCommand("setoption name MultiPV value 1");

    if (moves.length === 0) {
      this.sendCommand("position startpos");
    } else {
      this.sendCommand("position startpos moves " + moves.join(" "));
    }

    if (moveTimeMs !== undefined) {
      this.sendCommand(`go movetime ${moveTimeMs}`);
    } else {
      this.sendCommand(`go depth ${depth}`);
    }

    const lines = await this.waitFor("bestmove");
    return toEngineEvaluation(
      parseUciEvaluation(lines, moves.length % 2 === 0 ? "w" : "b")
    );
  }

  /**
   * Evaluate using Stockfish's built-in time management.
   * Passes actual clock state so Stockfish allocates time optimally.
   */
  async evaluateWithClock(
    moves: string[],
    whiteTimeMs: number,
    blackTimeMs: number,
    whiteIncMs = 0,
    blackIncMs = 0
  ): Promise<EngineEvaluation> {
    this.assertReady();

    this.sendCommand("setoption name MultiPV value 1");

    if (moves.length === 0) {
      this.sendCommand("position startpos");
    } else {
      this.sendCommand("position startpos moves " + moves.join(" "));
    }

    const wtime = Math.max(1, Math.round(whiteTimeMs));
    const btime = Math.max(1, Math.round(blackTimeMs));
    const winc = Math.round(whiteIncMs);
    const binc = Math.round(blackIncMs);

    this.sendCommand(`go wtime ${wtime} btime ${btime} winc ${winc} binc ${binc}`);

    // Safety timeout: engine's remaining time + generous buffer
    const sideToMove = moves.length % 2 === 0 ? "w" : "b";
    const engineTime = sideToMove === "w" ? wtime : btime;
    const safetyMs = Math.min(engineTime + 10_000, 30_000);
    const lines = await this.waitFor("bestmove", safetyMs);
    return toEngineEvaluation(parseUciEvaluation(lines, sideToMove));
  }

  /** Send the UCI `stop` command. */
  stop(): void {
    this.sendCommand("stop");
  }

  /** Terminate the Web Worker and release resources. */
  quit(): void {
    if (this.worker) {
      try {
        this.sendCommand("quit");
      } catch {
        // Worker may already be dead.
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
  }

  // ------------------------------------------------------------------
  // Worker creation helpers
  // ------------------------------------------------------------------

  private createLocalWorker(): Worker {
    // Stockfish 18 single-threaded build handles Worker messaging natively
    // (onmessage for input, postMessage for output) — no wrapper needed.
    const worker = new Worker("/stockfish/stockfish.js");
    this.attachListener(worker);
    return worker;
  }

  private attachListener(worker: Worker): void {
    worker.onmessage = (e: MessageEvent) => {
      const data =
        typeof e.data === "string" ? e.data : String(e.data ?? "");
      if (this.messageHandler) {
        this.messageHandler(data);
      }
    };

    worker.onerror = (e) => {
      console.error("[StockfishEngine] Worker error:", e);
    };
  }

  // ------------------------------------------------------------------
  // UCI communication
  // ------------------------------------------------------------------

  private sendCommand(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  /**
   * Collects lines from the worker until one contains `token`.
   * Returns all collected lines (including the one with the token).
   */
  private waitFor(token: string, timeoutMs = 30_000): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const lines: string[] = [];
      const timer = setTimeout(() => {
        this.messageHandler = null;
        reject(
          new Error(
            `Timed out waiting for "${token}" from Stockfish after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      this.messageHandler = (data: string) => {
        lines.push(data);
        if (data.includes(token)) {
          clearTimeout(timer);
          this.messageHandler = null;
          resolve(lines);
        }
      };
    });
  }

  /**
   * Run the UCI + isready handshake.
   *
   * Generous timeouts: the worker's first message only lands after the browser
   * has downloaded and compiled the ~113 MB stockfish.wasm, which is served
   * uncached and can take minutes on a slow connection.
   */
  private async handshake(): Promise<void> {
    this.sendCommand("uci");
    await this.waitFor("uciok", 180_000);
    this.sendCommand("isready");
    await this.waitFor("readyok", 180_000);
  }

  private assertReady(): void {
    if (!this.isReady || !this.worker) {
      throw new Error(
        "Engine is not initialised. Call init() before evaluate()."
      );
    }
  }
}
