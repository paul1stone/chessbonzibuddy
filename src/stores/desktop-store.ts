import type { CSSProperties } from "react";
import { create } from "zustand";
import { WINDOW_IDS, type WindowId } from "./window-store";

export interface IconPos {
  x: number;
  y: number;
}

// Uniform column that approximates today's flex layout (whose per-icon heights varied with
// label wrapping) — the pitch is eyeballed, not pixel-equal to the old stack.
export const GRID = { x: 8, y: 8, stepY: 76 };

// The icons that live on the desktop. "display" is deliberately absent: Display Properties
// opens from the context menus only.
export const DESKTOP_ICON_IDS: WindowId[] = [
  "games",
  "import",
  "review",
  "practice",
  "play",
  "profile",
  "terminal",
];

export const WIN98_COLORS: { name: string; value: string }[] = [
  { name: "Teal", value: "#008080" },
  { name: "Navy", value: "#000080" },
  { name: "Maroon", value: "#800000" },
  { name: "Olive", value: "#808000" },
  { name: "Purple", value: "#800080" },
  { name: "Silver", value: "#c0c0c0" },
  { name: "Black", value: "#000000" },
];

export type DesktopPattern = "none" | "checks" | "weave";

export const DESKTOP_PATTERNS: { name: string; value: DesktopPattern }[] = [
  { name: "(None)", value: "none" },
  { name: "Checks", value: "checks" },
  { name: "Weave", value: "weave" },
];

export interface DesktopAppearance {
  color: string;
  pattern: DesktopPattern;
}

export const POSITIONS_KEY = "cbb-desktop-icons";
export const APPEARANCE_KEY = "cbb-desktop-appearance";

const DEFAULT_APPEARANCE: DesktopAppearance = { color: "#008080", pattern: "none" };

interface DesktopStore {
  selected: ReadonlySet<WindowId>;
  positions: Partial<Record<WindowId, IconPos>>;
  appearance: DesktopAppearance;
  hydrated: boolean;
  select: (id: WindowId, opts?: { toggle?: boolean }) => void;
  setSelection: (ids: WindowId[]) => void;
  clearSelection: () => void;
  moveIcon: (id: WindowId, pos: IconPos) => void;
  lineUpIcons: () => void;
  setAppearance: (a: DesktopAppearance) => void;
  rehydrate: () => void;
  reset: () => void;
}

// Reading the property itself throws when cookies are blocked, so every call site goes through this.
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function defaultIconPos(index: number): IconPos {
  return { x: GRID.x, y: GRID.y + index * GRID.stepY };
}

export function desktopBackgroundStyle(a: DesktopAppearance): CSSProperties {
  if (a.pattern === "checks") {
    return {
      backgroundColor: a.color,
      backgroundImage: "repeating-conic-gradient(rgba(0,0,0,0.22) 0% 25%, rgba(255,255,255,0.1) 0% 50%)",
      backgroundSize: "4px 4px",
    };
  }
  if (a.pattern === "weave") {
    return {
      backgroundColor: a.color,
      backgroundImage:
        "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 4px), " +
        "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 4px)",
      backgroundSize: "4px 4px",
    };
  }
  return { backgroundColor: a.color };
}

function isPattern(v: unknown): v is DesktopPattern {
  return v === "none" || v === "checks" || v === "weave";
}

function readPositions(storage: Storage | null): Partial<Record<WindowId, IconPos>> {
  const raw = read(storage, POSITIONS_KEY);
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<WindowId, IconPos>> = {};
  for (const [id, pos] of Object.entries(raw as Record<string, unknown>)) {
    if (!WINDOW_IDS.includes(id as WindowId)) continue;
    const p = pos as Partial<IconPos> | null;
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
    out[id as WindowId] = { x: p.x, y: p.y };
  }
  return out;
}

function readAppearance(storage: Storage | null): DesktopAppearance {
  const raw = read(storage, APPEARANCE_KEY) as Partial<DesktopAppearance> | null;
  // Off-palette colours are dropped the same way unknown icon ids are.
  if (!raw || !isPattern(raw.pattern) || !WIN98_COLORS.some((c) => c.value === raw.color)) {
    return { ...DEFAULT_APPEARANCE };
  }
  return { color: raw.color as string, pattern: raw.pattern };
}

function read(storage: Storage | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Last writer wins across tabs: each action is a discrete user gesture, so writes are
// synchronous and unconditional rather than merged.
function write(storage: Storage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failures leave the in-memory state authoritative.
  }
}

const initialState = () => ({
  selected: new Set<WindowId>() as ReadonlySet<WindowId>,
  positions: {} as Partial<Record<WindowId, IconPos>>,
  appearance: { ...DEFAULT_APPEARANCE },
  hydrated: false,
});

/** Storage is injected so node-env tests can drive persistence without a `window`. */
export function createDesktopStore(storage: Storage | null) {
  return create<DesktopStore>((set, get) => ({
    ...initialState(),

    // Every selection update installs a NEW Set — reference equality is what drives re-renders.
    select: (id, opts) =>
      set((s) => {
        if (!opts?.toggle) return { selected: new Set([id]) };
        const next = new Set(s.selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selected: next };
      }),

    setSelection: (ids) => set({ selected: new Set(ids) }),

    clearSelection: () => set({ selected: new Set<WindowId>() }),

    moveIcon: (id, pos) => {
      set((s) => ({ positions: { ...s.positions, [id]: pos } }));
      write(storage, POSITIONS_KEY, get().positions);
    },

    lineUpIcons: () => {
      // Dropping every override puts each icon back on its default grid slot.
      set({ positions: {} });
      write(storage, POSITIONS_KEY, get().positions);
    },

    setAppearance: (a) => {
      set({ appearance: { ...a } });
      write(storage, APPEARANCE_KEY, get().appearance);
    },

    // Called from a client effect only — never at module scope, or SSR and the first
    // client render would disagree.
    rehydrate: () =>
      set({ positions: readPositions(storage), appearance: readAppearance(storage), hydrated: true }),

    // In-memory only; persisted values stay put.
    reset: () => set(initialState()),
  }));
}

export const useDesktopStore = createDesktopStore(safeLocalStorage());
