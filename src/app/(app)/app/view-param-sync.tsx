"use client";

import { useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import { VIEW_PARAM_WINDOWS } from "@/components/desktop/view-params";
import { useWindowStore } from "@/stores/window-store";

// Lets the landing page deep-link into a window: /app?view=play-bonzi, /app?view=practice, ...
export function ViewParamSync() {
  const params = useSearchParams();
  const view = params.get("view");

  // A layout effect so the window is already open before the shell's mount effect runs.
  useLayoutEffect(() => {
    const id = view ? VIEW_PARAM_WINDOWS[view] : undefined;
    if (id) useWindowStore.getState().open(id);
  }, [view]);

  return null;
}
