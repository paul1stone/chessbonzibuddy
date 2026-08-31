import type { ReactNode } from "react";
import { ImportDemo } from "./demo/import-demo";
import { PracticeDemo } from "./demo/practice-demo";
import { ReviewDemo } from "./demo/review-demo";
import { WindowStack, type StackItem } from "./window-stack";

const ITEMS: {
  key: string;
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
    place: "lg:col-start-1 lg:row-start-1 lg:self-start",
    copy: "Paste a Chess.com game link, or pull your last 50 games from Chess.com or Lichess and pick the ones worth a look.",
    demo: <ImportDemo />,
    statusBar: "Demo",
  },
  {
    key: "review",
    title: "Review",
    place: "lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start",
    offset: { x: 0, y: 40 },
    copy: "Stockfish 18 grades every move from best to blunder, scores accuracy for both sides, and estimates the rating you played at.",
    demo: <ReviewDemo />,
  },
  {
    key: "practice",
    title: "Practice",
    place: "lg:col-start-1 lg:row-start-2 lg:self-start",
    offset: { x: 32, y: 0 },
    copy: "Every mistake becomes a puzzle. Find the move you should have played.",
    demo: <PracticeDemo />,
  },
];

export function AnalyzerWalkthrough() {
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
    <section aria-labelledby="walkthrough-heading" className="mx-auto w-[min(92vw,960px)] lg:w-[min(92vw,1200px)]">
      <h2 id="walkthrough-heading" className="mb-6 text-[33px] font-bold leading-tight text-[var(--r-highlight)]">
        Then find out what went wrong.
      </h2>
      <WindowStack items={items} />
    </section>
  );
}
