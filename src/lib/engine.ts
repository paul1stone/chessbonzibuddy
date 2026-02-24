/**
 * Stockfish WASM engine wrapper for client-side chess analysis.
 *
 * This module is browser-only. It communicates with Stockfish via a Web Worker
 * and must never be imported in a server-side (Node.js) context. Components
 * that use it should be marked "use client" and import it dynamically or
 * conditionally guard against SSR.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineEvaluation {
  /** Evaluation in centipawns (positive = white advantage) */
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

export interface MoveAnalysis {
  moveNumber: number;
  color: "w" | "b";
  /** Standard algebraic notation, e.g. "e4" */
  san: string;
  /** UCI notation, e.g. "e2e4" */
  uci: string;
  /** Eval (centipawns) of the position before this move was played */
  evalBefore: number;
  /** Eval (centipawns) of the position after this move was played */
  evalAfter: number;
  /** Engine's best move in this position (UCI) */
  bestMove: string;
  /** Engine's best move in SAN */
  bestMoveSan: string;
  classification: MoveClassification;
  topLines: Array<{ moves: string[]; eval: number }>;
}

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface GameAnalysis {
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  /** Estimated rating White "played like" based on accuracy */
  whiteRating: number;
  /** Estimated rating Black "played like" based on accuracy */
  blackRating: number;
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

    if (multiPv > 1) {
      this.sendCommand(`setoption name MultiPV value ${multiPv}`);
    } else {
      this.sendCommand("setoption name MultiPV value 1");
    }

    this.sendCommand("position fen " + fen);
    this.sendCommand("go depth " + depth);
    const lines = await this.waitFor("bestmove");
    return this.parseEvaluation(lines);
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
    return this.parseEvaluation(lines);
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
    const engineTime = moves.length % 2 === 0 ? wtime : btime;
    const safetyMs = Math.min(engineTime + 10_000, 30_000);
    const lines = await this.waitFor("bestmove", safetyMs);
    return this.parseEvaluation(lines);
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

  /** Run the UCI + isready handshake. */
  private async handshake(): Promise<void> {
    this.sendCommand("uci");
    await this.waitFor("uciok", 10_000);
    this.sendCommand("isready");
    await this.waitFor("readyok", 10_000);
  }

  private assertReady(): void {
    if (!this.isReady || !this.worker) {
      throw new Error(
        "Engine is not initialised. Call init() before evaluate()."
      );
    }
  }

  // ------------------------------------------------------------------
  // Output parsing
  // ------------------------------------------------------------------

  /**
   * Parse UCI `info` and `bestmove` lines into an {@link EngineEvaluation}.
   *
   * Typical UCI output we're interested in:
   * ```
   * info depth 18 seldepth 24 multipv 1 score cp 35 nodes 123456 ... pv e2e4 e7e5 ...
   * info depth 18 ... score mate 3 ... pv ...
   * bestmove e2e4 ponder e7e5
   * ```
   */
  private parseEvaluation(lines: string[]): EngineEvaluation {
    let bestEval = 0;
    let mate: number | null = null;
    let pv: string[] = [];
    let depth = 0;
    let bestMove = "";

    // Walk info lines (deepest first) to find the highest-depth evaluation.
    const infoLines = lines
      .filter((l) => l.startsWith("info") && l.includes("score"))
      .reverse(); // most recent (deepest) first

    for (const line of infoLines) {
      const lineDepth = this.extractInt(line, "depth");
      if (lineDepth === null) continue;

      // Only consider the deepest line (or requested depth)
      if (lineDepth < depth) continue;
      depth = lineDepth;

      // Parse score
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);

      if (mateMatch) {
        mate = parseInt(mateMatch[1], 10);
        // Convert mate score to a very large centipawn value for comparison
        bestEval = mate > 0 ? 100_000 - mate : -100_000 - mate;
      } else if (cpMatch) {
        bestEval = parseInt(cpMatch[1], 10);
        mate = null;
      }

      // Parse PV
      const pvMatch = line.match(/ pv (.+)/);
      if (pvMatch) {
        pv = pvMatch[1].trim().split(/\s+/);
      }
    }

    // Parse bestmove line
    const bestMoveLine = lines.find((l) => l.startsWith("bestmove"));
    if (bestMoveLine) {
      const parts = bestMoveLine.split(/\s+/);
      bestMove = parts[1] ?? "";
    }

    return { eval: bestEval, bestMove, pv, depth, mate };
  }

  private extractInt(line: string, key: string): number | null {
    const regex = new RegExp(`\\b${key}\\s+(\\d+)`);
    const match = line.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }
}
