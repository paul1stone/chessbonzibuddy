"use client";

import { Taskbar } from "@/components/retro";
import { DEFAULT_MENU_ITEMS } from "@/components/retro/taskbar";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DOCK_LABELS, DOCK_ORDER, useDockStore, type DockId } from "@/stores/dock-store";

export function MarketingTaskbar() {
  const docked = useDockStore((s) => s.docked);
  const active = useDockStore((s) => s.active);

  const jump = (id: DockId) => {
    const { scrollFns, targets } = useDockStore.getState();
    const behavior = prefersReducedMotion() ? ("auto" as const) : ("smooth" as const);
    const top = scrollFns[id]?.();
    if (top != null) window.scrollTo({ top, behavior });
    else targets[id]?.scrollIntoView({ behavior, block: "start" });
  };

  return (
    <Taskbar menuItems={DEFAULT_MENU_ITEMS}>
      <div data-dock-slots className="flex min-w-0 flex-1 gap-1 overflow-hidden">
        {DOCK_ORDER.filter((id) => docked[id]).map((id) => {
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
  );
}
