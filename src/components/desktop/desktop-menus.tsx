"use client";

import { useEffect, useRef, useState } from "react";
import { RetroButton, RetroMenu, RetroWindow, type MenuItem } from "@/components/retro";
import type { ContextMenuState } from "@/components/retro/retro-menu";
import { useDesktopStore } from "@/stores/desktop-store";
import { useWindowStore, type WindowId } from "@/stores/window-store";
import { ICON_LABELS, WINDOW_ICONS } from "./icons";

export const DESKTOP_MENU = "desktop";
export const iconMenuKey = (id: WindowId) => `icon:${id}`;

interface DesktopMenusProps {
  menu: ContextMenuState | null;
  close: () => void;
  /** The desktop owns the Refresh gag: it flashes every icon at once. */
  onRefresh: () => void;
}

/**
 * The desktop and icon context menus plus the per-icon Properties dialog. Rendered at the
 * desktop-container level so nothing lands inside a window's stacking context.
 */
export function DesktopMenus({ menu, close, onRefresh }: DesktopMenusProps) {
  const [propsFor, setPropsFor] = useState<WindowId | null>(null);
  const { open } = useWindowStore.getState();

  const iconId = menu?.key.startsWith("icon:") ? (menu.key.slice(5) as WindowId) : null;
  const items: MenuItem[] = iconId
    ? [
        { label: "Open", onSelect: () => open(iconId) },
        { label: "", separator: true },
        { label: "Properties", onSelect: () => setPropsFor(iconId) },
      ]
    : [
        { label: "Arrange Icons", onSelect: () => useDesktopStore.getState().lineUpIcons() },
        { label: "Line up Icons", onSelect: () => useDesktopStore.getState().lineUpIcons() },
        { label: "Refresh", onSelect: onRefresh },
        { label: "", separator: true },
        { label: "Properties", onSelect: () => open("display") },
      ];

  return (
    <>
      {menu && <RetroMenu items={items} x={menu.x} y={menu.y} onClose={close} />}
      {propsFor && <IconPropertiesDialog id={propsFor} onClose={() => setPropsFor(null)} />}
    </>
  );
}

// Fictional details, straight out of a 1999 property sheet.
const DETAILS: [string, string][] = [
  ["Type:", "BonziWare application"],
  ["Size:", "4.09 MB"],
  ["Installed:", "4/23/1999"],
];

function IconPropertiesDialog({ id, onClose }: { id: WindowId; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[80] grid place-items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        // The window frame underneath would otherwise minimize as the dialog closed.
        e.stopPropagation();
        onClose();
      }}
    >
      <RetroWindow
        title={`${ICON_LABELS[id]} Properties`}
        className="w-[280px]"
        containerProps={{ role: "dialog" }}
      >
        <div className="flex items-center gap-3">
          <span className="icon-art shrink-0">{WINDOW_ICONS[id]}</span>
          <span className="r-body font-bold">{ICON_LABELS[id]}</span>
        </div>
        {/* The etched groove a Win98 property sheet puts under the name. */}
        <div className="my-3 border-t border-b border-t-[var(--r-shadow)] border-b-[var(--r-face-light)]" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[3px] text-[11px]">
          {DETAILS.map(([term, value]) => (
            <div key={term} className="contents">
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-end">
          <RetroButton variant="default" onClick={onClose}>
            OK
          </RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}
