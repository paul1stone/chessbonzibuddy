"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface RetroMenuProps {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([data-disabled])';

/**
 * A Win98 context menu anchored at viewport coords. Callers render it inside `.retro` so the
 * tokens resolve, and are responsible for unmounting it when `onClose` fires.
 */
export function RetroMenu({ items, x, y, onClose }: RetroMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Off before measuring: a running slide would fold its own translateY into the correction
    // below. The forced layout from getBoundingClientRect also lets the animation replay.
    el.classList.remove("r-menu--in");
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    // Win98 flips the panel back across the pointer rather than letting it run off-screen.
    const flipped = {
      x: x + r.width > vw ? x - r.width : x,
      y: y + r.height > vh ? y - r.height : y,
    };
    const wanted = {
      x: Math.max(0, Math.min(flipped.x, vw - r.width)),
      y: Math.max(0, Math.min(flipped.y, vh - r.height)),
    };
    // The measured rect carries any offset a transformed ancestor imposes on position: fixed
    // (a dragged window frame has one), so correct by the delta instead of trusting left/top.
    el.style.left = `${x + (wanted.x - r.left)}px`;
    el.style.top = `${y + (wanted.y - r.top)}px`;
    if (!reduced) el.classList.add("r-menu--in");
  }, [x, y, reduced]);

  // Focus the panel itself: the first arrow key then lands on the first item, as in Win98.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // Shift+F10 opens a menu without any pointerdown, so watch contextmenu too or two menus stack.
    const onContextMenu = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const moveFocus = (dir: 1 | -1) => {
    const list = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR) ?? []);
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = at === -1 ? (dir === 1 ? 0 : list.length - 1) : (at + dir + list.length) % list.length;
    list[next].focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className="r-menu"
      style={{ left: x, top: y }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          // Without this the window frame underneath would minimize as the menu closed.
          e.stopPropagation();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          moveFocus(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveFocus(-1);
        } else if (e.key === "Tab") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="r-menu-sep" aria-hidden="true" />
        ) : (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="r-menu-item"
            data-disabled={item.disabled || undefined}
            aria-disabled={item.disabled || undefined}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect?.();
              onClose();
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

export interface ContextMenuState {
  x: number;
  y: number;
  key: string;
}

/** Tracks which target opened a menu and where, for callers that own one RetroMenu. */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openAt = useCallback((e: ReactMouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Shift+F10 and the menu key synthesize a contextmenu at 0,0; anchor those to the target.
    const keyboard = e.clientX === 0 && e.clientY === 0;
    const r = keyboard ? e.currentTarget.getBoundingClientRect() : null;
    setMenu({ x: r ? r.left : e.clientX, y: r ? r.bottom : e.clientY, key });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return { menu, openAt, close };
}
