"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Taskbar, type TaskbarMenuItem } from "@/components/retro";
import { DEFAULT_MENU_ITEMS } from "@/components/retro/taskbar";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DOCK_LABELS, DOCK_ORDER, useDockStore, type DockId } from "@/stores/dock-store";
import { clearBootFlag, safeSessionStorage } from "./easter/boot-flag";
import { ShutdownOverlay } from "./easter/shutdown-overlay";
import { MarketingTerminal } from "./marketing-terminal";

export function MarketingTaskbar() {
  const docked = useDockStore((s) => s.docked);
  const active = useDockStore((s) => s.active);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const pathname = usePathname();
  // Dock state is module-global and survives client-side nav; only the landing page has these sections.
  const dockedIds = pathname === "/" ? DOCK_ORDER.filter((id) => docked[id]) : [];

  const menuItems = useMemo<TaskbarMenuItem[]>(() => {
    const extras: TaskbarMenuItem[] = [
      { label: "MS-DOS Prompt", onSelect: () => setTerminalOpen(true) },
      { label: "Shut Down…", onSelect: () => setShuttingDown(true) },
    ];
    // GitHub is the off-site item; the local ones belong above it.
    const github = DEFAULT_MENU_ITEMS.findIndex((item) => item.label === "GitHub");
    const at = github < 0 ? DEFAULT_MENU_ITEMS.length : github;
    return [...DEFAULT_MENU_ITEMS.slice(0, at), ...extras, ...DEFAULT_MENU_ITEMS.slice(at)];
  }, []);

  const reboot = useCallback(() => {
    clearBootFlag(safeSessionStorage());
    window.scrollTo(0, 0);
    window.location.reload();
  }, []);

  const jump = (id: DockId) => {
    const { scrollFns, targets } = useDockStore.getState();
    const behavior = prefersReducedMotion() ? ("auto" as const) : ("smooth" as const);
    const top = scrollFns[id]?.();
    if (top != null) window.scrollTo({ top, behavior });
    else targets[id]?.scrollIntoView({ behavior, block: "start" });
  };

  return (
    <>
      <Taskbar menuItems={menuItems}>
        <div data-dock-slots className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {dockedIds.map((id) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                data-dock-button={id}
                className={cn(
                  "r-btn h-[22px] min-w-0 max-w-[160px] flex-1 justify-start truncate px-2",
                  isActive && "font-bold"
                )}
                style={
                  isActive
                    ? { boxShadow: "inset -1px -1px var(--r-highlight), inset 1px 1px var(--r-dark), inset -2px -2px var(--r-face-light), inset 2px 2px var(--r-shadow)" }
                    : undefined
                }
                aria-pressed={isActive}
                onClick={() => jump(id)}
              >
                <span className="truncate">{DOCK_LABELS[id]}</span>
              </button>
            );
          })}
        </div>
      </Taskbar>

      {terminalOpen && <MarketingTerminal onClose={() => setTerminalOpen(false)} />}
      <ShutdownOverlay open={shuttingDown} onDone={reboot} />
    </>
  );
}
