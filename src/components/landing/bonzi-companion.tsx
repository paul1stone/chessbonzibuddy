"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { SpeechBubble } from "@/components/bonzi/speech-bubble";
import { loadGsap } from "@/lib/gsap-loader";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { BonziGifState } from "@/lib/bonzi/types";
import { useDockStore, type DockId } from "@/stores/dock-store";

// Below 1440px the page margin is ~40px, so Bonzi and his bubble would sit over the content column.
const WIDE_QUERY = "(min-width: 1440px)";

function subscribeWide(cb: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

const wideSnapshot = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_QUERY).matches
    : false;

function useIsWide(): boolean {
  return useSyncExternalStore(subscribeWide, wideSnapshot, () => false);
}

const REACTIONS: Partial<Record<DockId, { gif: BonziGifState; quip: string }>> = {
  showcase: { gif: "wave", quip: "That's me!" },
  import: { gif: "point", quip: "Feed me your games." },
  review: { gif: "shocked", quip: "Ooh. I saw that blunder too." },
  practice: { gif: "talk", quip: "Try not to hang the queen this time." },
};

const TOP_VH = 0.15;
const BOTTOM_VH = 0.72;
const FLING_VELOCITY = 2800;
const BACKFLIP_MS = 1800;
const FLING_DEBOUNCE_MS = 4000;
const REACTION_MS = 2500;
const QUIP_MS = 3500;

// Module scope, not a ref: crossing 1440px remounts Companion, and a per-instance Set
// would hand out every quip again.
const quipped = new Set<DockId>();

export function BonziCompanion() {
  const reduced = usePrefersReducedMotion();
  const wide = useIsWide();
  if (reduced || !wide) return null;
  return <Companion />;
}

// Split from the gate so the scroll effect only ever runs with a mounted element.
function Companion() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gif, setGif] = useState<BonziGifState>("idle");
  const [quip, setQuip] = useState<string>();

  const reactingRef = useRef(false);
  const flippingRef = useRef(false);
  const lastFlipRef = useRef(0);
  const gifTimerRef = useRef(0);
  const quipTimerRef = useRef(0);

  const flip = useCallback(() => {
    if (reactingRef.current || flippingRef.current) return;
    const now = Date.now();
    if (now - lastFlipRef.current < FLING_DEBOUNCE_MS) return;
    lastFlipRef.current = now;
    flippingRef.current = true;
    window.clearTimeout(gifTimerRef.current);
    setGif("backflip");
    gifTimerRef.current = window.setTimeout(() => {
      flippingRef.current = false;
      setGif("idle");
    }, BACKFLIP_MS);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;
        const yFor = (p: number) => (TOP_VH + (BOTTOM_VH - TOP_VH) * p) * window.innerHeight;

        gsap.set(el, { y: yFor(0) });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power2.out" });

        const st = ScrollTrigger.create({
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            yTo(yFor(self.progress));
            if (Math.abs(self.getVelocity()) > FLING_VELOCITY) flip();
          },
          // Re-place on resize/refresh: yFor depends on innerHeight.
          onRefresh: (self) => yTo(yFor(self.progress)),
        });

        cleanup = () => {
          st.kill();
          gsap.killTweensOf(el);
        };
      })
      .catch(() => {
        // No GSAP chunk: Bonzi just sits still. Nothing to un-hide, he is decoration.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [flip]);

  // Subscribed rather than selected: only the transition into a section is a reaction,
  // and this keeps dock-store churn from re-rendering the sprite.
  useEffect(
    () =>
      useDockStore.subscribe((state, prev) => {
        const id = state.active;
        if (id === prev.active || !id) return;
        const reaction = REACTIONS[id];
        if (!reaction) return;

        // A section reaction outranks a backflip and takes the sprite immediately.
        window.clearTimeout(gifTimerRef.current);
        flippingRef.current = false;
        reactingRef.current = true;
        setGif(reaction.gif);

        if (!quipped.has(id)) {
          quipped.add(id);
          window.clearTimeout(quipTimerRef.current);
          setQuip(reaction.quip);
          quipTimerRef.current = window.setTimeout(() => setQuip(undefined), QUIP_MS);
        }

        gifTimerRef.current = window.setTimeout(() => {
          reactingRef.current = false;
          setGif("idle");
        }, REACTION_MS);
      }),
    []
  );

  useEffect(
    () => () => {
      window.clearTimeout(gifTimerRef.current);
      window.clearTimeout(quipTimerRef.current);
    },
    []
  );

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed z-40"
      style={{ right: "max(8px, calc((100vw - 1240px) / 2 - 96px))", top: 0 }}
    >
      {/* Fixed-width anchor: the box is `right`-anchored, so letting it shrink-wrap the
          bubble would shove the sprite leftward every time a quip mounts. */}
      <div className="relative w-16">
        {quip && (
          <div className="absolute bottom-full right-0 mb-1 w-max max-w-[160px]">
            <SpeechBubble text={quip} visible />
          </div>
        )}
        <BonziAvatar gif={gif} size="md" showBubble={false} />
      </div>
    </div>
  );
}
