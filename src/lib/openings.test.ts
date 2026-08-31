import { it, expect } from "vitest";
import { epdFromFen, loadOpenings } from "./openings";

it("epdFromFen strips clocks", () => {
  expect(epdFromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"))
    .toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
});

it("loadOpenings contains 1.e4 and not a random midgame", async () => {
  const set = await loadOpenings();
  expect(set.has("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -")).toBe(true);
  expect(set.has("8/8/8/8/8/8/8/4k2K w - -")).toBe(false);
  expect(set.size).toBeGreaterThan(3000);
});
