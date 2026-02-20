"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useGameStore } from "@/stores/game-store";
import { ReviewView } from "@/components/review/review-view";
import { PracticeView } from "@/components/practice/practice-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crown, Loader2, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import type { GameAnalysis } from "@/lib/engine";
import type { Game } from "@/db/schema";

export default function Home() {
  // ---- Store ----
  const view = useGameStore((s) => s.view);
  const activeGame = useGameStore((s) => s.activeGame);
  const activeMove = useGameStore((s) => s.activeMove);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const analysisProgress = useGameStore((s) => s.analysisProgress);
  const games = useGameStore((s) => s.games);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const addGame = useGameStore((s) => s.addGame);
  const setActiveMove = useGameStore((s) => s.setActiveMove);
  const setIsAnalyzing = useGameStore((s) => s.setIsAnalyzing);
  const setAnalysisProgress = useGameStore((s) => s.setAnalysisProgress);
  const setView = useGameStore((s) => s.setView);

  // ---- Import form state ----
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Parse analysis from the active game's JSONB field ----
  const analysis: GameAnalysis | null = activeGame?.analysis
    ? (activeGame.analysis as GameAnalysis)
    : null;

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

      // Add game to store and set as active (this switches view to "review")
      addGame(data as Game);
      setActiveGame(data as Game);
      setUrl("");
      toast.success("Game imported successfully");
    } catch {
      setError("Network error. Please try again.");
      toast.error("Failed to import game: Network error");
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Analysis handler ----
  const handleAnalyze = useCallback(async () => {
    if (!activeGame) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Dynamic import since analyzeGame is browser-only
      const { analyzeGame } = await import("@/lib/analyze");

      const result = await analyzeGame(
        activeGame.pgn,
        18,
        (current, total) => {
          const progress = Math.round((current / total) * 100);
          setAnalysisProgress(progress);
        }
      );

      // Save analysis to the database
      const res = await fetch(`/api/games/${activeGame.id}/analysis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: result,
          whiteAccuracy: result.whiteAccuracy,
          blackAccuracy: result.blackAccuracy,
        }),
      });

      if (res.ok) {
        const updatedGame = (await res.json()) as Game;
        setActiveGame(updatedGame);
        toast.success("Analysis complete!");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      toast.error("Analysis failed: " + errorMessage);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [activeGame, setIsAnalyzing, setAnalysisProgress, setActiveGame]);

  // ---- Import view ----
  if (view === "import" || !activeGame) {
    const hasGames = games.length > 0;

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        {hasGames ? (
          // Standard import card when user has games
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Analyze a Game</CardTitle>
              <CardDescription>
                Paste a Chess.com game link to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  placeholder="https://www.chess.com/game/live/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
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
            </CardContent>
          </Card>
        ) : (
          // Welcome empty state when no games exist
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
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  {error && <p className="text-sm text-red-500">{error}</p>}
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
          <Button size="sm" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...{" "}
            {analysisProgress > 0 ? `${analysisProgress}%` : ""}
          </Button>
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
