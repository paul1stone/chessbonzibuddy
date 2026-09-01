import { beforeEach, describe, expect, it } from "vitest";
import {
  APPEARANCE_KEY,
  createDesktopStore,
  defaultIconPos,
  desktopBackgroundStyle,
  DESKTOP_ICON_IDS,
  GRID,
  POSITIONS_KEY,
  useDesktopStore,
  WIN98_COLORS,
} from "./desktop-store";
import { WINDOW_IDS } from "./window-store";

// Node-env tests never touch `window`: every store under test gets a fake Storage injected.
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

let storage: Storage;
let store: ReturnType<typeof createDesktopStore>;
const s = () => store.getState();

beforeEach(() => {
  storage = fakeStorage();
  store = createDesktopStore(storage);
});

describe("desktop icon ids", () => {
  it("lists the seven icons and excludes display", () => {
    expect(DESKTOP_ICON_IDS).toEqual(["games", "import", "review", "practice", "play", "profile", "terminal"]);
    expect(DESKTOP_ICON_IDS).not.toContain("display");
    expect(DESKTOP_ICON_IDS.every((id) => WINDOW_IDS.includes(id))).toBe(true);
  });

  it("stacks default positions in one column", () => {
    expect(defaultIconPos(0)).toEqual({ x: GRID.x, y: GRID.y });
    expect(defaultIconPos(3)).toEqual({ x: GRID.x, y: GRID.y + 3 * GRID.stepY });
  });

  it("offers the teal desktop colour first", () => {
    expect(WIN98_COLORS[0].value).toBe("#008080");
    expect(WIN98_COLORS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("desktop selection", () => {
  it("selects one icon at a time", () => {
    s().select("games");
    s().select("review");
    expect([...s().selected]).toEqual(["review"]);
  });

  it("toggles with the ctrl/cmd modifier", () => {
    s().select("games");
    s().select("review", { toggle: true });
    expect([...s().selected].sort()).toEqual(["games", "review"]);
    s().select("games", { toggle: true });
    expect([...s().selected]).toEqual(["review"]);
  });

  it("marquee selection replaces the whole set and clearing empties it", () => {
    s().select("games");
    s().setSelection(["review", "play"]);
    expect([...s().selected].sort()).toEqual(["play", "review"]);
    s().clearSelection();
    expect(s().selected.size).toBe(0);
  });

  it("hands out a NEW Set on every selection update", () => {
    const initial = s().selected;
    s().select("games");
    const afterSelect = s().selected;
    expect(afterSelect).not.toBe(initial);

    s().select("games");
    expect(s().selected).not.toBe(afterSelect);

    const beforeToggle = s().selected;
    s().select("review", { toggle: true });
    expect(s().selected).not.toBe(beforeToggle);

    const beforeSet = s().selected;
    s().setSelection(["play"]);
    expect(s().selected).not.toBe(beforeSet);

    const beforeClear = s().selected;
    s().clearSelection();
    expect(s().selected).not.toBe(beforeClear);

    const beforeSecondClear = s().selected;
    s().clearSelection();
    expect(s().selected).not.toBe(beforeSecondClear);
  });
});

describe("desktop icon positions", () => {
  it("moves one icon and leaves the rest on their default slot", () => {
    s().moveIcon("review", { x: 240, y: 120 });
    expect(s().positions.review).toEqual({ x: 240, y: 120 });
    expect(s().positions.games).toBeUndefined();
  });

  it("lines icons back up by dropping every override", () => {
    s().moveIcon("review", { x: 240, y: 120 });
    s().moveIcon("play", { x: 400, y: 300 });
    s().lineUpIcons();
    expect(s().positions).toEqual({});
  });

  it("replaces the positions object rather than mutating it", () => {
    const before = s().positions;
    s().moveIcon("games", { x: 10, y: 20 });
    expect(s().positions).not.toBe(before);
  });
});

describe("desktop appearance", () => {
  it("defaults to the teal desktop with no pattern", () => {
    expect(s().appearance).toEqual({ color: "#008080", pattern: "none" });
  });

  it("applies a new colour and pattern", () => {
    s().setAppearance({ color: "#000080", pattern: "checks" });
    expect(s().appearance).toEqual({ color: "#000080", pattern: "checks" });
  });

  it("builds a background style from the appearance", () => {
    expect(desktopBackgroundStyle({ color: "#000080", pattern: "none" })).toEqual({ backgroundColor: "#000080" });
    const checks = desktopBackgroundStyle({ color: "#008080", pattern: "checks" });
    expect(checks.backgroundColor).toBe("#008080");
    expect(String(checks.backgroundImage)).toContain("gradient");
    const weave = desktopBackgroundStyle({ color: "#008080", pattern: "weave" });
    expect(weave.backgroundImage).not.toBe(checks.backgroundImage);
  });
});

describe("desktop persistence", () => {
  it("writes positions synchronously on every move", () => {
    s().moveIcon("games", { x: 64, y: 96 });
    expect(JSON.parse(storage.getItem(POSITIONS_KEY)!)).toEqual({ games: { x: 64, y: 96 } });
    s().lineUpIcons();
    expect(JSON.parse(storage.getItem(POSITIONS_KEY)!)).toEqual({});
  });

  it("writes appearance synchronously on apply", () => {
    s().setAppearance({ color: "#800000", pattern: "weave" });
    expect(JSON.parse(storage.getItem(APPEARANCE_KEY)!)).toEqual({ color: "#800000", pattern: "weave" });
  });

  it("survives a storage that throws", () => {
    const hostile = fakeStorage();
    hostile.setItem = () => {
      throw new Error("quota");
    };
    const guarded = createDesktopStore(hostile);
    expect(() => guarded.getState().moveIcon("games", { x: 1, y: 2 })).not.toThrow();
    expect(guarded.getState().positions.games).toEqual({ x: 1, y: 2 });
  });

  it("works with no storage at all", () => {
    const none = createDesktopStore(null);
    expect(() => none.getState().setAppearance({ color: "#000000", pattern: "none" })).not.toThrow();
    none.getState().rehydrate();
    expect(none.getState().hydrated).toBe(true);
  });
});

describe("desktop rehydrate", () => {
  it("starts unhydrated on defaults so SSR and the first client render match", () => {
    expect(s().hydrated).toBe(false);
    expect(s().positions).toEqual({});
    expect(s().appearance).toEqual({ color: "#008080", pattern: "none" });
    expect(useDesktopStore.getState().hydrated).toBe(false);
  });

  it("restores positions and appearance from storage", () => {
    const seeded = createDesktopStore(
      fakeStorage({
        [POSITIONS_KEY]: JSON.stringify({ review: { x: 300, y: 40 } }),
        [APPEARANCE_KEY]: JSON.stringify({ color: "#800080", pattern: "weave" }),
      })
    );
    seeded.getState().rehydrate();
    expect(seeded.getState().positions).toEqual({ review: { x: 300, y: 40 } });
    expect(seeded.getState().appearance).toEqual({ color: "#800080", pattern: "weave" });
    expect(seeded.getState().hydrated).toBe(true);
  });

  it("falls back to defaults on empty or malformed storage", () => {
    s().rehydrate();
    expect(s().positions).toEqual({});
    expect(s().appearance).toEqual({ color: "#008080", pattern: "none" });
    expect(s().hydrated).toBe(true);

    const junk = createDesktopStore(
      fakeStorage({ [POSITIONS_KEY]: "{not json", [APPEARANCE_KEY]: JSON.stringify({ color: 5, pattern: "plaid" }) })
    );
    junk.getState().rehydrate();
    expect(junk.getState().positions).toEqual({});
    expect(junk.getState().appearance).toEqual({ color: "#008080", pattern: "none" });
    expect(junk.getState().hydrated).toBe(true);
  });

  it("drops a persisted colour that is not in the palette", () => {
    const offPalette = createDesktopStore(
      fakeStorage({ [APPEARANCE_KEY]: JSON.stringify({ color: "#123456", pattern: "checks" }) })
    );
    offPalette.getState().rehydrate();
    expect(offPalette.getState().appearance).toEqual({ color: "#008080", pattern: "none" });
  });

  it("drops persisted entries for unknown ids and non-numeric coords", () => {
    const seeded = createDesktopStore(
      fakeStorage({
        [POSITIONS_KEY]: JSON.stringify({ review: { x: 10, y: 20 }, mystery: { x: 1, y: 2 }, play: { x: "8", y: 9 } }),
      })
    );
    seeded.getState().rehydrate();
    expect(seeded.getState().positions).toEqual({ review: { x: 10, y: 20 } });
  });

  it("reset returns to the pre-hydration defaults", () => {
    s().select("games");
    s().moveIcon("games", { x: 1, y: 1 });
    s().setAppearance({ color: "#000000", pattern: "checks" });
    s().rehydrate();
    s().reset();
    expect(s().selected.size).toBe(0);
    expect(s().positions).toEqual({});
    expect(s().appearance).toEqual({ color: "#008080", pattern: "none" });
    expect(s().hydrated).toBe(false);
  });
});
