import { NextRequest, NextResponse } from "next/server";
import { desc, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/**
 * GET /api/games?username=ppstone47
 *
 * Returns games ordered by creation date (newest first).
 * When `username` is provided, only returns games where
 * whitePlayer or blackPlayer matches (case-insensitive).
 */
export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username");

    const query = db
      .select({
        id: games.id,
        whitePlayer: games.whitePlayer,
        blackPlayer: games.blackPlayer,
        result: games.result,
        whiteAccuracy: games.whiteAccuracy,
        blackAccuracy: games.blackAccuracy,
        createdAt: games.createdAt,
      })
      .from(games);

    const allGames = username
      ? await query
          .where(
            or(
              ilike(games.whitePlayer, username),
              ilike(games.blackPlayer, username)
            )
          )
          .orderBy(desc(games.createdAt))
      : await query.orderBy(desc(games.createdAt));

    return NextResponse.json(allGames);
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
