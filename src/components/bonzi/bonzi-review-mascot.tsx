"use client";

import { useEffect, useRef, useState } from "react";
import { BonziAvatar } from "./bonzi-avatar";
import {
  classificationToEvent,
  getBonziReaction,
} from "@/lib/bonzi/bonzi-engine";
import type { BonziGifState } from "@/lib/bonzi/types";
import type { MoveClassification } from "@/lib/engine";

interface BonziReviewMascotProps {
  classification?: MoveClassification;
  currentMove: number;
}

export function BonziReviewMascot({
  classification,
  currentMove,
}: BonziReviewMascotProps) {
  const [gif, setGif] = useState<BonziGifState>("idle");
  const [quip, setQuip] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastMoveRef = useRef<number>(-1);

  useEffect(() => {
    // Don't react to the same move twice
    if (currentMove === lastMoveRef.current) return;
    lastMoveRef.current = currentMove;

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Debounce 300ms to handle rapid navigation
    debounceRef.current = setTimeout(() => {
      // Clear previous reaction timer
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!classification) {
        setGif("idle");
        setQuip(undefined);
        return;
      }

      const event = classificationToEvent(classification);
      const reaction = getBonziReaction(event);

      setGif(reaction.gif);
      setQuip(reaction.quip);

      // Revert to idle after duration
      timerRef.current = setTimeout(() => {
        setGif("idle");
        setQuip(undefined);
      }, reaction.duration);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [classification, currentMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 border-t border-purple-800 bg-purple-950 px-3 py-2">
      <BonziAvatar gif={gif} quip={quip} size="sm" />
      {!quip && (
        <span className="text-xs text-purple-500">
          Navigate moves to see Bonzi react!
        </span>
      )}
    </div>
  );
}
