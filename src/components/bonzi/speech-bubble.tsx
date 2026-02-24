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
      className={`relative max-w-[200px] rounded-xl border-2 border-purple-500 bg-purple-900 px-3 py-2 text-sm font-semibold text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-300 ${
        visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
      }`}
      style={{ animation: visible ? "bubblePop 0.3s ease-out" : undefined }}
    >
      {text}
      {/* Triangle tail pointing down */}
      <div className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-purple-500 bg-purple-900" />
    </div>
  );
}
