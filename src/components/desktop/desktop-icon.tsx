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

export function DesktopIcon({ id, index, label, icon, flash, onOpen, onContextMenu }: DesktopIconProps) {
  const stored = useDesktopStore((s) => s.positions[id]);
  const selected = useDesktopStore((s) => s.selected.has(id));
  const pos: IconPos = stored ?? defaultIconPos(index);
  const [opening, setOpening] = useState(false);
  // A finished drag produces one click the user never meant: it is eaten, and so is the dblclick
  // it may still grow into, since the browser's double-click tolerance is wider than the 4px drag
  // threshold. Only those two — every later click selects normally.
  const dragClick = useRef(false);
  const dragChain = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const openWithFlash = () => {
    if (prefersReducedMotion()) {
      onOpen();
      return;
    }
    setOpening(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setOpening(false);
      onOpen();
    }, FLASH_MS);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let done = false;
    let next = pos;
    dragClick.current = false;
    el.setPointerCapture(pointerId);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
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
      if (ev.pointerId !== pointerId || done) return;
      done = true;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      el.removeEventListener("lostpointercapture", finish);
      if (!dragging) return;
      // Cleared in the same tick the store commits, so the two never paint apart.
      el.style.transform = "";
      if (ev.type === "pointercancel") return;
      dragClick.current = true;
      useDesktopStore.getState().moveIcon(id, next);
    };

    // On window, not the icon: a right-click mid-drag makes Chrome drop the capture, and the
    // terminating pointerup then lands on the desktop instead — which used to strand the icon
    // mid-transform with its listeners still attached. lostpointercapture ends the gesture where
    // it stands, so the drag never outlives its own context menu.
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    el.addEventListener("lostpointercapture", finish);
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
        if (dragClick.current) {
          dragClick.current = false;
          dragChain.current = true;
          return;
        }
        // detail 1 starts a fresh chain, so the drag's dblclick guard is spent.
        if (e.detail === 1) dragChain.current = false;
        useDesktopStore.getState().select(id, { toggle: e.ctrlKey || e.metaKey });
      }}
      onDoubleClick={() => {
        if (dragChain.current) {
          dragChain.current = false;
          return;
        }
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
