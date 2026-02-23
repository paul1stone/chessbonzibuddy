/**
 * Server-side Stockfish engine using the WASM build via Node.js subprocess.
 * Works on both local (native or WASM) and Vercel serverless (WASM only).
 */

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";

export interface ServerEngineEvaluation {
  eval: number;
  bestMove: string;
  pv: string[];
  depth: number;
  mate: number | null;
}

/**
 * Find the stockfish WASM JS file. Tries several locations since
 * bundlers and serverless runtimes may place node_modules differently.
 */
function resolveStockfishPath(): string {
  const candidates = [
    // Standard node_modules relative to project root
    path.join(process.cwd(), "node_modules/stockfish/bin/stockfish-18-single.js"),
    // Relative to this file (works in some bundled contexts)
    path.join(__dirname, "../../node_modules/stockfish/bin/stockfish-18-single.js"),
    path.join(__dirname, "../../../node_modules/stockfish/bin/stockfish-18-single.js"),
  ];

  // Also try require.resolve if available
  try {
    candidates.unshift(require.resolve("stockfish/bin/stockfish-18-single.js"));
  } catch {
    // require.resolve may fail in some bundled environments
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find stockfish WASM. Searched:\n${candidates.join("\n")}`
  );
}

export class ServerStockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private lineResolvers: Array<(line: string) => void> = [];

  async init(): Promise<void> {
    const stockfishPath = resolveStockfishPath();

    this.process = spawn(process.execPath, [stockfishPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.setEncoding("utf-8");
    this.process.stdout.on("data", (data: string) => {
      this.buffer += data;
      const lines = this.buffer.split("\n");
      // Keep the last incomplete line in the buffer
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          // Resolve any waiting line readers
          for (const resolve of this.lineResolvers) {
            resolve(line);
          }
        }
      }
    });

    // Capture stderr for debugging
    this.process.stderr.setEncoding("utf-8");
    this.process.stderr.on("data", (data: string) => {
      console.error("[stockfish stderr]", data);
    });

    this.process.on("error", (err) => {
      throw new Error(`Failed to start Stockfish WASM: ${err.message}`);
    });

    // UCI handshake — WASM init can be slow on cold start
    await this.sendAndWaitFor("uci", "uciok", 30_000);
    // WASM build is single-threaded, skip Threads option
    this.send("setoption name Hash value 64");
    await this.sendAndWaitFor("isready", "readyok", 30_000);
  }

  async evaluate(
    fen: string,
    depth = 18
  ): Promise<ServerEngineEvaluation> {
    this.send("setoption name MultiPV value 1");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    const lines = await this.collectUntil("bestmove");
    return this.parseEvaluation(lines);
  }

  quit(): void {
    if (this.process) {
      this.send("quit");
      this.process.kill();
      this.process = null;
    }
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private send(cmd: string): void {
    this.process?.stdin.write(cmd + "\n");
  }

  private async sendAndWaitFor(
    cmd: string,
    token: string,
    timeoutMs = 10_000
  ): Promise<void> {
    this.send(cmd);
    await this.waitForLine(token, timeoutMs);
  }

  private waitForLine(
    token: string,
    timeoutMs = 30_000
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.lineResolvers = this.lineResolvers.filter((r) => r !== handler);
        reject(new Error(`Timed out waiting for "${token}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (line: string) => {
        if (line.includes(token)) {
          clearTimeout(timer);
          this.lineResolvers = this.lineResolvers.filter((r) => r !== handler);
          resolve(line);
        }
      };

      this.lineResolvers.push(handler);
    });
  }

  private collectUntil(token: string, timeoutMs = 60_000): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const collected: string[] = [];
      const timer = setTimeout(() => {
        this.lineResolvers = this.lineResolvers.filter((r) => r !== handler);
        reject(new Error(`Timed out waiting for "${token}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (line: string) => {
        collected.push(line);
        if (line.includes(token)) {
          clearTimeout(timer);
          this.lineResolvers = this.lineResolvers.filter((r) => r !== handler);
          resolve(collected);
        }
      };

      this.lineResolvers.push(handler);
    });
  }

  private parseEvaluation(lines: string[]): ServerEngineEvaluation {
    let bestEval = 0;
    let mate: number | null = null;
    let pv: string[] = [];
    let depth = 0;
    let bestMove = "";

    const infoLines = lines
      .filter((l) => l.startsWith("info") && l.includes("score"))
      .reverse();

    for (const line of infoLines) {
      const lineDepth = this.extractInt(line, "depth");
      if (lineDepth === null || lineDepth < depth) continue;
      depth = lineDepth;

      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);

      if (mateMatch) {
        mate = parseInt(mateMatch[1], 10);
        bestEval = mate > 0 ? 100_000 - mate : -100_000 - mate;
      } else if (cpMatch) {
        bestEval = parseInt(cpMatch[1], 10);
        mate = null;
      }

      const pvMatch = line.match(/ pv (.+)/);
      if (pvMatch) {
        pv = pvMatch[1].trim().split(/\s+/);
      }
    }

    const bestMoveLine = lines.find((l) => l.startsWith("bestmove"));
    if (bestMoveLine) {
      bestMove = bestMoveLine.split(/\s+/)[1] ?? "";
    }

    return { eval: bestEval, bestMove, pv, depth, mate };
  }

  private extractInt(line: string, key: string): number | null {
    const regex = new RegExp(`\\b${key}\\s+(\\d+)`);
    const match = line.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }
}
