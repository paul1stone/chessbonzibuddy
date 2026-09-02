import { beforeEach, describe, expect, it } from "vitest";
import { useWindowStore, WINDOW_IDS, WINDOW_SIZES } from "./window-store";

const s = () => useWindowStore.getState();
// Wide enough that every window fits at the full cascade origin, so placement tests that are not
// about the clamp keep their stair whatever the headless viewport fallback happens to be.
const WIDE = { w: 1440, h: 900 };

beforeEach(() => useWindowStore.getState().reset());

describe("window store", () => {
  it("opens with a cascading position and focus", () => {
    s().open("games");
    s().open("import");
    const games = s().windows.games;
    const imp = s().windows.import;
    expect(games.open).toBe(true);
    expect(games.x).toBe(120);
    expect(games.y).toBe(48);
    expect(imp.x).toBe(144);
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
    expect(WINDOW_IDS).toHaveLength(Object.keys(WINDOW_SIZES).length);
    for (const id of WINDOW_IDS) {
      expect(WINDOW_SIZES[id].w).toBeGreaterThan(300);
      expect(WINDOW_SIZES[id].h).toBeGreaterThan(300);
    }
  });

  it("registers the terminal window", () => {
    expect(WINDOW_IDS).toContain("terminal");
    expect(WINDOW_SIZES.terminal).toEqual({ w: 680, h: 460 });
    s().open("terminal");
    expect(s().windows.terminal.open).toBe(true);
    expect(s().focused).toBe("terminal");
  });

  it("registers the display window", () => {
    expect(WINDOW_IDS).toContain("display");
    expect(WINDOW_IDS[WINDOW_IDS.length - 1]).toBe("display");
    expect(WINDOW_SIZES.display).toEqual({ w: 404, h: 420 });
    s().open("display");
    expect(s().windows.display.open).toBe(true);
    expect(s().focused).toBe("display");
  });

  it("cascades the visible windows in a 24px stair and focuses the top one", () => {
    s().open("games");
    s().open("review");
    s().open("profile");
    s().move("games", 500, 500);
    s().cascadeAll(WIDE);
    expect(s().windows.games).toMatchObject({ x: 120, y: 48 });
    expect(s().windows.review).toMatchObject({ x: 144, y: 72 });
    expect(s().windows.profile).toMatchObject({ x: 168, y: 96 });
    expect(s().focused).toBe("profile");
    expect(s().windows.profile.z).toBeGreaterThan(s().windows.review.z);
  });

  it("cascades back-to-front so the top window stays on top", () => {
    s().open("games");
    s().open("review");
    s().open("profile");
    s().focus("games");
    s().cascadeAll(WIDE);
    expect(s().windows.review).toMatchObject({ x: 120, y: 48 });
    expect(s().windows.profile).toMatchObject({ x: 144, y: 72 });
    expect(s().windows.games).toMatchObject({ x: 168, y: 96 });
    expect(s().focused).toBe("games");
    expect(s().windows.games.z).toBeGreaterThan(s().windows.profile.z);
    expect(s().windows.profile.z).toBeGreaterThan(s().windows.review.z);
  });

  it("cascade un-maximizes and leaves minimized windows where they are", () => {
    s().open("games");
    s().toggleMaximize("games");
    s().open("profile");
    s().move("profile", 300, 300);
    s().minimize("profile");
    s().cascadeAll();
    expect(s().windows.games).toMatchObject({ x: 120, y: 48, maximized: false });
    expect(s().windows.profile).toMatchObject({ x: 300, y: 300, minimized: true });
  });

  it("starts the stair right of the icon column but keeps it above the taskbar", () => {
    s().open("review", WIDE);
    // S1: x clears the icons; y cannot follow it, or the tallest window overflows a 768px screen.
    expect(s().windows.review.x).toBe(120);
    expect(s().windows.review.y + WINDOW_SIZES.review.h).toBeLessThanOrEqual(768 - 30);
  });

  it("pulls the origin left rather than open a window off the right edge", () => {
    for (const [width, expected] of [
      [1440, 120], // room for the full origin
      [1024, 56], // 120 + 960 would overhang by 56, so it backs off to the 8px margin
      [320, 8], // narrower than the window itself: all the way back to the margin
    ] as const) {
      s().reset();
      s().open("review", { w: width, h: 768 });
      expect(s().windows.review.x).toBe(expected);
      expect(s().windows.review.x).toBeGreaterThanOrEqual(8);
    }
  });

  it("cascade clamps each window against its own width", () => {
    const vp = { w: 1024, h: 768 };
    s().open("games", vp);
    s().open("review", vp);
    s().cascadeAll(vp);
    // The 360px window still clears the icon column; only the 960px one gives up its step.
    expect(s().windows.games).toMatchObject({ x: 120, y: 48 });
    expect(s().windows.review).toMatchObject({ x: 56, y: 72 });
    expect(s().windows.review.x + WINDOW_SIZES.review.w).toBeLessThanOrEqual(vp.w - 8);
  });

  it("tiles the visible windows into a grid inside the given viewport", () => {
    s().open("games");
    s().open("review");
    s().open("practice");
    s().tileAll({ w: 1000, h: 600 });
    expect(s().windows.games).toMatchObject({ x: 0, y: 0 });
    expect(s().windows.review).toMatchObject({ x: 500, y: 0 });
    expect(s().windows.practice).toMatchObject({ x: 0, y: 300 });
  });

  it("re-stacks every tile and keeps the active window focused and on top", () => {
    s().open("games");
    s().open("review");
    s().open("profile");
    s().focus("games");
    s().tileAll({ w: 1000, h: 600 });
    expect(s().focused).toBe("games");
    // Active window tops the pass; the rest keep WINDOW_IDS order beneath it.
    expect(s().windows.games.z).toBeGreaterThan(s().windows.profile.z);
    expect(s().windows.profile.z).toBeGreaterThan(s().windows.review.z);
    // Cells still follow WINDOW_IDS order, so the layout is stable across repeated tiles.
    expect(s().windows.games).toMatchObject({ x: 0, y: 0 });
    expect(s().windows.review).toMatchObject({ x: 500, y: 0 });
  });

  it("lifts every tile above the windows it leaves minimized", () => {
    s().open("games");
    s().open("review");
    s().open("import");
    s().minimize("import");
    s().focus("games");
    s().tileAll({ w: 1000, h: 600 });
    expect(s().windows.review.z).toBeGreaterThan(s().windows.import.z);
    expect(s().windows.games.z).toBeGreaterThan(s().windows.review.z);
  });

  it("tile focuses the top tile when no tiled window was active", () => {
    s().open("games");
    s().open("review");
    useWindowStore.setState({ focused: null });
    s().tileAll({ w: 1000, h: 600 });
    expect(s().focused).toBe("review");
    expect(s().windows.review.z).toBeGreaterThan(s().windows.games.z);
  });

  it("tiles without a viewport argument outside the browser", () => {
    s().open("games");
    s().toggleMaximize("games");
    expect(() => s().tileAll()).not.toThrow();
    expect(s().windows.games).toMatchObject({ x: 0, y: 0, maximized: false });
  });

  it("minimizes every open window and clears focus", () => {
    s().open("games");
    s().open("review");
    s().minimizeAll();
    expect(s().windows.games.minimized).toBe(true);
    expect(s().windows.review.minimized).toBe(true);
    expect(s().focused).toBeNull();
    expect(s().windows.profile.open).toBe(false);
  });

  it("focus is a no-op for the window already focused and on top", () => {
    s().open("games");
    s().open("review");
    const before = useWindowStore.getState();
    s().focus("review");
    expect(useWindowStore.getState()).toBe(before);
    s().focus("games");
    expect(useWindowStore.getState()).not.toBe(before);
    expect(s().focused).toBe("games");
  });

  it("focus still raises a focused window that is buried", () => {
    s().open("games");
    s().open("review");
    s().toggleMaximize("games");
    useWindowStore.setState({ focused: "review" });
    s().focus("review");
    expect(s().windows.review.z).toBeGreaterThan(s().windows.games.z);
  });

  it("keeps z compact to 1..N through a long open/focus churn", () => {
    for (let i = 0; i < 200; i++) {
      s().open(WINDOW_IDS[i % WINDOW_IDS.length]);
      s().focus(WINDOW_IDS[(i * 3) % WINDOW_IDS.length]);
      if (i % 5 === 0) s().toggleMaximize(WINDOW_IDS[i % WINDOW_IDS.length]);
    }
    const open = WINDOW_IDS.filter((id) => s().windows[id].open);
    const zs = open.map((id) => s().windows[id].z).sort((a, b) => a - b);
    expect(zs).toEqual(open.map((_, i) => i + 1));
    expect(s().nextZ).toBe(open.length + 1);
  });

  it("renormalizing preserves the relative order of the windows it does not touch", () => {
    s().open("games");
    s().open("import");
    s().open("review");
    s().open("practice");
    s().focus("import");
    const stack = WINDOW_IDS.filter((id) => s().windows[id].open).sort((a, b) => s().windows[a].z - s().windows[b].z);
    expect(stack).toEqual(["games", "review", "practice", "import"]);
    expect(stack.map((id) => s().windows[id].z)).toEqual([1, 2, 3, 4]);
  });

  it("cascade, tile and minimizeAll are no-ops with nothing open", () => {
    s().cascadeAll();
    s().tileAll({ w: 800, h: 600 });
    s().minimizeAll();
    expect(s().focused).toBeNull();
  });
});
