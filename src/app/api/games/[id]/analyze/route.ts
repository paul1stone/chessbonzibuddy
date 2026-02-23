import { eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { db } from "@/db";
import { games } from "@/db/schema";
import { ServerStockfishEngine } from "@/lib/server/engine";
import {
  cpToWinPercent,
  classifyMove,
  calculateAccuracy,
  accuracyToRating,
  uciToSan,
} from "@/lib/analysis-utils";
import type { MoveAnalysis, GameAnalysis } from "@/lib/engine";

// Allow up to 60s for analysis (Hobby plan max is 60s with streaming)
export const maxDuration = 60;

/**
 * POST /api/games/[id]/analyze
 *
 * Run Stockfish WASM analysis server-side.
 * Streams progress via Server-Sent Events.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch game from DB
  const [game] = await db.select().from(games).where(eq(games.id, id));
  if (!game) {
    return new Response(JSON.stringify({ error: "Game not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Parse PGN
        const gameFull = new Chess();
        gameFull.loadPgn(game.pgn);
        const moves = gameFull.history({ verbose: true });

        if (moves.length === 0) {
          const result: GameAnalysis = {
            moves: [],
            whiteAccuracy: 100,
            blackAccuracy: 100,
            whiteRating: 0,
            blackRating: 0,
          };
          send({ type: "complete", analysis: result });
          controller.close();
          return;
        }

        send({ type: "progress", current: 0, total: moves.length });

        // Init native Stockfish
        const engine = new ServerStockfishEngine();
        await engine.init();

        try {
          const analysis: MoveAnalysis[] = [];
          const replay = new Chess();
          const depth = 12;

          // Evaluate starting position — this gives us evalBefore AND
          // bestMove for the first move. We reuse each afterResult as
          // the next move's "before" evaluation to avoid redundant evals.
          let prevResult = await engine.evaluate(replay.fen(), depth);

          for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const fenBefore = replay.fen();
            const evalBefore = prevResult.eval;
            const bestMove = prevResult.bestMove;
            const bestPv = prevResult.pv;

            // Play the actual move
            replay.move(move.san);

            // Evaluate position AFTER the move — this result also serves
            // as the "before" evaluation for the next move (same position).
            const afterResult = await engine.evaluate(replay.fen(), depth);
            const evalAfter = afterResult.eval;

            const bestMoveSan = uciToSan(fenBefore, bestMove);
            const isPlayedBest =
              move.from + move.to + (move.promotion ?? "") === bestMove;
            const wpBefore = cpToWinPercent(evalBefore);
            const wpAfter = cpToWinPercent(evalAfter);
            const winPercentLoss =
              move.color === "w"
                ? Math.max(0, wpBefore - wpAfter)
                : Math.max(0, (100 - wpBefore) - (100 - wpAfter));
            const classification = classifyMove(winPercentLoss, isPlayedBest);

            analysis.push({
              moveNumber: Math.floor(i / 2) + 1,
              color: move.color,
              san: move.san,
              uci: move.from + move.to + (move.promotion ?? ""),
              evalBefore,
              evalAfter,
              bestMove,
              bestMoveSan,
              classification,
              topLines: bestPv.length > 0
                ? [{ moves: bestPv, eval: evalBefore }]
                : [],
            });

            prevResult = afterResult;
            send({ type: "progress", current: i + 1, total: moves.length });
          }

          const whiteMoves = analysis.filter((m) => m.color === "w");
          const blackMoves = analysis.filter((m) => m.color === "b");
          const whiteAccuracy = calculateAccuracy(whiteMoves);
          const blackAccuracy = calculateAccuracy(blackMoves);

          const result: GameAnalysis = {
            moves: analysis,
            whiteAccuracy,
            blackAccuracy,
            whiteRating: accuracyToRating(whiteAccuracy),
            blackRating: accuracyToRating(blackAccuracy),
          };

          // Save to database
          await db
            .update(games)
            .set({
              analysis: result as unknown as Record<string, unknown>,
              whiteAccuracy,
              blackAccuracy,
            })
            .where(eq(games.id, id));

          send({ type: "complete", analysis: result });
        } finally {
          engine.quit();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Analysis failed";
        send({ type: "error", error: message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
