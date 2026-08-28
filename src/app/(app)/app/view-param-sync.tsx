"use client";

import { useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "@/stores/game-store";

// Lets the landing page deep-link into a view: /app?view=play-bonzi
export function ViewParamSync() {
  const params = useSearchParams();
  const setView = useGameStore((s) => s.setView);
  const view = params.get("view");

  useLayoutEffect(() => {
    if (view === "play-bonzi") setView("play-bonzi");
  }, [view, setView]);

  return null;
}
