# Chess Game Analyzer — Design Document

## Overview

A Next.js web application that analyzes Chess.com games. Users paste a game URL, the app fetches the PGN, runs Stockfish analysis client-side via WASM, and presents move-by-move evaluation, game summaries, and a practice mode for improving on mistakes.

## Tech Stack

- **Next.js 14+** — App Router, primarily client components
- **shadcn/ui** — UI component library
- **Tailwind CSS** — Styling with custom dark theme
- **chess.js** — PGN parsing, move validation, game logic
- **react-chessboard** — Interactive board rendering
- **stockfish.js** (WASM via Web Worker) — Engine analysis
- **zustand** — Client-side state management
- **Drizzle ORM** — Type-safe database access
- **Neon PostgreSQL** — Serverless Postgres database

## Layout

Dashboard layout with persistent left sidebar and main content area.

**Sidebar:**
- "New Analysis" button
- Game history list (from database)
- Each entry: opponent name, date, result (W/L/D), accuracy score

**Main content area** switches between three views:
- Import view (default/empty state)
- Review view (game analysis)
- Practice view (replay from mistakes)

## Data Model

```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chess_com_url TEXT NOT NULL,
  pgn TEXT NOT NULL,
  white_player TEXT NOT NULL,
  black_player TEXT NOT NULL,
  result TEXT NOT NULL,
  played_at TIMESTAMP,
  analysis JSONB,
  white_accuracy FLOAT,
  black_accuracy FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**analysis JSONB structure** (per move):
```json
{
  "moves": [
    {
      "moveNumber": 1,
      "color": "w",
      "san": "e4",
      "eval": 0.3,
      "bestMove": "e4",
      "classification": "great",
      "topLines": [
        { "moves": ["e4", "e5", "Nf3"], "eval": 0.3 }
      ]
    }
  ]
}
```

Move classifications: brilliant, great, good, book, inaccuracy, mistake, blunder.

## Views

### Import View
- Centered URL input with paste button
- Validates Chess.com game URL format
- Shows loading state while fetching PGN

### Review View
- **Left panel:** Interactive chessboard with forward/back navigation arrows, auto-play toggle
- **Right panel:** Tabbed interface
  - **Moves tab:** Move list with color-coded classification badges. Click to jump to position.
  - **Summary tab:** Accuracy %, phase scores (opening/middlegame/endgame), eval swing chart
  - **Engine tab:** Current position eval bar, top 3 engine lines, analysis depth

### Practice View
- Board resets to position before the mistake
- User attempts the correct move
- Feedback: correct/incorrect with engine explanation
- Option to continue playing against Stockfish from that position

## Analysis Flow

1. User pastes Chess.com URL → extract game ID
2. Fetch PGN via Chess.com public API (`/pub/player/{username}/games/{year}/{month}`)
3. Parse PGN with chess.js, save game metadata to database
4. Spawn Stockfish WASM Web Worker
5. Analyze each position at depth 18-20
6. Classify moves by eval difference vs best move
7. Calculate accuracy scores
8. Save analysis results to database
9. Display review view

## Visual Style

Dark, modern, minimal:
- Dark background (#0a0a0a / zinc-950)
- Subtle card borders and shadows
- Clean sans-serif typography
- Color-coded move classifications (green=good, yellow=inaccuracy, orange=mistake, red=blunder)
- Eval bar with gradient (white advantage = white, black advantage = dark)
