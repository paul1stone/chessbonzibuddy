"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useDesktopStore } from "@/stores/desktop-store";
import type { WindowId } from "@/stores/window-store";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const THRESHOLD = 4;

/** Ids of every desktop icon the rect touches, in DOM order. */
function iconsIn(r: Rect): WindowId[] {
  const hit: WindowId[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("[data-desktop-icon]")) {
    const b = el.getBoundingClientRect();
    if (b.left < r.left + r.width && b.right > r.left && b.top < r.top + r.height && b.bottom > r.top) {
      hit.push(el.dataset.desktopIcon as WindowId);
    }
  }
  return hit;
}

/**
 * Rubber-band selection over the bare desktop. The rect is painted straight onto the node the
 * returned ref holds — routing it through React state would re-render every open window on
 * each frame of the sweep.
 */
export function useMarquee() {
  const ref = useRef<HTMLDivElement>(null);
  // null, not "": the first sweep frame must be able to push an empty selection.
  const lastHit = useRef<string | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    // Bare desktop only: a press that lands on an icon or a window is not a marquee.
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const el = e.currentTarget;
    const box = ref.current;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    lastHit.current = null;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const rect: Rect = {
        left: Math.min(startX, ev.clientX),
        top: Math.min(startY, ev.clientY),
        width: Math.abs(ev.clientX - startX),
        height: Math.abs(ev.clientY - startY),
      };
      if (!dragging && rect.width < THRESHOLD && rect.height < THRESHOLD) return;
      dragging = true;
      if (box) {
        box.hidden = false;
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
      }
      const hit = iconsIn(rect);
      const key = hit.join(",");
      // setSelection installs a new Set every call, so only push real changes at frame rate.
      if (key === lastHit.current) return;
      lastHit.current = key;
      useDesktopStore.getState().setSelection(hit);
    };

    const finish = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
      // A press that never became a marquee is a plain click on empty desktop.
      if (!dragging) useDesktopStore.getState().clearSelection();
      if (box) box.hidden = true;
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  }, []);

  return { ref, onPointerDown };
}

/** The band itself. Stays mounted and hidden so the sweep never touches React. */
export function DesktopMarquee({ ref }: { ref: RefObject<HTMLDivElement | null> }) {
  return <div ref={ref} className="marquee" hidden aria-hidden="true" />;
}
