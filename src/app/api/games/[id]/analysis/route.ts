import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/**
 * PUT /api/games/[id]/analysis
 *
 * Save analysis results for a game. Accepts the full analysis data along with
 * computed accuracy scores and persists them to the database.
 *
 * Request body: { analysis: object, whiteAccuracy: number, blackAccuracy: number }
 * Responses:
 *   200 - Analysis saved successfully (returns updated game record)
 *   400 - Invalid input
 *   404 - Game not found
 *   500 - Server error
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { analysis, whiteAccuracy, blackAccuracy } = body as {
      analysis?: unknown;
      whiteAccuracy?: number;
      blackAccuracy?: number;
    };

    // ---- Validate input ----
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json(
        { error: "Missing required field: analysis" },
        { status: 400 }
      );
    }

    if (typeof whiteAccuracy !== "number" || typeof blackAccuracy !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: whiteAccuracy and blackAccuracy must be numbers" },
        { status: 400 }
      );
    }

    // ---- Update the game record ----
    const [updated] = await db
      .update(games)
      .set({
        analysis,
        whiteAccuracy,
        blackAccuracy,
      })
      .where(eq(games.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving analysis:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
