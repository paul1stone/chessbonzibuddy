"use client";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { RetroButton } from "@/components/retro";
import { prefersReducedMotion } from "@/lib/motion";
import { createVM, type TerminalVM } from "@/lib/terminal/create-vm";

// v86 reports a missing asset by logging and giving up, so nothing ever rejects.
// A boot that goes this long without a single serial byte is dead, not slow.
const BOOT_SILENCE_MS = 60_000;

// A restored session answers the newline create-vm sends it almost immediately. Silence
// this long means the snapshot resumed into something wedged, so start over cold.
const RESTORE_ECHO_MS = 5_000;

const BOOT_NOTICE = {
  unknown: "Starting MS-DOS\u2026",
  restored: "Resuming MS-DOS\u2026",
  cold: "Starting MS-DOS\u2026 (fine, it's Linux \u2014 15-30s)",
} as const;

export default function TerminalWindowInner() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"booting" | "ready" | "error">("booting");
  const [mode, setMode] = useState<keyof typeof BOOT_NOTICE>("unknown");
  const [attempt, setAttempt] = useState(0);
  const [skipRestore, setSkipRestore] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      theme: { background: "#000000", foreground: "#c0c0c0", cursor: "#c0c0c0" },
      fontFamily: '"Courier New", monospace',
      fontSize: 14,
      cursorBlink: !prefersReducedMotion(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    // A minimized window is display:none, so the host measures 0x0 and fit() would throw.
    const refit = () => {
      if (host.offsetWidth > 0 && host.offsetHeight > 0) fit.fit();
    };
    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(host);

    let vm: TerminalVM | null = null;
    let cancelled = false;
    let stopOutput: (() => void) | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let echo: ReturnType<typeof setTimeout> | undefined;

    // Re-armed on every chunk while booting, so a slow-but-progressing boot is safe.
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => setPhase((p) => (p === "booting" ? "error" : p)), BOOT_SILENCE_MS);
    };
    armWatchdog();

    const abort = new AbortController();
    const input = term.onData((data) => vm?.send(data));

    createVM({ signal: abort.signal, attempt, skipRestore })
      .then((created) => {
        // StrictMode (and a fast close) can unmount before the VM resolves.
        if (cancelled) {
          created.destroy().catch(() => {});
          return;
        }
        vm = created;
        const decoder = new TextDecoder();
        // The boot notice clears when the prompt shows up; keep a tail so a
        // frame boundary can't split "C:\>" across two chunks.
        let tail: string | null = "";
        stopOutput = created.onOutput((chunk) => {
          term.write(chunk);
          if (tail === null) return;
          armWatchdog();
          tail = (tail + decoder.decode(chunk, { stream: true })).slice(-16);
          if (tail.includes("C:\\>")) {
            tail = null;
            clearTimeout(watchdog);
            clearTimeout(echo);
            setPhase("ready");
          }
        });
        created.restored.then((wasRestored) => {
          if (cancelled) return;
          setMode(wasRestored ? "restored" : "cold");
          // tail is nulled the moment the prompt lands, so a session already at C:\> is fine.
          if (!wasRestored || tail === null) return;
          echo = setTimeout(() => {
            console.warn("Restored terminal session never echoed, cold booting instead.");
            setMode("unknown");
            setSkipRestore(true);
            setAttempt((n) => n + 1);
          }, RESTORE_ECHO_MS);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Terminal VM failed to start:", err);
        setPhase("error");
      });

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(watchdog);
      clearTimeout(echo);
      input.dispose();
      stopOutput?.();
      observer.disconnect();
      vm?.destroy().catch(() => {});
      vm = null;
      term.dispose();
    };
  }, [attempt, skipRestore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div
        ref={hostRef}
        data-testid="terminal-xterm"
        className="r-bevel-in min-h-0 flex-1 overflow-hidden bg-black p-1"
      />
      {phase === "booting" && (
        <p data-testid="terminal-boot-notice" className="shrink-0 text-xs">
          {BOOT_NOTICE[mode]}
        </p>
      )}
      {phase === "error" && (
        <div className="r-paper r-bevel-in flex shrink-0 items-center gap-2 p-2 text-xs">
          <span className="flex-1">BONZI.SYS: A fatal exception 0E has occurred.</span>
          <RetroButton
            onClick={() => {
              setPhase("booting");
              setMode("unknown");
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </RetroButton>
        </div>
      )}
    </div>
  );
}
