import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createIdleWatcher, type IdleDoc } from "./idle";

const fakeDoc = (): IdleDoc => ({
  visibilityState: "visible",
  addEventListener: () => {},
  removeEventListener: () => {},
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("fires after ms of silence and not before", () => {
  const onIdle = vi.fn();
  const target = new EventTarget();
  const w = createIdleWatcher(1000, onIdle, { target, doc: fakeDoc() });
  w.arm();
  vi.advanceTimersByTime(999);
  expect(onIdle).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onIdle).toHaveBeenCalledOnce();
  w.disarm();
});

test("input resets the countdown", () => {
  const onIdle = vi.fn();
  const target = new EventTarget();
  const w = createIdleWatcher(1000, onIdle, { target, doc: fakeDoc() });
  w.arm();
  vi.advanceTimersByTime(900);
  target.dispatchEvent(new Event("pointermove"));
  vi.advanceTimersByTime(900);
  expect(onIdle).not.toHaveBeenCalled();
  w.disarm();
});

test("disarm cancels the countdown", () => {
  const onIdle = vi.fn();
  const target = new EventTarget();
  const w = createIdleWatcher(1000, onIdle, { target, doc: fakeDoc() });
  w.arm();
  w.disarm();
  vi.advanceTimersByTime(5000);
  expect(onIdle).not.toHaveBeenCalled();
});
