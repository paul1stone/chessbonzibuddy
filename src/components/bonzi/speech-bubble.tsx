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
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show && !visible) return null;

  return (
    <div
      className={`relative rounded-lg border border-purple-700 bg-purple-900 px-3 py-2 text-xs text-purple-100 shadow-lg transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {text}
      {/* Triangle tail pointing down */}
      <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-purple-700 bg-purple-900" />
    </div>
  );
}
