"use client";

import { useEffect, type RefObject } from "react";
import { whenBootSettled } from "@/components/landing/boot-cascade";
import { loadGsap } from "@/lib/gsap-loader";
import { prefersReducedMotion } from "@/lib/motion";
import { useDockStore } from "@/stores/dock-store";

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  windowRef: RefObject<HTMLElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  progressRef: RefObject<number>;
}

// Scrubs hero progress into a ref (read by the canvas each frame) and choreographs
// the DOM window/dialog. GSAP is dynamically imported so its ~52 KB gzip stays out
// of the initial bundle; reduced-motion visitors never load it at all.
export function useHeroScroll({ sectionRef, windowRef, dialogRef, progressRef }: HeroScrollRefs) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // The boot cascade owns the hero window until it settles; building the scrub timeline
    // first would overwrite its zoom with this timeline's scroll-0 state.
    whenBootSettled()
      .then(loadGsap)
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;

        const section = sectionRef.current;
        const win = windowRef.current;
        const dialog = dialogRef.current;
        if (!section || !win || !dialog) return;

        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          section.classList.add("hero--motion");

          // Viewport-space delta that lands the window's bottom-left on the first taskbar
          // dock slot. The stage is sticky, so a delta measured at refresh holds through the scrub.
          const slotDelta = () => {
            const slots = document.querySelector("[data-dock-slots]");
            const w = win.getBoundingClientRect();
            if (!slots) return { x: -window.innerWidth * 0.42, y: window.innerHeight * 0.42 };
            const s = slots.getBoundingClientRect();
            return { x: s.left + 4 - w.left, y: s.top + 2 - w.bottom };
          };

          const proxy = { p: 0 };
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
              // Re-runs the function-based landing coordinates on refresh/resize.
              invalidateOnRefresh: true,
            },
          });
          // Full-length linear tween: timeline positions equal scroll fractions,
          // and its onUpdate publishes smoothed progress to the canvas.
          tl.to(
            proxy,
            {
              p: 1,
              duration: 1,
              ease: "none",
              onUpdate: () => {
                progressRef.current = proxy.p;
              },
            },
            0
          );
          tl.fromTo(
            win,
            { scale: 1, autoAlpha: 1, x: 0, y: 0 },
            {
              scale: 0.15,
              autoAlpha: 0,
              x: () => slotDelta().x,
              y: () => slotDelta().y,
              ease: "power2.in",
              duration: 0.3,
            },
            0.05
          );
          tl.fromTo(
            dialog,
            { xPercent: -50, yPercent: -50, autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.08 },
            0.9
          );

          // The button pops in exactly where and when the window died: the minimize tween ends
          // at timeline 0.35 of a 200vh scrub, i.e. 70vh past the section top.
          const dockTrigger = ScrollTrigger.create({
            trigger: section,
            start: "top top-=70%",
            onEnter: () => useDockStore.getState().setDocked("hero", true),
            onLeaveBack: () => useDockStore.getState().setDocked("hero", false),
          });

          // `hero--motion` grew the section to 300vh, so triggers measured before this
          // (section dock, cascade) hold stale bounds. Deferred: a forced refresh reverts pins mid-scroll.
          ScrollTrigger.refresh(true);

          return () => {
            dockTrigger.kill();
            useDockStore.getState().setDocked("hero", false);
            tl.scrollTrigger?.kill();
            tl.kill();
            section.classList.remove("hero--motion");
            progressRef.current = 0;
          };
        });

        cleanup = () => mm.revert();
      })
      .catch(() => {
        // Chunk load failed (deploy skew, flaky network): no choreography, but the
        // dialog must not stay CSS-hidden forever — return it to normal flow.
        const dialog = dialogRef.current;
        if (dialog) {
          dialog.style.visibility = "visible";
          dialog.style.opacity = "1";
        }
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sectionRef, windowRef, dialogRef, progressRef]);
}
