# Retro Motion & Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the landing page's Win98 metaphor with taskbar-docking scroll choreography, a pinned window cascade, a Bonzi scroll companion, retro easter eggs, and a real Linux terminal (v86) behind the Start menu.

**Architecture:** A small zustand dock store bridges scroll position and the marketing taskbar; GSAP ScrollTriggers (dynamically imported via a shared loader) drive all choreography; the terminal is a lazily loaded v86 VM booting a committed Alpine 9p image, surfaced through the existing window manager.

**Tech Stack:** Next.js 16 App Router, React 19, GSAP 3.15 + ScrollTrigger, zustand 5, Tailwind 4 + retro.css tokens, v86, @xterm/xterm, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-retro-motion-design.md`

## Global Constraints

- Reduced motion: every animation must be absent under `prefers-reduced-motion: reduce`; use `usePrefersReducedMotion()` / `prefersReducedMotion()` from `src/lib/motion.ts` or GSAP `matchMedia`, following the existing hero pattern (`src/components/landing/hero/use-hero-scroll.ts`).
- GSAP must stay out of the initial bundle: always load it through the shared loader created in Task 1 (`src/lib/gsap-loader.ts`), never a static import.
- Commit messages: plain 3–5 words, no prefixes, no colons, no Co-Authored-By trailers (user rule).
- Comments: short, single-line, only for non-obvious constraints.
- Verification per task: `npm run typecheck`, `npm run lint`, `npm test` must pass. E2E: the Playwright config expects `localhost:3000` but an UNRELATED app may occupy it — before running e2e, check `curl -s localhost:3000 | grep -c "Chess Bonzi Buddy"`; if it is a different app, do NOT run e2e, report that step as unverified instead.
- The dev server for manual checks runs at `http://localhost:4110`.
- Styling: use retro.css tokens (`--r-face`, `--r-dark`, `--r-taskbar-h`, `r-btn`, `r-bevel-*`); no border-radius; stepped easings (`steps(n)` CSS / `SteppedEase`/snap in GSAP) for anything Win98-flavored.
- New marketing-page client components must not break SSR: guard `window`/`document` access behind effects.

---

## Parallelization map

| Wave | Tasks | Rationale |
|---|---|---|
| 1 | T1 (dock foundation), T2 (terminal assets), T3 (easter-egg components), T4 (cascade logic) | Fully disjoint file sets |
| 2 | T5 (hero retarget + boot wiring), T6 (cascade wiring), T7 (terminal app-side), T8 (Bonzi companion) | Each consumes wave-1 outputs; disjoint among themselves (T5: hero files + layout; T6: window-stack/walkthrough; T7: app-side files; T8: companion + marketing page) |
| 3 | T9 (marketing integration: shutdown, screensaver, eval bar, marketing terminal, menu items) | Touches `marketing-taskbar.tsx` and `(marketing)/page.tsx`, both owned by earlier waves |
| 4 | T10 (e2e + full verification sweep) | Needs everything |

---

### Task 1: Dock store + marketing taskbar foundation

**Files:**
- Create: `src/stores/dock-store.ts`
- Test: `src/stores/dock-store.test.ts`
- Create: `src/lib/gsap-loader.ts`
- Create: `src/components/landing/use-section-dock.ts`
- Create: `src/components/landing/marketing-taskbar.tsx`
- Modify: `src/app/(marketing)/layout.tsx` (swap `<Taskbar />` for `<MarketingTaskbar />`)
- Modify: `src/app/(marketing)/page.tsx` (showcase section registration wrapper)
- Modify: `src/components/landing/bonzi-showcase.tsx` (accept a ref-forwarding hook call — see below)

**Interfaces (later tasks rely on these exact names):**
- Produces `src/stores/dock-store.ts`:
  ```ts
  export type DockId = "hero" | "showcase" | "import" | "review" | "practice";
  export const DOCK_ORDER: DockId[];
  export const DOCK_LABELS: Record<DockId, string>;
  // labels: hero "Chess Bonzi Buddy", showcase "BonziBUDDY.exe", import "Import", review "Review", practice "Practice"
  interface DockStore {
    docked: Record<DockId, boolean>;
    active: DockId | null;
    targets: Partial<Record<DockId, HTMLElement>>;
    setDocked: (id: DockId, v: boolean) => void;
    setActive: (id: DockId | null) => void; // clears only if id currently active when v=null path used by callers
    registerTarget: (id: DockId, el: HTMLElement | null) => void;
    reset: () => void;
  }
  export const useDockStore: UseBoundStore<StoreApi<DockStore>>;
  ```
- Produces `src/lib/gsap-loader.ts`:
  ```ts
  export interface GsapBundle { gsap: typeof import("gsap").gsap; ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger; }
  export function loadGsap(): Promise<GsapBundle>; // caches the promise; registers ScrollTrigger once
  ```
- Produces `src/components/landing/use-section-dock.ts`:
  ```ts
  export function useSectionDock(id: DockId, ref: RefObject<HTMLElement | null>, opts?: { dockOnExit?: boolean }): void;
  // registers target; under reduced motion sets docked immediately; otherwise creates
  // ScrollTriggers: dock when section bottom passes viewport top (if dockOnExit !== false),
  // active while section spans viewport center.
  ```
- Produces in `marketing-taskbar.tsx`: dock buttons container carries `data-dock-slots`; each button carries `data-dock-button={id}`; the Taskbar root (in `taskbar.tsx`? no — wrap) — MarketingTaskbar renders `<div data-taskbar>` wrapper is NOT possible around a fixed child, so instead: `Taskbar` already renders a root div; add `data-taskbar` by rendering `<Taskbar menuItems={...}>` and putting `data-taskbar` on the dock-slots child. T5's boot cascade animates the taskbar via `document.querySelector(".retro .r-face.fixed")`? Too fragile — instead modify `src/components/retro/taskbar.tsx` root div to include `data-taskbar` (one-line, safe, also benefits `/app`).

**Steps:**

- [ ] **Step 1: Write failing store test** `src/stores/dock-store.test.ts` (mirror `window-store.test.ts` style):

```ts
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

  test("labels cover every dock id", () => {
    for (const id of DOCK_ORDER) expect(DOCK_LABELS[id]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it** — `npm test -- dock-store` — expect FAIL (module missing).
- [ ] **Step 3: Implement `src/stores/dock-store.ts`** with the interface above (zustand `create`, plain setters, `reset` restoring initial state).
- [ ] **Step 4: Run test** — expect PASS.
- [ ] **Step 5: Implement `src/lib/gsap-loader.ts`:**

```ts
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ST } from "gsap/ScrollTrigger";

export interface GsapBundle { gsap: typeof Gsap; ScrollTrigger: typeof ST; }

let bundle: Promise<GsapBundle> | null = null;

// One shared dynamic import so GSAP's ~52 KB gzip loads once and stays out of the initial bundle.
export function loadGsap(): Promise<GsapBundle> {
  bundle ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
    const gsap = g.gsap ?? g.default;
    const ScrollTrigger = st.ScrollTrigger ?? st.default;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  });
  return bundle;
}
```

- [ ] **Step 6: Implement `use-section-dock.ts`.** Effect: register target via `registerTarget(id, ref.current)` (and unregister with `null` on cleanup). If `prefersReducedMotion()`: `setDocked(id, true)` and return. Else `loadGsap().then(...)` with a `cancelled` flag (copy the pattern in `use-hero-scroll.ts:20-36`), then inside `gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", ...)`:
  - if `opts?.dockOnExit !== false`: `ScrollTrigger.create({ trigger: el, start: "bottom top", onEnter: () => setDocked(id, true), onLeaveBack: () => setDocked(id, false) })`
  - always: `ScrollTrigger.create({ trigger: el, start: "top center", end: "bottom center", onToggle: (self) => { if (self.isActive) setActive(id); else if (useDockStore.getState().active === id) setActive(null); } })`
  - cleanup kills both triggers; outer cleanup reverts matchMedia.
- [ ] **Step 7: Implement `marketing-taskbar.tsx`:**

```tsx
"use client";

import { RetroButton } from "@/components/retro"; // check export; else plain button with r-btn classes
import { cn } from "@/lib/utils";
import { DOCK_LABELS, DOCK_ORDER, useDockStore } from "@/stores/dock-store";
import { Taskbar, type TaskbarMenuItem } from "@/components/retro";
import { prefersReducedMotion } from "@/lib/motion";

const MENU_ITEMS: TaskbarMenuItem[] = [ /* copy DEFAULT_MENU_ITEMS from taskbar.tsx verbatim */ ];

export function MarketingTaskbar() {
  const docked = useDockStore((s) => s.docked);
  const active = useDockStore((s) => s.active);
  const targets = useDockStore((s) => s.targets);

  return (
    <Taskbar menuItems={MENU_ITEMS}>
      <div data-dock-slots className="flex min-w-0 flex-1 gap-1 overflow-hidden">
        {DOCK_ORDER.filter((id) => docked[id]).map((id) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              data-dock-button={id}
              className={cn("r-btn h-[22px] min-w-0 max-w-[160px] flex-1 justify-start truncate px-2", isActive && "font-bold")}
              style={isActive ? { boxShadow: "inset -1px -1px var(--r-highlight), inset 1px 1px var(--r-dark), inset -2px -2px var(--r-face-light), inset 2px 2px var(--r-shadow)" } : undefined}
              aria-pressed={isActive}
              onClick={() => targets[id]?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })}
            >
              <span className="truncate">{DOCK_LABELS[id]}</span>
            </button>
          );
        })}
      </div>
    </Taskbar>
  );
}
```
(Depressed-button styling copied from `app-taskbar.tsx:44-46` — keep identical.)
- [ ] **Step 8:** Add `data-taskbar` to the root div in `src/components/retro/taskbar.tsx:73` (the `r-face fixed…` div).
- [ ] **Step 9:** Swap `<Taskbar />` → `<MarketingTaskbar />` in `src/app/(marketing)/layout.tsx`.
- [ ] **Step 10:** Register the showcase: in `bonzi-showcase.tsx` add `useSectionDock("showcase", ref)` (the component already holds `ref` on its RetroWindow). Walkthrough windows and hero register in T6/T5 — do NOT register them here.
- [ ] **Step 11:** Manual check at `localhost:4110`: scroll past the showcase → "BonziBUDDY.exe" button appears in the taskbar; clicking it scrolls back; scrolling to top removes it.
- [ ] **Step 12:** `npm run typecheck && npm run lint && npm test` — all pass.
- [ ] **Step 13:** Commit: `add taskbar dock store`

---

### Task 2: Terminal image pipeline and dependencies

**Files:**
- Create: `scripts/terminal/Dockerfile`
- Create: `scripts/terminal/build-image.sh`
- Create: `scripts/terminal/README.md`
- Create (generated, committed): `public/terminal/fs.json`, `public/terminal/rootfs-flat/…`, `public/terminal/bzimage.bin`, `public/terminal/initramfs.bin`
- Modify: `package.json` (deps + postinstall)

**Interfaces:**
- Produces: URLs consumed by T7 — `/terminal/fs.json`, `/terminal/rootfs-flat/` (baseurl), `/terminal/bzimage.bin`, `/terminal/initramfs.bin`, `/v86/v86.wasm`.
- Produces deps: `v86`, `@xterm/xterm`, `@xterm/addon-fit` in `dependencies`.

**Steps:**

- [ ] **Step 1:** `npm install v86 @xterm/xterm @xterm/addon-fit`.
- [ ] **Step 2:** Extend the `postinstall` script in `package.json` (keep the stockfish copies) with: `mkdir -p public/v86 && cp node_modules/v86/build/v86.wasm public/v86/v86.wasm`. Verify the file lands (`ls -la public/v86`). If the npm package's build dir differs, locate the wasm with `find node_modules/v86 -name "*.wasm"` and adjust.
- [ ] **Step 3:** Fetch the authoritative build recipe: `curl -sL https://raw.githubusercontent.com/copy/v86/master/docs/alpine.md` and read it fully. The steps below are the expected shape — where the doc differs, THE DOC WINS.
- [ ] **Step 4:** Write `scripts/terminal/Dockerfile` (i686 Alpine + serial autologin + easter eggs):

```dockerfile
FROM i386/alpine:3.21
ENV KERNEL=lts
RUN apk add --no-cache openrc alpine-base agetty linux-$KERNEL
# 9p modules in initramfs so the kernel can mount the root filesystem
RUN sed -i 's/^features="[^"]*/& 9p virtio/' /etc/mkinitfs/mkinitfs.conf \
 && mkinitfs -c /etc/mkinitfs/mkinitfs.conf -b / "$(ls /lib/modules)"
# Serial console autologin as root, DOS-cosplay prompt
RUN echo 'ttyS0::respawn:/sbin/agetty --autologin root --nohostname ttyS0 115200 vt100' >> /etc/inittab \
 && echo 'export PS1="C:\\\\> "' >> /etc/profile
COPY rootfs-extra/ /
```

- [ ] **Step 5:** Create `scripts/terminal/rootfs-extra/` easter eggs:
  - `etc/motd` — ASCII Bonzi head plus:
    ```
    BonziOS 1.0 (definitely MS-DOS)
    Type "bonzi" for wisdom. Type "ls" and question everything.
    ```
  - `usr/local/bin/bonzi` (chmod +x) — POSIX sh script: array of ~8 quips copied verbatim from `src/lib/bonzi/quips.ts` `game_start`/`bonzi_checkmate` entries, printed via `awk 'BEGIN{srand()}...'` random pick.
  - `home/bonzi/README.TXT` — short lore: how this terminal is a real Linux VM in the browser, credit to v86.
  - `home/bonzi/chess_openings.txt` — 5 openings, one per line, with Bonzi commentary.
- [ ] **Step 6:** Write `scripts/terminal/build-image.sh` following alpine.md: `docker build` for linux/386, `docker export` a container, run v86's `tools/fs2json.py` and `tools/copy-to-sha256.py` (fetch these two scripts from the v86 repo at a pinned commit into `scripts/terminal/vendor/`) to produce `public/terminal/fs.json` + `public/terminal/rootfs-flat/`; extract `/boot/vmlinuz-$KERNEL` → `public/terminal/bzimage.bin` and `/boot/initramfs-$KERNEL` → `public/terminal/initramfs.bin`. Echo final sizes.
- [ ] **Step 7:** Run `bash scripts/terminal/build-image.sh` (Docker 29 is installed). Sanity-check: `fs.json` exists, flat dir has >1000 files, kernel + initramfs each 5–15 MB.
- [ ] **Step 8:** Write `scripts/terminal/README.md`: what the artifacts are, how to rebuild, the pinned v86 tool commit, and the follow-up note about a saved-state snapshot for instant boot.
- [ ] **Step 9:** Smoke-boot it in a throwaway HTML page under `scratchpad` (NOT committed) using `node_modules/v86/build/libv86.js` + the artifact URLs served via `npx serve public` — confirm you reach the `C:\>` prompt and `ls` works. (10–30s cold boot is expected and fine.) Record actual boot time in the README.
- [ ] **Step 10:** `npm run typecheck && npm run lint && npm test` (unchanged code must still pass; postinstall must not break `npm ci` reproducibility).
- [ ] **Step 11:** Commit (include `public/terminal` artifacts): `add v86 terminal image`

---

### Task 3: Easter-egg components (unwired)

**Files:**
- Create: `src/components/landing/easter/idle.ts` + Test: `src/components/landing/easter/idle.test.ts`
- Create: `src/components/landing/easter/eval-map.ts` + Test: `src/components/landing/easter/eval-map.test.ts`
- Create: `src/components/landing/easter/boot-flag.ts` + Test: `src/components/landing/easter/boot-flag.test.ts`
- Create: `src/components/landing/easter/screensaver.tsx`
- Create: `src/components/landing/easter/shutdown-overlay.tsx`
- Create: `src/components/landing/easter/eval-progress.tsx`

**Interfaces:**
- Produces:
  ```ts
  // idle.ts
  export function createIdleWatcher(ms: number, onIdle: () => void): { arm: () => void; disarm: () => void };
  // listens pointermove/pointerdown/keydown/wheel/touchstart/scroll (passive) on window,
  // resets the timer on any of them, pauses while document.visibilityState === "hidden".

  // eval-map.ts
  export interface EvalPoint { label: string; whiteShare: number } // whiteShare 0..1, bottom-up
  export function evalAtProgress(p: number): EvalPoint;
  // anchors (piecewise linear on whiteShare, label switches at midpoints):
  // 0→{+0.2,0.52} 0.25→{+0.8,0.58} 0.5→{+2.1,0.70} 0.75→{+5.8,0.88} 0.9..1→{M4,0.98}
  // Bonzi is White (hero plays Scholar's Mate, Qxf7#), so White's share GROWS.

  // boot-flag.ts
  export const BOOT_FLAG = "cbb-booted";
  export function shouldBoot(storage: Pick<Storage, "getItem">): boolean;
  export function markBooted(storage: Pick<Storage, "setItem">): void;
  export function clearBootFlag(storage: Pick<Storage, "removeItem">): void;
  ```
- Produces components (all `"use client"`, all self-gating on reduced motion):
  - `<Screensaver idleMs={45000} />` — arms the idle watcher; on idle renders a fixed inset-0 z-[90] black canvas, rAF loop bouncing 4 glyphs (♟♞♛♜, 72px, colors `#008080 #ffffff #7b4fb5 #c0c0c0`), DVD-style edge bounce; ANY watched input while showing hides it and re-arms. Renders `null` under reduced motion.
  - `<ShutdownOverlay open onDone={() => void} />` — when `open`: step-dim (CSS `animation: 400ms steps(5)` to a black overlay), then centered `<p>` in `r-term` style, `color:#ffb300`, text exactly `It is now safe to turn off your computer.`; any click/keydown calls `onDone`. Focus-traps itself (single button semantics: the overlay is a `role="alertdialog"` with `aria-label="Shut down"`, tabIndex -1, focused on open).
  - `<EvalProgress />` — fixed left edge, `hidden lg:block`, `aria-hidden`, ~10px wide × 40vh bar (white fill bottom growing per `whiteShare`, black rest, 1px `--r-dark` border) + tiny `r-term` label beneath showing `label`. Subscribes to scroll (passive) and computes `p = scrollY / (scrollHeight - innerHeight)`, throttled via rAF. `data-testid="eval-progress"`.

**Steps:**

- [ ] **Step 1: Failing tests for the three pure modules.** Representative cases:

```ts
// eval-map.test.ts
import { describe, expect, test } from "vitest";
import { evalAtProgress } from "./eval-map";

describe("evalAtProgress", () => {
  test("clamps and hits the anchors", () => {
    expect(evalAtProgress(-1).label).toBe("+0.2");
    expect(evalAtProgress(0).whiteShare).toBeCloseTo(0.52);
    expect(evalAtProgress(0.5).label).toBe("+2.1");
    expect(evalAtProgress(0.95).label).toBe("M4");
    expect(evalAtProgress(2).whiteShare).toBeCloseTo(0.98);
  });
  test("whiteShare is monotonically non-decreasing", () => {
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const share = evalAtProgress(p).whiteShare;
      expect(share).toBeGreaterThanOrEqual(prev);
      prev = share;
    }
  });
});

// idle.test.ts — vi.useFakeTimers(); jsdom window events
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createIdleWatcher } from "./idle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("fires after ms of silence and not before", () => {
  const onIdle = vi.fn();
  const w = createIdleWatcher(1000, onIdle);
  w.arm();
  vi.advanceTimersByTime(999);
  expect(onIdle).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onIdle).toHaveBeenCalledOnce();
  w.disarm();
});

test("input resets the countdown", () => {
  const onIdle = vi.fn();
  const w = createIdleWatcher(1000, onIdle);
  w.arm();
  vi.advanceTimersByTime(900);
  window.dispatchEvent(new Event("pointermove"));
  vi.advanceTimersByTime(900);
  expect(onIdle).not.toHaveBeenCalled();
  w.disarm();
});

// boot-flag.test.ts — fake storage object
import { expect, test } from "vitest";
import { BOOT_FLAG, markBooted, shouldBoot } from "./boot-flag";

test("boots only when flag unset", () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  expect(shouldBoot(storage)).toBe(true);
  markBooted(storage);
  expect(shouldBoot(storage)).toBe(false);
  expect(store.has(BOOT_FLAG)).toBe(true);
});
```

- [ ] **Step 2:** Run — expect FAIL. **Step 3:** Implement the three modules. **Step 4:** Run — PASS.
- [ ] **Step 5:** Implement the three components per the interface block. Screensaver canvas: devicePixelRatio-aware sizing on mount + resize; glyphs drawn with `ctx.font = "72px serif"`; velocities ~±2.5px/frame.
- [ ] **Step 6:** Components are NOT mounted anywhere yet (T9 wires them). Typecheck/lint/test pass.
- [ ] **Step 7:** Commit: `add easter egg components`

---

### Task 4: Cascade timeline logic

**Files:**
- Create: `src/components/landing/cascade/cascade-timeline.ts`
- Test: `src/components/landing/cascade/cascade-timeline.test.ts`
- Create: `src/components/landing/cascade/cascade.css`

**Interfaces:**
- Produces:
  ```ts
  export interface Rect { x: number; y: number; w: number; h: number }
  export const CASCADE_KEYS: ["import", "review", "practice"];
  export interface Segment { key: (typeof CASCADE_KEYS)[number]; start: number; end: number }
  export const SEGMENTS: Segment[]; // import .04–.30, review .36–.62, practice .68–.94
  export const OUTLINE_STEPS = 8;
  export function outlineRect(from: Rect, to: Rect, t: number): Rect;
  // t snapped to OUTLINE_STEPS discrete increments, linear interpolation of x/y/w/h
  export interface SegmentPhase { outlineT: number | null; revealed: boolean }
  export function segmentPhase(p: number, seg: Segment): SegmentPhase;
  // p<seg.start → {null,false}; within first 70% of segment → {0..1, false};
  // last 30% and beyond → {null, true}
  ```
- `cascade.css`: `.cascade--armed [data-stack-key] { visibility: hidden; }`, `.cascade-outline { position: fixed; border: 2px solid var(--r-dark); outline: 1px dotted var(--r-highlight); pointer-events: none; z-index: 60; }`, `[data-stack-key].cascade-open { visibility: visible; }`

**Steps:**

- [ ] **Step 1: Failing tests:**

```ts
import { describe, expect, test } from "vitest";
import { OUTLINE_STEPS, SEGMENTS, outlineRect, segmentPhase } from "./cascade-timeline";

describe("outlineRect", () => {
  const from = { x: 0, y: 100, w: 40, h: 20 };
  const to = { x: 100, y: 0, w: 400, h: 300 };
  test("snaps to discrete steps", () => {
    const a = outlineRect(from, to, 0.1);
    const b = outlineRect(from, to, 0.12); // same step at 8 steps
    expect(a).toEqual(b);
  });
  test("endpoints are exact", () => {
    expect(outlineRect(from, to, 0)).toEqual(from);
    expect(outlineRect(from, to, 1)).toEqual(to);
  });
});

describe("segmentPhase", () => {
  const seg = SEGMENTS[0];
  test("before, during, after", () => {
    expect(segmentPhase(0, seg)).toEqual({ outlineT: null, revealed: false });
    const mid = segmentPhase(seg.start + (seg.end - seg.start) * 0.35, seg);
    expect(mid.revealed).toBe(false);
    expect(mid.outlineT).toBeGreaterThan(0);
    expect(segmentPhase(seg.end, seg).revealed).toBe(true);
    expect(segmentPhase(1, seg).revealed).toBe(true);
  });
  test("segments never overlap and stay ordered", () => {
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i].start).toBeGreaterThan(SEGMENTS[i - 1].end);
  });
});
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Write `cascade.css` as specified. **Step 6:** typecheck/lint/test. **Step 7:** Commit: `add cascade timeline logic`

---

### Task 5: Hero minimize retarget + boot cascade wiring

**Files:**
- Modify: `src/components/landing/hero/use-hero-scroll.ts`
- Modify: `src/components/landing/hero/hero-section.tsx`
- Modify: `src/components/landing/hero/hero.css`
- Create: `src/components/landing/boot-cascade.tsx`
- Modify: `src/app/(marketing)/layout.tsx` (inline no-flash script + mount `<BootCascade />`)

**Interfaces:**
- Consumes: `useDockStore` setters, `DOCK_LABELS` (T1); `loadGsap` (T1); `shouldBoot`/`markBooted` (T3); `[data-dock-slots]`, `[data-taskbar]` DOM contracts (T1).
- Produces: hero registered as dock target (`registerTarget("hero", sectionEl)` + active tracking via `useSectionDock("hero", sectionRef, { dockOnExit: false })` in `hero-section.tsx`).

**Steps:**

- [ ] **Step 1:** Refactor `use-hero-scroll.ts` to use `loadGsap()` instead of its own `Promise.all` import (keep the `.catch` fallback that un-hides the dialog).
- [ ] **Step 2: Retarget the minimize tween.** Replace the `x`/`y` function values in the `win` tween (`use-hero-scroll.ts:63-64`) with slot-seeking deltas, and set `invalidateOnRefresh: true` on the tween:

```ts
const slotDelta = () => {
  const slots = document.querySelector("[data-dock-slots]");
  const w = win.getBoundingClientRect();
  if (!slots) return { x: -window.innerWidth * 0.42, y: window.innerHeight * 0.42 };
  const s = slots.getBoundingClientRect();
  // land the window's bottom-left on the first free slot
  return { x: s.left + 4 - w.left, y: s.top + 2 - w.bottom };
};
```
(`x: () => slotDelta().x, y: () => slotDelta().y` — the stage is sticky, so viewport-space deltas measured at refresh hold during the scrub.)
- [ ] **Step 3: Dock trigger.** In the same matchMedia block create `ScrollTrigger.create({ trigger: section, start: "35% top", onEnter: () => useDockStore.getState().setDocked("hero", true), onLeaveBack: () => useDockStore.getState().setDocked("hero", false) })`; kill it in cleanup.
- [ ] **Step 4:** In `hero-section.tsx` call `useSectionDock("hero", sectionRef, { dockOnExit: false })`.
- [ ] **Step 5: No-flash boot gate.** In `(marketing)/layout.tsx` add before `{children}`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `try{if(!sessionStorage.getItem("cbb-booted")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("boot-pending")}catch(e){}`,
  }}
/>
```
And in `hero.css`: `.boot-pending .hero-window, .boot-pending [data-taskbar] { visibility: hidden; }`
- [ ] **Step 6: `boot-cascade.tsx`** (`"use client"`, mounted in the marketing layout): on mount, if `!document.documentElement.classList.contains("boot-pending")` do nothing. Else `loadGsap()` then run a one-shot timeline (NOT scroll-bound): remove the class, set initial states via `gsap.set` (`[data-taskbar]` at `yPercent: 100`, `.hero-window` at `autoAlpha: 0, scale: 0.2, transformOrigin: "bottom left"`), then `[data-taskbar]` to `yPercent: 0` (0.2s, `steps(4)`) and `.hero-window` to `autoAlpha: 1, scale: 1` (0.35s, `steps(6)`), total ≤0.9s; `markBooted(sessionStorage)` on start; any `pointerdown|keydown|wheel` during playback jumps the timeline to its end (`tl.progress(1)`). If `loadGsap` rejects, remove the class so nothing stays hidden.
- [ ] **Step 7:** Interaction check with the scroll choreography: the boot timeline must fully finish (or be jumped) before ScrollTrigger scrubbing can fight it — create the hero ScrollTriggers regardless; GSAP last-writer-wins on the same properties is acceptable here because the boot tween is ≤0.9s from page top where hero progress is 0. Verify manually: hard-reload with cleared sessionStorage, then reload again (no boot), then scroll-and-return behavior.
- [ ] **Step 8:** Verify hero-timeline unit tests still pass (`npm test -- hero-timeline`), plus full typecheck/lint/test.
- [ ] **Step 9:** Commit: `hero minimizes into taskbar`

---

### Task 6: Walkthrough cascade wiring

**Files:**
- Modify: `src/components/landing/analyzer-walkthrough.tsx`
- Modify: `src/components/landing/window-stack.tsx`
- Create: `src/components/landing/cascade/use-cascade-scroll.ts`

**Interfaces:**
- Consumes: `SEGMENTS`, `OUTLINE_STEPS`, `outlineRect`, `segmentPhase`, `cascade.css` (T4); `loadGsap` (T1); `useSectionDock` + `useDockStore.setDocked` (T1); `[data-dock-slots]` (T1).
- Produces: each `StackWindow` root carries `data-stack-key={item.key}`.

**Steps:**

- [ ] **Step 1:** In `window-stack.tsx` `StackWindow`, spread `data-stack-key: item.key` onto the `RetroWindow` — RetroWindow doesn't forward unknown props, so pass via `id`? No: add an optional `containerProps?: HTMLAttributes<HTMLElement>` to `RetroWindow` (spread on the root `<section>`), and use it. Keep the change minimal and typed.
- [ ] **Step 2:** Register docks: in `StackWindow`, `const winRef = useRef<HTMLElement>(null)` passed to RetroWindow's `ref`, and `useSectionDock(item.key as DockId, winRef)` — only for keys in `DOCK_ORDER` (import/review/practice all are). This gives dock/undock + active behavior with NO cascade at all (mobile/reduced path).
- [ ] **Step 3:** `use-cascade-scroll.ts`: hook `useCascadeScroll(sectionRef: RefObject<HTMLElement | null>)`. Guard `prefersReducedMotion()`. `loadGsap()` then `gsap.matchMedia().add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", ...)`:
  - add `cascade--armed` class to the section (windows hide via T4 css);
  - `ScrollTrigger.create({ trigger: section, start: "top top", end: "+=250%", pin: true, scrub: 0.3, onUpdate })`;
  - `onUpdate(self)`: for each segment, compute `segmentPhase(self.progress, seg)`; maintain one reusable `.cascade-outline` div per segment (created lazily, appended to `document.body`): while `outlineT !== null`, position it via `outlineRect(fromRect, toRect, outlineT)` where `fromRect` = `[data-dock-slots]` bounding rect's next-slot stub (`{x: slots.left + 4, y: slots.top + 2, w: 120, h: 22}` viewport coords) and `toRect` = the window element's `getBoundingClientRect()` (measure each update — the section is pinned so it's stable); when `revealed` flips true add `cascade-open` class to the window and hide the outline; when it flips back false (reverse scroll) remove the class and re-show the outline.
  - cleanup: remove class, kill trigger, remove outline divs, `mm.revert()`.
- [ ] **Step 4:** `analyzer-walkthrough.tsx`: convert to `"use client"`, add `const sectionRef = useRef<HTMLElement>(null)` on the `<section>`, call `useCascadeScroll(sectionRef)`. Everything else unchanged.
- [ ] **Step 5:** Manual checks at 1440×900: pin engages, windows open in order with stepped outlines, reverse scroll closes them; demos play once revealed; at 375px and with reduced motion the static layout is byte-identical to before (compare DOM).
- [ ] **Step 6:** Check hero ScrollTrigger still fires correctly (pin changes document height — ScrollTrigger auto-refresh handles it; verify by scrolling the full page).
- [ ] **Step 7:** typecheck/lint/test; run existing landing e2e ONLY if port 3000 serves this app (Global Constraints).
- [ ] **Step 8:** Commit: `pin walkthrough cascade`

---

### Task 7: Terminal window on the app desktop

**Files:**
- Create: `src/lib/terminal/create-vm.ts`
- Create: `src/components/windows/terminal-window.tsx`
- Modify: `src/stores/window-store.ts` (+ `src/stores/window-store.test.ts`)
- Modify: `src/components/desktop/icons.tsx`
- Modify: `src/app/(app)/app/page.tsx`

**Interfaces:**
- Consumes: `/terminal/*` + `/v86/v86.wasm` assets (T2).
- Produces:
  ```ts
  // create-vm.ts
  export interface TerminalVM { send(data: string): void; onOutput(cb: (chunk: Uint8Array) => void): () => void; destroy(): void; }
  export async function createVM(): Promise<TerminalVM>;
  ```
  and window id `"terminal"` with `WINDOW_SIZES.terminal = { w: 680, h: 460 }`, `ICON_LABELS.terminal = "MS-DOS Prompt"`.
  `terminal-window.tsx` default export component `<TerminalWindow />` reusable by T9's marketing overlay.

**Steps:**

- [ ] **Step 1: Failing store test** — extend `window-store.test.ts`: `WINDOW_IDS` includes `"terminal"`, `WINDOW_SIZES.terminal` defined, `open("terminal")` focuses it.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Add `"terminal"` to `WindowId`, `WINDOW_IDS`, `WINDOW_SIZES` in `window-store.ts`. **Step 4:** Run — PASS.
- [ ] **Step 5: `create-vm.ts`.** `const { V86 } = await import("v86");` then:

```ts
const emulator = new V86({
  wasm_path: "/v86/v86.wasm",
  memory_size: 128 * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  bzimage: { url: "/terminal/bzimage.bin" },
  initrd: { url: "/terminal/initramfs.bin" },
  cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0",
  filesystem: { baseurl: "/terminal/rootfs-flat/", basefs: "/terminal/fs.json" },
  autostart: true,
  disable_keyboard: true,
  disable_mouse: true,
});
```
Wire `emulator.add_listener("serial0-output-byte", ...)` batching bytes into `Uint8Array` chunks per animation frame for `onOutput`; `send(data)` iterates chars → `emulator.serial0_send(data)`; `destroy()` calls `emulator.destroy()`. Consult `node_modules/v86/Readme.md` + typings for exact listener names — adjust if the API differs, keeping the exported interface stable.
- [ ] **Step 6: `terminal-window.tsx`.** `"use client"`; dynamic-imports `@xterm/xterm` + `@xterm/addon-fit` + `import "@xterm/xterm/css/xterm.css"` on mount (mirror the demo lazy-load pattern); creates the VM once (ref-guarded; StrictMode double-mount safe: create in an effect with cleanup calling `destroy()`); xterm theme `{ background: "#000000", foreground: "#c0c0c0", cursor: "#c0c0c0" }`, `fontFamily: '"Courier New", monospace'`, `fontSize: 14`; FitAddon refit on `ResizeObserver`. Status line while booting: `Starting MS-DOS… (fine, it's Linux — 15–30s)`. Error state: `r-paper` panel reading `BONZI.SYS: A fatal exception 0E has occurred.` with a `RetroButton` "Retry" that tears down and recreates. Show the terminal container `data-testid="terminal-xterm"`.
- [ ] **Step 7:** `icons.tsx`: add `TerminalIcon` — pixel-art 16×16 rect SVG matching neighbors (gray `#c0c0c0` monitor bezel, black screen, teal `C:\`-suggestive glyph rects, small stand), add to `ICON_LABELS` (`terminal: "MS-DOS Prompt"`) and `WINDOW_ICONS`.
- [ ] **Step 8:** `(app)/app/page.tsx`: `terminal: { title: ICON_LABELS.terminal, render: () => <TerminalWindow /> }` in `defs`.
- [ ] **Step 9:** Manual: at `localhost:4110/app`, double-click MS-DOS Prompt icon; watch kernel boot in xterm; reach `C:\>`; run `ls /home/bonzi`, `bonzi`, `vi` quits cleanly; minimize keeps the VM alive (windows stay mounted when minimized per `desktop-window.tsx`); close destroys it.
- [ ] **Step 10:** typecheck/lint/test. **Step 11:** Commit: `add ms dos prompt window`

---

### Task 8: Bonzi scroll companion

**Files:**
- Create: `src/components/landing/bonzi-companion.tsx`
- Modify: `src/app/(marketing)/page.tsx` (mount it)

**Interfaces:**
- Consumes: `useDockStore` (`active`), `loadGsap`, `BonziAvatar`, `usePrefersReducedMotion`.

**Steps:**

- [ ] **Step 1:** Implement `bonzi-companion.tsx` (`"use client"`):
  - Render gate: `usePrefersReducedMotion()` false AND `matchMedia("(min-width: 1280px)")` (tracked with a listener) — else `null`.
  - Wrapper: `<div aria-hidden className="pointer-events-none fixed z-40" style={{ right: "max(8px, calc((100vw - 1240px) / 2 - 96px))", top: 0 }}>` containing `<BonziAvatar gif={gif} quip={quip} size="md" />`.
  - On mount: `loadGsap()`; `const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power2.out" })`; a ScrollTrigger over the whole document (`trigger: document.body, start: "top top", end: "bottom bottom", scrub: false, onUpdate`) mapping progress → `yTo(lerp(0.15, 0.72) * innerHeight)`; velocity check via `self.getVelocity()`: `|v| > 2800` and not already playing → `gif = "backflip"` for 1.8s then back to `"idle"` (timeout ref, debounced 4s).
  - Section reactions: subscribe to `useDockStore` `active`; map `{ showcase: { gif: "wave", quip: "That's me!" }, import: { gif: "point", quip: "Feed me your games." }, review: { gif: "shocked", quip: "Ooh. I saw that blunder too." }, practice: { gif: "talk", quip: "Try not to hang the queen this time." } }`; play gif 2.5s then revert to idle; quip shows once per section per pageview (a `Set` in a ref), cleared bubble after 3.5s (`quip = undefined`).
  - Priority: section reaction wins over backflip; never interrupt an active reaction.
- [ ] **Step 2:** Mount `<BonziCompanion />` at the end of `(marketing)/page.tsx`'s `<main>`.
- [ ] **Step 3:** Manual: 1440×900 — Bonzi rides down the margin, waves at the showcase, backflips on a fast wheel fling, never overlaps the 1200px content column, absent at 1024px and under reduced motion.
- [ ] **Step 4:** typecheck/lint/test. **Step 5:** Commit: `add bonzi scroll companion`

---

### Task 9: Marketing integration (shutdown, screensaver, eval bar, terminal item)

**Files:**
- Modify: `src/components/landing/marketing-taskbar.tsx`
- Create: `src/components/landing/marketing-terminal.tsx`
- Modify: `src/app/(marketing)/page.tsx` (mount screensaver + eval bar)

**Interfaces:**
- Consumes: `<Screensaver />`, `<ShutdownOverlay />`, `<EvalProgress />`, `clearBootFlag` (T3); `<TerminalWindow />` (T7); `Taskbar` menu API (T1).

**Steps:**

- [ ] **Step 1:** `marketing-terminal.tsx`: `"use client"`; fixed centered wrapper (`w-[min(94vw,700px)]`, `z-[70]`), `RetroWindow` title `"MS-DOS Prompt"`, draggable via `useDrag` + `titleBarProps` (copy the hero-window drag wiring in `hero-section.tsx:31-46`), `statusBar` holding a `RetroButton` "Close" and hint text `Esc closes`; `Escape` keydown closes; body renders `<TerminalWindow />` via `next/dynamic` (`ssr: false`) so v86/xterm chunks load only when opened.
- [ ] **Step 2:** `marketing-taskbar.tsx`: add state `{ terminalOpen, shuttingDown }`; append menu items `{ label: "MS-DOS Prompt", onSelect: () => setTerminalOpen(true) }` and `{ label: "Shut Down…", onSelect: () => setShuttingDown(true) }` (after existing items, before GitHub). Render `<MarketingTerminal open… />` and `<ShutdownOverlay open={shuttingDown} onDone={reboot} />` where `reboot = () => { clearBootFlag(sessionStorage); window.scrollTo(0, 0); location.reload(); }`.
- [ ] **Step 3:** Mount `<Screensaver idleMs={45000} />` and `<EvalProgress />` in `(marketing)/page.tsx`.
- [ ] **Step 4:** Manual sweep: Start ▸ Shut Down… dims to the orange message; click reboots with the boot cascade replaying; Start ▸ MS-DOS Prompt opens and boots; idle 45s (temporarily lower to 3s locally to verify, restore before commit) triggers bouncing pieces; eval bar slides toward M4 while scrolling.
- [ ] **Step 5:** typecheck/lint/test. **Step 6:** Commit: `wire marketing easter eggs`

---

### Task 10: E2E coverage and full verification

**Files:**
- Modify: `e2e/landing.spec.ts`
- Modify: `e2e/desktop.spec.ts`

**Steps:**

- [ ] **Step 1:** Landing additions (follow the file's existing helpers/styles):
  - `taskbar docks section buttons on scroll`: scroll to bottom, expect buttons named `Import`, `Review`, `Practice`, `BonziBUDDY.exe` visible; click `Import` and expect the Import window in viewport.
  - `eval bar tracks scroll`: `data-testid="eval-progress"` visible at 1440×900, absent at 375px.
  - `boot cascade runs once per session`: fresh context → hero window becomes visible within 2s; `sessionStorage.cbb-booted` set; reload → no `boot-pending` class.
  - Reduced-motion project: assert dock buttons are all present immediately and no pin exists (`.cascade--armed` absent).
- [ ] **Step 2:** Desktop addition: `opens the MS-DOS Prompt window` — open via Start menu, expect window `MS-DOS Prompt` and `data-testid="terminal-xterm"` attached within 10s (do NOT wait for full boot).
- [ ] **Step 3:** Run the full suite: `npm run typecheck && npm run lint && npm test`, then e2e per the port-3000 guard in Global Constraints. Fix regressions found (existing tests: overflow at 375/1024px, reduced-motion, checkmate dialog — the pin and companion must not break them).
- [ ] **Step 4:** Commit: `cover retro motion e2e`

---

## Self-review notes

- Spec §1 → T1/T5; §2 → T4/T6; §3 → T8; §4 → T3/T5/T9; §5 → T2/T7/T9. No uncovered spec sections.
- Cross-task names checked: `DockId`, `useSectionDock`, `loadGsap`, `SEGMENTS`, `segmentPhase`, `outlineRect`, `createVM`, `TerminalWindow`, `clearBootFlag`, `data-dock-slots`, `data-stack-key`, `data-taskbar` consistent across tasks.
- Known risks called out in-task: v86 API drift (T7 step 5), alpine.md drift (T2 step 3), ScrollTrigger refresh with pinning (T6 step 6), StrictMode double-mount (T7 step 6).
