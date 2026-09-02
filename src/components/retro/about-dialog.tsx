"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RetroButton } from "./retro-button";
import { RetroWindow } from "./retro-window";

// The layer never changes for the life of a page, so the store never notifies; the point of
// useSyncExternalStore here is the SSR/hydration split — null on the server, the node after.
const NEVER = () => () => {};
const readLayer = () => document.querySelector<HTMLElement>(".retro");
const noLayer = () => null;

/**
 * Start ▸ About Chess Bonzi Buddy — the disclaimer and credits the landing footer used to carry.
 * Both taskbars mount it, so it portals to `.retro` like every other overlay: the bars are fixed
 * stacking contexts and a panel rendered inside one would be pinned to the bar's own layer.
 */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const layer = useSyncExternalStore(NEVER, readLayer, noLayer);

  if (!layer) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        // The window frame underneath would otherwise minimize as the dialog closed.
        e.stopPropagation();
        onClose();
      }}
    >
      <RetroWindow
        title="About Chess Bonzi Buddy"
        className="w-[min(92vw,360px)]"
        containerProps={{ role: "dialog" }}
      >
        <div className="flex items-center gap-3">
          {/* The app icon, the same 32px raster the browser tab gets: a whole-body Bonzi shrunk
              to 32px is a speck. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon-32.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 [image-rendering:pixelated]"
          />
          <div>
            <p className="font-bold">BonziOS 1.0</p>
            <p className="text-[11px]">Chess Bonzi Buddy</p>
          </div>
        </div>
        {/* The etched groove a Win98 About box puts under the product name. */}
        <div className="my-3 border-t border-b border-t-[var(--r-shadow)] border-b-[var(--r-face-light)]" />
        <p className="text-[11px] leading-[1.5]">
          Chess Bonzi Buddy is a hobby project. Not affiliated with Bonzi Software, Chess.com, or Lichess.
        </p>
        <p className="mt-2 text-[11px] leading-[1.5]">
          Credits: Stockfish 18, chess.js, react-chessboard. MS Sans Serif pixel font by lou, CC BY-SA 3.0.
        </p>
        <div className="mt-4 flex justify-end">
          {/* A Win98 About box opens with OK already focused, so Enter and Esc both dismiss it. */}
          <RetroButton variant="default" autoFocus onClick={onClose}>
            OK
          </RetroButton>
        </div>
      </RetroWindow>
    </div>,
    layer
  );
}
