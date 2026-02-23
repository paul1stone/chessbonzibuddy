/**
 * Fetch player ratings from Chess.com and Lichess public APIs.
 * Both APIs support CORS so these can be called client-side.
 */

import type { PlayerRatings } from "@/stores/profile-store";

// ---------------------------------------------------------------------------
// Chess.com
// ---------------------------------------------------------------------------

interface ChessComStats {
  chess_rapid?: { last?: { rating?: number } };
  chess_blitz?: { last?: { rating?: number } };
  chess_bullet?: { last?: { rating?: number } };
}

/**
 * Fetch a Chess.com player's ratings.
 * @throws Error if the user is not found or the request fails.
 */
export async function fetchChessComRatings(
  username: string
): Promise<PlayerRatings> {
  const res = await fetch(
    `https://api.chess.com/pub/player/${username.toLowerCase()}/stats`,
    { headers: { Accept: "application/json" } }
  );

  if (res.status === 404) throw new Error("Chess.com user not found");
  if (!res.ok) throw new Error(`Chess.com API error: ${res.status}`);

  const data = (await res.json()) as ChessComStats;

  return {
    rapid: data.chess_rapid?.last?.rating,
    blitz: data.chess_blitz?.last?.rating,
    bullet: data.chess_bullet?.last?.rating,
  };
}

// ---------------------------------------------------------------------------
// Lichess
// ---------------------------------------------------------------------------

interface LichessUser {
  perfs?: {
    rapid?: { rating?: number };
    blitz?: { rating?: number };
    bullet?: { rating?: number };
  };
}

/**
 * Fetch a Lichess player's ratings.
 * @throws Error if the user is not found or the request fails.
 */
export async function fetchLichessRatings(
  username: string
): Promise<PlayerRatings> {
  const res = await fetch(
    `https://lichess.org/api/user/${username.toLowerCase()}`,
    { headers: { Accept: "application/json" } }
  );

  if (res.status === 404) throw new Error("Lichess user not found");
  if (!res.ok) throw new Error(`Lichess API error: ${res.status}`);

  const data = (await res.json()) as LichessUser;

  return {
    rapid: data.perfs?.rapid?.rating,
    blitz: data.perfs?.blitz?.rating,
    bullet: data.perfs?.bullet?.rating,
  };
}
