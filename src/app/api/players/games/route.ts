import { NextResponse } from "next/server";

/**
 * GET /api/players/games?platform=chesscom|lichess&username=xxx
 *
 * Fetch recent games for a player from Chess.com or Lichess public APIs.
 */

interface RecentGame {
  id: string;
  url: string;
  white: string;
  black: string;
  result: string;
  timeControl: string;
  playedAt: string; // ISO string
  pgn: string;
}

// ---------------------------------------------------------------------------
// Chess.com
// ---------------------------------------------------------------------------

interface ChessComArchiveGame {
  url: string;
  pgn?: string;
  white?: { username: string; result?: string };
  black?: { username: string; result?: string };
  time_control?: string;
  end_time?: number;
}

async function fetchChessComGames(username: string): Promise<RecentGame[]> {
  // Get archives list
  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`,
    { headers: { Accept: "application/json" } }
  );

  if (!archivesRes.ok) {
    throw new Error(
      archivesRes.status === 404
        ? "Chess.com user not found"
        : `Chess.com API error: ${archivesRes.status}`
    );
  }

  const { archives } = (await archivesRes.json()) as {
    archives: string[];
  };

  if (!archives || archives.length === 0) {
    return [];
  }

  // Fetch the last 2 months of games
  const recentArchives = archives.slice(-2).reverse();
  const allGames: RecentGame[] = [];

  for (const archiveUrl of recentArchives) {
    const res = await fetch(archiveUrl, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) continue;

    const data = (await res.json()) as { games?: ChessComArchiveGame[] };
    const games = data.games ?? [];

    for (const g of games) {
      if (!g.pgn) continue;

      // Extract game ID from URL
      const idMatch = g.url.match(/\/(\d+)$/);
      const gameId = idMatch ? idMatch[1] : g.url;

      // Determine result string
      let result = "*";
      if (g.white?.result === "win") result = "1-0";
      else if (g.black?.result === "win") result = "0-1";
      else if (
        g.white?.result === "agreed" ||
        g.white?.result === "stalemate" ||
        g.white?.result === "repetition" ||
        g.white?.result === "insufficient"
      ) {
        result = "1/2-1/2";
      }

      allGames.push({
        id: gameId,
        url: g.url,
        white: g.white?.username ?? "Unknown",
        black: g.black?.username ?? "Unknown",
        result,
        timeControl: formatTimeControl(g.time_control),
        playedAt: g.end_time
          ? new Date(g.end_time * 1000).toISOString()
          : "",
        pgn: g.pgn,
      });
    }
  }

  // Sort newest first
  allGames.sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );

  return allGames.slice(0, 50);
}

function formatTimeControl(tc?: string): string {
  if (!tc) return "Unknown";
  const seconds = parseInt(tc.split("/").pop() ?? tc, 10);
  if (isNaN(seconds)) return tc;
  if (seconds < 180) return "Bullet";
  if (seconds < 600) return "Blitz";
  if (seconds < 1800) return "Rapid";
  return "Classical";
}

// ---------------------------------------------------------------------------
// Lichess
// ---------------------------------------------------------------------------

interface LichessGame {
  id: string;
  pgn?: string;
  players?: {
    white?: { user?: { name: string } };
    black?: { user?: { name: string } };
  };
  status?: string;
  winner?: "white" | "black";
  speed?: string;
  createdAt?: number;
}

async function fetchLichessGames(username: string): Promise<RecentGame[]> {
  const res = await fetch(
    `https://lichess.org/api/games/user/${username.toLowerCase()}?max=50&pgnInJson=true`,
    {
      headers: {
        Accept: "application/x-ndjson",
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Lichess user not found"
        : `Lichess API error: ${res.status}`
    );
  }

  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  const allGames: RecentGame[] = [];

  for (const line of lines) {
    try {
      const g = JSON.parse(line) as LichessGame;
      if (!g.pgn) continue;

      let result = "1/2-1/2";
      if (g.winner === "white") result = "1-0";
      else if (g.winner === "black") result = "0-1";
      else if (g.status === "draw" || g.status === "stalemate")
        result = "1/2-1/2";

      allGames.push({
        id: g.id,
        url: `https://lichess.org/${g.id}`,
        white: g.players?.white?.user?.name ?? "Unknown",
        black: g.players?.black?.user?.name ?? "Unknown",
        result,
        timeControl: g.speed
          ? g.speed.charAt(0).toUpperCase() + g.speed.slice(1)
          : "Unknown",
        playedAt: g.createdAt
          ? new Date(g.createdAt).toISOString()
          : "",
        pgn: g.pgn,
      });
    } catch {
      // Skip malformed lines
    }
  }

  return allGames;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const username = searchParams.get("username");

  if (!platform || !username) {
    return NextResponse.json(
      { error: "Missing platform or username" },
      { status: 400 }
    );
  }

  try {
    let recentGames: RecentGame[];

    if (platform === "chesscom") {
      recentGames = await fetchChessComGames(username);
    } else if (platform === "lichess") {
      recentGames = await fetchLichessGames(username);
    } else {
      return NextResponse.json(
        { error: "Invalid platform. Use 'chesscom' or 'lichess'" },
        { status: 400 }
      );
    }

    return NextResponse.json(recentGames);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch games";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
