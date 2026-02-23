# Chess Analyzer

**Import and analyze your chess games with Stockfish engine analysis.**

Chess Analyzer lets you pull in games from [Chess.com](https://www.chess.com) and [Lichess](https://lichess.org), run them through Stockfish 18, and review every move with detailed classifications, accuracy scores, and interactive board navigation. It also includes a practice mode that drills you on your mistakes and blunders so you can learn from them.

**Live site:** [chessbonzibuddy.vercel.app](https://chessbonzibuddy.vercel.app/)

<!-- screenshot -->

---

## Features

### Account Connection

Link your Chess.com and Lichess accounts by entering your username -- no password or OAuth required. Once connected, Chess Analyzer fetches and displays your current ratings across rapid, blitz, and bullet time controls. Your linked accounts persist in the sidebar profile settings, and your username is used to determine which side of the board you played in imported games.

### Game Import

There are two ways to bring games into the analyzer:

- **Paste a game URL** -- Drop in a Chess.com game URL directly. The importer handles live game links, daily game links, and analysis board URLs, extracting the PGN data automatically.
- **Bulk import from recent games** -- Fetch approximately the last 50 games from any of your linked Chess.com or Lichess accounts. Games are presented in a searchable list with multi-select checkboxes, so you can pick exactly which ones to import in a single action.

### Stockfish Analysis

Every imported game can be analyzed with Stockfish 18 running server-side via WebAssembly (single-threaded WASM build). The analysis pipeline works as follows:

- **Streamed progress** -- Analysis status is pushed to the client in real time using Server-Sent Events (SSE), so you can watch the progress as each move is evaluated.
- **Move classifications** -- Each move is categorized into one of six tiers: **best**, **great**, **good**, **inaccuracy**, **mistake**, or **blunder**, based on the centipawn loss relative to the engine's top line.
- **Win percentage** -- Centipawn evaluations are converted to win probability using a logistic regression curve, giving a more intuitive sense of who is winning at any point in the game.
- **Per-side accuracy** -- An overall accuracy score is calculated for both White and Black, weighted by position volatility (sharp tactical positions are weighted differently from quiet ones).
- **"Played like ~Elo" estimation** -- Based on the accuracy and quality of moves played, the analyzer estimates a performance rating for each side, giving a rough sense of the Elo level the player performed at in that particular game.

### Review View

After analysis completes, the review view provides a full interactive breakdown of the game:

- **Interactive chessboard** -- Navigate through the game move by move using arrow keys or clickable controls. The board updates in real time as you step through the move list.
- **Color-coded move list** -- Moves are annotated with color indicators reflecting their classification: green for great moves, yellow for inaccuracies, orange for mistakes, and red for blunders. Best and good moves use neutral styling.
- **Three detail tabs:**
  - **Moves** -- The full annotated move list with classification markers, scrollable and clickable for quick navigation to any position.
  - **Summary** -- Accuracy rings for both players, an evaluation chart showing the advantage over the course of the game, classification counts (how many bests, greats, inaccuracies, etc. each side played), and key moments highlighting the most impactful moves.
  - **Engine** -- A vertical eval bar showing the current position's evaluation, the engine's recommended best move, the top principal variation lines, and the search depth used during analysis.

### Practice Mode

Practice mode is designed to help you learn from your mistakes:

- The analyzer identifies every move classified as a mistake or blunder in your analyzed games.
- For each one, it presents the board position **before** you made the error and asks you to find the best move.
- You play your answer on the board, and the system validates it against the engine's top recommendation.
- Feedback is shown immediately: whether your move was correct or incorrect, along with the evaluation difference between your attempt and the best line.
- You can navigate forward and backward between mistake positions to drill as many as you want in a single session.

### Sidebar and Game History

The sidebar serves as the main navigation hub:

- **Game history** -- All imported games are listed, filtered by your linked username so you always see games relevant to you.
- **Accuracy badges** -- Games that have been analyzed display accuracy scores directly in the sidebar list, so you can see at a glance how you performed.
- **Delete games** -- Remove any imported game from your history.
- **Profile settings** -- Located at the bottom of the sidebar, this is where you manage your linked Chess.com and Lichess accounts.
- **Mobile support** -- On smaller screens, the sidebar collapses behind a hamburger menu for a clean mobile experience.

### Responsive Design and Theming

- Fully responsive layout that adapts the chessboard and panels to mobile, tablet, and desktop viewports.
- The sidebar transforms into a slide-out drawer on mobile with a hamburger toggle.
- Dark theme throughout the interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 with App Router |
| UI Library | [React](https://react.dev) 19 |
| Language | [TypeScript](https://www.typescriptlang.org) |
| Chess Engine | [Stockfish](https://stockfishchess.org) 18 (WASM, single-threaded) |
| Database | [Neon](https://neon.tech) Postgres (serverless driver) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| State Management | [Zustand](https://zustand.docs.pmnd.rs) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) primitives |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Chess Logic | [chess.js](https://github.com/jhlywa/chess.js) |
| Chessboard | [react-chessboard](https://github.com/Clariity/react-chessboard) |
| Charts | [Recharts](https://recharts.org) |
| Icons | [Lucide React](https://lucide.dev) |
| Notifications | [Sonner](https://sonner.emilkowal.dev) |
| Deployment | [Vercel](https://vercel.com) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or later recommended)
- A [Neon](https://neon.tech) Postgres database (or any Postgres-compatible connection string)

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/paul1stone/chessbonzibuddy.git
   cd chessbonzibuddy
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This will also run the `postinstall` script that copies the Stockfish WASM files into the `public/stockfish/` directory.

3. **Configure environment variables**

   Create a `.env.local` file in the project root:

   ```bash
   DATABASE_URL="your-neon-postgres-connection-string"
   ```

   You can get a connection string by creating a free database at [neon.tech](https://neon.tech).

4. **Push the database schema**

   ```bash
   npx drizzle-kit push
   ```

   This applies the Drizzle ORM schema to your Neon Postgres database, creating all necessary tables.

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Disclaimer

> **This analyzer is a work in progress.** Move classifications, accuracy scores, and performance estimates may not always match the results you see on Chess.com or Lichess. The evaluation methodology, classification thresholds, and accuracy formulas are approximations and are still being refined. Use the analysis as a general guide for reviewing your games, but do not treat it as an authoritative source. Contributions and feedback are welcome as the project continues to improve.

---

## License

This project is licensed under the [MIT License](LICENSE).
