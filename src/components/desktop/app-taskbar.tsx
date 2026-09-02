"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { RetroMenu, Taskbar, useContextMenu, type MenuItem, type TaskbarMenuItem } from "@/components/retro";
import { cn } from "@/lib/utils";
import { useWindowStore, WINDOW_IDS, type WindowId } from "@/stores/window-store";
import { ICON_LABELS, WINDOW_ICONS } from "./icons";
import { useIsMobile } from "./use-is-mobile";

// Taskbar buttons use the same static labels as the desktop icons (never the dynamic window title).

const BAR_MENU = "bar";

/**
 * The Start menu of a desktop that is actually running. A factory, not a constant: the landing's
 * arrived finale builds the same list against its own `open` and then edits the ends of it.
 */
export const APP_MENU_ITEMS_FACTORY = (open: (id: WindowId) => void): TaskbarMenuItem[] => [
  { label: "Play Bonzi Buddy", onSelect: () => open("play") },
  { label: "My games", onSelect: () => open("games") },
  { label: "Import", onSelect: () => open("import") },
  { label: "Practice", onSelect: () => open("practice") },
  { label: "Profile", onSelect: () => open("profile") },
  { label: "MS-DOS Prompt", onSelect: () => open("terminal") },
  { href: "/", label: "Home" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "https://github.com/paul1stone/chessbonzibuddy", label: "GitHub", external: true },
];

/**
 * One button per open window, with its own system menu — and the focus handoff when the last
 * window closes. Split out of AppTaskbar so the marketing taskbar can host the same buttons
 * once the finale has arrived; the effect travels with them or the finale loses it.
 */
export function WindowButtons() {
  const windows = useWindowStore((s) => s.windows);
  const focused = useWindowStore((s) => s.focused);
  const { focus, close, minimize } = useWindowStore.getState();
  const isMobile = useIsMobile();

  // Spec 8: when the last window closes, focus falls to the Start button.
  const anyOpen = WINDOW_IDS.some((id) => windows[id].open);
  const prevOpenRef = useRef(anyOpen);
  useEffect(() => {
    if (prevOpenRef.current && !anyOpen) {
      document.querySelector<HTMLElement>('[aria-controls="start-menu"]')?.focus();
    }
    prevOpenRef.current = anyOpen;
  }, [anyOpen]);

  const { menu, openAt, close: closeMenu } = useContextMenu();
  // The menu mounts at the .retro level: the bar is a fixed z-50 stacking context, so a panel
  // rendered inside it would be pinned to the bar's own layer instead of floating over the desktop.
  const [menuLayer, setMenuLayer] = useState<HTMLElement | null>(null);

  const openMenu = (e: ReactMouseEvent, id: WindowId) => {
    // Mobile gets no retro menu at all, and bailing before openAt leaves the native one intact.
    if (isMobile) return;
    setMenuLayer(e.currentTarget.closest<HTMLElement>(".retro"));
    openAt(e, id);
  };

  const items: MenuItem[] = !menu
    ? []
    : [
        windows[menu.key as WindowId].minimized
          ? { label: "Restore", onSelect: () => focus(menu.key as WindowId) }
          : { label: "Minimize", onSelect: () => minimize(menu.key as WindowId) },
        { label: "Close", onSelect: () => close(menu.key as WindowId) },
      ];

  return (
    <>
      {WINDOW_IDS.filter((id) => windows[id].open).map((id) => {
        const isFocused = focused === id && !windows[id].minimized;
        return (
          <button
            key={id}
            type="button"
            data-taskbar-button={id}
            className={cn(
              // M3: r-btn's 75px min-width is unlayered, so it outranks a plain `min-w-0` and
              // floors the buttons at six-across-a-phone — past the clock. The ! puts it back.
              "r-btn hit-44 h-[22px] min-w-0! max-w-[160px] flex-1 justify-start gap-1 truncate px-2",
              isFocused && "font-bold"
            )}
            style={isFocused ? { boxShadow: "inset -1px -1px var(--r-highlight), inset 1px 1px var(--r-dark), inset -2px -2px var(--r-face-light), inset 2px 2px var(--r-shadow)" } : undefined}
            aria-pressed={isFocused}
            onClick={() => (isFocused ? minimize(id) : focus(id))}
            onContextMenu={(e) => openMenu(e, id)}
          >
            <span className="h-4 w-4 shrink-0 [&>*]:h-4 [&>*]:w-4">{WINDOW_ICONS[id]}</span>
            <span className="truncate">{ICON_LABELS[id]}</span>
          </button>
        );
      })}
      {!isMobile &&
        menu &&
        menuLayer &&
        createPortal(<RetroMenu items={items} x={menu.x} y={menu.y} onClose={closeMenu} />, menuLayer)}
    </>
  );
}

export function AppTaskbar() {
  const { open, cascadeAll, tileAll, minimizeAll } = useWindowStore.getState();
  const isMobile = useIsMobile();

  const { menu, openAt, close: closeMenu } = useContextMenu();
  const [menuLayer, setMenuLayer] = useState<HTMLElement | null>(null);

  const barItems: MenuItem[] = [
    { label: "Cascade Windows", onSelect: () => cascadeAll() },
    { label: "Tile Windows", onSelect: () => tileAll() },
    { label: "Minimize All Windows", onSelect: () => minimizeAll() },
    { label: "", separator: true },
    { label: "Properties", onSelect: () => open("display") },
  ];

  return (
    <>
      <Taskbar
        menuItems={APP_MENU_ITEMS_FACTORY(open)}
        onBarContextMenu={(e) => {
          // Start and the window buttons own their own menus; bare bar gets the window list one.
          if ((e.target as HTMLElement).closest("button, a")) return;
          if (isMobile) return;
          setMenuLayer(e.currentTarget.closest<HTMLElement>(".retro"));
          openAt(e, BAR_MENU);
        }}
      >
        <WindowButtons />
      </Taskbar>
      {!isMobile &&
        menu &&
        menuLayer &&
        createPortal(<RetroMenu items={barItems} x={menu.x} y={menu.y} onClose={closeMenu} />, menuLayer)}
    </>
  );
}
