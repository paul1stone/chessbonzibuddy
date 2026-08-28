import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { RetroWindow } from "./retro-window";

interface RetroDialogProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}

export function RetroDialog({ title, children, actions, className, ref }: RetroDialogProps) {
  return (
    <RetroWindow ref={ref} title={title} className={cn("w-[min(92vw,380px)]", className)}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center bg-[var(--r-title-a)] font-serif text-[22px] font-bold italic text-[var(--r-title-text)]"
        >
          i
        </span>
        <div className="r-body pt-1">{children}</div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
    </RetroWindow>
  );
}
