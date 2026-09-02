"use client";

import { useEffect, useState } from "react";
import { RetroButton } from "@/components/retro";
import { toastError } from "@/components/ui/toast-helpers";
import { useGameStore } from "@/stores/game-store";
import { useProfileStore } from "@/stores/profile-store";
import { useWindowStore } from "@/stores/window-store";
import type { Game } from "@/db/schema";

function resultDot(result: string) {
  if (result === "1-0") return "#008000";
  if (result === "0-1") return "#800000";
  return "var(--r-shadow)";
}

/** One authored line per branch — a failed fetch never puts the server's own words on screen. */
function offlineCopy() {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? "You're offline."
    : "The game library is offline. Try again in a minute.";
}

/** A 4xx is the record being gone, not the server being down — don't say "try again". */
function isMissing(status: number | null) {
  return status !== null && status >= 400 && status < 500;
}

function listFailureCopy(status: number | null) {
  return isMissing(status)
    ? "No game library found for that account."
    : offlineCopy();
}

function openFailureCopy(status: number | null) {
  return isMissing(status)
    ? "That game is no longer in your library."
    : `Could not open that game. ${offlineCopy()}`;
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="r-skeleton h-4 w-3/4" />
          <div className="r-skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function GamesWindow() {
  const games = useGameStore((s) => s.games);
  const activeGame = useGameStore((s) => s.activeGame);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const setGames = useGameStore((s) => s.setGames);
  const removeGame = useGameStore((s) => s.removeGame);

  const openWindow = useWindowStore((s) => s.open);

  const chessComUsername = useProfileStore((s) => s.chessComUsername);
  const lichessUsername = useProfileStore((s) => s.lichessUsername);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch games from API, filtered by linked username
  const username = chessComUsername || lichessUsername;

  useEffect(() => {
    if (!username) {
      setGames([]);
      setFetchError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    async function fetchGames() {
      try {
        const res = await fetch(
          `/api/games?username=${encodeURIComponent(username)}`
        );
        if (!res.ok) {
          if (!cancelled) setFetchError(listFailureCopy(res.status));
          return;
        }
        const data = (await res.json()) as Game[];
        if (!cancelled) {
          setGames(data);
          setFetchError(null);
        }
      } catch {
        if (!cancelled) {
          setFetchError(listFailureCopy(null));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchGames();
    return () => {
      cancelled = true;
    };
  }, [setGames, username, reloadKey]);

  async function handleDelete(e: React.MouseEvent, gameId: string) {
    e.stopPropagation();
    setDeletingId(gameId);

    try {
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        removeGame(gameId);
      } else {
        toastError("Could not delete game");
      }
    } catch {
      toastError("Could not delete game");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGameClick(game: Game) {
    // If the game already has pgn data (e.g. just imported), use it directly
    if (game.pgn) {
      setActiveGame(game);
      openWindow("review");
      return;
    }

    // Otherwise fetch the full game record (with pgn + analysis). Both failure
    // branches stop here: the row's own record has no pgn, so opening Review on
    // it would show an empty board with no way to tell why.
    try {
      const res = await fetch(`/api/games/${game.id}`);
      if (!res.ok) {
        toastError(openFailureCopy(res.status));
        return;
      }
      const fullGame = (await res.json()) as Game;
      setActiveGame(fullGame);
    } catch {
      toastError(openFailureCopy(null));
      return;
    }
    openWindow("review");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Top strip */}
      <div className="flex shrink-0 items-center gap-2">
        <RetroButton onClick={() => openWindow("import")}>
          Import games
        </RetroButton>
      </div>

      <div className="r-sep shrink-0" />

      {/* Game list */}
      <div className="r-scroll r-bevel-in min-h-0 flex-1 bg-[var(--r-paper)] p-[2px]">
        {isLoading ? (
          <SkeletonRows />
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
            <p className="font-bold text-[#800000]">Could not load games</p>
            <p className="text-[var(--r-shadow)]">{fetchError}</p>
            <RetroButton onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </RetroButton>
          </div>
        ) : !username ? (
          <div className="flex flex-col items-center gap-3 px-2 py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coolmonkey.gif" alt="" className="h-16 w-16" />
            <p className="text-center text-[var(--r-shadow)]">
              Connect your Chess.com or Lichess account to view games
            </p>
            <RetroButton onClick={() => openWindow("profile")}>
              Open profile
            </RetroButton>
          </div>
        ) : games.length === 0 ? (
          <p className="px-2 py-8 text-center text-[var(--r-shadow)]">
            No games analyzed yet
          </p>
        ) : (
          <div className="flex flex-col">
            {games.map((game) => {
              const isActive = activeGame?.id === game.id;
              return (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game)}
                  className={`group relative flex w-full flex-col gap-0.5 px-2 py-1.5 text-left ${
                    isActive
                      ? "bg-[var(--r-title-a)] text-[var(--r-title-text)]"
                      : "hover:bg-[var(--r-face-light)]"
                  }`}
                >
                  {/* Delete button: hover-revealed on mice, always out and 32px on touch. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete game"
                    onClick={(e) => handleDelete(e, game.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleDelete(
                          e as unknown as React.MouseEvent,
                          game.id
                        );
                      }
                    }}
                    className={`r-face r-bevel-out absolute right-1 top-1 flex h-4 w-4 items-center justify-center text-[10px] leading-none text-[var(--r-dark)] ${
                      deletingId === game.id
                        ? "opacity-50"
                        : "opacity-0 focus:opacity-100 group-hover:opacity-100"
                    } [@media(hover:none)]:h-8 [@media(hover:none)]:w-8 [@media(hover:none)]:text-[16px] [@media(hover:none)]:opacity-100`}
                  >
                    &times;
                  </span>

                  <span className="truncate pr-5 font-medium [@media(hover:none)]:pr-10">
                    {game.whitePlayer} vs {game.blackPlayer}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0"
                      style={{ background: resultDot(game.result) }}
                    />
                    <span>{game.result}</span>
                    {(game.whiteAccuracy != null ||
                      game.blackAccuracy != null) && (
                      <span className="ml-auto shrink-0 text-[11px]">
                        {game.whiteAccuracy != null &&
                          `W ${game.whiteAccuracy.toFixed(1)}%`}
                        {game.whiteAccuracy != null &&
                          game.blackAccuracy != null &&
                          " / "}
                        {game.blackAccuracy != null &&
                          `B ${game.blackAccuracy.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
