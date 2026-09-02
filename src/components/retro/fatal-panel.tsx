"use client";

import { RetroButton, RetroWindow } from "@/components/retro";
import { msSans, vt323 } from "@/fonts/retro-fonts";

interface FatalPanelProps {
  reset: () => void;
  digest?: string;
}

/** The error boundaries' surface: BONZI.SYS died, here is the button that restarts it. */
export function FatalPanel({ reset, digest }: FatalPanelProps) {
  return (
    // Self-contained shell: the root boundary renders above the route-group layouts,
    // so it cannot inherit their `.retro` wrapper or font variables.
    <div
      className={`retro app ${msSans.variable} ${vt323.variable} flex min-h-screen items-center justify-center p-4`}
    >
      <RetroWindow
        title="Chess Bonzi Buddy"
        className="w-full max-w-[440px]"
        statusBar={digest ? `Reference: ${digest}` : "Press Retry to continue."}
      >
        <div className="flex gap-3">
          <svg
            viewBox="0 0 16 16"
            width="32"
            height="32"
            shapeRendering="crispEdges"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="8" cy="8" r="7" fill="#c00000" />
            <path d="M5 5 L11 11 M11 5 L5 11" stroke="#ffffff" strokeWidth="2" />
          </svg>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="font-bold">
              BONZI.SYS: A fatal exception 0E has occurred.
            </p>
            <ul className="flex flex-col gap-1 text-[var(--r-dark)]">
              <li>* Press Retry to return to the desktop.</li>
              <li>* If problems continue, reload the page.</li>
            </ul>
            <div className="flex justify-end">
              <RetroButton variant="default" onClick={reset}>
                Retry
              </RetroButton>
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
