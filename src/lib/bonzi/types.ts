export type BonziGifState =
  | "idle"
  | "wave"
  | "think"
  | "celebrate"
  | "clap"
  | "laugh"
  | "sad"
  | "shocked"
  | "angry"
  | "talk"
  | "point"
  | "backflip"
  | "peek";

export type BonziEvent =
  | "game_start"
  | "bonzi_capture"
  | "bonzi_check"
  | "bonzi_checkmate"
  | "player_checkmate"
  | "bonzi_thinking"
  | "player_blunder"
  | "player_mistake"
  | "player_good_move"
  | "review_blunder"
  | "review_brilliant"
  | "review_mistake"
  | "review_inaccuracy"
  | "review_great"
  | "review_best"
  | "review_good"
  | "review_book"
  | "game_over_win"
  | "game_over_lose"
  | "game_over_draw"
  | "player_resign";

export interface BonziReaction {
  gif: BonziGifState;
  quip: string;
  duration: number; // ms to show before reverting to idle
}
