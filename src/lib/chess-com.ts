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
 *  2. Use the callback API to get player username and game date.
 *  3. Use the public API to fetch the game with full PGN.
 *  4. Fall back to scraping if the public API fails.
 *
 * @throws Error with a descriptive message on failure.
 */
export async function fetchChessComGame(url: string): Promise<ChessComGame> {
  const { gameId, type } = parseChessComUrl(url);

  // Attempt 1 -- Use callback API to get metadata, then public API for PGN
  try {
    const game = await fetchViaPublicApi(gameId, type, url);
    return game;
  } catch (publicApiError) {
    // Attempt 2 -- scrape the game page
    try {
      const game = await fetchViaPgnEndpoint(gameId, type, url);
      return game;
    } catch {
      throw new Error(
        `Failed to fetch game ${gameId} from Chess.com: ${
          publicApiError instanceof Error ? publicApiError.message : String(publicApiError)
        }`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: Public API approach (most reliable)
// ---------------------------------------------------------------------------

interface CallbackApiResponse {
  game?: {
    pgnHeaders?: {
      White?: string;
      Black?: string;
      Date?: string;
    };
  };
  players?: {
    top?: { username?: string; color?: string };
    bottom?: { username?: string; color?: string };
  };
  [key: string]: unknown;
}

interface PublicApiGame {
  url: string;
  pgn: string;
  white?: { username: string };
  black?: { username: string };
  end_time?: number;
  [key: string]: unknown;
}

/**
 * Use the callback API to get player info, then the public API for the full PGN.
 * The public API endpoint is: /pub/player/{username}/games/{YYYY}/{MM}
 */
async function fetchViaPublicApi(
  gameId: string,
  type: "live" | "daily",
  originalUrl: string
): Promise<ChessComGame> {
  // Step 1: Get player username and date from callback API
  const callbackUrl = `https://www.chess.com/callback/${type}/game/${gameId}`;
  const callbackResponse = await fetch(callbackUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!callbackResponse.ok) {
    if (callbackResponse.status === 404) {
      throw new Error("Game not found on Chess.com");
    }
    throw new Error(`Chess.com API returned status ${callbackResponse.status}`);
  }

  const callbackData = (await callbackResponse.json()) as CallbackApiResponse;

  // Find a username from the callback response
  const username =
    callbackData.game?.pgnHeaders?.White ??
    callbackData.players?.top?.username ??
    callbackData.players?.bottom?.username;

  if (!username) {
    throw new Error("Could not determine player username from Chess.com");
  }

  // Get the date (YYYY.MM.DD format from PGN headers)
  const dateStr = callbackData.game?.pgnHeaders?.Date;
  let year: string;
  let month: string;

  if (dateStr) {
    const parts = dateStr.split(".");
    year = parts[0];
    month = parts[1];
  } else {
    // Fallback to current month
    const now = new Date();
    year = String(now.getFullYear());
    month = String(now.getMonth() + 1).padStart(2, "0");
  }

  // Step 2: Fetch games from the public API
  const publicApiUrl = `https://api.chess.com/pub/player/${username.toLowerCase()}/games/${year}/${month}`;
  const publicResponse = await fetch(publicApiUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!publicResponse.ok) {
    throw new Error(`Chess.com public API returned status ${publicResponse.status}`);
  }

  const publicData = (await publicResponse.json()) as { games?: PublicApiGame[] };
  const games = publicData.games ?? [];

  // Find the matching game by URL containing the game ID
  const targetUrl = `https://www.chess.com/game/${type}/${gameId}`;
  const matchedGame = games.find(
    (g) => g.url === targetUrl || g.url.includes(gameId)
  );

  if (!matchedGame) {
    throw new Error(
      `Game ${gameId} not found in ${username}'s recent games. The game may be from a different month.`
    );
  }

  const pgn = matchedGame.pgn;
  if (!pgn || typeof pgn !== "string") {
    throw new Error("No PGN data found for this game");
  }

  // Extract info from PGN headers (most reliable source)
  const headers = parsePgnHeaders(pgn);

  return {
    pgn,
    whitePlayer: headers.White ?? matchedGame.white?.username ?? "Unknown",
    blackPlayer: headers.Black ?? matchedGame.black?.username ?? "Unknown",
    result: headers.Result ?? extractResultFromPgn(pgn),
    playedAt: headers.Date ? parseChessComDate(headers.Date) : null,
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
