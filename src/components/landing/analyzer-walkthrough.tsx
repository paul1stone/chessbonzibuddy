"use client";

import { useRef, type ReactNode } from "react";
import type { DockId } from "@/stores/dock-store";
import { CASCADE_QUERY, useCascadeScroll } from "./cascade/use-cascade-scroll";
import { ImportDemo } from "./demo/import-demo";
import { PracticeDemo } from "./demo/practice-demo";
import { ReviewDemo } from "./demo/review-demo";
import { WindowStack, type StackItem } from "./window-stack";
import "./cascade/cascade.css";

const ITEMS: {
  key: DockId;
  title: string;
  copy: string;
  demo: ReactNode;
  statusBar?: ReactNode;
  place?: string;
  offset?: { x: number; y: number };
}[] = [
  {
    key: "import",
    title: "Import",
    place: "lg:col-start-1 lg:col-span-5 lg:row-start-1 lg:self-start",
    copy: "Paste a Chess.com game link, or pull your last 50 games from Chess.com or Lichess and pick the ones worth a look.",
    demo: <ImportDemo />,
    statusBar: "Demo",
  },
  {
    key: "review",
    title: "Review",
    // Rows 1-2 so the short Import window above Practice adds up to Review's height; the
    // last five columns put it flush against the section's right edge.
    place: "lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-span-2 lg:self-start",
    offset: { x: 0, y: 40 },
    copy: "Stockfish 18 grades every move from best to blunder, scores accuracy for both sides, and estimates the rating you played at.",
    demo: <ReviewDemo />,
  },
  {
    key: "practice",
    title: "Practice",
    // One column right of Import, and a column wider: the cascade steps down-and-right, and
    // the sixth column keeps this window at its natural size, which is what lets the section
    // fit a pinned 900px viewport from ~1280px up (at 1024x768 the three windows are taller
    // than the viewport regardless of placement). Columns 2-7 clear Review's column 8 by at
    // least the gutter at every lg width.
    place: "lg:col-start-2 lg:col-span-6 lg:row-start-2 lg:self-start",
    copy: "Every mistake becomes a puzzle. Find the move you should have played.",
    demo: <PracticeDemo />,
  },
];

export function AnalyzerWalkthrough() {
  const sectionRef = useRef<HTMLElement>(null);
  useCascadeScroll(sectionRef);

  const items: StackItem[] = ITEMS.map((item) => ({
    key: item.key,
    title: item.title,
    statusBar: item.statusBar,
    place: item.place,
    offset: item.offset,
    content: (
      <>
        {item.demo}
        <p className="r-body mt-3">{item.copy}</p>
      </>
    ),
  }));

  return (
    <section ref={sectionRef} aria-labelledby="walkthrough-heading">
      {/* The centred column is an inner wrapper: pinning wraps the section in a pin-spacer
          that zeroes auto margins, which would knock this off-centre on lg+. */}
      <div className="mx-auto w-[min(92vw,960px)] lg:w-[min(92vw,1320px)]">
        <h2 id="walkthrough-heading" className="mb-4 text-[33px] font-bold leading-tight text-[var(--r-highlight)]">
          Then find out what went wrong.
        </h2>
        <WindowStack items={items} managedQuery={CASCADE_QUERY} />
      </div>
    </section>
  );
}
