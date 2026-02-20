"use client";

import { Crown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGameStore } from "@/stores/game-store";

function resultColor(result: string) {
  if (result === "1-0" || result === "0-1") {
    // We don't know which side the user played, so just show the result as-is
    // The parent can determine win/loss once we know the user's color
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

export function Sidebar() {
  const games = useGameStore((s) => s.games);
  const activeGame = useGameStore((s) => s.activeGame);
  const setActiveGame = useGameStore((s) => s.setActiveGame);

  return (
    <div className="flex h-screen w-72 flex-col border-r border-zinc-800 bg-zinc-950">
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
          onClick={() => setActiveGame(null)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Analysis
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Game list */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {games.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">
              No games analyzed yet
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setActiveGame(game)}
                  className={`flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/50 ${
                    activeGame?.id === game.id ? "bg-zinc-800/50" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-200">
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
