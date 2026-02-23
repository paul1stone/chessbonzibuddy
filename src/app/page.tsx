"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useGameStore } from "@/stores/game-store";
import { ReviewView } from "@/components/review/review-view";
import { PracticeView } from "@/components/practice/practice-view";
import { RecentGames } from "@/components/import/recent-games";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crown, Loader2, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import type { GameAnalysis } from "@/lib/engine";
import type { Game } from "@/db/schema";

interface RecentGameData {
  id: string;
  url: string;
  white: string;
  black: string;
  result: string;
  timeControl: string;
  playedAt: string;
  pgn: string;
}

export default function Home() {
  // ---- Store ----
  const view = useGameStore((s) => s.view);
  const activeGame = useGameStore((s) => s.activeGame);
  const activeMove = useGameStore((s) => s.activeMove);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const analysisProgress = useGameStore((s) => s.analysisProgress);
  const analysisQueue = useGameStore((s) => s.analysisQueue);
  const games = useGameStore((s) => s.games);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const addGame = useGameStore((s) => s.addGame);
  const setActiveMove = useGameStore((s) => s.setActiveMove);
  const setIsAnalyzing = useGameStore((s) => s.setIsAnalyzing);
  const setAnalysisProgress = useGameStore((s) => s.setAnalysisProgress);
  const setView = useGameStore((s) => s.setView);
  const enqueueAnalysis = useGameStore((s) => s.enqueueAnalysis);
  const dequeueAnalysis = useGameStore((s) => s.dequeueAnalysis);

  // ---- Import form state ----
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Parse analysis from the active game's JSONB field ----
  const analysis: GameAnalysis | null = activeGame?.analysis
    ? (activeGame.analysis as GameAnalysis)
    : null;

  // ---- Server-side analysis via SSE ----
  const runAnalysis = useCallback(
    async (game: Game) => {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setActiveMove(0);

      try {
        const res = await fetch(`/api/games/${game.id}/analyze`, {
          method: "POST",
        });

        if (!res.ok || !res.body) {
          throw new Error("Failed to start analysis");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress") {
              const progress = Math.round(
                (data.current / data.total) * 100
              );
              setAnalysisProgress(progress);
              setActiveMove(data.current);
            } else if (data.type === "complete") {
              // Refresh the game from DB to get the saved analysis
              const gameRes = await fetch(`/api/games/${game.id}`);
              if (gameRes.ok) {
                const updatedGame = (await gameRes.json()) as Game;
                setActiveGame(updatedGame);
              }
              toast.success(
                `Analysis complete: ${game.whitePlayer} vs ${game.blackPlayer}`
              );
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      } catch (err) {
        console.error("Analysis failed:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        toast.error("Analysis failed: " + errorMessage);
      } finally {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setActiveMove(0);
      }
    },
    [setIsAnalyzing, setAnalysisProgress, setActiveGame, setActiveMove]
  );

  // ---- Queue processor: run analysis for queued games one at a time ----
  const processingRef = useRef(false);

  useEffect(() => {
    if (isAnalyzing || analysisQueue.length === 0 || processingRef.current)
      return;

    processingRef.current = true;
    const next = dequeueAnalysis();
    if (next) {
      // If no game is currently active, make the queued game active
      if (!activeGame) {
        setActiveGame(next);
      }
      runAnalysis(next).finally(() => {
        processingRef.current = false;
      });
    } else {
      processingRef.current = false;
    }
  }, [
    isAnalyzing,
    analysisQueue,
    dequeueAnalysis,
    runAnalysis,
    activeGame,
    setActiveGame,
  ]);

  const handleAnalyze = useCallback(() => {
    if (activeGame) enqueueAnalysis([activeGame]);
  }, [activeGame, enqueueAnalysis]);

  // ---- Import form handler ----
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please enter a Chess.com game URL");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/games/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error ?? "Failed to import game";
        setError(errorMessage);
        toast.error("Failed to import game: " + errorMessage);
        return;
      }

      const importedGame = data as Game;
      addGame(importedGame);
      setActiveGame(importedGame);
      setUrl("");
      toast.success("Game imported — queued for analysis");
      enqueueAnalysis([importedGame]);
    } catch {
      setError("Network error. Please try again.");
      toast.error("Failed to import game: Network error");
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Bulk import from recent games ----
  const handleBulkImport = useCallback(
    async (recentGames: RecentGameData[]) => {
      const imported: Game[] = [];

      for (const g of recentGames) {
        try {
          const res = await fetch("/api/games/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: g.url }),
          });

          if (res.ok) {
            const game = (await res.json()) as Game;
            addGame(game);
            imported.push(game);
          }
        } catch {
          toast.error(`Failed to import ${g.white} vs ${g.black}`);
        }
      }

      if (imported.length > 0) {
        // Set the first imported game as active
        setActiveGame(imported[0]);
        // Queue all imported games for analysis
        enqueueAnalysis(imported);
        toast.success(
          `Imported ${imported.length} game${imported.length > 1 ? "s" : ""} — queued for analysis`
        );
      }
    },
    [addGame, setActiveGame, enqueueAnalysis]
  );

  // ---- Import view ----
  if (view === "import" || !activeGame) {
    const hasGames = games.length > 0;

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        {hasGames ? (
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Analyze a Game</CardTitle>
              <CardDescription>
                Paste a game link or import from your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="url" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="url" className="flex-1 text-xs">
                    Paste URL
                  </TabsTrigger>
                  <TabsTrigger value="recent" className="flex-1 text-xs">
                    Recent Games
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url">
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4"
                  >
                    <Input
                      placeholder="https://www.chess.com/game/live/..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                    />
                    {error && (
                      <p className="text-sm text-red-500">{error}</p>
                    )}
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Analyze"
                      )}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="recent">
                  <RecentGames onImport={handleBulkImport} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          // Welcome empty state
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10">
                <Crown className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-50">
                Welcome to Chess Analyzer
              </h2>
              <p className="max-w-md text-zinc-400">
                Import your first game to get started. Paste a Chess.com game
                URL below and we&apos;ll analyze every move.
              </p>
            </div>

            <Card className="w-full max-w-lg">
              <CardContent className="pt-6">
                <Tabs defaultValue="url" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="url" className="flex-1 text-xs">
                      Paste URL
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="flex-1 text-xs">
                      Recent Games
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url">
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="relative">
                        <Input
                          placeholder="https://www.chess.com/game/live/..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          disabled={isLoading}
                        />
                        <div className="pointer-events-none absolute -top-8 right-4 flex flex-col items-center text-zinc-500">
                          <ArrowUp className="h-5 w-5 animate-bounce" />
                        </div>
                      </div>
                      {error && (
                        <p className="text-sm text-red-500">{error}</p>
                      )}
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Import & Analyze"
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="recent">
                    <RecentGames onImport={handleBulkImport} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ---- Practice view ----
  if (view === "practice" && activeGame && analysis) {
    return (
      <div className="h-screen p-4">
        <PracticeView
          pgn={activeGame.pgn}
          moves={analysis.moves}
          onExit={() => setView("review")}
        />
      </div>
    );
  }

  // ---- Review view ----
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar with Analyze button when no analysis exists */}
      {!analysis && !isAnalyzing && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-zinc-200">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-zinc-500">{activeGame.result}</span>
          </div>
          <Button onClick={handleAnalyze} size="sm">
            Analyze Game
          </Button>
        </div>
      )}

      {/* Top bar with progress during analysis */}
      {isAnalyzing && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-zinc-200">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-zinc-500">{activeGame.result}</span>
          </div>
          <div className="flex items-center gap-2">
            {analysisQueue.length > 0 && (
              <span className="text-[10px] text-zinc-500">
                +{analysisQueue.length} queued
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coolmonkey.gif" alt="" className="h-8 w-8" />
            <Button size="sm" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...{" "}
              {analysisProgress > 0 ? `${analysisProgress}%` : ""}
            </Button>
          </div>
        </div>
      )}

      {/* Top bar with Practice Mistakes button when analysis exists */}
      {analysis && !isAnalyzing && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-zinc-200">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-zinc-500">{activeGame.result}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("practice")}
          >
            Practice Mistakes
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="min-h-0 flex-1 p-2 sm:p-4">
        <ReviewView
          pgn={activeGame.pgn}
          analysis={analysis}
          currentMove={activeMove}
          onMoveChange={setActiveMove}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
        />
      </div>
    </div>
  );
}
