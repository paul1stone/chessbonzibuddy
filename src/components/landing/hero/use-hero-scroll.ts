"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  windowRef: RefObject<HTMLElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  progressRef: RefObject<number>;
}

// Scrubs hero progress into a ref (read by the canvas each frame) and choreographs the DOM window/dialog.
export function useHeroScroll({ sectionRef, windowRef, dialogRef, progressRef }: HeroScrollRefs) {
  useGSAP(
    () => {
      const section = sectionRef.current;
      const win = windowRef.current;
      const dialog = dialogRef.current;
      if (!section || !win || !dialog) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        section.classList.add("hero--motion");

        const proxy = { p: 0 };
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
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
            x: () => -window.innerWidth * 0.42,
            y: () => window.innerHeight * 0.42,
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

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          section.classList.remove("hero--motion");
          progressRef.current = 0;
        };
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );
}
