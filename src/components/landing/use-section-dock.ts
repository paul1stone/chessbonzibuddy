"use client";

import { useEffect, type RefObject } from "react";
import { loadGsap } from "@/lib/gsap-loader";
import { prefersReducedMotion } from "@/lib/motion";
import { useDockStore, type DockId } from "@/stores/dock-store";

interface SectionDockOptions {
  dockOnExit?: boolean;
  /** Pass the pinning element when the section lives inside a pinned container, so triggers resolve. */
  pinnedContainer?: () => HTMLElement | null;
}

// Docks a taskbar button once the section has scrolled past, and marks it active while the
// section owns the viewport centre. Under reduced motion every button is simply always docked.
export function useSectionDock(id: DockId, ref: RefObject<HTMLElement | null>, opts?: SectionDockOptions) {
  const dockOnExit = opts?.dockOnExit;
  const pinnedContainer = opts?.pinnedContainer;

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
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const pinned = pinnedContainer?.() ?? undefined;
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
        // Chunk load failed: keep the button usable (it still jumps) instead of losing it entirely.
        setDocked(id, true);
      });

    return () => {
      cancelled = true;
      cleanup?.();
      registerTarget(id, null);
    };
  }, [id, ref, dockOnExit, pinnedContainer]);
}
