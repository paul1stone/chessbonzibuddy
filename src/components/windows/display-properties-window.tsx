"use client";

import { useState } from "react";
import { RetroButton, RetroPanel } from "@/components/retro";
import { cn } from "@/lib/utils";
import {
  DESKTOP_PATTERNS,
  desktopBackgroundStyle,
  useDesktopStore,
  WIN98_COLORS,
  type DesktopAppearance,
} from "@/stores/desktop-store";
import { useWindowStore } from "@/stores/window-store";

// Win98's Display Properties, Background tab. The draft lives here and only reaches the
// desktop store on Apply/OK, so Cancel discards whatever has not been applied yet.
export default function DisplayPropertiesWindow() {
  const [draft, setDraft] = useState<DesktopAppearance>(() => useDesktopStore.getState().appearance);

  const apply = () => useDesktopStore.getState().setAppearance(draft);
  const close = () => useWindowStore.getState().close("display");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* preview monitor */}
      <div className="flex shrink-0 flex-col items-center">
        <div className="r-face r-bevel-out p-[6px]">
          <div className="r-bevel-in h-[92px] w-[124px]" style={desktopBackgroundStyle(draft)} />
        </div>
        <div className="r-face r-bevel-out h-[6px] w-[28px]" />
        <div className="r-face r-bevel-out h-[5px] w-[64px]" />
      </div>

      <RetroPanel caption="Color" className="shrink-0">
        <div className="flex flex-wrap gap-[6px]">
          {WIN98_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.name}
              aria-pressed={draft.color === c.value}
              className={cn(
                "h-[26px] w-[26px] shrink-0",
                draft.color === c.value ? "r-bevel-in" : "r-bevel-out"
              )}
              style={{ backgroundColor: c.value }}
              onClick={() => setDraft((d) => ({ ...d, color: c.value }))}
            />
          ))}
        </div>
      </RetroPanel>

      <RetroPanel caption="Pattern" className="shrink-0">
        <div className="r-paper r-bevel-in flex flex-col p-[2px]" role="listbox" aria-label="Pattern">
          {DESKTOP_PATTERNS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="option"
              aria-selected={draft.pattern === p.value}
              className={cn(
                "px-1 py-[2px] text-left text-[11px]",
                draft.pattern === p.value && "bg-[var(--r-title-a)] text-[var(--r-title-text)]"
              )}
              onClick={() => setDraft((d) => ({ ...d, pattern: p.value }))}
            >
              {p.name}
            </button>
          ))}
        </div>
      </RetroPanel>

      <div className="mt-auto flex shrink-0 justify-end gap-2 pt-1">
        <RetroButton
          variant="default"
          onClick={() => {
            apply();
            close();
          }}
        >
          OK
        </RetroButton>
        <RetroButton onClick={close}>Cancel</RetroButton>
        <RetroButton onClick={apply}>Apply</RetroButton>
      </div>
    </div>
  );
}
