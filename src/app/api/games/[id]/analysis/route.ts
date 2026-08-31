import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/** Accuracies are percentages; anything outside [0, 100] is a client bug, not data. */
function isAccuracy(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

/**
 * PUT /api/games/[id]/analysis
 *
 * Save analysis results for a game. Accepts the full analysis data along with
 * computed accuracy scores and persists them to the database.
 *
 * Request body: { analysis: GameAnalysis (v2), whiteAccuracy: number, blackAccuracy: number }
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
    // Only v2 blobs are storable: pre-v2 evals were side-to-move relative, so
    // accepting one would persist numbers the UI reads with the wrong sign.
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json(
        { error: "Missing required field: analysis" },
        { status: 400 }
      );
    }

    const candidate = analysis as { version?: unknown; moves?: unknown };
    if (candidate.version !== 2 || !Array.isArray(candidate.moves)) {
      return NextResponse.json(
        { error: "Invalid analysis: expected version 2 with a moves array" },
        { status: 400 }
      );
    }

    if (!isAccuracy(whiteAccuracy) || !isAccuracy(blackAccuracy)) {
      return NextResponse.json(
        { error: "whiteAccuracy and blackAccuracy must be numbers between 0 and 100" },
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
