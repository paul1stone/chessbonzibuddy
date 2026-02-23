/**
 * Server-side Stockfish engine using the native binary via child_process.
 * Much faster than the browser WASM build.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

export interface ServerEngineEvaluation {
  eval: number;
  bestMove: string;
  pv: string[];
  depth: number;
  mate: number | null;
}

export class ServerStockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private lineResolvers: Array<(line: string) => void> = [];

  async init(): Promise<void> {
    this.process = spawn("stockfish", [], {
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

    this.process.on("error", (err) => {
      throw new Error(
        `Failed to start Stockfish. Is it installed? (brew install stockfish)\n${err.message}`
      );
    });

    // UCI handshake
    await this.sendAndWaitFor("uci", "uciok");
    // Use multiple threads for speed
    this.send("setoption name Threads value 4");
    this.send("setoption name Hash value 256");
    await this.sendAndWaitFor("isready", "readyok");
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

  private async sendAndWaitFor(cmd: string, token: string): Promise<void> {
    this.send(cmd);
    await this.waitForLine(token, 10_000);
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
