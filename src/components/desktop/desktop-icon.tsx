"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DesktopIconProps {
  label: string;
  icon: ReactNode;
  onOpen: () => void;
}

export function DesktopIcon({ label, icon, onOpen }: DesktopIconProps) {
  const [selected, setSelected] = useState(false);

  return (
    <button
      type="button"
      className="flex w-[76px] flex-col items-center gap-1 p-1 focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-[var(--r-highlight)]"
      onClick={() => setSelected(true)}
      onBlur={() => setSelected(false)}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onOpen(); }
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span
        className={cn(
          "max-w-full px-[2px] text-center text-[11px] leading-tight text-[var(--r-title-text)] [text-shadow:1px_1px_0_var(--r-dark)]",
          selected && "bg-[var(--r-title-a)] [text-shadow:none]"
        )}
      >
        {label}
      </span>
    </button>
  );
}
