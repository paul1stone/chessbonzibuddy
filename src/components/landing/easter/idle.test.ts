import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createIdleWatcher, IDLE_EVENTS, type IdleDoc } from "./idle";

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

test("registers and removes input listeners in the capture phase", () => {
  const added: Array<[string, unknown]> = [];
  const removed: Array<[string, unknown]> = [];
  const target = {
    addEventListener: (type: string, _fn: unknown, opts: unknown) => added.push([type, opts]),
    removeEventListener: (type: string, _fn: unknown, opts: unknown) => removed.push([type, opts]),
  } as unknown as EventTarget;

  const w = createIdleWatcher(1000, () => {}, { target, doc: fakeDoc() });
  w.arm();
  w.disarm();

  expect(added.map(([type]) => type)).toEqual([...IDLE_EVENTS]);
  expect(removed.map(([type]) => type)).toEqual([...IDLE_EVENTS]);
  // Bubbling keydown never reaches window from xterm, and a mismatched flag leaks the listener.
  for (const [, opts] of added) expect(opts).toMatchObject({ capture: true });
  for (const [, opts] of removed) expect(opts).toMatchObject({ capture: true });
});
