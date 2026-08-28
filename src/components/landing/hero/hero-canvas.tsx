"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { ChessScene } from "./chess-scene";
import { DitherEffect } from "./dither-effect";

const INTERNAL_WIDTH = 400;

function useRetroDpr() {
  const [dpr, setDpr] = useState(0.3);
  useEffect(() => {
    const update = () => setDpr(Math.min(1, Math.max(0.15, INTERNAL_WIDTH / window.innerWidth)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return dpr;
}

interface HeroCanvasProps {
  progressRef: RefObject<number>;
  active: boolean;
  onContextLost?: () => void;
  onReady?: () => void;
}

export function HeroCanvas({ progressRef, active, onContextLost, onReady }: HeroCanvasProps) {
  const dpr = useRetroDpr();
  const dither = useMemo(() => new DitherEffect({ levels: 6 }), []);
  useEffect(() => () => dither.dispose(), [dither]);

  return (
    <Canvas
      dpr={dpr}
      flat
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      camera={{ fov: 40, near: 0.5, far: 60, position: [0, 11, 2.5] }}
      style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
        onReady?.();
      }}
    >
      <ChessScene progressRef={progressRef} />
      <EffectComposer multisampling={0}>
        <primitive object={dither} />
      </EffectComposer>
    </Canvas>
  );
}
