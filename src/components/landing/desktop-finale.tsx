"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RetroButton } from "@/components/retro";
import { ICON_LABELS, WINDOW_ICONS } from "@/components/desktop/icons";
import { VIEW_PARAM_WINDOWS } from "@/components/desktop/view-params";
import { prefersReducedMotion } from "@/lib/motion";
import { DESKTOP_ICON_IDS } from "@/stores/desktop-store";
import { useDockStore } from "@/stores/dock-store";
import { markBooted, safeSessionStorage, shouldBoot } from "./easter/boot-flag";

const FinaleInner = dynamic(() => import("./desktop-finale-inner"), { ssr: false });

// The section is one viewport of desktop, so "arrived" means all but a sliver of it is on screen.
const ARRIVED_RATIO = 0.9;
// Far enough ahead that the chunk is on disk before the walkthrough's pin lets go.
const PREFETCH_MARGIN = "150%";
// The chunk can still be resolving when the section latches; past this it never will.
const ICONS_DEADLINE_MS = 5000;

const APP_BOOT_FLAG = "cbb-app-booted";
const MOBILE_QUERY = "(max-width: 767px)";
// AppBoot's stagger, to the millisecond: arriving here and opening /app are the same boot.
const ICON_START_MS = 100;
const ICON_STAGGER_MS = 60;
const ICON_ANIM_MS = 180;

// One boot per session, module-scoped so StrictMode's second effect can't restart it.
let booted = false;

/** `/app?view=<param>` per icon, inverted from the whitelist ViewParamSync opens windows by. */
const VIEW_PARAM_FOR = Object.fromEntries(
  Object.entries(VIEW_PARAM_WINDOWS).map(([param, id]) => [id, param])
) as Record<string, string>;

/**
 * Plays the icon stagger and writes the shared session flag when it lands, so a visitor who
 * arrived here doesn't watch /app boot all over again. Returns its own canceller.
 */
function playBootStagger(root: HTMLElement): () => void {
  const deadline = performance.now() + ICONS_DEADLINE_MS;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let icons: HTMLElement[] = [];

  const finish = () => {
    for (const icon of icons) {
      icon.classList.remove("boot-pop");
      // The animation fills forwards; its parked transform would fight icon drags.
      icon.style.removeProperty("animation-delay");
    }
    try {
      markBooted(safeSessionStorage(), APP_BOOT_FLAG);
    } catch {
      // setItem still throws in some private modes; the boot is already over.
    }
  };

  const start = () => {
    icons = [...root.querySelectorAll<HTMLElement>("[data-desktop-icon]")];
    if (icons.length === 0) {
      if (performance.now() < deadline) frame = requestAnimationFrame(start);
      return;
    }
    booted = true;
    icons.forEach((icon, i) => {
      icon.style.animationDelay = `${ICON_START_MS + i * ICON_STAGGER_MS}ms`;
      icon.classList.add("boot-pop");
    });
    timer = setTimeout(finish, ICON_START_MS + (icons.length - 1) * ICON_STAGGER_MS + ICON_ANIM_MS);
  };

  frame = requestAnimationFrame(start);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

/**
 * The landing's scroll ends at the machine itself. Above md the section lazy-mounts the real
 * desktop and the marketing taskbar hands over to it once the section fills the viewport;
 * below md it is a tap grid into `/app`, where the mobile desktop actually lives.
 */
export function DesktopFinale() {
  return (
    // `app` alongside `retro` is load-bearing: retro-app.css scopes the token mapping and
    // .r-body sizing under `.retro.app`, and without it the windows come out in marketing type.
    <section className="desktop-finale retro app" data-finale aria-label="Desktop">
      <FinaleDesktop />
      <FinaleGrid />
    </section>
  );
}

function FinaleDesktop() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [arrived, setArrived] = useState(false);

  // Its own observer, and much the earliest: the chunk should be fetched long before it is
  // parsed, because parsing recharts mid-scrub janks the walkthrough it is parked over.
  // Armed only once the visitor is a viewport in, though — the pins add three viewports after
  // first paint, so an observer created at mount sees the finale as near and fetches this
  // against the hero.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;

    const arm = () => {
      if (io || window.scrollY < window.innerHeight) return;
      window.removeEventListener("scroll", arm);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          void import("./desktop-finale-inner");
        },
        { rootMargin: PREFETCH_MARGIN }
      );
      observer.observe(el);
      io = observer;
    };

    arm();
    window.addEventListener("scroll", arm, { passive: true });
    return () => {
      window.removeEventListener("scroll", arm);
      io?.disconnect();
    };
  }, []);

  // Mount, then arrive. The walkthrough is pinned directly above, so the section cannot enter
  // the viewport until that pin releases — first intersection IS the release.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { setDesktopActive } = useDockStore.getState();
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
        const active = entry.intersectionRatio >= ARRIVED_RATIO;
        setDesktopActive(active);
        if (active) setArrived(true);
      },
      { threshold: [0, ARRIVED_RATIO, 1] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // dock-store is module-global and survives client-side nav: without this the taskbar
      // handoff would follow the visitor to /privacy and /terms.
      setDesktopActive(false);
    };
  }, []);

  // First arrival of a session pops the icons in, exactly as the machine boots at /app.
  useEffect(() => {
    if (!arrived || booted) return;
    if (prefersReducedMotion() || window.matchMedia(MOBILE_QUERY).matches) return;
    if (!shouldBoot(safeSessionStorage(), APP_BOOT_FLAG)) return;
    const root = ref.current;
    if (!root) return;
    return playBootStagger(root);
  }, [arrived]);

  return (
    <div
      ref={ref}
      // Hidden below md is also what keeps the chunk off phones: a display:none target never
      // intersects, so neither latch above ever fires there.
      className="absolute inset-0 hidden md:block"
      // Until the section fills the viewport, its overlays' fixed coordinates are off by the
      // scroll offset — and a tab press would land inside a desktop nobody can see yet.
      inert={!arrived}
    >
      {mounted && <FinaleInner />}
    </div>
  );
}

/** No windows on a phone: the icons are links, and the desktop they open is the real one. */
function FinaleGrid() {
  return (
    <div className="absolute inset-0 flex flex-col md:hidden">
      <nav aria-label="Desktop shortcuts" className="icon-grid-mobile">
        {DESKTOP_ICON_IDS.map((id) => (
          <Link
            key={id}
            href={`/app?view=${VIEW_PARAM_FOR[id]}`}
            data-finale-icon={id}
            className="flex select-none flex-col items-center gap-1 p-1"
            // retro.css is unlayered, so its link underline beats a Tailwind utility. These
            // are desktop icons, not prose links.
            style={{ textDecoration: "none" }}
          >
            <span className="icon-art" aria-hidden="true">
              {WINDOW_ICONS[id]}
            </span>
            <span className="icon-label max-w-full px-[2px] text-center text-[11px] leading-tight text-[var(--r-title-text)] [text-shadow:1px_1px_0_var(--r-dark)]">
              {ICON_LABELS[id]}
            </span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-6 text-center">
        <p className="mb-3 text-[12px] text-[var(--r-title-text)] [text-shadow:1px_1px_0_var(--r-dark)]">
          Everything you just saw, on a desktop of your own.
        </p>
        <RetroButton href="/app?view=play-bonzi" variant="default" size="lg">
          Play Bonzi Buddy
        </RetroButton>
      </div>
    </div>
  );
}
