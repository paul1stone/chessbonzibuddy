"use client";

import { useEffect, useState } from "react";

interface SpeechBubbleProps {
  text: string;
  visible: boolean;
}

export function SpeechBubble({ text, visible }: SpeechBubbleProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 400);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show && !visible) return null;

  return (
    <div
      className={`relative max-w-[200px] rounded-xl border-2 border-primary bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_40%,transparent)] transition-all duration-300 ${
        visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
      }`}
      style={{ animation: visible ? "bubblePop 0.3s ease-out" : undefined }}
    >
      {text}
      {/* Triangle tail pointing down */}
      <div className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-primary bg-card" />
    </div>
  );
}
