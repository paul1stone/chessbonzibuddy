"use client";

import dynamic from "next/dynamic";
import { useDemoActivation } from "./use-in-view";

// Same split as the review demo: the board, chess.js and the fixture load on first sight.
const PracticeDemoInner = dynamic(() => import("./practice-demo-inner"), {
  ssr: false,
  loading: () => <div className="r-skeleton h-[420px] w-full" aria-hidden="true" />,
});

export function PracticeDemo() {
  const { ref, activated } = useDemoActivation();
  return (
    <div ref={ref} className="min-h-[420px]">
      {activated ? <PracticeDemoInner /> : <div className="r-skeleton h-[420px] w-full" aria-hidden="true" />}
    </div>
  );
}
