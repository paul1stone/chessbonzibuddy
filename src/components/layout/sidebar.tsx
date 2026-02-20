"use client";

import { useEffect, useState } from "react";
import { Crown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameStore } from "@/stores/game-store";
import type { Game } from "@/db/schema";

function resultColor(result: string) {
  if (result === "1-0" || result === "0-1") {
    return "text-zinc-400";
  }
  if (result === "1/2-1/2") return "text-zinc-500";
  return "text-zinc-400";
}

function resultIndicator(result: string) {
  if (result === "1-0") return "bg-green-500";
  if (result === "0-1") return "bg-red-500";
  if (result === "1/2-1/2") return "bg-zinc-500";
  return "bg-zinc-500";
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

interface SidebarProps {
  onGameSelect?: () => void;
}

export function Sidebar({ onGameSelect }: SidebarProps) {
  const games = useGameStore((s) => s.games);
  const activeGame = useGameStore((s) => s.activeGame);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const setGames = useGameStore((s) => s.setGames);
  const removeGame = useGameStore((s) => s.removeGame);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch games from API on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
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
  }, [setGames]);

  // Delete game handler
  async function handleDelete(e: React.MouseEvent, gameId: string) {
    e.stopPropagation();
    setDeletingId(gameId);

    try {
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        removeGame(gameId);
      }
    } catch {
      // Silently fail - the game remains in the list
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGameClick(game: Game) {
    // If the game already has pgn data (e.g. just imported), use it directly
    if (game.pgn) {
      setActiveGame(game);
      onGameSelect?.();
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
    onGameSelect?.();
  }

  return (
    <div className="flex h-full w-72 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-5">
        <Crown className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold text-zinc-50">Chess Analyzer</h1>
      </div>

      {/* New Analysis button */}
      <div className="px-4 pb-4">
        <Button
          variant="default"
          className="w-full"
          onClick={() => {
            setActiveGame(null);
            onGameSelect?.();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Analysis
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Game list */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {isLoading ? (
            <SkeletonRows />
          ) : fetchError ? (
            <p className="px-2 py-8 text-center text-sm text-red-400">
              {fetchError}
            </p>
          ) : games.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">
              No games analyzed yet
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game)}
                  className={`group relative flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/50 ${
                    activeGame?.id === game.id ? "bg-zinc-800/50" : ""
                  }`}
                >
                  {/* Delete button (visible on hover) */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDelete(e, game.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleDelete(
                          e as unknown as React.MouseEvent,
                          game.id
                        );
                      }
                    }}
                    className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition-opacity hover:bg-zinc-700 hover:text-zinc-300 ${
                      deletingId === game.id
                        ? "opacity-50"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </span>

                  <span className="pr-5 text-sm font-medium text-zinc-200">
                    {game.whitePlayer} vs {game.blackPlayer}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${resultIndicator(game.result)}`}
                    />
                    <span className={`text-xs ${resultColor(game.result)}`}>
                      {game.result}
                    </span>
                    {(game.whiteAccuracy != null ||
                      game.blackAccuracy != null) && (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-5 px-1.5 text-[10px]"
                      >
                        {game.whiteAccuracy != null &&
                          `W: ${game.whiteAccuracy.toFixed(1)}%`}
                        {game.whiteAccuracy != null &&
                          game.blackAccuracy != null &&
                          " / "}
                        {game.blackAccuracy != null &&
                          `B: ${game.blackAccuracy.toFixed(1)}%`}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
