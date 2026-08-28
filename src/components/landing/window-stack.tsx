import type { CSSProperties, ReactNode } from "react";
import { RetroWindow } from "@/components/retro";

export interface StackItem {
  key: string;
  title: string;
  content: ReactNode;
}

// Win98-style cascade: each window steps 48px right on md+; plain vertical stack below md.
export function WindowStack({ items }: { items: StackItem[] }) {
  return (
    <div className="grid gap-6 md:pr-[96px]">
      {items.map((item, i) => {
        const style = { "--depth": i } as CSSProperties;
        return (
          <RetroWindow
            key={item.key}
            title={item.title}
            className="w-full md:w-[560px] md:translate-x-[calc(48px*var(--depth))]"
            style={style}
          >
            {item.content}
          </RetroWindow>
        );
      })}
    </div>
  );
}
