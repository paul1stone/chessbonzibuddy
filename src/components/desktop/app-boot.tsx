"use client";

import { useEffect } from "react";
import { markBooted, safeSessionStorage, shouldBoot } from "@/components/landing/easter/boot-flag";
import { prefersReducedMotion } from "@/lib/motion";

const APP_BOOT_FLAG = "cbb-app-booted";
const MOBILE_QUERY = "(max-width: 767px)";

// Skip on release, never on press: a down-skip moves elements mid-click, and the click then
// lands on an ancestor instead of the icon that was pressed. Capture phase so a scroll inside a
// window (scroll does not bubble) and a keydown swallowed by xterm still count as input.
const SKIP_EVENTS = ["pointerup", "keydown", "wheel", "scroll"] as const;
const CAPTURE = { capture: true } as const;

const ICON_START_MS = 100;
const ICON_STAGGER_MS = 60;
// Matches the .boot-pop keyframes.
const ICON_ANIM_MS = 180;

// One boot per session, and a module guard so StrictMode's second effect does not restart it.
let ran = false;

// First visit of a session: the taskbar slides up and the icons pop in, staggered. Both
// animations are additive - the elements are visible by default, so nothing is gated on JS.
export function AppBoot() {
  useEffect(() => {
    // Read the query live: useIsMobile's SSR snapshot says desktop and corrects only after this.
    if (ran || prefersReducedMotion() || window.matchMedia(MOBILE_QUERY).matches) return;
    if (!shouldBoot(safeSessionStorage(), APP_BOOT_FLAG)) return;
    ran = true;

    const taskbar = document.querySelector<HTMLElement>("[data-taskbar]");
    const icons = [...document.querySelectorAll<HTMLElement>("[data-desktop-icon]")];

    taskbar?.classList.add("taskbar-boot");
    icons.forEach((icon, i) => {
      icon.style.animationDelay = `${ICON_START_MS + i * ICON_STAGGER_MS}ms`;
      icon.classList.add("boot-pop");
    });

    let done = false;

    // Removing the classes snaps to the natural state, so this doubles as the fast-forward.
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const type of SKIP_EVENTS) window.removeEventListener(type, finish, CAPTURE);
      taskbar?.classList.remove("taskbar-boot");
      for (const icon of icons) {
        icon.classList.remove("boot-pop");
        // The filled animation would otherwise keep overriding the drag transform.
        icon.style.removeProperty("animation-delay");
      }
      try {
        markBooted(safeSessionStorage(), APP_BOOT_FLAG);
      } catch {
        // setItem still throws in some private modes; the boot is already over.
      }
    };

    const total = ICON_START_MS + Math.max(0, icons.length - 1) * ICON_STAGGER_MS + ICON_ANIM_MS;
    const timer = setTimeout(finish, total);
    for (const type of SKIP_EVENTS) window.addEventListener(type, finish, { passive: true, ...CAPTURE });

    // No cleanup on purpose: finish() always runs within `total` and drops its own listeners,
    // while tearing down here would cancel the boot on StrictMode's remount.
  }, []);

  return null;
}
