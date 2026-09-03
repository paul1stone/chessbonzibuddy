"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AboutDialog, Taskbar, type TaskbarMenuItem } from "@/components/retro";
import { DEFAULT_MENU_ITEMS } from "@/components/retro/taskbar";
import { APP_MENU_ITEMS_FACTORY, WindowButtons } from "@/components/desktop/app-taskbar";
import { WINDOW_ICONS } from "@/components/desktop/icons";
import { ShutDownGlyph } from "@/components/desktop/menu-glyphs";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DOCK_LABELS, DOCK_ORDER, useDockStore, type DockId } from "@/stores/dock-store";
import { useWindowStore, type WindowId } from "@/stores/window-store";
import { clearBootFlag, safeSessionStorage } from "./easter/boot-flag";
import { ShutdownOverlay } from "./easter/shutdown-overlay";
import { MarketingTerminal } from "./marketing-terminal";

/** GitHub is the off-site item; everything local belongs above it. */
function beforeGitHub(base: TaskbarMenuItem[], extras: TaskbarMenuItem[]): TaskbarMenuItem[] {
  const github = base.findIndex((item) => item.label === "GitHub");
  const at = github < 0 ? base.length : github;
  return [...base.slice(0, at), ...extras, ...base.slice(at)];
}

export function MarketingTaskbar() {
  const docked = useDockStore((s) => s.docked);
  const active = useDockStore((s) => s.active);
  const desktopActive = useDockStore((s) => s.desktopActive);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const pathname = usePathname();
  // Dock state is module-global and survives client-side nav; only the landing page has these sections.
  const onLanding = pathname === "/";
  // The finale's desktop is on screen: this bar is its taskbar now.
  const arrived = onLanding && desktopActive;
  const dockedIds = onLanding ? DOCK_ORDER.filter((id) => docked[id]) : [];

  const menuItems = useMemo<TaskbarMenuItem[]>(() => {
    const about: TaskbarMenuItem = {
      label: "About Chess Bonzi Buddy",
      // The app taskbar's About icon: the dialog's own 32px raster, shrunk to the slot.
      // eslint-disable-next-line @next/next/no-img-element
      icon: <img src="/favicon-32.png" alt="" width={16} height={16} className="[image-rendering:pixelated]" />,
      onSelect: () => setAboutOpen(true),
    };
    const shutDown: TaskbarMenuItem = {
      label: "Shut Down…",
      icon: <ShutDownGlyph />,
      onSelect: () => setShuttingDown(true),
    };

    if (arrived) {
      // The running desktop's own menu, minus Home (we are home) — and the factory already
      // carries MS-DOS Prompt, so the overlay item would collide with it on label and key.
      const open = (id: WindowId) => useWindowStore.getState().open(id);
      const app = APP_MENU_ITEMS_FACTORY(open).filter((item) => item.label !== "Home");
      return beforeGitHub(app, [shutDown, about]);
    }

    return beforeGitHub(DEFAULT_MENU_ITEMS, [
      { label: "MS-DOS Prompt", icon: WINDOW_ICONS.terminal, onSelect: () => setTerminalOpen(true) },
      shutDown,
      about,
    ]);
  }, [arrived]);

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
        {arrived ? (
          <WindowButtons />
        ) : (
          <div data-dock-slots className="flex min-w-0 flex-1 gap-1 overflow-hidden">
            {dockedIds.map((id) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-dock-button={id}
                  className={cn(
                    // M3, same as the app bar: r-btn's 75px min-width is unlayered, so it
                    // outranks a plain `min-w-0` and floors five buttons past the clock at
                    // 375px — the last two vanish. The ! puts the shrink back.
                    "r-btn h-[22px] min-w-0! max-w-[160px] flex-1 justify-start truncate px-2",
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
        )}
      </Taskbar>

      {terminalOpen && <MarketingTerminal onClose={() => setTerminalOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      <ShutdownOverlay open={shuttingDown} onDone={reboot} />
    </>
  );
}
