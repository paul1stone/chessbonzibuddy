import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

/**
 * DELETE /api/games/[id]
 *
 * Removes a game from the database.
 *
 * Responses:
 *   204 - Game deleted successfully
 *   404 - Game not found
 *   500 - Server error
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(games)
      .where(eq(games.id, id))
      .returning({ id: games.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
