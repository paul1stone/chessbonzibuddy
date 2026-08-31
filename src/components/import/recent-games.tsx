"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Download, Check, RefreshCw, Search } from "lucide-react";
import { RetroButton } from "@/components/retro";
import { useProfileStore } from "@/stores/profile-store";
import { toast } from "sonner";

export interface RecentGameData {
  id: string;
  url: string;
  white: string;
  black: string;
  result: string;
  timeControl: string;
  playedAt: string;
  pgn: string;
}

interface RecentGamesProps {
  onImport: (games: RecentGameData[]) => void;
}

function resultColor(result: string) {
  if (result === "1-0") return "#008000";
  if (result === "0-1") return "#800000";
  return "var(--r-shadow)";
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentGames({ onImport }: RecentGamesProps) {
  const chessComUsername = useProfileStore((s) => s.chessComUsername);
  const lichessUsername = useProfileStore((s) => s.lichessUsername);

  const [games, setGames] = useState<RecentGameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const hasAccount = Boolean(chessComUsername || lichessUsername);

  const filteredGames = useMemo(() => {
    if (!search.trim()) return games;
    const q = search.toLowerCase();
    return games.filter(
      (g) =>
        g.white.toLowerCase().includes(q) ||
        g.black.toLowerCase().includes(q) ||
        g.timeControl.toLowerCase().includes(q) ||
        g.result.includes(q)
    );
  }, [games, search]);

  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setGames([]);

    try {
      const allGames: RecentGameData[] = [];

      if (chessComUsername) {
        const res = await fetch(
          `/api/players/games?platform=chesscom&username=${encodeURIComponent(chessComUsername)}`
        );
        if (res.ok) {
          const data = (await res.json()) as RecentGameData[];
          allGames.push(...data);
        }
      }

      if (lichessUsername) {
        const res = await fetch(
          `/api/players/games?platform=lichess&username=${encodeURIComponent(lichessUsername)}`
        );
        if (res.ok) {
          const data = (await res.json()) as RecentGameData[];
          allGames.push(...data);
        }
      }

      allGames.sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      );

      setGames(allGames);
    } catch {
      toast.error("Failed to fetch recent games");
    } finally {
      setIsLoading(false);
    }
  }, [chessComUsername, lichessUsername]);

  useEffect(() => {
    if (hasAccount) {
      fetchGames();
    }
  }, [hasAccount, fetchGames]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const gamesToImport = games.filter((g) => selected.has(g.id));
    if (gamesToImport.length === 0) return;
    onImport(gamesToImport);
    setImported((prev) => {
      const next = new Set(prev);
      for (const g of gamesToImport) next.add(g.id);
      return next;
    });
    setSelected(new Set());
  }, [games, selected, onImport]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/coolmonkey.gif" alt="Loading" className="h-16 w-16" />
        <span>Fetching recent games...</span>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-8 text-center text-[var(--r-shadow)]">
        No recent games found.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Search + action bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--r-shadow)]" />
          <input
            placeholder="Search by player, time control..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="r-input w-full pl-6!"
            aria-label="Search recent games"
          />
        </div>
        <RetroButton
          className="min-w-0! shrink-0 px-2!"
          onClick={fetchGames}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </RetroButton>
      </div>

      {/* Count + import button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--r-shadow)]">
          {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </span>
        {selected.size > 0 && (
          <RetroButton className="min-w-0! px-2!" onClick={handleImport}>
            <Download className="mr-1 h-3 w-3" />
            Import {selected.size}
          </RetroButton>
        )}
      </div>

      {/* Scrollable game list — fills the remaining body height */}
      <div className="r-scroll r-bevel-in min-h-0 flex-1 bg-[var(--r-paper)] p-[2px]">
        <div className="flex flex-col">
          {filteredGames.map((game) => {
            const isImported = imported.has(game.id);
            const isSelected = selected.has(game.id);

            return (
              <button
                key={game.id}
                onClick={() => !isImported && toggleSelect(game.id)}
                disabled={isImported}
                aria-pressed={isImported ? undefined : isSelected}
                className={`flex w-full items-center gap-3 px-2 py-1.5 text-left ${
                  isImported
                    ? "opacity-40"
                    : isSelected
                      ? "bg-[var(--r-title-a)] text-[var(--r-title-text)]"
                      : "hover:bg-[var(--r-face-light)]"
                }`}
              >
                {isImported ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#008000]" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="r-bevel-in flex h-3.5 w-3.5 shrink-0 items-center justify-center bg-[var(--r-paper)]"
                  >
                    {/* Win98 tick: dark block inside the sunken paper box. 8px keeps the 3px inset integral. */}
                    {isSelected && (
                      <span className="h-2 w-2 bg-[var(--r-dark)]" />
                    )}
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {game.white} vs {game.black}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0"
                      style={{ background: resultColor(game.result) }}
                    />
                    <span>{game.result}</span>
                    <span className="r-badge r-badge--flat">
                      {game.timeControl}
                    </span>
                    <span className="ml-auto shrink-0">
                      {timeAgo(game.playedAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredGames.length === 0 && (
            <div className="py-8 text-center text-[var(--r-shadow)]">
              No games match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
