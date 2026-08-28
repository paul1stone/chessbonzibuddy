"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MENU_ITEMS: { href: string; label: string; external?: boolean }[] = [
  { href: "/app?view=play-bonzi", label: "Play Bonzi Buddy" },
  { href: "/app", label: "Analyze my games" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "https://github.com/paul1stone/chessbonzibuddy", label: "GitHub", external: true },
];

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
      {time ?? " "}
    </time>
  );
}

export function Taskbar() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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
      className="r-face fixed inset-x-0 bottom-0 z-50 flex h-[var(--r-taskbar-h)] items-center gap-1 border-t-2 border-[var(--r-highlight)] px-[2px]"
    >
      <button
        ref={buttonRef}
        type="button"
        className="r-btn h-[22px] min-w-0 gap-1 px-2 font-bold"
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
          className="r-face r-bevel-out absolute bottom-[var(--r-taskbar-h)] left-0 flex w-[220px] p-[3px]"
        >
          {/* Period-accurate Win98 Start-menu sidebar stripe */}
          <div
            className="flex w-[24px] items-end justify-center bg-[var(--r-title-a)] py-2 text-[14px] font-bold text-[var(--r-title-text)] [writing-mode:vertical-rl] rotate-180"
            aria-hidden="true"
          >
            Chess Bonzi Buddy
          </div>
          <ul className="flex-1">
            {MENU_ITEMS.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    className="block px-3 py-[6px] no-underline hover:bg-[var(--r-title-a)] hover:text-[var(--r-title-text)]"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="block px-3 py-[6px] no-underline hover:bg-[var(--r-title-a)] hover:text-[var(--r-title-text)]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="r-bevel-in ml-auto flex h-[22px] items-center px-2">
        <Clock />
      </div>
    </div>
  );
}
