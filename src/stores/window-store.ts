import { create } from "zustand";

export type WindowId = "games" | "import" | "review" | "practice" | "play" | "profile" | "terminal";

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
};

export const WINDOW_IDS: WindowId[] = ["games", "import", "review", "practice", "play", "profile", "terminal"];

const CASCADE_ORIGIN = 48;
const CASCADE_STEP = 24;

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

export const useWindowStore = create<WindowStore>((set) => ({
  windows: initialWindows(),
  focused: null,
  nextZ: 1,

  open: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (w.open) {
        return {
          windows: { ...s.windows, [id]: { ...w, minimized: false, z: s.nextZ } },
          focused: id,
          nextZ: s.nextZ + 1,
        };
      }
      const openCount = WINDOW_IDS.filter((i) => s.windows[i].open).length;
      const offset = CASCADE_ORIGIN + CASCADE_STEP * openCount;
      return {
        windows: {
          ...s.windows,
          [id]: { ...w, open: true, minimized: false, maximized: false, x: offset, y: offset, z: s.nextZ },
        },
        focused: id,
        nextZ: s.nextZ + 1,
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
        windows: { ...s.windows, [id]: { ...s.windows[id], maximized: !s.windows[id].maximized, z: s.nextZ } },
        focused: id,
        nextZ: s.nextZ + 1,
      };
    }),

  focus: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (!w.open) return s;
      return {
        windows: { ...s.windows, [id]: { ...w, minimized: false, z: s.nextZ } },
        focused: id,
        nextZ: s.nextZ + 1,
      };
    }),

  move: (id, x, y) =>
    set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], x, y } } })),

  reset: () => set({ windows: initialWindows(), focused: null, nextZ: 1 }),
}));

export function useWindowFocused(id: WindowId): boolean {
  return useWindowStore((s) => s.focused === id);
}
