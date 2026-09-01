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

const CASCADE_ORIGIN = 48;
const CASCADE_STEP = 24;
// Mirrors --r-taskbar-h: the desktop surface windows sit on stops above the taskbar.
const TASKBAR_H = 30;

interface WindowStore {
  windows: Record<WindowId, WindowState>;
  focused: WindowId | null;
  nextZ: number;
  open: (id: WindowId) => void;
  close: (id: WindowId) => void;
  minimize: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  cascadeAll: () => void;
  tileAll: (viewport?: { w: number; h: number }) => void;
  minimizeAll: () => void;
  reset: () => void;
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

// Injectable in tileAll so node-env tests never reach for `window`.
function viewportSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1024, h: 768 - TASKBAR_H };
  return { w: window.innerWidth, h: window.innerHeight - TASKBAR_H };
}

export const useWindowStore = create<WindowStore>((set) => ({
  windows: initialWindows(),
  focused: null,
  nextZ: 1,

  open: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (w.open) {
        return { ...normalizeZ({ ...s.windows, [id]: { ...w, minimized: false, z: s.nextZ } }), focused: id };
      }
      const openCount = WINDOW_IDS.filter((i) => s.windows[i].open).length;
      const offset = CASCADE_ORIGIN + CASCADE_STEP * openCount;
      return {
        ...normalizeZ({
          ...s.windows,
          [id]: { ...w, open: true, minimized: false, maximized: false, x: offset, y: offset, z: s.nextZ },
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

  cascadeAll: () =>
    set((s) => {
      // Back-to-front, so the window that was on top stays on top of the stair.
      const ids = visibleWindows(s.windows).sort((a, b) => s.windows[a].z - s.windows[b].z);
      if (ids.length === 0) return s;
      const windows = { ...s.windows };
      let z = s.nextZ;
      ids.forEach((id, i) => {
        const offset = CASCADE_ORIGIN + CASCADE_STEP * i;
        windows[id] = { ...windows[id], maximized: false, x: offset, y: offset, z: z++ };
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
