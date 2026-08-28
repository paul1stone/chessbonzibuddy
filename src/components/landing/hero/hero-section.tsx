"use client";

import { useRef } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { RetroButton, RetroDialog, RetroWindow } from "@/components/retro";
import { QUIP_MAP } from "@/lib/bonzi/quips";
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

  return (
    <section ref={sectionRef} className="hero" aria-labelledby="hero-heading">
      <div ref={stageRef} className="hero-stage">
        <div className="absolute inset-0" aria-hidden="true">
          <HeroCanvasLoader progressRef={progressRef} stageRef={stageRef} poster={<HeroPoster />} />
        </div>

        <RetroWindow ref={windowRef} title="Chess Bonzi Buddy" className="hero-window" statusBar="Scroll to watch a game">
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
