import type { BonziEvent, BonziGifState } from "./types";

interface QuipEntry {
  gif: BonziGifState;
  quips: string[];
}

const QUIP_MAP: Record<BonziEvent, QuipEntry> = {
  game_start: {
    gif: "wave",
    quips: [
      "Hi there! Ready to get destroyed?",
      "Oh, a challenger! How cute.",
      "Welcome! I haven't lost since... well, ever.",
      "Let's play! I'll try to go easy on you. (I won't.)",
      "Bonzi Buddy wants to play chess! Click OK to lose.",
      "I've been practicing! Just kidding, I don't need to.",
      "Another victim— I mean, friend! Let's play!",
    ],
  },
  bonzi_capture: {
    gif: "laugh",
    quips: [
      "Nom nom nom! Tasty piece!",
      "I'll take that, thank you very much!",
      "Yoink! Mine now!",
      "That piece was barely defended. Just like your ego.",
      "Thanks for the snack!",
      "Ooh, free material! Don't mind if I do.",
      "Is that piece important? Was* important.",
      "You weren't using that, right?",
    ],
  },
  bonzi_check: {
    gif: "laugh",
    quips: [
      "Check! Your king is in danger!",
      "Knock knock! Check!",
      "Watch your king, buddy!",
      "CHECK! Did that scare you?",
      "Your king seems nervous. As it should be.",
      "Careful! That's check!",
      "Ding dong! Check is calling!",
    ],
  },
  bonzi_checkmate: {
    gif: "backflip",
    quips: [
      "CHECKMATE! Better luck next time!",
      "And THAT'S checkmate! GG EZ!",
      "Checkmate! Would you like to uninstall chess?",
      "Game over! I am simply too powerful.",
      "Checkmate! I'd say good game, but...",
      "That's mate! Thanks for playing!",
      "CHECKMATE! *does victory dance*",
      "Checkmate! Your king has fallen! Long live ME!",
    ],
  },
  player_checkmate: {
    gif: "sad",
    quips: [
      "Wait... that's checkmate?! No fair!",
      "I... I let you win. Obviously.",
      "Impossible! I demand a rematch!",
      "Okay, you got me. This time.",
      "Error 404: Bonzi's dignity not found.",
      "My CPU must have glitched. That's my story.",
      "Well played... I guess. *sob*",
    ],
  },
  bonzi_thinking: {
    gif: "think",
    quips: [
      "Hmm, let me think about this...",
      "Calculating the best way to crush you...",
      "Processing... processing... almost done...",
      "One moment, finding the perfect move...",
      "Thinking really hard! (Not really, I'm a computer.)",
      "Let me consult my inner grandmaster...",
      "Analyzing 50 million positions... or just picking one.",
      "Hold on, my genius takes a moment to manifest.",
    ],
  },
  player_blunder: {
    gif: "laugh",
    quips: [
      "HAHA! That was a terrible move!",
      "Oh no... oh no no no. What was THAT?",
      "Did you just hang a piece? Classic!",
      "My turn to feast! Thanks for the blunder!",
      "Blunder alert! Bonzi is pleased.",
      "I couldn't have asked for a better gift!",
      "Even I couldn't make a move that bad if I tried!",
    ],
  },
  player_mistake: {
    gif: "laugh",
    quips: [
      "Oops! That wasn't great.",
      "Hmm, I don't think that was your best option...",
      "Mistake! But don't worry, I'll capitalize on it.",
      "Not the best move there, chief.",
      "I see what you tried. It didn't work.",
      "That's a mistake! My advantage grows!",
    ],
  },
  player_good_move: {
    gif: "shocked",
    quips: [
      "Okay, that was actually decent...",
      "Not bad! I'm almost impressed.",
      "Fine, that was a good move. Don't let it go to your head.",
      "Hmm, you might actually know what you're doing.",
      "Whoa! Did you mean to do that?",
    ],
  },
  review_blunder: {
    gif: "angry",
    quips: [
      "Yikes! That was a major blunder!",
      "Oh no, that move changed everything...",
      "That's a serious blunder. Ouch.",
      "The position just collapsed after this move.",
      "That's gonna leave a mark. Big blunder!",
      "I felt that blunder from here.",
      "This is the move that lost the game. Brutal.",
    ],
  },
  review_brilliant: {
    gif: "shocked",
    quips: [
      "BRILLIANT! What a move!",
      "Incredible! That's a brilliant find!",
      "Now THAT is a move! Brilliant!",
      "Wow, that's the kind of move engines dream about!",
      "Absolutely brilliant! Chef's kiss!",
      "A brilliant move! Hard to find and perfectly played!",
      "Stunning! That move deserves a standing ovation!",
    ],
  },
  review_mistake: {
    gif: "point",
    quips: [
      "That's a mistake — there was a better option.",
      "Oops, this move gave away some advantage.",
      "A mistake here. The position shifted.",
      "Not ideal — this was a turning point.",
      "This move let the opponent back in the game.",
      "A mistake. The engine sees a much better continuation.",
    ],
  },
  review_inaccuracy: {
    gif: "point",
    quips: [
      "Slight inaccuracy here.",
      "Not the best move — a small inaccuracy.",
      "Close, but there was something a bit better.",
      "A minor slip. The engine prefers something else.",
      "Small inaccuracy — not the end of the world.",
      "This was okay, but not quite optimal.",
    ],
  },
  review_great: {
    gif: "clap",
    quips: [
      "Great move! Well played!",
      "That's a great choice!",
      "Nicely done — great move!",
      "Strong play! That was a great move.",
      "Excellent judgment on that one!",
      "A great move — nearly perfect!",
    ],
  },
  review_best: {
    gif: "clap",
    quips: [
      "That's the engine's top choice! Best move!",
      "Perfect — that's the best move!",
      "Exactly what the engine recommends!",
      "Best move! You found the engine line!",
      "Spot on! That's the top engine choice.",
      "Textbook perfect. Best move!",
    ],
  },
  review_good: {
    gif: "talk",
    quips: [
      "Solid move. Nothing wrong with that.",
      "Good move — keeps things steady.",
      "A sensible choice.",
      "Nothing flashy, but it gets the job done.",
      "Perfectly reasonable move.",
      "Good, practical chess.",
    ],
  },
  review_book: {
    gif: "talk",
    quips: [
      "Standard book move. Theory!",
      "By the book — literally!",
      "Opening theory here.",
      "A well-known book move.",
      "Straight from the opening database.",
      "Theory move. Nothing to see here!",
    ],
  },
  game_over_win: {
    gif: "backflip",
    quips: [
      "Victory! Bonzi reigns supreme!",
      "I win! As expected!",
      "GG! Better luck next time, human!",
      "Another win in the books! I'm on a roll!",
      "That was fun! For me, anyway.",
    ],
  },
  game_over_lose: {
    gif: "sad",
    quips: [
      "You... you won?! This is unprecedented!",
      "I demand a recount! I mean, rematch!",
      "Congratulations... I guess you earned it.",
      "Fine, you win this time. ONE time.",
      "My circuits are crying. Well played.",
    ],
  },
  game_over_draw: {
    gif: "talk",
    quips: [
      "A draw? How anticlimactic.",
      "Nobody wins! How boring.",
      "A draw. I'll take it... barely.",
      "Tied? I was CLEARLY winning.",
      "Draw! Let's pretend that didn't happen and play again.",
    ],
  },
  player_resign: {
    gif: "celebrate",
    quips: [
      "You resign? Wise choice!",
      "Giving up already? Smart move, actually.",
      "A graceful resignation. I respect it. (Not really.)",
      "You resign! Finally, someone recognizes my power!",
      "Good call. It was only going to get worse.",
    ],
  },
};

const recentQuips: Map<BonziEvent, string[]> = new Map();
const MAX_RECENT = 3;

export function getRandomQuip(event: BonziEvent): { gif: BonziGifState; quip: string } {
  const entry = QUIP_MAP[event];
  const recent = recentQuips.get(event) ?? [];

  // Filter out recently used quips
  let available = entry.quips.filter((q) => !recent.includes(q));
  if (available.length === 0) {
    // Reset if all quips have been used recently
    available = entry.quips;
    recentQuips.set(event, []);
  }

  const quip = available[Math.floor(Math.random() * available.length)];

  // Track recent quips
  const updated = [...recent, quip].slice(-MAX_RECENT);
  recentQuips.set(event, updated);

  return { gif: entry.gif, quip };
}
