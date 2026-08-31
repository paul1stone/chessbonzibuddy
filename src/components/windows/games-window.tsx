"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { RetroButton } from "@/components/retro";
import { useGameStore } from "@/stores/game-store";
import { useProfileStore } from "@/stores/profile-store";
import { useWindowStore } from "@/stores/window-store";
import type { Game } from "@/db/schema";

function resultDot(result: string) {
  if (result === "1-0") return "#008000";
  if (result === "0-1") return "#800000";
  return "var(--r-shadow)";
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

  // Fetch games from API, filtered by linked username
  const username = chessComUsername || lichessUsername;

  useEffect(() => {
    if (!username) {
      setGames([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchGames() {
      try {
        const res = await fetch(
          `/api/games?username=${encodeURIComponent(username)}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch games");
        }
        const data = (await res.json()) as Game[];
        if (!cancelled) {
          setGames(data);
          setFetchError(null);
        }
      } catch {
        if (!cancelled) {
          setFetchError("Could not load games");
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
  }, [setGames, username]);

  async function handleDelete(e: React.MouseEvent, gameId: string) {
    e.stopPropagation();
    setDeletingId(gameId);

    try {
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        removeGame(gameId);
      } else {
        toast.error("Could not delete game");
      }
    } catch {
      toast.error("Could not delete game");
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

    // Otherwise fetch the full game record (with pgn + analysis)
    try {
      const res = await fetch(`/api/games/${game.id}`);
      if (res.ok) {
        const fullGame = (await res.json()) as Game;
        setActiveGame(fullGame);
      } else {
        setActiveGame(game);
      }
    } catch {
      setActiveGame(game);
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
          <p className="px-2 py-8 text-center text-[#800000]">{fetchError}</p>
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
                  {/* Delete button (visible on hover) */}
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
                    }`}
                  >
                    &times;
                  </span>

                  <span className="truncate pr-5 font-medium">
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
