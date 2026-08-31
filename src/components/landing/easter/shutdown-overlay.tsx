"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

const DIM_MS = 400;

interface ShutdownOverlayProps {
  open: boolean;
  onDone: () => void;
}

// Functional UI, not decoration: reduced motion drops the stepped dim but the overlay,
// the message and the click/key dismissal all still work.
export function ShutdownOverlay({ open, onDone }: ShutdownOverlayProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);

  // Re-arm the sequence if the overlay is closed and reopened (idiom from speech-bubble.tsx).
  if (wasOpen !== open) {
    setWasOpen(open);
    setStep(0);
  }

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || reduced) return;
    const raf = requestAnimationFrame(() => setStep(1));
    const timer = setTimeout(() => setStep(2), DIM_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [open, reduced]);

  // Window-level so a keypress dismisses even if focus has moved off the overlay.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = () => onDone();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDone]);

  if (!open) return null;

  const dimmed = reduced || step >= 1;
  const showMessage = reduced || step >= 2;

  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label="Shut down"
      tabIndex={-1}
      onClick={onDone}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black outline-none"
      style={{
        opacity: dimmed ? 1 : 0,
        transition: reduced ? undefined : `opacity ${DIM_MS}ms steps(5)`,
      }}
    >
      {showMessage && (
        <p className="r-term px-6 text-center" style={{ color: "#ffb300" }}>
          It is now safe to turn off your computer.
        </p>
      )}
    </div>
  );
}
