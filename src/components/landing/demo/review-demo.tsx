"use client";

import dynamic from "next/dynamic";
import { useDemoActivation } from "./use-in-view";

// chess.js, react-chessboard and the 45 KB fixture stay out of the landing bundle:
// the inner chunk is only fetched once the demo scrolls into view.
const ReviewDemoInner = dynamic(() => import("./review-demo-inner"), {
  ssr: false,
  loading: () => <div className="r-skeleton h-[420px] w-full" aria-hidden="true" />,
});

export function ReviewDemo() {
  const { ref, inView, activated, reduced } = useDemoActivation();
  return (
    <div ref={ref} className="min-h-[420px]">
      {activated ? (
        <ReviewDemoInner inView={inView} reduced={reduced} />
      ) : (
        <div className="r-skeleton h-[420px] w-full" aria-hidden="true" />
      )}
    </div>
  );
}
