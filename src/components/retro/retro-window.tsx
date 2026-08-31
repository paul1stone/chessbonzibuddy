import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface RetroWindowProps {
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  statusBar?: ReactNode;
  ref?: Ref<HTMLElement>;
  id?: string;
  "aria-labelledby"?: string;
  titleBarProps?: HTMLAttributes<HTMLDivElement>;
}

export function RetroWindow({
  title,
  children,
  className,
  style,
  statusBar,
  ref,
  id,
  "aria-labelledby": labelledBy,
  titleBarProps,
}: RetroWindowProps) {
  return (
    <section
      ref={ref}
      id={id}
      style={style}
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      className={cn("r-face r-bevel-out p-[3px]", className)}
    >
      <div {...titleBarProps} className={cn("r-title", titleBarProps?.className)}>
        <span className="truncate">{title}</span>
        <span className="ml-auto flex gap-[2px]" aria-hidden="true">
          <span className="r-title-glyph">_</span>
          <span className="r-title-glyph">□</span>
          <span className="r-title-glyph">×</span>
        </span>
      </div>
      <div className="p-3">{children}</div>
      {statusBar !== undefined && (
        <div className="r-bevel-in mx-[1px] mb-[1px] px-2 py-[3px] text-[11px]">{statusBar}</div>
      )}
    </section>
  );
}
