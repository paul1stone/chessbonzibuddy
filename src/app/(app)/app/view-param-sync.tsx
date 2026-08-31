"use client";

import { useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWindowStore } from "@/stores/window-store";

// Lets the landing page deep-link into a window: /app?view=play-bonzi
export function ViewParamSync() {
  const params = useSearchParams();
  const view = params.get("view");

  // A layout effect so play is already open before the page's mount effect runs.
  useLayoutEffect(() => {
    if (view === "play-bonzi") useWindowStore.getState().open("play");
  }, [view]);

  return null;
}
