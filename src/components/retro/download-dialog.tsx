"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  cancelEnginePrefetch,
  isAbortError,
  prefetchEngine,
  type PrefetchProgress,
} from "@/lib/engine-prefetch";
import { RetroButton } from "./retro-button";
import { RetroWindow } from "./retro-window";

type Phase = "ask" | "downloading" | "failed";

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/**
 * The Win98 confirm box in front of the engine's 113 MB download.
 *
 * Mounted imperatively by `requestEngineDownload` rather than by a parent: the two things that
 * need it (starting a game, and the analysis queue's next game) are asked for from a callback
 * and an effect, and the analysis one outlives whichever window queued the game.
 */
function DownloadDialogView({ onSettle }: { onSettle: (ok: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  // The dialog unmounts as soon as it settles, so late progress must not set state.
  const liveRef = useRef(true);
  useEffect(() => () => {
    liveRef.current = false;
  }, []);

  const settle = useCallback(
    (ok: boolean) => {
      liveRef.current = false;
      onSettle(ok);
    },
    [onSettle]
  );

  const start = useCallback(async () => {
    setPhase("downloading");
    setProgress(null);
    try {
      await prefetchEngine((next) => {
        if (liveRef.current) setProgress(next);
      });
      settle(true);
    } catch (err) {
      // Cancel mid-download aborts the fetch, which lands here as a decline, not a failure.
      if (isAbortError(err)) {
        settle(false);
        return;
      }
      console.error("Engine download failed:", err);
      if (liveRef.current) setPhase("failed");
    }
  }, [settle]);

  const cancel = useCallback(() => {
    if (phase === "downloading") {
      // The abort rejects the shared promise; `start`'s catch settles the dialog.
      cancelEnginePrefetch();
      return;
    }
    settle(false);
  }, [phase, settle]);

  const percent = progress?.percent ?? 0;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-2"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        // The window underneath would otherwise minimize as the dialog closed.
        e.stopPropagation();
        cancel();
      }}
    >
      <RetroWindow
        title="Download Stockfish"
        className="w-[min(92vw,380px)]"
        containerProps={{ role: "dialog", "aria-modal": "true" }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center bg-[var(--r-title-a)] font-serif text-[22px] font-bold italic text-[var(--r-title-text)]"
          >
            {phase === "failed" ? "!" : "?"}
          </span>
          <div className="r-body min-w-0 flex-1 pt-1">
            {phase === "ask" && (
              <>
                <p>
                  Bonzi thinks with Stockfish, a chess engine that runs inside your browser.
                </p>
                <p className="mt-2">
                  It is a 113 MB download, once. Your browser keeps it, so this may finish
                  instantly if you already have it.
                </p>
              </>
            )}

            {phase === "downloading" && (
              <>
                <p>Downloading Stockfish...</p>
                <div
                  className="r-progress mt-2"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Engine download"
                >
                  <div className="r-progress-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-[var(--r-shadow)]">
                  {progress
                    ? `${percent}% of ${megabytes(progress.total)}`
                    : "Starting..."}
                </p>
              </>
            )}

            {phase === "failed" && (
              <>
                <p>The engine download did not finish.</p>
                <p className="mt-2 text-[11px] text-[var(--r-shadow)]">
                  Check your connection and try again.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Keyed on the phase so the buttons remount and `autoFocus` lands on the new primary
            action; otherwise focus falls to the body and Escape stops reaching this dialog. */}
        <div key={phase} className="mt-5 flex flex-wrap justify-center gap-2">
          {phase === "ask" && (
            <RetroButton variant="default" autoFocus onClick={start}>
              Download
            </RetroButton>
          )}
          {phase === "failed" && (
            <RetroButton variant="default" autoFocus onClick={start}>
              Retry
            </RetroButton>
          )}
          <RetroButton autoFocus={phase === "downloading"} onClick={cancel}>
            Cancel
          </RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}

let pending: Promise<boolean> | null = null;
let openHost: HTMLElement | null = null;

/**
 * Shows the gate and resolves true once the engine is cached, false if declined.
 *
 * Its own React root: the callers are a hook with no node of its own to hand a parent and a
 * play view that can close mid-download, and both need the same one dialog.
 */
export function requestEngineDownload(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  // A host torn out with its layer (a route change mid-dialog) can never answer, so the next
  // caller gets a fresh dialog rather than that dead promise.
  if (pending && openHost?.isConnected) return pending;

  // Inside `.retro` so the dialog inherits the theme tokens and the pixel font.
  const layer = document.querySelector<HTMLElement>(".retro") ?? document.body;
  const host = document.createElement("div");
  layer.appendChild(host);
  openHost = host;
  const root = createRoot(host);

  pending = new Promise<boolean>((resolve) => {
    root.render(
      <DownloadDialogView
        onSettle={(ok) => {
          pending = null;
          openHost = null;
          resolve(ok);
          // Out of band: React refuses to unmount a root from inside its own render pass.
          setTimeout(() => {
            root.unmount();
            host.remove();
          }, 0);
        }}
      />
    );
  });

  return pending;
}
