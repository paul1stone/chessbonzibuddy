import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/**
 * GET /api/games
 *
 * Returns all games ordered by creation date (newest first).
 * Only includes the fields needed for the sidebar listing.
 */
export async function GET() {
  try {
    const allGames = await db
      .select({
        id: games.id,
        whitePlayer: games.whitePlayer,
        blackPlayer: games.blackPlayer,
        result: games.result,
        whiteAccuracy: games.whiteAccuracy,
        blackAccuracy: games.blackAccuracy,
        createdAt: games.createdAt,
      })
      .from(games)
      .orderBy(desc(games.createdAt));

    return NextResponse.json(allGames);
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
