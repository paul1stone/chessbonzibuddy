import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { fetchChessComGame } from "@/lib/chess-com";

/**
 * POST /api/games/import
 *
 * Import a Chess.com game by URL. Fetches the game data, saves it to the
 * database, and returns the created record.
 *
 * Request body: { url: string }
 * Responses:
 *   201 - Game imported successfully (returns game record)
 *   400 - Invalid input (missing URL or not a Chess.com URL)
 *   404 - Game not found on Chess.com
 *   500 - Server error
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    // ---- Validate input ----
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();

    // Basic domain validation before attempting to parse
    try {
      const parsed = new URL(trimmedUrl);
      const hostname = parsed.hostname.replace(/^www\./, "");
      if (hostname !== "chess.com") {
        return NextResponse.json(
          { error: "URL must be from chess.com" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // ---- Fetch game from Chess.com ----
    let result;
    try {
      result = await fetchChessComGame(trimmedUrl);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unknown error";

      if (message.includes("not found")) {
        return NextResponse.json(
          { error: "Game not found on Chess.com" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch game: ${message}` },
        { status: 500 }
      );
    }

    // ---- Save to database ----
    const [game] = await db
      .insert(games)
      .values({
        chessComUrl: trimmedUrl,
        pgn: result.pgn,
        whitePlayer: result.whitePlayer,
        blackPlayer: result.blackPlayer,
        result: result.result,
        playedAt: result.playedAt,
      })
      .returning();

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Error importing game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
