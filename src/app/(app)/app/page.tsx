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
import { Crown, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useProfileStore } from "@/stores/profile-store";
import { fetchChessComRatings, fetchLichessRatings } from "@/lib/ratings";
import { PlayView } from "@/components/play/play-view";
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

// ---- Login screen (no account linked) ----
function LoginScreen({
  url,
  setUrl,
  isLoading,
  error,
  handleSubmit,
}: {
  url: string;
  setUrl: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const setChessComUsername = useProfileStore((s) => s.setChessComUsername);
  const setLichessUsername = useProfileStore((s) => s.setLichessUsername);
  const setChessComRatings = useProfileStore((s) => s.setChessComRatings);
  const setLichessRatings = useProfileStore((s) => s.setLichessRatings);

  const [chessComInput, setChessComInput] = useState("");
  const [lichessInput, setLichessInput] = useState("");
  const [connecting, setConnecting] = useState<"chesscom" | "lichess" | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showUrlForm, setShowUrlForm] = useState(false);

  async function handleConnect(platform: "chesscom" | "lichess") {
    const username = platform === "chesscom" ? chessComInput.trim() : lichessInput.trim();
    if (!username) return;

    setConnecting(platform);
    setConnectError(null);

    try {
      if (platform === "chesscom") {
        const ratings = await fetchChessComRatings(username);
        setChessComUsername(username);
        setChessComRatings(ratings);
        toast.success(`Connected to Chess.com as ${username}`);
      } else {
        const ratings = await fetchLichessRatings(username);
        setLichessUsername(username);
        setLichessRatings(ratings);
        toast.success(`Connected to Lichess as ${username}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setConnectError(msg);
      toast.error(msg);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10">
            <Crown className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-bold text-purple-50">Chess Analyzer</h2>
          <p className="max-w-md text-purple-300">
            Connect your account to import and analyze your recent games.
          </p>
        </div>

        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col gap-6 pt-6">
            {/* Chess.com */}
            <div className="flex flex-col gap-2">
              <label className="text-left text-xs font-medium text-purple-300">
                Chess.com username
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="username"
                  value={chessComInput}
                  onChange={(e) => setChessComInput(e.target.value)}
                  disabled={connecting !== null}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConnect("chesscom");
                    }
                  }}
                />
                <Button
                  onClick={() => handleConnect("chesscom")}
                  disabled={!chessComInput.trim() || connecting !== null}
                  className="shrink-0"
                >
                  {connecting === "chesscom" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>

            {/* Lichess */}
            <div className="flex flex-col gap-2">
              <label className="text-left text-xs font-medium text-purple-300">
                Lichess username
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="username"
                  value={lichessInput}
                  onChange={(e) => setLichessInput(e.target.value)}
                  disabled={connecting !== null}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConnect("lichess");
                    }
                  }}
                />
                <Button
                  onClick={() => handleConnect("lichess")}
                  disabled={!lichessInput.trim() || connecting !== null}
                  className="shrink-0"
                >
                  {connecting === "lichess" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>

            {connectError && (
              <p className="text-sm text-red-500">{connectError}</p>
            )}
          </CardContent>
        </Card>

        {/* Paste URL fallback */}
        {!showUrlForm ? (
          <button
            onClick={() => setShowUrlForm(true)}
            className="flex items-center gap-1.5 text-xs text-purple-400 transition-colors hover:text-purple-200"
          >
            <LinkIcon className="h-3 w-3" />
            or paste a game URL directly
          </button>
        ) : (
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6">
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
                    "Import & Analyze"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---- Import view (account linked) ----
function ImportView({
  url,
  setUrl,
  isLoading,
  error,
  handleSubmit,
  handleBulkImport,
}: {
  url: string;
  setUrl: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleBulkImport: (games: RecentGameData[]) => Promise<void>;
}) {
  const chessComUsername = useProfileStore((s) => s.chessComUsername);
  const lichessUsername = useProfileStore((s) => s.lichessUsername);
  const hasAccount = Boolean(chessComUsername || lichessUsername);

  if (!hasAccount) {
    return (
      <LoginScreen
        url={url}
        setUrl={setUrl}
        isLoading={isLoading}
        error={error}
        handleSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Import a Game</CardTitle>
          <CardDescription>
            Select from your recent games or paste a link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="recent" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="recent" className="flex-1 text-xs">
                Recent Games
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1 text-xs">
                Paste URL
              </TabsTrigger>
            </TabsList>
            <TabsContent value="recent">
              <RecentGames onImport={handleBulkImport} />
            </TabsContent>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
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

  // ---- Play Bonzi Buddy view ----
  if (view === "play-bonzi") {
    return (
      <PlayView
        onExit={() => setView(activeGame ? "review" : "import")}
      />
    );
  }

  // ---- Import view ----
  if (view === "import" || !activeGame) {
    return <ImportView url={url} setUrl={setUrl} isLoading={isLoading} error={error} handleSubmit={handleSubmit} handleBulkImport={handleBulkImport} />;
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
        <div className="flex items-center justify-between border-b border-purple-800 bg-purple-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-purple-300">
            <span className="font-medium text-purple-100">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-purple-100">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-purple-400">{activeGame.result}</span>
          </div>
          <Button onClick={handleAnalyze} size="sm">
            Analyze Game
          </Button>
        </div>
      )}

      {/* Top bar with progress during analysis */}
      {isAnalyzing && (
        <div className="flex items-center justify-between border-b border-purple-800 bg-purple-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-purple-300">
            <span className="font-medium text-purple-100">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-purple-100">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-purple-400">{activeGame.result}</span>
          </div>
          <div className="flex items-center gap-2">
            {analysisQueue.length > 0 && (
              <span className="text-[10px] text-purple-400">
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
        <div className="flex items-center justify-between border-b border-purple-800 bg-purple-950 px-4 py-3 sm:px-6">
          <div className="text-sm text-purple-300">
            <span className="font-medium text-purple-100">
              {activeGame.whitePlayer}
            </span>{" "}
            vs{" "}
            <span className="font-medium text-purple-100">
              {activeGame.blackPlayer}
            </span>
            <span className="ml-2 text-purple-400">{activeGame.result}</span>
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
