"use client";

import { useState } from "react";
import { SpeechBubble } from "./speech-bubble";
import { getBonziGifUrl, FALLBACK_GIF } from "@/lib/bonzi/bonzi-engine";
import type { BonziGifState } from "@/lib/bonzi/types";

// Square boxes, but the sprites are 200x160 — object-contain keeps the box (and every layout
// tuned against it) while letterboxing the 5:4 art instead of squashing it 20% narrower.
const SIZES = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
} as const;

interface BonziAvatarProps {
  gif: BonziGifState;
  quip?: string;
  size?: "sm" | "md" | "lg";
  showBubble?: boolean;
}

export function BonziAvatar({
  gif,
  quip,
  size = "md",
  showBubble = true,
}: BonziAvatarProps) {
  const [imgError, setImgError] = useState(false);
  // Remount the <img> on every gif change so the animation restarts from frame 0.
  const [seq, setSeq] = useState(0);
  const [prevGif, setPrevGif] = useState(gif);
  if (gif !== prevGif) {
    setPrevGif(gif);
    setSeq((s) => s + 1);
    setImgError(false);
  }

  const src = imgError ? FALLBACK_GIF : getBonziGifUrl(gif);

  return (
    <div className="flex flex-col items-center gap-1">
      {showBubble && quip && (
        <SpeechBubble text={quip} visible={!!quip} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Bonzi Buddy"
        className={`${SIZES[size]} object-contain`}
        onError={() => setImgError(true)}
        key={`${gif}-${seq}`}
      />
    </div>
  );
}
