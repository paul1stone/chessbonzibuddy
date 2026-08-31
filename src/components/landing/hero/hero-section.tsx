"use client";

import { useCallback, useRef, useState } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { useIsMobile } from "@/components/desktop/use-is-mobile";
import { RetroButton, RetroDialog, RetroWindow } from "@/components/retro";
import { useDrag } from "@/hooks/use-drag";
import { QUIP_MAP } from "@/lib/bonzi/quips";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useSectionDock } from "../use-section-dock";
import { HeroCanvasLoader } from "./hero-canvas-loader";
import { HeroPoster } from "./hero-poster";
import { useHeroScroll } from "./use-hero-scroll";
import "./hero.css";

// "Bonzi Buddy wants to play chess! Click OK to lose." Fixed index so SSR and client match.
const HERO_QUIP = QUIP_MAP.game_start.quips[4];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);

  useHeroScroll({ sectionRef, windowRef, dialogRef, progressRef });
  // The hero docks from its own 35% trigger, so only active tracking comes from here.
  useSectionDock("hero", sectionRef, { dockOnExit: false });

  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const draggable = !isMobile && !reduced;
  const [pos, setPos] = useState({ dx: 0, dy: 0 });

  const onMove = useCallback((dx: number, dy: number) => {
    setPos((p) => ({ dx: p.dx + dx, dy: p.dy + dy }));
  }, []);
  const { onPointerDown } = useDrag({ onMove, disabled: !draggable });

  // Progress is read at pointerdown, not render: once the scroll choreography has taken
  // over the window, dragging it would fight GSAP.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (progressRef.current > 0.05) return;
      onPointerDown(e);
    },
    [onPointerDown]
  );

  return (
    <section ref={sectionRef} className="hero" aria-labelledby="hero-heading">
      <div ref={stageRef} className="hero-stage">
        <div className="absolute inset-0" aria-hidden="true">
          <HeroCanvasLoader progressRef={progressRef} stageRef={stageRef} poster={<HeroPoster />} />
        </div>

        {/* GSAP animates `transform`; the drag uses the separate `translate` property so the two compose. */}
        <RetroWindow
          ref={windowRef}
          title="Chess Bonzi Buddy"
          className="hero-window"
          statusBar="Scroll to watch a game"
          style={{ translate: pos.dx || pos.dy ? `${pos.dx}px ${pos.dy}px` : undefined }}
          titleBarProps={{
            onPointerDown: handlePointerDown,
            className: draggable ? "cursor-default touch-none" : undefined,
          }}
        >
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <h1 id="hero-heading" className="text-[33px] font-bold leading-[1.05] sm:text-[44px]">
                Play chess against a purple gorilla from 1999.
              </h1>
              <p className="r-body mt-4">
                Bonzi Buddy runs on Stockfish and talks trash the whole game. Lose, then import the game and find out exactly where it went wrong.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <RetroButton href="/app?view=play-bonzi" variant="default" size="lg">
                  Play Bonzi Buddy
                </RetroButton>
                <RetroButton href="/app" size="lg">
                  Analyze my games
                </RetroButton>
              </div>
            </div>
            <div className="justify-self-end">
              <BonziAvatar gif="wave" quip={HERO_QUIP} size="lg" />
            </div>
          </div>
        </RetroWindow>

        <RetroDialog
          ref={dialogRef}
          title="Chess Bonzi Buddy"
          className="hero-dialog"
          actions={
            <>
              <RetroButton href="/app?view=play-bonzi" variant="default">
                Rematch
              </RetroButton>
              <RetroButton href="/app">Show me why</RetroButton>
            </>
          }
        >
          Checkmate. Bonzi wins in four moves.
        </RetroDialog>
      </div>
    </section>
  );
}
