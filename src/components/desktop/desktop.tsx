"use client";

import type { ReactNode } from "react";
import { useWindowStore, WINDOW_IDS, type WindowId } from "@/stores/window-store";
import { useIsMobile } from "./use-is-mobile";
import { DesktopIcon } from "./desktop-icon";
import { DesktopWindow } from "./desktop-window";
import { ICON_LABELS, WINDOW_ICONS } from "./icons";
import { AppTaskbar } from "./app-taskbar";

export interface WindowDef {
  title: string;
  render: () => ReactNode;
  statusBar?: ReactNode;
}

// Re-exported so existing consumers of "./desktop" keep working; source of truth is icons.tsx.
export { ICON_LABELS };

export function Desktop({ defs }: { defs: Record<WindowId, WindowDef> }) {
  const windows = useWindowStore((s) => s.windows);
  const { open } = useWindowStore.getState();
  const isMobile = useIsMobile();

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-[var(--r-taskbar-h)] overflow-hidden bg-[var(--r-desktop)]"
      onPointerDown={(e) => {
        // Clicking bare desktop clears focus (spec 2.3); windows call focus() in their own handler.
        // Not on mobile: there the focused window is the only visible one, so clearing blanks the screen.
        if (isMobile) return;
        if (e.target === e.currentTarget) useWindowStore.setState({ focused: null });
      }}
    >
      {!isMobile && (
        <div className="absolute left-2 top-2 flex flex-col gap-3">
          {WINDOW_IDS.map((id) => (
            <DesktopIcon key={id} label={ICON_LABELS[id]} icon={WINDOW_ICONS[id]} onOpen={() => open(id)} />
          ))}
        </div>
      )}
      {WINDOW_IDS.filter((id) => windows[id].open).map((id) => (
        <DesktopWindow key={id} id={id} title={defs[id].title} statusBar={defs[id].statusBar}>
          {defs[id].render()}
        </DesktopWindow>
      ))}
      <AppTaskbar />
    </div>
  );
}
