"use client";

import { useEffect } from "react";
import { loadGsap } from "@/lib/gsap-loader";
import { markBooted, safeSessionStorage } from "./easter/boot-flag";

const BOOT_CLASS = "boot-pending";
// Scroll counts as input: a programmatic scroll (Playwright, an impatient human) would otherwise
// let the boot's final writes land after the hero scrub had already taken the window away.
// The pointer skip is on release, not press: jumping the timeline mid-click resizes the window out
// from under the cursor, and the click then lands on an ancestor instead of the button pressed.
const SKIP_EVENTS = ["pointerup", "keydown", "wheel", "scroll"] as const;

// The boot owns the hero window while it plays, so anything else animating that element waits
// here — a scrub timeline rendering its scroll-0 state would otherwise wipe the zoom mid-flight.
let gate: Promise<void> | null = null;
let openGate = () => {};
let booting = 0;

// Long enough that a slow gsap chunk cannot reintroduce the clobber, short enough that a
// boot wedged before it can release still hands the hero window back.
const GATE_TIMEOUT_MS = 5000;

function holdGate(): Promise<void> {
  if (!gate) gate = new Promise<void>((resolve) => (openGate = resolve));
  return gate;
}

export function whenBootSettled(): Promise<void> {
  const pendingBoot =
    typeof document !== "undefined" && document.documentElement.classList.contains(BOOT_CLASS);
  const held = gate ?? (pendingBoot ? holdGate() : null);
  if (!held) return Promise.resolve();
  return Promise.race([held, new Promise<void>((r) => setTimeout(r, GATE_TIMEOUT_MS))]);
}

// First visit of a session: the taskbar slides up and the hero window zooms open.
// The pre-paint script in the marketing layout owns the gating, so the class is our only signal.
export function BootCascade() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(BOOT_CLASS)) return;

    holdGate();
    booting += 1;

    try {
      markBooted(safeSessionStorage());
    } catch {
      // setItem still throws in some private modes; a throw here would strand the gate.
    }

    let cancelled = false;
    let released = false;
    let cleanup: (() => void) | undefined;

    const release = () => {
      if (released) return;
      released = true;
      booting -= 1;
      queueMicrotask(() => {
        if (booting > 0) return;
        // Last one out: nothing may stay hidden behind a boot that is not going to run.
        root.classList.remove(BOOT_CLASS);
        openGate();
      });
    };

    loadGsap()
      .then(({ gsap }) => {
        // The inline failsafe clears the class after 3s. If it beat us here the page is already
        // showing, and booting now would flash it away and back.
        const stillPending = root.classList.contains(BOOT_CLASS);
        const taskbar = document.querySelector("[data-taskbar]");
        const heroWindow = document.querySelector(".hero-window");
        if (cancelled || !stillPending || !taskbar || !heroWindow) return release();

        gsap.set(taskbar, { yPercent: 100 });
        gsap.set(heroWindow, { autoAlpha: 0, scale: 0.2, transformOrigin: "bottom left" });
        root.classList.remove(BOOT_CLASS);

        const tl = gsap.timeline({ onComplete: () => finish() });
        tl.to(taskbar, { yPercent: 0, duration: 0.2, ease: "steps(4)" });
        tl.to(heroWindow, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "steps(8)" }, 0.2);

        const skip = () => {
          tl.progress(1);
          finish();
        };
        function finish() {
          SKIP_EVENTS.forEach((type) => window.removeEventListener(type, skip));
          release();
        }
        SKIP_EVENTS.forEach((type) => window.addEventListener(type, skip, { passive: true }));

        cleanup = () => {
          finish();
          tl.kill();
        };
      })
      .catch(release);

    return () => {
      cancelled = true;
      cleanup?.();
      release();
    };
  }, []);

  return null;
}
