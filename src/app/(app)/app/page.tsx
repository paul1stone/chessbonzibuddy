"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Desktop, ICON_LABELS, type WindowDef } from "@/components/desktop";
import { GamesWindow } from "@/components/windows/games-window";
import {
  ImportWindow,
  type RecentGameData,
} from "@/components/windows/import-window";
import { PlayWindow } from "@/components/windows/play-window";
import { PracticeWindow } from "@/components/windows/practice-window";
import { ProfileWindow } from "@/components/windows/profile-window";
import {
  ReviewStatusBar,
  ReviewWindow,
} from "@/components/windows/review-window";
import { useGameStore } from "@/stores/game-store";
import { useProfileStore } from "@/stores/profile-store";
import { useWindowStore, type WindowId } from "@/stores/window-store";
import type { Game } from "@/db/schema";

export default function Home() {
  // ---- Store ----
  const activeGame = useGameStore((s) => s.activeGame);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const analysisProgress = useGameStore((s) => s.analysisProgress);
  const analysisQueue = useGameStore((s) => s.analysisQueue);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const addGame = useGameStore((s) => s.addGame);
  const setActiveMove = useGameStore((s) => s.setActiveMove);
  const setIsAnalyzing = useGameStore((s) => s.setIsAnalyzing);
  const setAnalysisProgress = useGameStore((s) => s.setAnalysisProgress);
  const enqueueAnalysis = useGameStore((s) => s.enqueueAnalysis);
  const dequeueAnalysis = useGameStore((s) => s.dequeueAnalysis);
  const playOpen = useWindowStore((s) => s.windows.play.open);

  // ---- Import form state ----
  const [isLoading, setIsLoading] = useState(false);

  // ---- Client-side analysis: run the pipeline in-browser, then persist ----
  const runAnalysis = useCallback(
    async (game: Game) => {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setActiveMove(0);

      try {
        // Dynamic import keeps Stockfish and the opening book out of the initial bundle.
        const { analyzeGame } = await import("@/lib/analyze");
        toast.info(
          "Warming up Stockfish - first analysis downloads the engine (~113 MB)"
        );

        const result = await analyzeGame(game.pgn, {
          onProgress: (current, total) => {
            setAnalysisProgress(Math.round((current / total) * 100));
            // Only drive the board cursor when this game is the one on screen.
            if (useGameStore.getState().activeGame?.id === game.id) {
              setActiveMove(current);
            }
          },
        });

        const res = await fetch(`/api/games/${game.id}/analysis`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: result,
            whiteAccuracy: result.whiteAccuracy,
            blackAccuracy: result.blackAccuracy,
          }),
        });
        if (!res.ok) throw new Error("Failed to save analysis");
        const updatedGame = (await res.json()) as Game;
        // A queued game finishing in the background must not yank the user out of
        // whatever they are viewing — setActiveGame forces view: "review".
        if (useGameStore.getState().activeGame?.id === game.id) {
          setActiveGame(updatedGame);
        }

        toast.success(
          `Analysis complete: ${game.whitePlayer} vs ${game.blackPlayer}`
        );
      } catch (err) {
        console.error("Analysis failed:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        toast.error("Analysis failed: " + errorMessage);
      } finally {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        if (useGameStore.getState().activeGame?.id === game.id) {
          setActiveMove(0);
        }
      }
    },
    [setIsAnalyzing, setAnalysisProgress, setActiveGame, setActiveMove]
  );

  // ---- Queue processor: run analysis for queued games one at a time ----
  const processingRef = useRef(false);

  useEffect(() => {
    // Hold the queue while the user is playing Bonzi: analysis and Bonzi each
    // spin up their own single-threaded engine, and two 113 MB WASM instances
    // starve the clock (and can kill the tab on mobile). A minimized play window
    // still has a live game, so `open` is the guard, not focus.
    if (
      isAnalyzing ||
      playOpen ||
      analysisQueue.length === 0 ||
      processingRef.current
    )
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
    playOpen,
    analysisQueue,
    dequeueAnalysis,
    runAnalysis,
    activeGame,
    setActiveGame,
  ]);

  const handleAnalyze = useCallback(() => {
    if (activeGame) enqueueAnalysis([activeGame]);
  }, [activeGame, enqueueAnalysis]);

  // ---- Import a single game by URL (throws so the window can show the error) ----
  const handleImportUrl = useCallback(
    async (rawUrl: string) => {
      setIsLoading(true);

      try {
        const result = await fetch("/api/games/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: rawUrl }),
        })
          .then(async (res) => ({ ok: res.ok, data: await res.json() }))
          .catch(() => null);

        if (!result) {
          toast.error("Failed to import game: Network error");
          throw new Error("Network error. Please try again.");
        }

        if (!result.ok) {
          const errorMessage = result.data?.error ?? "Failed to import game";
          toast.error("Failed to import game: " + errorMessage);
          throw new Error(errorMessage);
        }

        const importedGame = result.data as Game;
        addGame(importedGame);
        setActiveGame(importedGame);
        useWindowStore.getState().open("review");
        toast.success("Game imported - queued for analysis");
        enqueueAnalysis([importedGame]);
      } finally {
        setIsLoading(false);
      }
    },
    [addGame, setActiveGame, enqueueAnalysis]
  );

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
          } else {
            // A rejected import resolves the fetch, so only this branch reports it.
            toast.error(`Failed to import ${g.white} vs ${g.black}`);
          }
        } catch {
          toast.error(`Failed to import ${g.white} vs ${g.black}`);
        }
      }

      if (imported.length > 0) {
        // Set the first imported game as active
        setActiveGame(imported[0]);
        useWindowStore.getState().open("review");
        // Queue all imported games for analysis
        enqueueAnalysis(imported);
        toast.success(
          `Imported ${imported.length} game${imported.length > 1 ? "s" : ""} - queued for analysis`
        );
      }
    },
    [addGame, setActiveGame, enqueueAnalysis]
  );

  // ---- Opening windows on first paint ----
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    // Read the param here rather than via useSearchParams: that hook would force
    // this static page into a client-side bailout.
    const view = new URLSearchParams(window.location.search).get("view");
    // ViewParamSync opened `play` in a layout effect, which already ran.
    if (view === "play-bonzi") return;

    const { open } = useWindowStore.getState();
    const { chessComUsername, lichessUsername } = useProfileStore.getState();

    open("games");
    // Unlinked: games explains the linking, profile lands on top to do it.
    if (!chessComUsername && !lichessUsername) open("profile");
  }, []);

  const defs: Record<WindowId, WindowDef> = {
    games: { title: ICON_LABELS.games, render: () => <GamesWindow /> },
    import: {
      title: ICON_LABELS.import,
      render: () => (
        <ImportWindow
          onImportUrl={handleImportUrl}
          onBulkImport={handleBulkImport}
          importing={isLoading}
        />
      ),
    },
    review: {
      title: activeGame
        ? `${activeGame.whitePlayer} vs ${activeGame.blackPlayer}`
        : "Game review",
      render: () => (
        <ReviewWindow
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
        />
      ),
      statusBar: (
        <ReviewStatusBar
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
        />
      ),
    },
    practice: { title: ICON_LABELS.practice, render: () => <PracticeWindow /> },
    play: { title: ICON_LABELS.play, render: () => <PlayWindow /> },
    profile: { title: ICON_LABELS.profile, render: () => <ProfileWindow /> },
  };

  return <Desktop defs={defs} />;
}
