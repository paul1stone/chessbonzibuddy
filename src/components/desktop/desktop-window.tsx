"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useDrag } from "@/hooks/use-drag";
import { useWindowStore, WINDOW_SIZES, type WindowId } from "@/stores/window-store";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useIsMobile } from "./use-is-mobile";

interface DesktopWindowProps {
  id: WindowId;
  title: string;
  children: ReactNode;
  statusBar?: ReactNode;
}

const NUDGE = 16;

const translate = (x: number, y: number) => `translate(${x}px, ${y}px)`;

export function DesktopWindow({ id, title, children, statusBar }: DesktopWindowProps) {
  const win = useWindowStore((s) => s.windows[id]);
  const focused = useWindowStore((s) => s.focused === id);
  const { focus, close, minimize, toggleMaximize, move } = useWindowStore.getState();
  const isMobile = useIsMobile();
  const ref = useRef<HTMLElement>(null);
  // Live drag position and its pending frame. The store stays untouched until release.
  const dragPos = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef<number | null>(null);

  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      // Clamp against the rendered width, not the nominal one: the frame caps at 100vw - 16px.
      const w = ref.current?.offsetWidth ?? WINDOW_SIZES[id].w;
      return { x: Math.min(maxX, Math.max(-w + 60, x)), y: Math.min(maxY, Math.max(0, y)) };
    },
    [id]
  );

  const clampedMove = useCallback(
    (dx: number, dy: number) => {
      const { x, y } = useWindowStore.getState().windows[id];
      const p = clamp(x + dx, y + dy);
      move(id, p.x, p.y);
    },
    [clamp, id, move]
  );

  // Writes the drag position straight to the DOM. Skipped while maximized, where the frame is
  // inset-positioned and a transform would displace it.
  const paintDrag = useCallback(
    (p: { x: number; y: number }) => {
      const el = ref.current;
      if (el && !useWindowStore.getState().windows[id].maximized) el.style.transform = translate(p.x, p.y);
    },
    [id]
  );

  const onDragMove = useCallback(
    (dx: number, dy: number) => {
      const base = dragPos.current ?? useWindowStore.getState().windows[id];
      dragPos.current = clamp(base.x + dx, base.y + dy);
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        if (dragPos.current) paintDrag(dragPos.current);
      });
    },
    [clamp, id, paintDrag]
  );

  const onDragEnd = useCallback(() => {
    // Cancel first: a queued frame landing after the commit would re-apply the drag transform.
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    const p = dragPos.current;
    dragPos.current = null;
    if (!p) return;
    // Keep the inline value equal to the one the commit renders: React skips the style write when
    // x/y are unchanged (dragging into a clamp), and clearing it would strand the frame at 0,0.
    paintDrag(p);
    move(id, p.x, p.y);
  }, [id, move, paintDrag]);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const reduced = usePrefersReducedMotion();
  const { onPointerDown } = useDrag({
    onMove: onDragMove,
    onEnd: onDragEnd,
    disabled: isMobile || win.maximized || reduced,
  });

  // Focus the window frame when it becomes the focused window.
  useEffect(() => {
    if (focused && ref.current && !ref.current.contains(document.activeElement)) {
      ref.current.focus({ preventScroll: true });
    }
  }, [focused]);

  // Closed windows unmount; minimized / mobile-background windows stay MOUNTED and are
  // hidden with CSS. Unmounting would kill live state (the Stockfish worker, the play
  // view's game ref, review scrubbing) — hiding preserves it all. useBoardSize sees
  // 0x0 while hidden; its 200px floor plus the re-measure on restore make that benign.
  if (!win.open) return null;
  const hidden = win.minimized || (isMobile && !focused);

  const maximized = win.maximized || isMobile;
  const size = WINDOW_SIZES[id];

  return (
    <section
      ref={ref}
      role="dialog"
      aria-labelledby={`win-title-${id}`}
      tabIndex={-1}
      className="r-face r-bevel-out absolute flex flex-col p-[3px] outline-none"
      style={
        maximized
          ? { inset: 0, zIndex: win.z, display: hidden ? "none" : undefined }
          : {
              width: `min(${size.w}px, calc(100vw - 16px))`,
              height: `min(${size.h}px, calc(100vh - var(--r-taskbar-h) - 16px))`,
              transform: translate(win.x, win.y),
              zIndex: win.z,
              display: hidden ? "none" : undefined,
            }
      }
      onPointerDown={() => focus(id)}
      onKeyDown={(e) => {
        // Window-level Escape minimizes (spec 2.5); never steal Escape from text fields.
        if (e.key !== "Escape") return;
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
        e.preventDefault();
        minimize(id);
      }}
    >
      <div
        className={cn("r-title shrink-0 cursor-default touch-none select-none", !focused && "r-title--inactive")}
        onPointerDown={onPointerDown}
        onDoubleClick={() => !isMobile && toggleMaximize(id)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowLeft") { e.preventDefault(); clampedMove(-NUDGE, 0); }
          else if (e.key === "ArrowRight") { e.preventDefault(); clampedMove(NUDGE, 0); }
          else if (e.key === "ArrowUp") { e.preventDefault(); clampedMove(0, -NUDGE); }
          else if (e.key === "ArrowDown") { e.preventDefault(); clampedMove(0, NUDGE); }
          else if (e.key === "Enter") { e.preventDefault(); toggleMaximize(id); }
          else if (e.key === "Escape") { e.preventDefault(); minimize(id); }
        }}
      >
        <span id={`win-title-${id}`} className="truncate">{title}</span>
        <span className="ml-auto flex gap-[2px]">
          <button type="button" className="r-title-glyph" aria-label="Minimize" onClick={() => minimize(id)}>_</button>
          {!isMobile && (
            <button type="button" className="r-title-glyph" aria-label={win.maximized ? "Restore" : "Maximize"} onClick={() => toggleMaximize(id)}>□</button>
          )}
          <button type="button" className="r-title-glyph" aria-label="Close" onClick={() => close(id)}>×</button>
        </span>
      </div>
      <div className="r-body flex min-h-0 flex-1 flex-col p-2">{children}</div>
      {statusBar !== undefined && (
        <div className="r-bevel-in r-statusbar shrink-0">{statusBar}</div>
      )}
    </section>
  );
}
