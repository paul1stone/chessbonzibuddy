"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * The desktop and icon context menus plus the per-icon Properties dialog. Both mount at the
 * `.retro` level, like every other overlay: the desktop container is a stacking context, so a
 * fixed panel inside it would be capped below the traces and menus that live a level up.
 */
export function DesktopMenus({ menu, close, onRefresh }: DesktopMenusProps) {
  const [propsFor, setPropsFor] = useState<WindowId | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const { open } = useWindowStore.getState();

  // The app layout's wrapper is the first `.retro` in document order, so this resolves to the
  // same element T6's `closest(".retro")` finds from inside a window frame.
  useEffect(() => setLayer(document.querySelector<HTMLElement>(".retro")), []);

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

  if (!layer) return null;

  return (
    <>
      {menu && createPortal(<RetroMenu items={items} x={menu.x} y={menu.y} onClose={close} />, layer)}
      {propsFor &&
        createPortal(<IconPropertiesDialog id={propsFor} onClose={() => setPropsFor(null)} />, layer)}
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
