/**
 * Generates the committed demo fixture for the homepage: a real Stockfish 18
 * analysis of the Opera Game, produced by the very same pipeline the browser
 * runs (`analyzeGame`), with the WASM worker swapped for a spawned UCI process.
 *
 * Run with `npm run demo-fixture`. Output: src/components/landing/demo/opera-game.json
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import * as nodeModule from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseUciEvaluation,
  sideToMoveFromFen,
  type ParsedUciEval,
} from "../src/lib/uci.ts";
import type { AnalysisEngine } from "../src/lib/analyze.ts";

const REPO_ROOT = new URL("../", import.meta.url);
const SRC_ROOT = new URL("src/", REPO_ROOT);
const STOCKFISH = fileURLToPath(
  new URL("node_modules/stockfish/bin/stockfish-18-lite-single.js", REPO_ROOT)
);
const OUT_FILE = fileURLToPath(
  new URL("src/components/landing/demo/opera-game.json", REPO_ROOT)
);

/** Morphy vs Duke of Brunswick and Count Isouard, Paris 1858. */
const OPERA_PGN =
  "1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 " +
  "7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 " +
  "13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0";

// ---------------------------------------------------------------------------
// Module resolution for the app's source graph
// ---------------------------------------------------------------------------

interface ResolveContext {
  parentURL?: string;
  conditions?: string[];
  importAttributes?: Record<string, string>;
}
interface ResolveResult {
  url: string;
  format?: string | null;
  importAttributes?: Record<string, string>;
  shortCircuit?: boolean;
}
type NextResolve = (
  specifier: string,
  context?: ResolveContext
) => ResolveResult;
type ResolveHook = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve
) => ResolveResult;

/**
 * Teach node how to load the app's modules.
 *
 * The pipeline is written for a bundler: relative imports carry no extension
 * (`./engine`) and `openings.ts` reaches for the `@/*` tsconfig alias. Bare
 * node ESM resolves neither, so a resolve hook fills both gaps and the fixture
 * is generated from unmodified production source — including real book
 * detection, which a plain node run would silently lose.
 */
function registerAppResolution(): void {
  // module.registerHooks landed in node 22.15 but is absent from @types/node 20.
  const { registerHooks } = nodeModule as unknown as {
    registerHooks?: (hooks: { resolve: ResolveHook }) => void;
  };
  if (typeof registerHooks !== "function") {
    throw new Error("node >= 22.15 required: module.registerHooks is unavailable");
  }

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const aliased = specifier.startsWith("@/")
        ? new URL(specifier.slice(2), SRC_ROOT).href
        : specifier;

      if (!/^(\.|\/|file:)/.test(aliased)) return nextResolve(aliased, context);

      const url = new URL(aliased, context.parentURL);

      // JSON needs an explicit type, which the app's bundler-style import omits.
      if (url.pathname.endsWith(".json")) {
        return {
          url: url.href,
          format: "json",
          importAttributes: { type: "json" },
          shortCircuit: true,
        };
      }

      if (!existsSync(fileURLToPath(url))) {
        for (const ext of [".ts", ".tsx", ".js"]) {
          if (existsSync(fileURLToPath(new URL(url.href + ext)))) {
            return nextResolve(url.href + ext, context);
          }
        }
      }
      return nextResolve(url.href, context);
    },
  });
}

// ---------------------------------------------------------------------------
// AnalysisEngine over a spawned Stockfish process
// ---------------------------------------------------------------------------

/**
 * The node-side twin of `StockfishEngine`: same UCI conversation, but over a
 * child process's stdio instead of a Web Worker. Parsing is delegated to the
 * production `parseUciEvaluation` so the fixture's numbers are parsed exactly as production parses them (the browser ships the full net, this script the lite build, so evals differ slightly).
 * to what the browser would produce.
 */
class StockfishProcessEngine implements AnalysisEngine {
  private child: ChildProcess | null = null;
  private stdoutBuffer = "";
  /** Lines received but not yet claimed by a waiter. */
  private pending: string[] = [];
  private waiter: {
    token: string;
    resolve: (lines: string[]) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  private multiPv = 1;

  async init(): Promise<void> {
    this.child = spawn(process.execPath, [STOCKFISH], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.child.stdout?.setEncoding("utf8");
    this.child.stdout?.on("data", (chunk: string) => this.ingest(chunk));
    this.child.on("error", (err) => this.fail(err));
    this.child.on("exit", (code) =>
      this.fail(new Error(`stockfish exited early with code ${code}`))
    );

    this.send("uci");
    await this.waitFor("uciok", 60_000);
    this.send("isready");
    await this.waitFor("readyok", 60_000);
  }

  async newGame(): Promise<void> {
    this.send("ucinewgame");
    this.send("isready");
    await this.waitFor("readyok", 60_000);
  }

  async evaluateNodes(
    fen: string,
    nodes: number,
    multiPv: number
  ): Promise<ParsedUciEval> {
    if (multiPv !== this.multiPv) {
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.multiPv = multiPv;
    }
    this.send("isready");
    await this.waitFor("readyok", 60_000);

    this.send(`position fen ${fen}`);
    this.send(`go nodes ${nodes}`);
    const lines = await this.waitFor("bestmove", 300_000);
    return parseUciEvaluation(lines, sideToMoveFromFen(fen));
  }

  quit(): void {
    const child = this.child;
    if (!child) return;
    this.child = null;
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter = null;
    }
    try {
      child.stdin?.write("quit\n");
      child.stdin?.end();
    } catch {
      // Already gone; the kill below is the real cleanup.
    }
    child.kill();
  }

  private send(command: string): void {
    this.child?.stdin?.write(`${command}\n`);
  }

  private ingest(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      this.pending.push(line);
      const waiter = this.waiter;
      if (waiter && line.includes(waiter.token)) {
        clearTimeout(waiter.timer);
        this.waiter = null;
        waiter.resolve(this.claim());
      }
    }
  }

  private claim(): string[] {
    const lines = this.pending;
    this.pending = [];
    return lines;
  }

  /** Collect lines up to and including the first one containing `token`. */
  private waitFor(token: string, timeoutMs: number): Promise<string[]> {
    // The token may already have arrived while nobody was waiting.
    const hit = this.pending.findIndex((line) => line.includes(token));
    if (hit !== -1) {
      const lines = this.pending.slice(0, hit + 1);
      this.pending = this.pending.slice(hit + 1);
      return Promise.resolve(lines);
    }

    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error(`timed out waiting for "${token}" after ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiter = { token, resolve, reject, timer };
    });
  }

  private fail(err: Error): void {
    const waiter = this.waiter;
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.waiter = null;
    waiter.reject(err);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(STOCKFISH)) {
    throw new Error(`stockfish binary not found at ${STOCKFISH}; run npm install`);
  }

  registerAppResolution();

  // Imported after the hooks are registered: static imports resolve too early.
  const { analyzeGame } = await import("../src/lib/analyze.ts");
  const { loadOpenings } = await import("../src/lib/openings.ts");

  const openings = await loadOpenings().catch(() => null);
  if (openings) {
    console.log(`opening book: ${openings.size} positions loaded`);
  } else {
    console.warn(
      "warning: opening book failed to load; opening moves will grade as best/good instead of book"
    );
  }

  const started = Date.now();
  const engine = new StockfishProcessEngine();
  const analysis = await analyzeGame(OPERA_PGN, {
    engine,
    onProgress: (current, total) =>
      process.stdout.write(`\ranalysing ${current}/${total} moves`),
  });
  process.stdout.write("\n");

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    `${JSON.stringify({ pgn: OPERA_PGN, analysis }, null, 2)}\n`
  );

  const counts = new Map<string, number>();
  for (const move of analysis.moves) {
    counts.set(move.classification, (counts.get(move.classification) ?? 0) + 1);
  }

  const { size } = await stat(OUT_FILE);
  console.log(`wrote ${OUT_FILE}`);
  console.log(
    `  ${analysis.moves.length} moves, ${(size / 1024).toFixed(1)} KB, ${(
      (Date.now() - started) /
      1000
    ).toFixed(1)}s`
  );
  console.log(
    `  accuracy: white ${analysis.whiteAccuracy} (${analysis.whiteRating}), black ${analysis.blackAccuracy} (${analysis.blackRating})`
  );
  console.log(
    `  classifications: ${[...counts]
      .map(([name, n]) => `${name} ${n}`)
      .join(", ")}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
