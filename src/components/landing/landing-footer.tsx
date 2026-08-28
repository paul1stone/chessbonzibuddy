import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="r-face r-bevel-out mx-auto mt-16 w-[min(92vw,960px)] p-4 text-[11px]">
      <p className="r-body">
        Chess Bonzi Buddy is a hobby project. Not affiliated with Bonzi Software, Chess.com, or Lichess.
      </p>
      <nav aria-label="Footer" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="https://github.com/paul1stone/chessbonzibuddy" rel="noreferrer">GitHub</a>
      </nav>
      <div className="r-sep my-3" />
      <p>
        Credits: Stockfish 18, chess.js, react-chessboard. MS Sans Serif pixel font by lou, CC BY-SA 3.0.
      </p>
    </footer>
  );
}
