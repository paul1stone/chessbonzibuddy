/**
 * Chess.com game URL parser and PGN fetcher.
 *
 * Supports parsing various Chess.com URL formats and fetching game data
 * via Chess.com's callback API.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedChessComUrl {
  gameId: string;
  type: "live" | "daily";
}

export interface ChessComGame {
  pgn: string;
  whitePlayer: string;
  blackPlayer: string;
  result: string;
  playedAt: Date | null;
  url: string;
}

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Chess.com game URL and extract the game ID and type.
 *
 * Supported URL formats:
 *  - https://www.chess.com/game/live/123456789
 *  - https://www.chess.com/game/daily/123456789
 *  - https://www.chess.com/live#g=123456789
 *  - https://www.chess.com/analysis/game/live/123456789
 *  - https://www.chess.com/analysis/game/daily/123456789
 *
 * @throws Error if the URL is not a valid Chess.com game URL.
 */
export function parseChessComUrl(url: string): ParsedChessComUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  if (hostname !== "chess.com") {
    throw new Error("URL is not from chess.com");
  }

  // Format: /live#g=123456789
  if (parsed.pathname === "/live" && parsed.hash) {
    const match = parsed.hash.match(/g=(\d+)/);
    if (match) {
      return { gameId: match[1], type: "live" };
    }
  }

  // Format: /game/live/123456789 or /game/daily/123456789
  const gamePathMatch = parsed.pathname.match(
    /\/game\/(live|daily)\/(\d+)/
  );
  if (gamePathMatch) {
    return {
      gameId: gamePathMatch[2],
      type: gamePathMatch[1] as "live" | "daily",
    };
  }

  // Format: /analysis/game/live/123456789 or /analysis/game/daily/123456789
  const analysisPathMatch = parsed.pathname.match(
    /\/analysis\/game\/(live|daily)\/(\d+)/
  );
  if (analysisPathMatch) {
    return {
      gameId: analysisPathMatch[2],
      type: analysisPathMatch[1] as "live" | "daily",
    };
  }

  throw new Error(
    "Could not parse Chess.com game URL. Supported formats: " +
      "/game/live/{id}, /game/daily/{id}, /live#g={id}, /analysis/game/live/{id}, /analysis/game/daily/{id}"
  );
}

// ---------------------------------------------------------------------------
// PGN Header Parsing
// ---------------------------------------------------------------------------

/**
 * Extract standard PGN header values from raw PGN text.
 *
 * Parses tags such as `[White "player1"]`, `[Black "player2"]`, etc.
 */
export function parsePgnHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Game Fetching
// ---------------------------------------------------------------------------

const USER_AGENT = "ChessAnalyzer/1.0";

/**
 * Fetch a Chess.com game by its URL.
 *
 * Strategy:
 *  1. Parse the URL to get the game ID and type.
 *  2. Try the Chess.com callback JSON API (`/callback/{type}/game/{id}`).
 *  3. If that fails, attempt to scrape the game page for embedded PGN data.
 *
 * @throws Error with a descriptive message on failure.
 */
export async function fetchChessComGame(url: string): Promise<ChessComGame> {
  const { gameId, type } = parseChessComUrl(url);

  // Attempt 1 -- callback JSON API
  try {
    const game = await fetchViaCallbackApi(gameId, type, url);
    return game;
  } catch (callbackError) {
    // Attempt 2 -- public PGN endpoint (chess.com serves PGN at the game URL
    // with specific Accept headers, but this is fragile). We wrap and rethrow
    // with a helpful message.
    try {
      const game = await fetchViaPgnEndpoint(gameId, type, url);
      return game;
    } catch {
      // Both approaches failed -- surface the original callback error
      throw new Error(
        `Failed to fetch game ${gameId} from Chess.com: ${
          callbackError instanceof Error ? callbackError.message : String(callbackError)
        }`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: Callback API approach
// ---------------------------------------------------------------------------

interface CallbackApiResponse {
  // The callback API returns a large JSON object. We only care about a subset.
  game?: {
    pgn?: string;
    pgnHeaders?: {
      White?: string;
      Black?: string;
      Result?: string;
      Date?: string;
      EndDate?: string;
    };
  };
  players?: {
    top?: { username?: string };
    bottom?: { username?: string };
  };
  // Some responses nest differently
  pgn?: string;
  white?: { username?: string };
  black?: { username?: string };
  [key: string]: unknown;
}

async function fetchViaCallbackApi(
  gameId: string,
  type: "live" | "daily",
  originalUrl: string
): Promise<ChessComGame> {
  const callbackUrl = `https://www.chess.com/callback/${type}/game/${gameId}`;

  const response = await fetch(callbackUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Game not found on Chess.com");
    }
    throw new Error(
      `Chess.com API returned status ${response.status}`
    );
  }

  const data = (await response.json()) as CallbackApiResponse;

  // Extract PGN -- the shape varies between API versions
  const pgn = data.game?.pgn ?? data.pgn;
  if (!pgn || typeof pgn !== "string") {
    throw new Error("No PGN data found in Chess.com API response");
  }

  // Extract player names
  const whitePlayer =
    data.game?.pgnHeaders?.White ??
    data.white?.username ??
    data.players?.top?.username ??
    "Unknown";
  const blackPlayer =
    data.game?.pgnHeaders?.Black ??
    data.black?.username ??
    data.players?.bottom?.username ??
    "Unknown";

  // Extract result
  const result =
    data.game?.pgnHeaders?.Result ?? extractResultFromPgn(pgn);

  // Extract date played
  const dateStr =
    data.game?.pgnHeaders?.Date ?? data.game?.pgnHeaders?.EndDate;
  const playedAt = dateStr ? parseChessComDate(dateStr) : null;

  return {
    pgn,
    whitePlayer,
    blackPlayer,
    result,
    playedAt,
    url: originalUrl,
  };
}

// ---------------------------------------------------------------------------
// Internal: PGN endpoint fallback
// ---------------------------------------------------------------------------

async function fetchViaPgnEndpoint(
  gameId: string,
  type: "live" | "daily",
  originalUrl: string
): Promise<ChessComGame> {
  // Chess.com sometimes provides PGN when requesting the game page with
  // an appropriate Accept header.
  const gamePageUrl = `https://www.chess.com/game/${type}/${gameId}`;

  const response = await fetch(gamePageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Game not found on Chess.com");
    }
    throw new Error(
      `Chess.com returned status ${response.status}`
    );
  }

  const html = await response.text();

  // Try to find embedded PGN in the page. Chess.com often includes it in a
  // script tag or meta tag.
  const pgnMatch =
    html.match(/\[Event\s+"[^"]*"\][\s\S]*?(?:1-0|0-1|1\/2-1\/2|\*)/) ??
    html.match(/"pgn"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (!pgnMatch) {
    throw new Error("Could not extract PGN from Chess.com game page");
  }

  let pgn = pgnMatch[1] ?? pgnMatch[0];
  // If extracted from JSON, unescape
  if (pgnMatch[1]) {
    pgn = pgn.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  const headers = parsePgnHeaders(pgn);

  return {
    pgn,
    whitePlayer: headers.White ?? "Unknown",
    blackPlayer: headers.Black ?? "Unknown",
    result: headers.Result ?? extractResultFromPgn(pgn),
    playedAt: headers.Date ? parseChessComDate(headers.Date) : null,
    url: originalUrl,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract the result token from the end of a PGN move text.
 */
function extractResultFromPgn(pgn: string): string {
  const resultMatch = pgn.match(/(1-0|0-1|1\/2-1\/2|\*)[\s]*$/);
  return resultMatch ? resultMatch[1] : "*";
}

/**
 * Parse a PGN-style date string (YYYY.MM.DD) into a JS Date, or null.
 */
function parseChessComDate(dateStr: string): Date | null {
  // PGN dates use dots: "2024.01.15"
  const normalised = dateStr.replace(/\./g, "-");
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}
