"use client";

import { Desktop } from "@/components/desktop";
import { useDesktopShell } from "@/components/desktop/use-desktop-shell";

export default function Home() {
  // The route is the skip-the-story entrance, so it opens a window on arrival.
  const { defs } = useDesktopShell({ autoOpen: true });
  return <Desktop defs={defs} />;
}
