"use client";

import { useRef, useState } from "react";
import { SpeechBubble } from "./speech-bubble";
import { getBonziGifUrl, FALLBACK_GIF } from "@/lib/bonzi/bonzi-engine";
import type { BonziGifState } from "@/lib/bonzi/types";

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
  // Counter increments on every gif change to force a fresh <img> mount,
  // which restarts the gif animation and resets error state.
  const seqRef = useRef(0);
  const prevGifRef = useRef(gif);

  if (gif !== prevGifRef.current) {
    prevGifRef.current = gif;
    seqRef.current += 1;
    if (imgError) setImgError(false);
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
        className={SIZES[size]}
        onError={() => setImgError(true)}
        key={`${gif}-${seqRef.current}`}
      />
    </div>
  );
}
