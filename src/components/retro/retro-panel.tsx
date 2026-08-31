import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RetroPanelProps {
  caption?: string;
  children: ReactNode;
  className?: string;
}

export function RetroPanel({ caption, children, className }: RetroPanelProps) {
  return (
    <fieldset
      className={cn(
        "border border-[var(--r-shadow)] p-3 [border-style:groove] [border-width:2px]",
        className
      )}
    >
      {caption && <legend className="r-group-caption">{caption}</legend>}
      {children}
    </fieldset>
  );
}
