import { beforeEach, describe, expect, it } from "vitest";
import { useWindowStore, WINDOW_SIZES } from "./window-store";

const s = () => useWindowStore.getState();

beforeEach(() => useWindowStore.getState().reset());

describe("window store", () => {
  it("opens with a cascading position and focus", () => {
    s().open("games");
    s().open("import");
    const games = s().windows.games;
    const imp = s().windows.import;
    expect(games.open).toBe(true);
    expect(games.x).toBe(48);
    expect(imp.x).toBe(72);
    expect(imp.y).toBe(72);
    expect(s().focused).toBe("import");
    expect(imp.z).toBeGreaterThan(games.z);
  });

  it("re-opening a minimized window restores and focuses it", () => {
    s().open("games");
    s().minimize("games");
    expect(s().windows.games.minimized).toBe(true);
    expect(s().focused).toBeNull();
    s().open("games");
    expect(s().windows.games.minimized).toBe(false);
    expect(s().focused).toBe("games");
  });

  it("focus bumps z above every other window", () => {
    s().open("games");
    s().open("review");
    s().focus("games");
    expect(s().windows.games.z).toBeGreaterThan(s().windows.review.z);
    expect(s().focused).toBe("games");
  });

  it("close clears focus and falls back to the top remaining window", () => {
    s().open("games");
    s().open("review");
    s().close("review");
    expect(s().windows.review.open).toBe(false);
    expect(s().focused).toBe("games");
  });

  it("move updates position and toggleMaximize round-trips", () => {
    s().open("play");
    s().move("play", 200, 120);
    expect(s().windows.play.x).toBe(200);
    s().toggleMaximize("play");
    expect(s().windows.play.maximized).toBe(true);
    s().toggleMaximize("play");
    expect(s().windows.play.maximized).toBe(false);
    expect(s().windows.play.x).toBe(200);
  });

  it("declares a size for every window id", () => {
    for (const id of ["games", "import", "review", "practice", "play", "profile"] as const) {
      expect(WINDOW_SIZES[id].w).toBeGreaterThan(300);
      expect(WINDOW_SIZES[id].h).toBeGreaterThan(300);
    }
  });
});
