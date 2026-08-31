"use client";

import { PlayView } from "@/components/play/play-view";
import { useWindowStore } from "@/stores/window-store";

export function PlayWindow() {
  return <PlayView onExit={() => useWindowStore.getState().close("play")} />;
}
