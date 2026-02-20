# Chess Game Analyzer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chess.com game analyzer with Stockfish WASM analysis, move-by-move review, and practice mode.

**Architecture:** Next.js App Router with dashboard layout (persistent sidebar + main content). Client-side Stockfish WASM for analysis. Neon PostgreSQL via Drizzle ORM for persistence. Zustand for client state.

**Tech Stack:** Next.js 15, shadcn/ui, Tailwind CSS, chess.js, react-chessboard, stockfish.js (WASM), Drizzle ORM, Neon PostgreSQL, zustand, next-themes

---

## Phase 1: Project Scaffolding & Infrastructure

### Task 1: Create Next.js project

**Step 1: Scaffold the project**

```bash
cd /Users/paulstone
npx create-next-app@latest chess-analyzer --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Select defaults: Yes to all prompts.

**Step 2: Verify it runs**

```bash
cd /Users/paulstone/chess-analyzer
npm run dev
```

Expected: Dev server starts on localhost:3000

**Step 3: Initialize git and commit**

```bash
cd /Users/paulstone/chess-analyzer
git init
git add -A
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Install and configure shadcn/ui with dark theme

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Install shadcn/ui**

```bash
cd /Users/paulstone/chess-analyzer
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

**Step 2: Install next-themes**

```bash
npm install next-themes
```

**Step 3: Create ThemeProvider component**

Create `src/components/theme-provider.tsx`:

```tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Step 4: Update root layout to use ThemeProvider with dark default**

Update `src/app/layout.tsx` to wrap children with ThemeProvider, set `defaultTheme="dark"`, `attribute="class"`, `disableTransitionOnChange`.

Add `suppressHydrationWarning` to the `<html>` tag. Add `dark` to the html className.

**Step 5: Install core shadcn components we'll need**

```bash
npx shadcn@latest add button card input tabs badge scroll-area separator tooltip
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure shadcn/ui with dark theme"
```

---

### Task 3: Set up Drizzle ORM with Neon PostgreSQL

**Files:**
- Create: `src/db/index.ts`
- Create: `src/db/schema.ts`
- Create: `drizzle.config.ts`
- Create: `.env.local`

**Step 1: Install Drizzle dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

**Step 2: Create `.env.local` with database URL**

```
DATABASE_URL=postgresql://neondb_owner:npg_zI8RXgYWjJ0q@ep-noisy-silence-aiu4d0sn-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Step 3: Create Drizzle config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Create schema**

Create `src/db/schema.ts`:

```ts
import { pgTable, uuid, text, timestamp, jsonb, real } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  chessComUrl: text("chess_com_url").notNull(),
  pgn: text("pgn").notNull(),
  whitePlayer: text("white_player").notNull(),
  blackPlayer: text("black_player").notNull(),
  result: text("result").notNull(),
  playedAt: timestamp("played_at"),
  analysis: jsonb("analysis"),
  whiteAccuracy: real("white_accuracy"),
  blackAccuracy: real("black_accuracy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
```

**Step 5: Create database client**

Create `src/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

**Step 6: Run migration to create tables**

```bash
npx drizzle-kit push
```

Expected: Table `games` created in Neon database.

**Step 7: Verify with Drizzle Studio (optional)**

```bash
npx drizzle-kit studio
```

**Step 8: Commit**

```bash
git add drizzle.config.ts src/db/ drizzle/
git commit -m "chore: set up Drizzle ORM with Neon PostgreSQL"
```

---

## Phase 2: Dashboard Layout

### Task 4: Build the dashboard shell layout

**Files:**
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/dashboard-layout.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create sidebar component**

Create `src/components/layout/sidebar.tsx` — a fixed left sidebar (w-72) with:
- App title "Chess Analyzer" at top
- "New Analysis" button (shadcn Button)
- ScrollArea for game history list (empty for now, placeholder text)
- Dark background (bg-zinc-950), border-r divider

**Step 2: Create dashboard layout wrapper**

Create `src/components/layout/dashboard-layout.tsx` — flex container with:
- Sidebar on the left (fixed width)
- Main content area (flex-1) with padding

**Step 3: Update root layout**

Wrap page content with DashboardLayout inside the ThemeProvider.

**Step 4: Update page.tsx with import view placeholder**

Replace default Next.js content with a centered card containing:
- Heading: "Analyze a Game"
- Subtext: "Paste a Chess.com game link to get started"
- URL input field (shadcn Input)
- "Analyze" button (shadcn Button)

**Step 5: Verify layout**

```bash
npm run dev
```

Open localhost:3000 — should see dark sidebar on left, import form centered in main area.

**Step 6: Commit**

```bash
git add src/components/layout/ src/app/
git commit -m "feat: add dashboard layout with sidebar and import view"
```

---

## Phase 3: Chess.com Integration

### Task 5: Build Chess.com game fetcher

**Files:**
- Create: `src/lib/chess-com.ts`
- Create: `src/app/api/games/import/route.ts`

**Step 1: Create Chess.com URL parser and PGN fetcher**

Create `src/lib/chess-com.ts`:
- `parseChessComUrl(url: string)` — extracts username and game ID from URL formats like `https://www.chess.com/game/live/12345` or `https://www.chess.com/live#g=12345`
- `fetchGamePgn(gameUrl: string)` — calls Chess.com public API to get game data. The API endpoint is `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}` which returns an array of games. Filter by game URL to find the matching game and extract its PGN.

**Step 2: Create API route for importing games**

Create `src/app/api/games/import/route.ts`:
- POST handler accepts `{ url: string }`
- Validates URL format
- Fetches PGN from Chess.com
- Parses PGN headers (White, Black, Result, Date)
- Saves game to database via Drizzle
- Returns the game record

**Step 3: Test the API route**

```bash
curl -X POST http://localhost:3000/api/games/import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.chess.com/game/live/123456789"}'
```

**Step 4: Commit**

```bash
git add src/lib/chess-com.ts src/app/api/
git commit -m "feat: add Chess.com game import API"
```

---

### Task 6: Wire up import form to API

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/stores/game-store.ts`

**Step 1: Create zustand game store**

Create `src/stores/game-store.ts`:

```ts
import { create } from "zustand";
import type { Game } from "@/db/schema";

interface GameStore {
  games: Game[];
  activeGame: Game | null;
  isAnalyzing: boolean;
  setGames: (games: Game[]) => void;
  setActiveGame: (game: Game | null) => void;
  addGame: (game: Game) => void;
  setIsAnalyzing: (val: boolean) => void;
}
```

**Step 2: Update import form with submission logic**

Update `src/app/page.tsx`:
- Add form state (URL input, loading, error)
- On submit: POST to `/api/games/import`
- On success: add game to store, set as active game
- Show loading spinner during fetch
- Show error toast on failure

**Step 3: Commit**

```bash
git add src/stores/ src/app/page.tsx
git commit -m "feat: wire up import form with game store"
```

---

## Phase 4: Chess Board & Analysis Engine

### Task 7: Set up interactive chessboard

**Files:**
- Create: `src/components/chess/board.tsx`
- Create: `src/components/chess/move-controls.tsx`

**Step 1: Install chess dependencies**

```bash
npm install chess.js react-chessboard
```

**Step 2: Create Board component**

Create `src/components/chess/board.tsx`:
- Wraps react-chessboard's `Chessboard` component
- Accepts `fen` prop for position
- Accepts `onPieceDrop` for interactive moves
- Dark theme board colors (customDarkSquareStyle, customLightSquareStyle)
- Responsive sizing

**Step 3: Create move navigation controls**

Create `src/components/chess/move-controls.tsx`:
- First move, previous, next, last move buttons (arrow icons)
- Auto-play toggle button
- Current move number display

**Step 4: Commit**

```bash
git add src/components/chess/
git commit -m "feat: add interactive chessboard component"
```

---

### Task 8: Set up Stockfish WASM Web Worker

**Files:**
- Create: `src/lib/stockfish-worker.ts`
- Create: `src/lib/engine.ts`
- Create: `public/stockfish/` (WASM files)

**Step 1: Install stockfish.js**

```bash
npm install stockfish
```

Copy the stockfish WASM files to `public/stockfish/` so they can be loaded by the web worker. The files needed are `stockfish.js` and `stockfish.wasm` from the npm package.

**Step 2: Create engine wrapper**

Create `src/lib/engine.ts`:
- `StockfishEngine` class that manages the Web Worker lifecycle
- Methods: `init()`, `evaluate(fen: string, depth: number)`, `getBestMove(fen: string)`, `stop()`, `quit()`
- Communicates with Stockfish via UCI protocol (postMessage/onmessage)
- Parses engine output to extract: eval score (cp/mate), best move, principal variation (PV lines)
- Returns structured results: `{ eval: number, bestMove: string, topLines: Line[] }`

**Step 3: Create analysis runner**

Add to `src/lib/engine.ts`:
- `analyzeGame(pgn: string, depth: number, onProgress: callback)` function
- Iterates through each position in the game
- Evaluates each position with Stockfish
- Classifies each move based on eval difference:
  - Brilliant: finds a move significantly better than engine expected
  - Great: matches engine's top choice
  - Good: within 0.3 pawns of best move
  - Inaccuracy: 0.3-0.8 pawn loss
  - Mistake: 0.8-2.0 pawn loss
  - Blunder: >2.0 pawn loss
- Calculates accuracy percentages per player
- Reports progress via callback (for progress bar)

**Step 4: Commit**

```bash
git add src/lib/stockfish-worker.ts src/lib/engine.ts public/stockfish/
git commit -m "feat: set up Stockfish WASM engine with analysis runner"
```

---

## Phase 5: Review View

### Task 9: Build the review view — move list

**Files:**
- Create: `src/components/review/review-panel.tsx`
- Create: `src/components/review/move-list.tsx`
- Create: `src/components/review/move-badge.tsx`

**Step 1: Create move badge component**

Create `src/components/review/move-badge.tsx`:
- Color-coded badge per classification
- brilliant = cyan, great = green, good = muted, book = slate, inaccuracy = yellow, mistake = orange, blunder = red

**Step 2: Create move list component**

Create `src/components/review/move-list.tsx`:
- Renders moves in pairs (1. e4 e5, 2. Nf3 Nc6...)
- Each move is clickable (jumps board to that position)
- Active move highlighted
- Classification badge next to each move

**Step 3: Create review panel wrapper**

Create `src/components/review/review-panel.tsx`:
- Tabbed interface (shadcn Tabs): Moves | Summary | Engine
- Moves tab shows the MoveList
- Summary and Engine tabs are placeholders for now

**Step 4: Commit**

```bash
git add src/components/review/
git commit -m "feat: add move list with classification badges"
```

---

### Task 10: Build the review view — summary tab

**Files:**
- Create: `src/components/review/game-summary.tsx`
- Create: `src/components/review/eval-chart.tsx`
- Create: `src/components/review/accuracy-ring.tsx`

**Step 1: Create accuracy ring component**

A circular progress indicator showing accuracy percentage (0-100). White and black player scores side by side.

**Step 2: Create eval chart component**

A line/area chart showing eval over move number. Positive = white advantage (white fill), negative = black advantage (dark fill). Key moments (blunders/mistakes) marked with dots.

Note: Use a lightweight chart approach — either raw SVG or a minimal charting library like recharts.

```bash
npm install recharts
```

**Step 3: Create game summary component**

Combines:
- Accuracy rings for both players
- Phase breakdown (opening/middlegame/endgame accuracy)
- Key moments list (biggest eval swings)
- Move classification counts (e.g., "3 blunders, 2 mistakes, 1 inaccuracy")

**Step 4: Commit**

```bash
git add src/components/review/
git commit -m "feat: add game summary with accuracy and eval chart"
```

---

### Task 11: Build the review view — engine tab

**Files:**
- Create: `src/components/review/engine-panel.tsx`
- Create: `src/components/review/eval-bar.tsx`

**Step 1: Create eval bar component**

Vertical bar showing current position evaluation. White fills from bottom, black from top. Shows numeric eval (+1.5, -0.3, M3, etc.)

**Step 2: Create engine panel**

Shows for the current position:
- Eval bar on the side
- Top 3 engine lines with eval scores
- Best move highlighted
- Analysis depth indicator

**Step 3: Commit**

```bash
git add src/components/review/
git commit -m "feat: add engine panel with eval bar"
```

---

### Task 12: Compose the full review view

**Files:**
- Create: `src/components/review/review-view.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create review view composition**

Create `src/components/review/review-view.tsx`:
- Left side: Chessboard (Board component) + move controls
- Right side: ReviewPanel (tabbed moves/summary/engine)
- Connects to game store for state
- Handles move navigation (clicking moves, arrow buttons)

**Step 2: Update page.tsx**

Show ReviewView when a game is active and analyzed. Show import view when no game is selected.

**Step 3: Add analysis progress UI**

When analysis is running:
- Show a progress bar overlay on the board
- Show "Analyzing move X of Y" text
- Disable navigation until complete

**Step 4: Commit**

```bash
git add src/components/review/ src/app/page.tsx
git commit -m "feat: compose full review view with board and analysis panels"
```

---

## Phase 6: Practice Mode

### Task 13: Build practice mode

**Files:**
- Create: `src/components/practice/practice-view.tsx`
- Create: `src/components/practice/feedback-card.tsx`

**Step 1: Create practice view**

Create `src/components/practice/practice-view.tsx`:
- Receives a position (FEN) and the best move from analysis
- Board is interactive — user can make a move
- On move: compare to engine's best move
- Show immediate feedback (correct/incorrect)
- If correct: celebration animation, move to next mistake
- If incorrect: show the correct move with arrow annotation on the board

**Step 2: Create feedback card**

Create `src/components/practice/feedback-card.tsx`:
- Shows "Correct!" or "Not quite" with eval difference
- Shows the best move and why it's better
- "Next Mistake" / "Try Again" buttons
- "Continue Playing vs Engine" option (use Stockfish for opponent moves)

**Step 3: Add practice entry points**

In the move list and summary, add "Practice" buttons next to mistakes/blunders that switch to practice mode at that position.

**Step 4: Commit**

```bash
git add src/components/practice/
git commit -m "feat: add practice mode for mistakes"
```

---

## Phase 7: Game History Sidebar

### Task 14: Wire up game history in sidebar

**Files:**
- Create: `src/app/api/games/route.ts`
- Create: `src/components/layout/game-list-item.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Create games list API route**

Create `src/app/api/games/route.ts`:
- GET handler returns all games ordered by createdAt desc
- Select only fields needed for sidebar display (id, players, result, accuracy, date)

**Step 2: Create game list item component**

Create `src/components/layout/game-list-item.tsx`:
- Shows: opponent name, date, result (W/L/D with color), accuracy badge
- Active state styling when this game is selected
- Click handler sets active game in store

**Step 3: Update sidebar**

Load games on mount. Show game list items in the scroll area. "New Analysis" button clears active game and shows import view.

**Step 4: Commit**

```bash
git add src/app/api/games/ src/components/layout/
git commit -m "feat: wire up game history sidebar"
```

---

## Phase 8: Polish & Final Touches

### Task 15: Add loading states, error handling, and responsive design

**Files:**
- Various components

**Step 1: Loading states**
- Skeleton loaders for game list in sidebar
- Board loading placeholder
- Analysis progress bar with estimated time

**Step 2: Error handling**
- Invalid URL format validation with inline error
- Chess.com API errors (game not found, rate limited)
- Stockfish initialization failure fallback
- Toast notifications for errors (install shadcn toast)

```bash
npx shadcn@latest add toast sonner
```

**Step 3: Responsive design**
- Sidebar collapses to icon-only on small screens
- Board resizes to fit viewport
- Move list scrolls independently

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish: add loading states, error handling, responsive design"
```
