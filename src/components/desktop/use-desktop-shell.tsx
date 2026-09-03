"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { requestEngineDownload } from "@/components/retro/download-dialog";
import {
  acquireProgressCursor,
  releaseProgressCursor,
  toastError,
} from "@/components/ui/toast-helpers";
import DisplayPropertiesWindow from "@/components/windows/display-properties-window";
import { GamesWindow } from "@/components/windows/games-window";
import {
  ImportWindow,
  type ImportOne,
} from "@/components/windows/import-window";
import { PlayWindow } from "@/components/windows/play-window";
import { PracticeWindow } from "@/components/windows/practice-window";
import { ProfileWindow } from "@/components/windows/profile-window";
import {
  ReviewStatusBar,
  ReviewWindow,
} from "@/components/windows/review-window";
import TerminalWindow from "@/components/windows/terminal-window";
import { isEngineFetched } from "@/lib/engine-prefetch";
import { useGameStore } from "@/stores/game-store";
import { useWindowStore, type WindowId } from "@/stores/window-store";
import type { Game } from "@/db/schema";
import type { WindowDef } from "./desktop";
import { ICON_LABELS } from "./icons";
import { VIEW_PARAM_WINDOWS } from "./view-params";

/** One authored line for the branches where the server's own words can't be trusted (A8). */
function unreachableCopy(): string {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? "You're offline."
    : "Could not reach the game library. Try again in a minute.";
}

/**
 * The window definitions and the import/analyze handlers behind them, shared by the `/app`
 * route and the landing's desktop finale.
 *
 * `autoOpen` is the only difference between the two: the route opens a window on first paint,
 * the finale arrives at a desktop the visitor has to click.
 */
export function useDesktopShell({ autoOpen = false }: { autoOpen?: boolean } = {}): {
  defs: Record<WindowId, WindowDef>;
} {
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
        // No warm-up toast: the gate above has already named the download and shown its bar.
        const { analyzeGame } = await import("@/lib/analyze");

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
        if (res.status === 404) {
          // Game was deleted while analyzing: drop the result quietly.
          return;
        }
        if (!res.ok) throw new Error("Failed to save analysis");
        const updatedGame = (await res.json()) as Game;
        // Only refresh the game on screen: setActiveGame resets activeMove, which
        // would jump the review scrubber back to move 0 in a game being read.
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
        toastError("Analysis failed: " + errorMessage);
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
  // A drain that outlives its shell has to stop: the replacement shell mounts with both its
  // own flags clear and would start a second Stockfish alongside the detached one.
  const aliveRef = useRef(true);

  useEffect(() => {
    // Set in the body, not just cleared in the cleanup: StrictMode's mount/unmount/mount
    // would otherwise leave this false for the life of the real mount.
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

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

    (async () => {
      try {
        // A3: the engine is 113 MB, so nothing downloads it until the user says so. Gated
        // BEFORE the dequeue — a decline leaves the queue whole, ready for the next attempt.
        if (!isEngineFetched() && !(await requestEngineDownload())) {
          // The queue is held rather than lost, so say what would restart it.
          toast.info("Analysis needs the Stockfish download. Click Analyze to try again.");
          return;
        }

        // Drain the queue in this one run rather than a game per effect pass: the
        // one-game-per-pass shape stalled after the first game (verified live here and
        // against unmodified main), and draining in a single run needs no re-entry at all.
        for (;;) {
          // Stop if this shell is gone: a detached drain would run a second engine
          // alongside whatever the newly mounted shell starts.
          if (!aliveRef.current) break;

          // Re-read the guard between games: opening the play window mid-drain pauses us
          // after the current game, and closing it re-runs this effect to resume.
          if (useWindowStore.getState().windows.play.open) break;

          // A fresh snapshot each pass — games queued while this ran are picked up here.
          const next = dequeueAnalysis();
          if (!next) break;

          // If no game is currently active, make the queued game active. Read fresh: the
          // gate may have held this run open for the length of a download.
          if (!useGameStore.getState().activeGame) {
            setActiveGame(next);
          }
          // Awaited, so the engine only ever runs one game at a time.
          await runAnalysis(next);
        }
      } finally {
        processingRef.current = false;
      }
    })().catch((err) => {
      // Nothing above throws today; this keeps a future one out of the unhandled bucket.
      console.error("Analysis queue failed:", err);
    });
  }, [
    isAnalyzing,
    playOpen,
    analysisQueue,
    dequeueAnalysis,
    runAnalysis,
    setActiveGame,
  ]);

  // ---- Hourglass while the engine works ----
  useEffect(() => {
    if (!isAnalyzing) return;
    acquireProgressCursor();
    return releaseProgressCursor;
  }, [isAnalyzing]);

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
          .then(async (res) => ({
            ok: res.ok,
            status: res.status,
            data: await res.json().catch(() => null),
          }))
          .catch(() => null);

        // A8: one surface for the failure — the form's own inline line, which is what the
        // caller renders from these throws. No toast saying the same thing beside it.
        if (!result) throw new Error(unreachableCopy());

        if (!result.ok) {
          // 4xx bodies are this app's own validation copy; anything else can carry raw
          // upstream text, which never reaches the screen.
          const authored =
            result.status < 500 && typeof result.data?.error === "string"
              ? (result.data.error as string)
              : unreachableCopy();
          throw new Error(authored);
        }

        const importedGame = result.data as Game | null;
        if (!importedGame) throw new Error(unreachableCopy());
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

  // ---- Import one recent game (A2/A14: the caller marks only confirmed ids) ----
  const handleImportOne = useCallback<ImportOne>(
    async (g) => {
      try {
        const res = await fetch("/api/games/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: g.url }),
        });

        if (!res.ok) {
          // A rejected import resolves the fetch, so only this branch reports it.
          toastError(`Failed to import ${g.white} vs ${g.black}`);
          return false;
        }

        const game = (await res.json()) as Game;
        addGame(game);
        // The first game of an import run lands on the board; later ones queue behind it
        // rather than yanking the review scrubber off whatever is being read.
        if (!useGameStore.getState().activeGame) setActiveGame(game);
        enqueueAnalysis([game]);
        return true;
      } catch {
        toastError(`Failed to import ${g.white} vs ${g.black}`);
        return false;
      }
    },
    [addGame, setActiveGame, enqueueAnalysis]
  );

  // ---- Opening windows on first paint ----
  const openedRef = useRef(false);

  useEffect(() => {
    if (!autoOpen || openedRef.current) return;
    openedRef.current = true;

    // Read the param here rather than via useSearchParams: that hook would force
    // this static page into a client-side bailout.
    const view = new URLSearchParams(window.location.search).get("view");
    // A deep link already picked the window, in ViewParamSync's layout effect.
    if (view && view in VIEW_PARAM_WINDOWS) return;

    // Matched here rather than through useIsMobile: that hook hands the hydrating render its
    // server snapshot (false), and the hydrating render is the only one this effect ever sees.
    if (window.matchMedia("(max-width: 767px)").matches) {
      // M5: a phone arrives to play Bonzi, not to a file manager. Safe now that opening the
      // window downloads nothing — the gate asks at Start. Closing it falls back to the icon
      // grid, so the last close never strands a blank screen.
      useWindowStore.getState().open("play");
      return;
    }
    // S2: My games alone — Profile comes from its own "Open profile" CTA.
    useWindowStore.getState().open("games");
  }, [autoOpen]);

  const defs: Record<WindowId, WindowDef> = {
    games: { title: ICON_LABELS.games, render: () => <GamesWindow /> },
    import: {
      title: ICON_LABELS.import,
      render: () => (
        <ImportWindow
          onImportUrl={handleImportUrl}
          onImportOne={handleImportOne}
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
    terminal: { title: ICON_LABELS.terminal, render: () => <TerminalWindow /> },
    display: { title: ICON_LABELS.display, render: () => <DisplayPropertiesWindow /> },
  };

  return { defs };
}
