import { create } from "zustand";

export type WindowId =
  | "games"
  | "import"
  | "review"
  | "practice"
  | "play"
  | "profile"
  | "terminal"
  | "display";

export interface WindowState {
  id: WindowId;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  x: number;
  y: number;
  z: number;
}

export const WINDOW_SIZES: Record<WindowId, { w: number; h: number }> = {
  games: { w: 360, h: 520 },
  import: { w: 520, h: 560 },
  review: { w: 960, h: 640 },
  practice: { w: 900, h: 560 },
  play: { w: 960, h: 640 },
  profile: { w: 400, h: 380 },
  terminal: { w: 680, h: 460 },
  display: { w: 404, h: 420 },
};

export const WINDOW_IDS: WindowId[] = [
  "games",
  "import",
  "review",
  "practice",
  "play",
  "profile",
  "terminal",
  "display",
];

// S1: the stair starts right of the icon column so the first window never covers the icons.
// Only x moves out — a 640px-tall window dropped at y 120 hangs past the taskbar on a 768px
// viewport, so the vertical origin stays where it was.
const CASCADE_ORIGIN_X = 120;
const CASCADE_ORIGIN_Y = 48;
const CASCADE_STEP = 24;
// The margin the frame's own `min(size, calc(100v* - 16px))` sizing already assumes on each side.
const CASCADE_MARGIN = 8;
// Mirrors --r-taskbar-h: the desktop surface windows sit on stops above the taskbar.
const TASKBAR_H = 30;

export interface Viewport {
  w: number;
  h: number;
}

interface WindowStore {
  windows: Record<WindowId, WindowState>;
  focused: WindowId | null;
  nextZ: number;
  open: (id: WindowId, viewport?: Viewport) => void;
  close: (id: WindowId) => void;
  minimize: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  cascadeAll: (viewport?: Viewport) => void;
  tileAll: (viewport?: Viewport) => void;
  minimizeAll: () => void;
  reset: () => void;
}

/** One axis of the stair: the full step, unless the window would hang past the far edge. */
function stairAxis(origin: number, step: number, available: number, size: number): number {
  return Math.min(origin + step, Math.max(CASCADE_MARGIN, available - size - CASCADE_MARGIN));
}

/**
 * Where a window lands on the cascade. The origin clears the icon column, but a window that
 * cannot fit there backs off toward the margin instead — content off the edge is worse than a
 * partly covered icon. Both axes need it: a 960px window at x 120 runs off a 1024px screen, and
 * a 640px window four steps down hangs below the taskbar on a 768px one.
 *
 * `vp.h` is already the height above the taskbar (viewportSize subtracts it), so this must not
 * subtract TASKBAR_H again.
 */
function cascadePos(id: WindowId, step: number, vp: Viewport): { x: number; y: number } {
  const { w, h } = WINDOW_SIZES[id];
  return {
    x: stairAxis(CASCADE_ORIGIN_X, step, vp.w, w),
    y: stairAxis(CASCADE_ORIGIN_Y, step, vp.h, h),
  };
}

const closedWindow = (id: WindowId): WindowState => ({
  id, open: false, minimized: false, maximized: false, x: 0, y: 0, z: 0,
});

const initialWindows = () =>
  Object.fromEntries(WINDOW_IDS.map((id) => [id, closedWindow(id)])) as Record<WindowId, WindowState>;

/** Highest-z open, non-minimized window, or null. */
function topWindow(windows: Record<WindowId, WindowState>, except?: WindowId): WindowId | null {
  let best: WindowId | null = null;
  for (const id of WINDOW_IDS) {
    const w = windows[id];
    if (!w.open || w.minimized || id === except) continue;
    if (best === null || w.z > windows[best].z) best = id;
  }
  return best;
}

/** Open, non-minimized windows in WINDOW_IDS order — the ones Cascade and Tile arrange. */
function visibleWindows(windows: Record<WindowId, WindowState>): WindowId[] {
  return WINDOW_IDS.filter((id) => windows[id].open && !windows[id].minimized);
}

/**
 * Compacts z to 1..N over the open windows in their current stacking order. Every z-assigning
 * action runs this, so z tracks the window count instead of growing with every click and can
 * never climb past the trace and menu layers above the desktop.
 */
function normalizeZ(windows: Record<WindowId, WindowState>): {
  windows: Record<WindowId, WindowState>;
  nextZ: number;
} {
  // WINDOW_IDS order breaks ties, since Array.sort is stable.
  const open = WINDOW_IDS.filter((id) => windows[id].open).sort((a, b) => windows[a].z - windows[b].z);
  const next = { ...windows };
  open.forEach((id, i) => {
    if (next[id].z !== i + 1) next[id] = { ...next[id], z: i + 1 };
  });
  return { windows: next, nextZ: open.length + 1 };
}

// Injectable in the placing actions so node-env tests never reach for `window`.
function viewportSize(): Viewport {
  if (typeof window === "undefined") return { w: 1024, h: 768 - TASKBAR_H };
  return { w: window.innerWidth, h: window.innerHeight - TASKBAR_H };
}

export const useWindowStore = create<WindowStore>((set) => ({
  windows: initialWindows(),
  focused: null,
  nextZ: 1,

  open: (id, viewport) =>
    set((s) => {
      const w = s.windows[id];
      if (w.open) {
        return { ...normalizeZ({ ...s.windows, [id]: { ...w, minimized: false, z: s.nextZ } }), focused: id };
      }
      const openCount = WINDOW_IDS.filter((i) => s.windows[i].open).length;
      const step = CASCADE_STEP * openCount;
      return {
        ...normalizeZ({
          ...s.windows,
          [id]: {
            ...w,
            open: true,
            minimized: false,
            maximized: false,
            ...cascadePos(id, step, viewport ?? viewportSize()),
            z: s.nextZ,
          },
        }),
        focused: id,
      };
    }),

  close: (id) =>
    set((s) => {
      const windows = { ...s.windows, [id]: closedWindow(id) };
      return { windows, focused: s.focused === id ? topWindow(windows) : s.focused };
    }),

  minimize: (id) =>
    set((s) => {
      if (!s.windows[id].open) return s;
      const windows = { ...s.windows, [id]: { ...s.windows[id], minimized: true } };
      return { windows, focused: s.focused === id ? topWindow(windows) : s.focused };
    }),

  toggleMaximize: (id) =>
    set((s) => {
      if (!s.windows[id].open) return s;
      return {
        ...normalizeZ({
          ...s.windows,
          [id]: { ...s.windows[id], maximized: !s.windows[id].maximized, z: s.nextZ },
        }),
        focused: id,
      };
    }),

  focus: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (!w.open) return s;
      // Every pointerdown inside a window calls this; skip the write when it changes nothing.
      if (s.focused === id && !w.minimized && topWindow(s.windows) === id) return s;
      return { ...normalizeZ({ ...s.windows, [id]: { ...w, minimized: false, z: s.nextZ } }), focused: id };
    }),

  move: (id, x, y) =>
    set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], x, y } } })),

  cascadeAll: (viewport) =>
    set((s) => {
      // Back-to-front, so the window that was on top stays on top of the stair.
      const ids = visibleWindows(s.windows).sort((a, b) => s.windows[a].z - s.windows[b].z);
      if (ids.length === 0) return s;
      const vp = viewport ?? viewportSize();
      const windows = { ...s.windows };
      let z = s.nextZ;
      // Clamped per window: each one is measured against its own size, so a small window keeps
      // the full origin while a large one in the same cascade steps back to the margin.
      ids.forEach((id, i) => {
        windows[id] = {
          ...windows[id],
          maximized: false,
          ...cascadePos(id, CASCADE_STEP * i, vp),
          z: z++,
        };
      });
      return { ...normalizeZ(windows), focused: ids[ids.length - 1] };
    }),

  // Sizes stay fixed (spec 3): tiling only walks the positions across a grid of cells.
  tileAll: (viewport) =>
    set((s) => {
      const ids = visibleWindows(s.windows);
      if (ids.length === 0) return s;
      const vp = viewport ?? viewportSize();
      const cols = Math.ceil(Math.sqrt(ids.length));
      const rows = Math.ceil(ids.length / cols);
      // Re-stack every tile: a stale huge z would otherwise cover its neighbours. The active
      // window takes the top of the pass so tiling never moves focus out from under the user.
      const active = s.focused && ids.includes(s.focused) ? s.focused : null;
      const stacking = active ? [...ids.filter((id) => id !== active), active] : ids;
      let z = s.nextZ;
      const zOf = new Map(stacking.map((id) => [id, z++]));
      const windows = { ...s.windows };
      // Cells stay in WINDOW_IDS order, so repeated tiles give the same layout.
      ids.forEach((id, i) => {
        const x = Math.round((i % cols) * (vp.w / cols));
        const y = Math.round(Math.floor(i / cols) * (vp.h / rows));
        windows[id] = { ...windows[id], maximized: false, x, y, z: zOf.get(id)! };
      });
      return { ...normalizeZ(windows), focused: active ?? stacking[stacking.length - 1] };
    }),

  minimizeAll: () =>
    set((s) => {
      const windows = { ...s.windows };
      for (const id of WINDOW_IDS) {
        if (windows[id].open) windows[id] = { ...windows[id], minimized: true };
      }
      return { windows, focused: null };
    }),

  reset: () => set({ windows: initialWindows(), focused: null, nextZ: 1 }),
}));

export function useWindowFocused(id: WindowId): boolean {
  return useWindowStore((s) => s.focused === id);
}
