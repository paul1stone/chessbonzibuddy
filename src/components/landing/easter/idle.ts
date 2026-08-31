// Structural slice of `document` so the watcher stays testable under vitest's node environment.
export interface IdleDoc {
  visibilityState: DocumentVisibilityState;
  addEventListener: Document["addEventListener"];
  removeEventListener: Document["removeEventListener"];
}

export const IDLE_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

interface IdleWatcher {
  arm: () => void;
  disarm: () => void;
}

export function createIdleWatcher(
  ms: number,
  onIdle: () => void,
  opts?: { target?: EventTarget; doc?: IdleDoc }
): IdleWatcher {
  const target = opts?.target ?? (typeof window === "undefined" ? undefined : window);
  const doc = opts?.doc ?? (typeof document === "undefined" ? undefined : document);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let armed = false;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  // Restarts the countdown, except while the tab is hidden — a backgrounded tab is not "idle".
  const schedule = () => {
    clear();
    if (!armed || doc?.visibilityState === "hidden") return;
    timer = setTimeout(onIdle, ms);
  };

  const arm = () => {
    if (armed) return;
    armed = true;
    for (const type of IDLE_EVENTS) target?.addEventListener(type, schedule, { passive: true });
    doc?.addEventListener("visibilitychange", schedule);
    schedule();
  };

  const disarm = () => {
    armed = false;
    clear();
    for (const type of IDLE_EVENTS) target?.removeEventListener(type, schedule);
    doc?.removeEventListener("visibilitychange", schedule);
  };

  return { arm, disarm };
}
