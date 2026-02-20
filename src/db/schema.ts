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
