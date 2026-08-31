"use client";

import { useEffect, useRef, type RefObject } from "react";
import { loadGsap } from "@/lib/gsap-loader";
import { prefersReducedMotion } from "@/lib/motion";
import { useDockStore, type DockId } from "@/stores/dock-store";

interface SectionDockOptions {
  dockOnExit?: boolean;
  /** Pass the pinning element when the section lives inside a pinned container, so triggers resolve. */
  pinnedContainer?: () => HTMLElement | null;
  /** Media query where an external driver owns this id's docked/active state (the cascade scrub). */
  managedQuery?: string;
}

// matchMedia needs a query for the "nobody else owns this" case; "not all" never matches.
const NEVER = "not all";

// Docks a taskbar button once the section has scrolled past, and marks it active while the
// section owns the viewport centre. Under reduced motion every button is simply always docked.
export function useSectionDock(id: DockId, ref: RefObject<HTMLElement | null>, opts?: SectionDockOptions) {
  const dockOnExit = opts?.dockOnExit;
  const managedQuery = opts?.managedQuery;
  // Read opts through a ref: an inline pinnedContainer arrow would otherwise rebuild the triggers every render.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const { registerTarget, setDocked, setActive } = useDockStore.getState();
    registerTarget(id, ref.current);

    if (prefersReducedMotion()) {
      setDocked(id, true);
      return () => registerTarget(id, null);
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;
        const el = ref.current;
        if (!el) return;

        const mm = gsap.matchMedia();
        mm.add({ motion: "(prefers-reduced-motion: no-preference)", managed: managedQuery ?? NEVER }, (ctx) => {
          // Geometry can't speak for a pinned section: its windows hold fixed viewport positions,
          // so while the cascade scrub owns this id we create no triggers at all.
          if (!ctx.conditions?.motion || ctx.conditions.managed) return;

          const pinned = optsRef.current?.pinnedContainer?.() ?? undefined;
          const triggers: ReturnType<typeof ScrollTrigger.create>[] = [];

          if (dockOnExit !== false) {
            triggers.push(
              ScrollTrigger.create({
                trigger: el,
                start: "bottom top",
                pinnedContainer: pinned,
                onEnter: () => setDocked(id, true),
                onLeaveBack: () => setDocked(id, false),
              })
            );
          }

          triggers.push(
            ScrollTrigger.create({
              trigger: el,
              start: "top center",
              end: "bottom center",
              pinnedContainer: pinned,
              onToggle: (self) => {
                if (self.isActive) setActive(id);
                else if (useDockStore.getState().active === id) setActive(null);
              },
            })
          );

          return () => triggers.forEach((t) => t.kill());
        });

        cleanup = () => mm.revert();
      })
      .catch(() => {
        if (cancelled) return;
        // Chunk load failed: keep the button usable (it still jumps) instead of losing it entirely.
        setDocked(id, true);
      });

    return () => {
      cancelled = true;
      cleanup?.();
      registerTarget(id, null);
    };
  }, [id, ref, dockOnExit, managedQuery]);
}
