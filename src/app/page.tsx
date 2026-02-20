"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useGameStore } from "@/stores/game-store";
import { ReviewView } from "@/components/review/review-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GameAnalysis } from "@/lib/engine";
import type { Game } from "@/db/schema";

export default function Home() {
  // ---- Store ----
  const view = useGameStore((s) => s.view);
  const activeGame = useGameStore((s) => s.activeGame);
  const activeMove = useGameStore((s) => s.activeMove);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const analysisProgress = useGameStore((s) => s.analysisProgress);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const addGame = useGameStore((s) => s.addGame);
  const setActiveMove = useGameStore((s) => s.setActiveMove);
  const setIsAnalyzing = useGameStore((s) => s.setIsAnalyzing);
  const setAnalysisProgress = useGameStore((s) => s.setAnalysisProgress);

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
        setError(data.error ?? "Failed to import game");
        return;
      }

      // Add game to store and set as active (this switches view to "review")
      addGame(data as Game);
      setActiveGame(data as Game);
      setUrl("");
    } catch {
      setError("Network error. Please try again.");
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
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [activeGame, setIsAnalyzing, setAnalysisProgress, setActiveGame]);

  // ---- Import view ----
  if (view === "import" || !activeGame) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
                {isLoading ? "Importing..." : "Analyze"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Practice view (placeholder) ----
  if (view === "practice") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Practice Mode</CardTitle>
            <CardDescription>Coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Practice mode is under development. Check back soon!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Review view ----
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar with Analyze button when no analysis exists */}
      {!analysis && !isAnalyzing && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3">
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

      {/* Main content */}
      <div className="min-h-0 flex-1 p-4">
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
