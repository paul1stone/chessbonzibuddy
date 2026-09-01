"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useContextMenu } from "@/components/retro";
import { prefersReducedMotion } from "@/lib/motion";
import { useWindowStore, WINDOW_IDS, type WindowId } from "@/stores/window-store";
import { DESKTOP_ICON_IDS, desktopBackgroundStyle, useDesktopStore } from "@/stores/desktop-store";
import { useIsMobile } from "./use-is-mobile";
import { DesktopIcon } from "./desktop-icon";
import { DesktopMarquee, useMarquee } from "./desktop-marquee";
import { DesktopMenus, DESKTOP_MENU, iconMenuKey } from "./desktop-menus";
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

// Matches the .icon-flash keyframes.
const FLASH_MS = 120;

export function Desktop({ defs }: { defs: Record<WindowId, WindowDef> }) {
  const windows = useWindowStore((s) => s.windows);
  const { open } = useWindowStore.getState();
  const isMobile = useIsMobile();
  const appearance = useDesktopStore((s) => s.appearance);
  const hydrated = useDesktopStore((s) => s.hydrated);
  const { menu, openAt, close } = useContextMenu();
  const marquee = useMarquee();
  const [flashAll, setFlashAll] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Positions and appearance load here, never at module scope: the first client render has
  // to match the server's.
  useEffect(() => {
    useDesktopStore.getState().rehydrate();
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current ?? undefined), []);

  // Win98's Refresh repaints the desktop; here that reads as one flicker across the icons.
  const refresh = () => {
    useDesktopStore.getState().clearSelection();
    if (prefersReducedMotion()) return;
    setFlashAll(true);
    clearTimeout(flashTimer.current ?? undefined);
    flashTimer.current = setTimeout(() => setFlashAll(false), FLASH_MS);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-[var(--r-taskbar-h)] overflow-hidden bg-[var(--r-desktop)]"
      // Pre-hydration paints the default teal, so the server markup and the first client
      // render agree; the stored appearance lands once rehydrate() has run.
      style={hydrated ? desktopBackgroundStyle(appearance) : undefined}
      onPointerDown={(e) => {
        // Clicking bare desktop clears focus (spec 2.3); windows call focus() in their own handler.
        // Not on mobile: there the focused window is the only visible one, so clearing blanks the screen.
        if (isMobile || e.target !== e.currentTarget) return;
        useWindowStore.setState({ focused: null });
        marquee.onPointerDown(e);
      }}
      onContextMenu={(e) => {
        // Guarded on the target so right-clicks inside window bodies keep the native menu.
        if (isMobile || e.target !== e.currentTarget) return;
        openAt(e, DESKTOP_MENU);
      }}
    >
      {!isMobile && (
        <>
          {DESKTOP_ICON_IDS.map((id, i) => (
            <DesktopIcon
              key={id}
              id={id}
              index={i}
              label={ICON_LABELS[id]}
              icon={WINDOW_ICONS[id]}
              flash={flashAll}
              onOpen={() => open(id)}
              onContextMenu={(e) => {
                // Win98 selects the icon you right-click before showing its menu.
                useDesktopStore.getState().select(id);
                openAt(e, iconMenuKey(id));
              }}
            />
          ))}
          <DesktopMarquee ref={marquee.ref} />
          <DesktopMenus menu={menu} close={close} onRefresh={refresh} />
        </>
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
