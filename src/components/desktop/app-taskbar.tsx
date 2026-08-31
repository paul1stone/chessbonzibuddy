"use client";

import { Taskbar, type TaskbarMenuItem } from "@/components/retro";
import { cn } from "@/lib/utils";
import { useWindowStore, WINDOW_IDS } from "@/stores/window-store";
import { WINDOW_ICONS } from "./icons";
import { ICON_LABELS } from "./desktop";

// Taskbar buttons use the same static labels as icons (never the dynamic window title).
// desktop.tsx imports this file, so ICON_LABELS is only ever read at render time.

export function AppTaskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focused = useWindowStore((s) => s.focused);
  const { open, focus, minimize } = useWindowStore.getState();

  const menuItems: TaskbarMenuItem[] = [
    { label: "Play Bonzi Buddy", onSelect: () => open("play") },
    { label: "My games", onSelect: () => open("games") },
    { label: "Import", onSelect: () => open("import") },
    { label: "Profile", onSelect: () => open("profile") },
    { href: "/", label: "Home" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];

  return (
    <Taskbar menuItems={menuItems}>
      {WINDOW_IDS.filter((id) => windows[id].open).map((id) => {
        const isFocused = focused === id && !windows[id].minimized;
        return (
          <button
            key={id}
            type="button"
            className={cn("r-btn h-[22px] min-w-0 max-w-[160px] flex-1 justify-start gap-1 truncate px-2", isFocused && "font-bold")}
            style={isFocused ? { boxShadow: "inset -1px -1px var(--r-highlight), inset 1px 1px var(--r-dark), inset -2px -2px var(--r-face-light), inset 2px 2px var(--r-shadow)" } : undefined}
            aria-pressed={isFocused}
            onClick={() => (isFocused ? minimize(id) : focus(id))}
          >
            <span className="h-4 w-4 shrink-0 [&>*]:h-4 [&>*]:w-4">{WINDOW_ICONS[id]}</span>
            <span className="truncate">{ICON_LABELS[id]}</span>
          </button>
        );
      })}
    </Taskbar>
  );
}
