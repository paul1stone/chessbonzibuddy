"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

export interface TaskbarMenuItem {
  href?: string;
  label: string;
  external?: boolean;
  onSelect?: () => void;
  /** Rendered in a fixed 16px slot ahead of the label, Win98-style. */
  icon?: ReactNode;
}

export const DEFAULT_MENU_ITEMS: TaskbarMenuItem[] = [
  { href: "/app?view=play-bonzi", label: "Play Bonzi Buddy" },
  { href: "/app", label: "Analyze my games" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "https://github.com/paul1stone/chessbonzibuddy", label: "GitHub", external: true },
];

// Stacked items grow their own box on a finger rather than wearing .hit-44: a 44px overlay on a
// 27px item reaches into its neighbour, so the bottom third of every row opened the NEXT one.
const MENU_ITEM_CLASS =
  "flex items-center gap-2 px-3 py-[6px] no-underline pointer-coarse:min-h-[44px] pointer-coarse:py-2 hover:bg-[var(--r-title-a)] hover:text-[var(--r-title-text)]";

/**
 * The slot appears for every item of a menu that has any icons at all, so one iconless entry
 * can't break the label column — and menus with no icons keep their old flush layout.
 */
function MenuItemIcon({ icon, reserve }: { icon?: ReactNode; reserve: boolean }) {
  if (!reserve) return null;
  return (
    <span className="h-4 w-4 shrink-0 [&>*]:h-4 [&>*]:w-4" aria-hidden="true">
      {icon}
    </span>
  );
}

function Clock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className="tabular-nums" suppressHydrationWarning>
      {time ?? " "}
    </time>
  );
}

export function Taskbar({
  menuItems = DEFAULT_MENU_ITEMS,
  children,
  onBarContextMenu,
}: {
  menuItems?: TaskbarMenuItem[];
  children?: ReactNode;
  onBarContextMenu?: (e: ReactMouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reserveIcons = menuItems.some((item) => item.icon);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-taskbar
      className="r-face fixed inset-x-0 bottom-0 z-50 flex h-[var(--r-taskbar-h)] items-center gap-1 border-t-2 border-[var(--r-highlight)] px-[2px]"
      onContextMenu={onBarContextMenu}
    >
      <button
        ref={buttonRef}
        type="button"
        className="r-btn hit-44 h-[22px] min-w-0 gap-1 px-2 font-bold"
        aria-expanded={open}
        aria-controls="start-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bonzi/idle-still.png" alt="" width={16} height={16} />
        Start
      </button>

      {open && (
        <nav
          id="start-menu"
          aria-label="Start menu"
          className="start-menu--in r-face r-bevel-out absolute bottom-[var(--r-taskbar-h)] left-0 flex w-[220px] p-[3px]"
        >
          {/* Period-accurate Win98 Start-menu sidebar stripe */}
          <div
            className="flex w-[24px] items-end justify-center bg-[var(--r-title-a)] py-2 text-[14px] font-bold text-[var(--r-title-text)] [writing-mode:vertical-rl] rotate-180"
            aria-hidden="true"
          >
            Chess Bonzi Buddy
          </div>
          <ul className="flex-1">
            {menuItems.map((item) => (
              <li key={item.label}>
                {item.onSelect ? (
                  <button
                    type="button"
                    className={`${MENU_ITEM_CLASS} w-full text-left`}
                    onClick={() => {
                      item.onSelect!();
                      setOpen(false);
                    }}
                  >
                    <MenuItemIcon icon={item.icon} reserve={reserveIcons} />
                    {item.label}
                  </button>
                ) : item.external ? (
                  <a
                    href={item.href}
                    className={MENU_ITEM_CLASS}
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    <MenuItemIcon icon={item.icon} reserve={reserveIcons} />
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href ?? "#"}
                    className={MENU_ITEM_CLASS}
                    onClick={() => setOpen(false)}
                  >
                    <MenuItemIcon icon={item.icon} reserve={reserveIcons} />
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex min-w-0 flex-1 gap-1 overflow-hidden px-1">{children}</div>

      <div className="r-bevel-in flex h-[22px] items-center px-2">
        <Clock />
      </div>
    </div>
  );
}
