import { create } from "zustand";

export type DockId = "hero" | "showcase" | "import" | "review" | "practice";

export const DOCK_ORDER: DockId[] = ["hero", "showcase", "import", "review", "practice"];

export const DOCK_LABELS: Record<DockId, string> = {
  hero: "Chess Bonzi Buddy",
  showcase: "BonziBUDDY.exe",
  import: "Import",
  review: "Review",
  practice: "Practice",
};

interface DockStore {
  docked: Record<DockId, boolean>;
  active: DockId | null;
  /** True once the landing's desktop finale fills the viewport: the taskbar hands over to it. */
  desktopActive: boolean;
  targets: Partial<Record<DockId, HTMLElement>>;
  /** Absolute scrollY per section, so pinned sections can be jumped to precisely. */
  scrollFns: Partial<Record<DockId, () => number>>;
  setDocked: (id: DockId, v: boolean) => void;
  setActive: (id: DockId | null) => void;
  setDesktopActive: (v: boolean) => void;
  registerTarget: (id: DockId, el: HTMLElement | null) => void;
  registerScrollFn: (id: DockId, fn: (() => number) | null) => void;
  reset: () => void;
}

const initialDocked = () =>
  Object.fromEntries(DOCK_ORDER.map((id) => [id, false])) as Record<DockId, boolean>;

/** Drops the key entirely when value is null, so callers can test with `?.` / undefined. */
function withEntry<T>(map: Partial<Record<DockId, T>>, id: DockId, value: T | null) {
  const next = { ...map };
  if (value === null) delete next[id];
  else next[id] = value;
  return next;
}

export const useDockStore = create<DockStore>((set) => ({
  docked: initialDocked(),
  active: null,
  desktopActive: false,
  targets: {},
  scrollFns: {},

  setDocked: (id, v) => set((s) => (s.docked[id] === v ? s : { docked: { ...s.docked, [id]: v } })),

  setActive: (id) => set((s) => (s.active === id ? s : { active: id })),

  setDesktopActive: (v) => set((s) => (s.desktopActive === v ? s : { desktopActive: v })),

  registerTarget: (id, el) => set((s) => ({ targets: withEntry(s.targets, id, el) })),

  registerScrollFn: (id, fn) => set((s) => ({ scrollFns: withEntry(s.scrollFns, id, fn) })),

  reset: () =>
    set({ docked: initialDocked(), active: null, desktopActive: false, targets: {}, scrollFns: {} }),
}));
