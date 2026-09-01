"use client";

import { useEffect, type RefObject } from "react";
import { loadGsap } from "@/lib/gsap-loader";
import { prefersReducedMotion } from "@/lib/motion";
import { useDockStore, type DockId } from "@/stores/dock-store";
import { CASCADE_KEYS, OUTLINE_STEPS, SEGMENTS, outlineRect, segmentPhase, type Rect } from "./cascade-timeline";

type CascadeKey = (typeof CASCADE_KEYS)[number];

const isCascadeKey = (id: DockId | null): id is CascadeKey =>
  id !== null && (CASCADE_KEYS as readonly string[]).includes(id);

export const CASCADE_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
// The outline grows out of a taskbar-button-sized stub, not the whole slot strip.
const SLOT_W = 120;
const SLOT_H = 22;

// Pins the walkthrough and scrubs the three windows open in sequence, each announced by a
// stepped Win98 zoom outline flying up from the taskbar. Below lg, under reduced motion, or
// if GSAP fails to load, nothing is armed and the static layout stands.
export function useCascadeScroll(sectionRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;

        const section = sectionRef.current;
        // Outlines hang off .retro: the --r-* tokens are scoped there, and the pinned section
        // is a transformed ancestor that would hijack their position: fixed.
        const host = section?.closest<HTMLElement>(".retro");
        if (!section || !host) return;

        const mm = gsap.matchMedia();
        mm.add(CASCADE_QUERY, () => {
          const { registerScrollFn, setActive, setDocked } = useDockStore.getState();
          section.classList.add("cascade--armed");

          const windows = new Map<CascadeKey, HTMLElement>();
          const outlines = new Map<CascadeKey, HTMLElement>();
          const targets = new Map<CascadeKey, Rect>();
          const drawn = new Map<CascadeKey, { step: number | null; open: boolean }>();
          let active: CascadeKey | null = null;

          // Measured once per refresh, never per frame: the section is pinned, so its layout is
          // static for the whole scrub. Window rects are stored relative to the section top,
          // which is where the viewport top sits while pinned.
          const measure = () => {
            const sec = section.getBoundingClientRect();
            for (const key of CASCADE_KEYS) {
              const el = section.querySelector<HTMLElement>(`[data-stack-key="${key}"]`);
              if (!el) continue;
              windows.set(key, el);
              const r = el.getBoundingClientRect();
              targets.set(key, { x: r.left, y: r.top - sec.top, w: r.width, h: r.height });
            }
            drawn.clear();
          };

          // Read when a step is actually drawn (~8 reads per window), not cached at refresh: an
          // early refresh can land mid boot-cascade while the taskbar is still sliding up.
          const slotStub = (): Rect => {
            const s = document.querySelector("[data-dock-slots]")?.getBoundingClientRect();
            return s
              ? { x: s.left + 4, y: s.top + 2, w: SLOT_W, h: SLOT_H }
              : { x: 4, y: window.innerHeight - SLOT_H - 4, w: SLOT_W, h: SLOT_H };
          };

          const draw = (key: CascadeKey, r: Rect) => {
            let el = outlines.get(key);
            if (!el) {
              el = document.createElement("div");
              el.className = "cascade-outline";
              el.setAttribute("aria-hidden", "true");
              host.appendChild(el);
              outlines.set(key, el);
            }
            el.style.display = "block";
            el.style.left = `${r.x}px`;
            el.style.top = `${r.y}px`;
            el.style.width = `${r.w}px`;
            el.style.height = `${r.h}px`;
          };

          const apply = (progress: number) => {
            // Geometry can't drive `active` here — the pinned windows never move — so the scrub
            // owns it: the most recently revealed window. Tying it to the reveal (not to the
            // outline flight) keeps the pressed button one that is actually docked.
            let nextActive: CascadeKey | null = null;

            for (const seg of SEGMENTS) {
              const win = windows.get(seg.key);
              const target = targets.get(seg.key);
              if (!win || !target) continue;

              const { outlineT, revealed } = segmentPhase(progress, seg);
              const step = outlineT === null ? null : Math.round(outlineT * OUTLINE_STEPS);
              const prev = drawn.get(seg.key);
              if (revealed) nextActive = seg.key;

              // Only touch styles when the snapped frame actually changed.
              if (!prev || prev.step !== step) {
                if (outlineT === null) {
                  const el = outlines.get(seg.key);
                  if (el) el.style.display = "none";
                } else {
                  draw(seg.key, outlineRect(slotStub(), target, outlineT));
                }
              }
              if (!prev || prev.open !== revealed) {
                win.classList.toggle("cascade-open", revealed);
                // The taskbar button pops exactly as its window opens, and leaves on the way back.
                setDocked(seg.key, revealed);
              }
              drawn.set(seg.key, { step, open: revealed });
            }

            if (nextActive !== active) {
              active = nextActive;
              if (nextActive) setActive(nextActive);
              else if (isCascadeKey(useDockStore.getState().active)) setActive(null);
            }
          };

          const st = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "+=250%",
            pin: true,
            scrub: 0.3,
            onRefresh: (self) => {
              measure();
              apply(self.progress);
            },
            onUpdate: (self) => apply(self.progress),
          });

          // The hero is only 100svh until its own GSAP hook adds .hero--motion (300vh), which can
          // land after this trigger measured — leaving the pin ~200vh too early. On boot visits the
          // hero chain also waits on the boot gate, so this rAF can still run early; the hero's own
          // ScrollTrigger.refresh(true) after adding the class is what finally settles positions.
          const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());

          // Taskbar jumps must land where the window is revealed, not at pin start where
          // everything is still hidden.
          for (const seg of SEGMENTS) {
            registerScrollFn(seg.key, () => st.start + (st.end - st.start) * seg.end);
          }

          return () => {
            cancelAnimationFrame(refresh);
            // Release the dock state this scrub owned: on disarm no geometry transition would
            // ever fire to correct it, so the buttons would stay docked for good.
            for (const key of CASCADE_KEYS) {
              registerScrollFn(key, null);
              setDocked(key, false);
              windows.get(key)?.classList.remove("cascade-open");
            }
            if (isCascadeKey(useDockStore.getState().active)) setActive(null);
            outlines.forEach((el) => el.remove());
            outlines.clear();
            st.kill();
            section.classList.remove("cascade--armed");
          };
        });

        cleanup = () => mm.revert();
      })
      .catch(() => {
        // Chunk load failed: nothing was armed, so the static layout is already correct.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sectionRef]);
}
