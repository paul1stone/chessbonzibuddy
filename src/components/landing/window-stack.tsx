"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { RetroWindow } from "@/components/retro";
import { useIsMobile } from "@/components/desktop/use-is-mobile";
import { useDrag } from "@/hooks/use-drag";
import { usePrefersReducedMotion } from "@/lib/motion";

export interface StackItem {
  key: string;
  title: string;
  content: ReactNode;
  statusBar?: ReactNode;
}

const CASCADE = 48;

// Win98-style cascade: each window steps 48px right on md+; plain vertical stack below md.
// Cascade and drag offset share one inline `translate`, so a drag can never clobber the
// cascade (and the window cannot jump left on the first pointer move).
export function WindowStack({ items }: { items: StackItem[] }) {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const draggable = !isMobile && !reduced;

  const [zMap, setZMap] = useState<Record<string, number>>({});
  const nextZ = useRef(1);
  const raise = useCallback((key: string) => {
    setZMap((m) => ({ ...m, [key]: nextZ.current++ }));
  }, []);

  return (
    <div className="grid gap-6 md:pr-[96px]">
      {items.map((item, i) => (
        <StackWindow
          key={item.key}
          item={item}
          cascade={isMobile ? 0 : CASCADE * i}
          draggable={draggable}
          z={zMap[item.key]}
          onRaise={raise}
        />
      ))}
    </div>
  );
}

interface StackWindowProps {
  item: StackItem;
  cascade: number;
  draggable: boolean;
  z?: number;
  onRaise: (key: string) => void;
}

function StackWindow({ item, cascade, draggable, z, onRaise }: StackWindowProps) {
  const [pos, setPos] = useState({ dx: 0, dy: 0 });

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

  const x = cascade + pos.dx;

  return (
    <RetroWindow
      title={item.title}
      className="relative w-full md:w-[560px]"
      style={{ translate: x || pos.dy ? `${x}px ${pos.dy}px` : undefined, zIndex: z }}
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
