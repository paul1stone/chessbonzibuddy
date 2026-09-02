"use client";

import { Desktop } from "@/components/desktop/desktop";
import { useDesktopShell } from "@/components/desktop/use-desktop-shell";
import { Toaster } from "@/components/ui/sonner";

/**
 * The real desktop, running inside the landing's last section: the same shell `/app` runs, with
 * no auto-opened window (the visitor arrives at a desktop to click) and no taskbar of its own
 * (the marketing bar hands its buttons over on arrival).
 *
 * Its own module so `desktop-finale` can code-split it — everything heavy the landing page can
 * reach (Stockfish, recharts, xterm) enters only through this chunk.
 */
export default function DesktopFinaleInner() {
  const { defs } = useDesktopShell({ autoOpen: false });

  return (
    <>
      <Desktop defs={defs} embedded />
      {/* Marketing routes mount no Toaster of their own, so every finale toast would drop. */}
      <Toaster position="bottom-right" offset={{ bottom: 38 }} mobileOffset={{ bottom: 38 }} />
    </>
  );
}
