"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Loader2, Download, Check, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useProfileStore } from "@/stores/profile-store";
import { toast } from "sonner";

interface RecentGame {
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
  onImport: (games: RecentGame[]) => void;
}

function resultColor(result: string) {
  if (result === "1-0") return "bg-green-500";
  if (result === "0-1") return "bg-red-500";
  return "bg-zinc-500";
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

  const [games, setGames] = useState<RecentGame[]>([]);
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
      const allGames: RecentGame[] = [];

      if (chessComUsername) {
        const res = await fetch(
          `/api/players/games?platform=chesscom&username=${encodeURIComponent(chessComUsername)}`
        );
        if (res.ok) {
          const data = (await res.json()) as RecentGame[];
          allGames.push(...data);
        }
      }

      if (lichessUsername) {
        const res = await fetch(
          `/api/players/games?platform=lichess&username=${encodeURIComponent(lichessUsername)}`
        );
        if (res.ok) {
          const data = (await res.json()) as RecentGame[];
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

  if (!hasAccount) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">
        Link your Chess.com or Lichess account in the sidebar to import recent
        games.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/coolmonkey.gif" alt="Loading" className="h-16 w-16" />
        <span className="text-sm text-zinc-400">
          Fetching recent games...
        </span>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">
        No recent games found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search + action bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search by player, time control..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={fetchGames}
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Count + import button */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </span>
        {selected.size > 0 && (
          <Button size="sm" className="h-6 text-[10px]" onClick={handleImport}>
            <Download className="mr-1 h-3 w-3" />
            Import {selected.size}
          </Button>
        )}
      </div>

      {/* Scrollable game list — fixed height */}
      <div className="h-[300px] overflow-y-auto rounded-md border border-zinc-800">
        <div className="flex flex-col">
          {filteredGames.map((game) => {
            const isImported = imported.has(game.id);
            const isSelected = selected.has(game.id);

            return (
              <button
                key={game.id}
                onClick={() => !isImported && toggleSelect(game.id)}
                disabled={isImported}
                className={`flex w-full items-center gap-3 border-b border-zinc-800/50 px-3 py-2 text-left transition-colors last:border-b-0 ${
                  isImported
                    ? "opacity-40"
                    : isSelected
                      ? "bg-blue-500/10"
                      : "hover:bg-zinc-800/40"
                }`}
              >
                {isImported ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <div
                    className={`h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-zinc-600"
                    }`}
                  />
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium text-zinc-200">
                    {game.white} vs {game.black}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${resultColor(game.result)}`}
                    />
                    <span className="text-[10px] text-zinc-500">
                      {game.result}
                    </span>
                    <Badge
                      variant="secondary"
                      className="h-3.5 px-1 text-[8px] leading-none"
                    >
                      {game.timeControl}
                    </Badge>
                    <span className="ml-auto text-[10px] text-zinc-600">
                      {timeAgo(game.playedAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredGames.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-500">
              No games match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
