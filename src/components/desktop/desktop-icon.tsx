"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { defaultIconPos, useDesktopStore, type IconPos } from "@/stores/desktop-store";
import type { WindowId } from "@/stores/window-store";

interface DesktopIconProps {
  id: WindowId;
  index: number;
  label: string;
  icon: ReactNode;
  /** Desktop-driven flash, used by the Refresh gag. The open-flash is local. */
  flash: boolean;
  onOpen: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}

const DRAG_THRESHOLD = 4;
// Matches the .icon-flash keyframes.
const FLASH_MS = 120;
// Wider than the drag threshold on purpose: the browser's double-click tolerance is bigger, so
// a sloppy double-click can both move the icon and fire dblclick. Both are suppressed until the
// double-click window has passed.
const DBLCLICK_MS = 500;

export function DesktopIcon({ id, index, label, icon, flash, onOpen, onContextMenu }: DesktopIconProps) {
  const stored = useDesktopStore((s) => s.positions[id]);
  const selected = useDesktopStore((s) => s.selected.has(id));
  const pos: IconPos = stored ?? defaultIconPos(index);
  const [opening, setOpening] = useState(false);
  const movedRef = useRef(false);
  const timers = useRef<{ flash?: ReturnType<typeof setTimeout>; moved?: ReturnType<typeof setTimeout> }>({});

  useEffect(
    () => () => {
      clearTimeout(timers.current.flash);
      clearTimeout(timers.current.moved);
    },
    []
  );

  const openWithFlash = () => {
    if (prefersReducedMotion()) {
      onOpen();
      return;
    }
    setOpening(true);
    clearTimeout(timers.current.flash);
    timers.current.flash = setTimeout(() => {
      setOpening(false);
      onOpen();
    }, FLASH_MS);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let next = pos;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragging = true;
      const parent = el.offsetParent as HTMLElement | null;
      const maxX = Math.max(0, (parent?.clientWidth ?? el.offsetWidth) - el.offsetWidth);
      const maxY = Math.max(0, (parent?.clientHeight ?? el.offsetHeight) - el.offsetHeight);
      next = {
        x: Math.round(Math.min(Math.max(pos.x + dx, 0), maxX)),
        y: Math.round(Math.min(Math.max(pos.y + dy, 0), maxY)),
      };
      // Straight to the DOM: the store is written once, on release.
      el.style.transform = `translate(${next.x - pos.x}px, ${next.y - pos.y}px)`;
    };

    const finish = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
      if (!dragging) return;
      // Cleared in the same tick the store commits, so the two never paint apart.
      el.style.transform = "";
      if (ev.type === "pointercancel") return;
      movedRef.current = true;
      clearTimeout(timers.current.moved);
      timers.current.moved = setTimeout(() => {
        movedRef.current = false;
      }, DBLCLICK_MS);
      useDesktopStore.getState().moveIcon(id, next);
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  };

  return (
    <button
      type="button"
      data-desktop-icon={id}
      style={{ left: pos.x, top: pos.y }}
      className={cn(
        "absolute flex w-[76px] select-none flex-col items-center gap-1 p-1",
        "focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-[var(--r-highlight)]",
        selected && "icon-selected",
        (flash || opening) && "icon-flash"
      )}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        if (movedRef.current) return;
        useDesktopStore.getState().select(id, { toggle: e.ctrlKey || e.metaKey });
      }}
      onDoubleClick={() => {
        if (movedRef.current) return;
        openWithFlash();
      }}
      onFocus={(e) => {
        // Keyboard focus selects; pointer focus must not, or a drag would change the
        // selection at press, before we know it is a drag.
        if (e.target.matches(":focus-visible")) useDesktopStore.getState().select(id);
      }}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openWithFlash();
        }
      }}
    >
      <span className="icon-art" aria-hidden="true">
        {icon}
      </span>
      <span className="icon-label max-w-full px-[2px] text-center text-[11px] leading-tight text-[var(--r-title-text)] [text-shadow:1px_1px_0_var(--r-dark)]">
        {label}
      </span>
    </button>
  );
}
