import { beforeEach, describe, expect, test } from "vitest";
import { DOCK_LABELS, DOCK_ORDER, useDockStore } from "./dock-store";

beforeEach(() => useDockStore.getState().reset());

describe("dock store", () => {
  test("starts undocked and inactive", () => {
    const s = useDockStore.getState();
    expect(DOCK_ORDER.every((id) => !s.docked[id])).toBe(true);
    expect(s.active).toBeNull();
  });

  test("docks and undocks a section", () => {
    useDockStore.getState().setDocked("import", true);
    expect(useDockStore.getState().docked.import).toBe(true);
    useDockStore.getState().setDocked("import", false);
    expect(useDockStore.getState().docked.import).toBe(false);
  });

  test("tracks the active section", () => {
    useDockStore.getState().setActive("review");
    expect(useDockStore.getState().active).toBe("review");
    useDockStore.getState().setActive(null);
    expect(useDockStore.getState().active).toBeNull();
  });

  test("registers and clears scroll fns", () => {
    const fn = () => 1234;
    useDockStore.getState().registerScrollFn("review", fn);
    expect(useDockStore.getState().scrollFns.review?.()).toBe(1234);
    useDockStore.getState().registerScrollFn("review", null);
    expect(useDockStore.getState().scrollFns.review).toBeUndefined();
  });

  test("labels cover every dock id", () => {
    for (const id of DOCK_ORDER) expect(DOCK_LABELS[id]).toBeTruthy();
  });

  test("tracks the arrived desktop finale", () => {
    expect(useDockStore.getState().desktopActive).toBe(false);
    useDockStore.getState().setDesktopActive(true);
    expect(useDockStore.getState().desktopActive).toBe(true);
    useDockStore.getState().setDesktopActive(false);
    expect(useDockStore.getState().desktopActive).toBe(false);
  });

  test("reset clears the arrived flag", () => {
    useDockStore.getState().setDesktopActive(true);
    useDockStore.getState().reset();
    expect(useDockStore.getState().desktopActive).toBe(false);
  });

  test("setDesktopActive keeps the same state object when unchanged", () => {
    useDockStore.getState().setDesktopActive(true);
    const before = useDockStore.getState();
    useDockStore.getState().setDesktopActive(true);
    expect(useDockStore.getState()).toBe(before);
  });
});
