import type { MoveClassification } from "@/lib/engine";
import type { BonziEvent, BonziGifState, BonziReaction } from "./types";
import { getRandomQuip } from "./quips";

const FALLBACK_GIF = "/coolmonkey.gif";

/**
 * Map a move classification from game analysis to a Bonzi event.
 */
export function classificationToEvent(
  classification: MoveClassification
): BonziEvent {
  switch (classification) {
    case "brilliant":
      return "review_brilliant";
    case "great":
      return "review_great";
    case "best":
      return "review_best";
    case "good":
      return "review_good";
    case "book":
      return "review_book";
    case "inaccuracy":
      return "review_inaccuracy";
    case "mistake":
      return "review_mistake";
    case "blunder":
      return "review_blunder";
  }
}

/**
 * Get a Bonzi reaction for a given event.
 * Returns the appropriate GIF state, quip, and display duration.
 */
export function getBonziReaction(event: BonziEvent): BonziReaction {
  const { gif, quip } = getRandomQuip(event);

  // Longer duration for dramatic events
  let duration = 3000;
  if (
    event === "bonzi_checkmate" ||
    event === "player_checkmate" ||
    event === "game_over_win" ||
    event === "game_over_lose"
  ) {
    duration = 5000;
  } else if (event === "bonzi_thinking") {
    duration = 60000; // stays until engine finishes
  } else if (
    event === "review_brilliant" ||
    event === "review_blunder"
  ) {
    duration = 4000;
  }

  return { gif, quip, duration };
}

/**
 * Get the URL for a Bonzi GIF state.
 * Falls back to coolmonkey.gif if the specific GIF isn't available.
 */
export function getBonziGifUrl(state: BonziGifState): string {
  return `/bonzi/${state}.gif`;
}

export { FALLBACK_GIF };
