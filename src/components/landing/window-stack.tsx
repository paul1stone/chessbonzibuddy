"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { RetroWindow } from "@/components/retro";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/components/desktop/use-is-mobile";
import { useDrag } from "@/hooks/use-drag";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { DockId } from "@/stores/dock-store";
import { useSectionDock } from "./use-section-dock";

export interface StackItem {
  /** Also the dock id: every stack window registers a taskbar button. */
  key: DockId;
  title: string;
  content: ReactNode;
  statusBar?: ReactNode;
  /** lg+ grid placement classes (12-column desktop composition). */
  place?: string;
  /** lg+ base offset, a deliberate zigzag so title bars are not ruler-aligned. */
  offset?: { x: number; y: number };
}

// Base offsets are pure CSS (custom properties set per breakpoint by these static
// classes), so the prerendered HTML is correct at EVERY viewport — a JS media-query
// snapshot here caused pre-hydration mobile overflow. JS contributes only drag deltas.
const STACK_POS =
  "md:[--stack-x:calc(48px*var(--i))] lg:[--stack-x:var(--lgx,0px)] lg:[--stack-y:var(--lgy,0px)]";

// Win98-style cascade: each window steps 48px right on md+; plain vertical stack below md.
// Cascade and drag offset share one inline `translate`, so a drag can never clobber the
// cascade (and the window cannot jump left on the first pointer move).
interface WindowStackProps {
  items: StackItem[];
  /** Media query where a scrub owns docked/active for these windows (see use-cascade-scroll). */
  managedQuery?: string;
}

export function WindowStack({ items, managedQuery }: WindowStackProps) {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const draggable = !isMobile && !reduced;

  const [zMap, setZMap] = useState<Record<string, number>>({});
  const nextZ = useRef(1);
  const raise = useCallback((key: string) => {
    const z = ++nextZ.current;
    setZMap((m) => ({ ...m, [key]: z }));
  }, []);

  return (
    // 12 columns at lg+ so windows can step across the full width a column at a time
    // instead of stacking into a pair of half-page columns.
    <div className="grid gap-6 md:pr-[96px] lg:grid-cols-12 lg:gap-x-6 lg:gap-y-3 lg:pr-0">
      {items.map((item, i) => (
        <StackWindow
          key={item.key}
          item={item}
          index={i}
          draggable={draggable}
          z={zMap[item.key]}
          onRaise={raise}
          managedQuery={managedQuery}
        />
      ))}
    </div>
  );
}

interface StackWindowProps {
  item: StackItem;
  index: number;
  draggable: boolean;
  z?: number;
  onRaise: (key: string) => void;
  managedQuery?: string;
}

function StackWindow({ item, index, draggable, z, onRaise, managedQuery }: StackWindowProps) {
  const [pos, setPos] = useState({ dx: 0, dy: 0 });
  const winRef = useRef<HTMLElement>(null);

  // Inside the pinned cascade the scrub owns docked/active, so geometry triggers are
  // suppressed for exactly that media query.
  useSectionDock(item.key, winRef, { managedQuery });

  const onMove = useCallback((dx: number, dy: number) => {
    setPos((p) => ({ dx: p.dx + dx, dy: p.dy + dy }));
  }, []);
  const { onPointerDown } = useDrag({ onMove, disabled: !draggable });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggable) onRaise(item.key);
      onPointerDown(e);
    },
    [draggable, onRaise, item.key, onPointerDown]
  );

  return (
    <RetroWindow
      ref={winRef}
      containerProps={{ "data-stack-key": item.key }}
      title={item.title}
      className={cn("relative w-full md:w-[560px] lg:w-full lg:max-w-[560px]", STACK_POS, item.place)}
      style={{
        "--i": index,
        "--lgx": `${item.offset?.x ?? 0}px`,
        "--lgy": `${item.offset?.y ?? 0}px`,
        translate: `calc(var(--stack-x, 0px) + ${pos.dx}px) calc(var(--stack-y, 0px) + ${pos.dy}px)`,
        zIndex: z,
      } as React.CSSProperties}
      statusBar={item.statusBar}
      titleBarProps={{
        onPointerDown: handlePointerDown,
        className: draggable ? "cursor-default touch-none" : undefined,
      }}
    >
      {item.content}
    </RetroWindow>
  );
}
