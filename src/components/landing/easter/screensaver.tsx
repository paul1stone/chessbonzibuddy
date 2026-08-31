"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { createIdleWatcher, IDLE_EVENTS } from "./idle";

const GLYPHS = ["♟", "♞", "♛", "♜"];
const COLORS = ["#008080", "#ffffff", "#7b4fb5", "#c0c0c0"];
const GLYPH_PX = 72;

interface ScreensaverProps {
  idleMs?: number;
}

export function Screensaver({ idleMs = 45000 }: ScreensaverProps) {
  const reduced = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  // The watcher stays armed while the screensaver shows: the input that dismisses it
  // also resets the countdown, so it re-arms itself.
  useEffect(() => {
    if (reduced) return;
    const watcher = createIdleWatcher(idleMs, () => setActive(true));
    watcher.arm();
    return () => watcher.disarm();
  }, [reduced, idleMs]);

  useEffect(() => {
    if (!active) return;
    const dismiss = () => setActive(false);
    for (const type of IDLE_EVENTS) window.addEventListener(type, dismiss, { passive: true });
    return () => {
      for (const type of IDLE_EVENTS) window.removeEventListener(type, dismiss);
    };
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${GLYPH_PX}px "Segoe UI Symbol", "DejaVu Sans", serif`;
      ctx.textBaseline = "top";
    };
    resize();

    const sprites = GLYPHS.map((glyph, i) => ({
      glyph,
      color: COLORS[i],
      x: Math.random() * Math.max(1, width - GLYPH_PX),
      y: Math.random() * Math.max(1, height - GLYPH_PX),
      vx: (i % 2 === 0 ? 1 : -1) * (96 + i * 17),
      vy: (i < 2 ? 1 : -1) * (74 + i * 13),
    }));

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      for (const s of sprites) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x <= 0) {
          s.x = 0;
          s.vx = -s.vx;
        } else if (s.x + GLYPH_PX >= width) {
          s.x = width - GLYPH_PX;
          s.vx = -s.vx;
        }
        if (s.y <= 0) {
          s.y = 0;
          s.vy = -s.vy;
        } else if (s.y + GLYPH_PX >= height) {
          s.y = height - GLYPH_PX;
          s.vy = -s.vy;
        }
        ctx.fillStyle = s.color;
        ctx.fillText(s.glyph, s.x, s.y);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (reduced || !active) return null;

  return <canvas ref={canvasRef} aria-hidden className="fixed inset-0 z-[90] h-screen w-screen bg-black" />;
}
