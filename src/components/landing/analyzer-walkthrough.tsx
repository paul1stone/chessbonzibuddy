import Image from "next/image";
import shots from "./screenshots.json";
import { WindowStack, type StackItem } from "./window-stack";

type ShotKey = "import" | "review" | "practice";

const ITEMS: { key: ShotKey; title: string; copy: string; alt: string }[] = [
  {
    key: "import",
    title: "Import",
    copy: "Paste a Chess.com game link, or pull your last 50 games from Chess.com or Lichess and pick the ones worth a look.",
    alt: "Import screen listing recent games from Chess.com with checkboxes to select which to import",
  },
  {
    key: "review",
    title: "Review",
    copy: "Stockfish 18 grades every move from best to blunder, scores accuracy for both sides, and estimates the rating you played at.",
    alt: "Review screen with a chessboard, a color-coded move list, and accuracy summary",
  },
  {
    key: "practice",
    title: "Practice",
    copy: "Every mistake becomes a puzzle. Find the move you should have played.",
    alt: "Practice screen asking for the best move in a position where a mistake was made",
  },
];

function Shot({ item }: { item: (typeof ITEMS)[number] }) {
  if (shots[item.key]) {
    return (
      <Image
        src={`/screenshots/${item.key}.png`}
        alt={item.alt}
        width={1200}
        height={750}
        sizes="(min-width: 768px) 560px, 92vw"
        className="r-bevel-in h-auto w-full"
      />
    );
  }
  return (
    <div className="r-bevel-in r-body flex h-[120px] items-center justify-center bg-[var(--r-face)] p-6 text-center">
      Screenshot pending. This screen is being redesigned in part 2.
    </div>
  );
}

export function AnalyzerWalkthrough() {
  const items: StackItem[] = ITEMS.map((item) => ({
    key: item.key,
    title: item.title,
    content: (
      <>
        <Shot item={item} />
        <p className="r-body mt-3">{item.copy}</p>
      </>
    ),
  }));

  return (
    <section aria-labelledby="walkthrough-heading" className="mx-auto w-[min(92vw,960px)]">
      <h2 id="walkthrough-heading" className="mb-6 text-[33px] font-bold leading-tight text-[var(--r-highlight)]">
        Then find out what went wrong.
      </h2>
      <WindowStack items={items} />
    </section>
  );
}
