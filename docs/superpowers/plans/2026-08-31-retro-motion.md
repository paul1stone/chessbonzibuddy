# Retro Motion & Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Revision 2 — incorporates the 2026-08-31 three-lens plan review (correctness, regression, simplicity).

**Goal:** Extend the landing page's Win98 metaphor with taskbar-docking scroll choreography, a pinned window cascade, a Bonzi scroll companion, retro easter eggs, and a real Linux terminal (v86) behind the Start menu.

**Architecture:** A small zustand dock store bridges scroll position and the marketing taskbar; GSAP ScrollTriggers (dynamically imported via a shared loader) drive all choreography; the terminal is a lazily loaded v86 VM booting a committed Alpine 9p image, surfaced through the existing window manager.

**Tech Stack:** Next.js 16 App Router, React 19, GSAP 3.15 + ScrollTrigger, zustand 5, Tailwind 4 + retro.css tokens, v86 (exact-pinned), @xterm/xterm, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-retro-motion-design.md`

## Global Constraints

- Reduced motion: every *animation* must be absent under `prefers-reduced-motion: reduce` (via `usePrefersReducedMotion()` / `prefersReducedMotion()` from `src/lib/motion.ts` or GSAP `matchMedia`, following `src/components/landing/hero/use-hero-scroll.ts`). Functional UI (Shut Down overlay, dock buttons, terminal) must still WORK under reduced motion — it just skips the animated treatment.
- GSAP must stay out of the initial bundle: always load through `src/lib/gsap-loader.ts` (Task 1), never a static import.
- Vitest runs with `environment: "node"` (vitest.config.ts) and jsdom is NOT installed — unit-testable modules must be DOM-injectable, not window-touching.
- Commit messages: plain 3–5 words, no prefixes, no colons, no Co-Authored-By trailers (user rule).
- Comments: short, single-line, only for non-obvious constraints.
- Verification per task: `npm run typecheck`, `npm run lint`, `npm test` must pass. E2E: the Playwright config expects `localhost:3000` but an UNRELATED app may occupy it — before running e2e, check `curl -s localhost:3000 | grep -c "Chess Bonzi Buddy"`; if it is a different app, do NOT run e2e, report that step as unverified instead.
- The dev server for manual checks runs at `http://localhost:4110`.
- Styling: retro.css tokens (`--r-face`, `--r-dark`, `--r-taskbar-h`, `r-btn`, `r-bevel-*`); no border-radius; stepped easings (`steps(n)` CSS / snapped progress in GSAP) for anything Win98-flavored.
- New marketing-page client components must not break SSR: guard `window`/`document` behind effects. Never touch `window.sessionStorage` directly — it throws in cookie-blocked browsers; use `safeSessionStorage()` from Task 3.
- Z-layers: taskbar 50, cascade outlines 60, marketing terminal 70, screensaver 90, shutdown overlay 100.

---

## Parallelization map

| Wave | Tasks | Rationale |
|---|---|---|
| 1 | T1 (dock foundation), T2 (terminal assets), T3 (easter-egg components), T4 (cascade logic) | Fully disjoint file sets |
| 2 | T5 (hero retarget + boot wiring), T6 (cascade wiring), T7 (terminal app-side), T8 (Bonzi companion) | Each consumes wave-1 outputs; disjoint among themselves (T5: hero files + marketing layout; T6: window-stack/walkthrough/retro-window; T7: app-side files + app-taskbar; T8: companion + marketing page) |
| 3 | T9 (marketing integration: shutdown, screensaver, eval bar, marketing terminal, menu items) | Touches `marketing-taskbar.tsx` and `(marketing)/page.tsx`, owned by earlier waves |
| 4 | T10 (e2e + full verification sweep) | Needs everything |

---

### Task 1: Dock store + marketing taskbar foundation

**Files:**
- Create: `src/stores/dock-store.ts`
- Test: `src/stores/dock-store.test.ts`
- Create: `src/lib/gsap-loader.ts`
- Create: `src/components/landing/use-section-dock.ts`
- Create: `src/components/landing/marketing-taskbar.tsx`
- Modify: `src/components/retro/taskbar.tsx` (add `data-taskbar` to root div; export `DEFAULT_MENU_ITEMS`)
- Modify: `src/app/(marketing)/layout.tsx` (swap `<Taskbar />` for `<MarketingTaskbar />`)
- Modify: `src/components/landing/bonzi-showcase.tsx` (register the showcase section)

**Interfaces (later tasks rely on these exact names):**
- Produces `src/stores/dock-store.ts`:
  ```ts
  export type DockId = "hero" | "showcase" | "import" | "review" | "practice";
  export const DOCK_ORDER: DockId[];
  export const DOCK_LABELS: Record<DockId, string>;
  // hero "Chess Bonzi Buddy", showcase "BonziBUDDY.exe", import "Import", review "Review", practice "Practice"
  interface DockStore {
    docked: Record<DockId, boolean>;
    active: DockId | null;
    targets: Partial<Record<DockId, HTMLElement>>;
    scrollFns: Partial<Record<DockId, () => number>>; // absolute scrollY for precise jumps (pinned sections)
    setDocked: (id: DockId, v: boolean) => void;
    setActive: (id: DockId | null) => void;
    registerTarget: (id: DockId, el: HTMLElement | null) => void;
    registerScrollFn: (id: DockId, fn: (() => number) | null) => void;
    reset: () => void;
  }
  export const useDockStore: UseBoundStore<StoreApi<DockStore>>;
  ```
- Produces `src/lib/gsap-loader.ts`:
  ```ts
  export interface GsapBundle { gsap: ...; ScrollTrigger: ...; }
  export function loadGsap(): Promise<GsapBundle>;
  // caches the promise; registers ScrollTrigger once; on rejection RESETS the cache
  // to null so a later mount can retry (a failed chunk must not disable all motion forever)
  ```
- Produces `src/components/landing/use-section-dock.ts`:
  ```ts
  export function useSectionDock(
    id: DockId,
    ref: RefObject<HTMLElement | null>,
    opts?: { dockOnExit?: boolean; pinnedContainer?: () => HTMLElement | null }
  ): void;
  // registers target; reduced motion → docked immediately; else ScrollTriggers:
  // dock when section bottom passes viewport top (if dockOnExit !== false),
  // active while section spans viewport center. If opts.pinnedContainer returns an
  // element, pass it as ScrollTrigger's `pinnedContainer` so triggers inside a
  // pinned section compute correct positions (T6 pins the walkthrough).
  ```
- Produces DOM contracts: dock buttons container `data-dock-slots`; each button `data-dock-button={id}`; taskbar root div `data-taskbar` (in `taskbar.tsx`, benefits `/app` too).

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
});
```

- [ ] **Step 2: Run it** — `npm test -- dock-store` — expect FAIL (module missing).
- [ ] **Step 3: Implement `src/stores/dock-store.ts`** per the interface (zustand `create`, plain setters, `reset`).
- [ ] **Step 4: Run test** — expect PASS.
- [ ] **Step 5: Implement `src/lib/gsap-loader.ts`:**

```ts
let bundle: Promise<GsapBundle> | null = null;

// One shared dynamic import so GSAP loads once and stays out of the initial bundle.
export function loadGsap(): Promise<GsapBundle> {
  bundle ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
    const gsap = g.gsap ?? g.default;
    const ScrollTrigger = st.ScrollTrigger ?? st.default;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  });
  // A failed chunk load must not poison every later consumer.
  bundle.catch(() => { bundle = null; });
  return bundle;
}
```
(Attach the reset via a `.catch` on a separate chain as shown so the returned promise still rejects to callers.)
- [ ] **Step 6: Implement `use-section-dock.ts`.** Effect: `registerTarget(id, ref.current)` (cleanup registers `null`). If `prefersReducedMotion()`: `setDocked(id, true)` and return. Else `loadGsap().then(...)` with a `cancelled` flag (copy `use-hero-scroll.ts:20-36`), then inside `gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", ...)`:
  - if `opts?.dockOnExit !== false`: `ScrollTrigger.create({ trigger: el, start: "bottom top", pinnedContainer: opts?.pinnedContainer?.() ?? undefined, onEnter: () => setDocked(id, true), onLeaveBack: () => setDocked(id, false) })`
  - always: `ScrollTrigger.create({ trigger: el, start: "top center", end: "bottom center", pinnedContainer: … same …, onToggle: (self) => { if (self.isActive) setActive(id); else if (useDockStore.getState().active === id) setActive(null); } })`
  - cleanup kills both; outer cleanup reverts matchMedia. Verify manually that passing a `pinnedContainer` element that is NOT actually pinned (mobile/reduced fallback path) is harmless.
- [ ] **Step 7:** In `taskbar.tsx`: add `data-taskbar` to the root div (`taskbar.tsx:71-73`) and change `const DEFAULT_MENU_ITEMS` to `export const DEFAULT_MENU_ITEMS`.
- [ ] **Step 8: Implement `marketing-taskbar.tsx`:**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { DOCK_LABELS, DOCK_ORDER, useDockStore, type DockId } from "@/stores/dock-store";
import { Taskbar } from "@/components/retro";
import { DEFAULT_MENU_ITEMS } from "@/components/retro/taskbar"; // direct import; no index churn
import { prefersReducedMotion } from "@/lib/motion";

export function MarketingTaskbar() {
  const docked = useDockStore((s) => s.docked);
  const active = useDockStore((s) => s.active);

  const jump = (id: DockId) => {
    const { scrollFns, targets } = useDockStore.getState();
    const behavior = prefersReducedMotion() ? "auto" as const : "smooth" as const;
    const top = scrollFns[id]?.();
    if (top != null) window.scrollTo({ top, behavior });
    else targets[id]?.scrollIntoView({ behavior, block: "start" });
  };

  return (
    <Taskbar menuItems={DEFAULT_MENU_ITEMS}>
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
              onClick={() => jump(id)}
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
(Depressed styling copied from `app-taskbar.tsx:46-48` — keep identical. T9 later adds menu items and overlays to this file.)
- [ ] **Step 9:** Swap `<Taskbar />` → `<MarketingTaskbar />` in `src/app/(marketing)/layout.tsx`.
- [ ] **Step 10:** Register the showcase: in `bonzi-showcase.tsx` call `useSectionDock("showcase", ref)` (the RetroWindow ref exists at `bonzi-showcase.tsx:40,72`). Hero registers in T5, walkthrough windows in T6 — NOT here.
- [ ] **Step 11:** Manual check at `localhost:4110`: scroll past the showcase → "BonziBUDDY.exe" button appears; click scrolls back; scroll to top removes it; under reduced motion (devtools emulation) the button is present immediately.
- [ ] **Step 12:** `npm run typecheck && npm run lint && npm test` — all pass.
- [ ] **Step 13:** Commit: `add taskbar dock store`

---

### Task 2: Terminal image pipeline and dependencies

**Files:**
- Create: `scripts/terminal/Dockerfile`
- Create: `scripts/terminal/build-image.sh`
- Create: `scripts/terminal/README.md`
- Create: `scripts/terminal/rootfs-extra/…` (easter eggs)
- Create (generated, committed): `public/terminal/fs.json`, `public/terminal/rootfs-flat/…`
- Modify: `package.json` (deps + postinstall), `.gitignore` (`/public/v86/`)

**Interfaces:**
- Produces URLs consumed by T7: `/terminal/fs.json`, `/terminal/rootfs-flat/` (baseurl), `/v86/v86.wasm`. Kernel + initramfs are NOT separate artifacts — T7 boots with `bzimage_initrd_from_filesystem: true`, reading them from the 9p filesystem's `/boot`.
- Produces deps: `v86` (EXACT version pin — it auto-publishes near-daily and has renamed serial events before), `@xterm/xterm`, `@xterm/addon-fit`.

**Authoritative upstream recipe** (the previously cited `docs/alpine.md` does NOT exist): the v86 repo's `tools/docker/alpine/{Dockerfile,build.sh,Readme.md}` plus `examples/alpine.html` and `docs/linux-9p-image.md`, at a pinned commit recorded in `scripts/terminal/README.md`. Where these steps differ from upstream, UPSTREAM WINS.

**Environment notes:** this host is arm64 — the linux/386 Docker build runs emulated (slow but works; Docker 29.2.1 installed). The system python3 lacks the `zstandard` module needed by the `--zstd` flags: create `scripts/terminal/.venv` (`python3 -m venv`, `pip install zstandard`) inside build-image.sh.

**Steps:**

- [ ] **Step 1:** `npm install --save-exact v86 && npm install @xterm/xterm @xterm/addon-fit`.
- [ ] **Step 2:** Extend `postinstall` in `package.json` (keep the stockfish copies): `mkdir -p public/v86 && cp node_modules/v86/build/v86.wasm public/v86/v86.wasm`. Add `/public/v86/` to `.gitignore` (mirror the `/public/stockfish/` line). Verify with `ls -la public/v86` after `npm install`.
- [ ] **Step 3:** Fetch the upstream recipe files at master, record the commit SHA, and READ THEM: `tools/docker/alpine/Dockerfile`, `tools/docker/alpine/build.sh`, `tools/docker/alpine/Readme.md`, `examples/alpine.html` from `https://github.com/copy/v86`. Vendor `tools/fs2json.py` and `tools/copy-to-sha256.py` at that SHA into `scripts/terminal/vendor/`.
- [ ] **Step 4:** Write `scripts/terminal/Dockerfile` = upstream's Dockerfile with: `ENV KERNEL=virt` and `linux-firmware-none` kept EXACTLY as upstream has them (this is what keeps the image ~25–40MB instead of >500MB); upstream's `mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)` form; upstream's rc-update lines; DROP upstream's `ADDPKGS`/nodejs and networking bits. Then layer:

```dockerfile
RUN echo 'ttyS0::respawn:/sbin/agetty --autologin root --nohostname ttyS0 115200 vt100' >> /etc/inittab \
 && echo 'export PS1="C:\\\\> "' >> /etc/profile
COPY rootfs-extra/ /
```

- [ ] **Step 5:** Create `scripts/terminal/rootfs-extra/`:
  - `etc/motd` — ASCII Bonzi head plus:
    ```
    BonziOS 1.0 (definitely MS-DOS)
    Type "bonzi" for wisdom. Type "ls" and question everything.
    ```
  - `usr/local/bin/bonzi` (mode 755) — POSIX sh: ~8 quips copied verbatim from `src/lib/bonzi/quips.ts` (`game_start` + `bonzi_checkmate`), random pick via `awk 'BEGIN{srand()}…'`.
  - `home/bonzi/README.TXT` — short lore: this is a real Linux VM (v86) inside the browser.
  - `home/bonzi/chess_openings.txt` — 5 openings with Bonzi commentary.
- [ ] **Step 6:** Write `scripts/terminal/build-image.sh` starting from upstream `build.sh`: docker build for linux/386 → `docker create`/`export` → `tar --delete .dockerenv` (keep `/boot` — the runtime reads kernel+initramfs from it) → venv python `fs2json.py --zstd` → `copy-to-sha256.py --zstd` → outputs `public/terminal/fs.json` + `public/terminal/rootfs-flat/`. Echo (report, don't gate) artifact sizes and file count.
- [ ] **Step 7:** Run `bash scripts/terminal/build-image.sh`. Report: fs.json size, flat file count (~1.5–3k expected), total MB (~25–40 expected). If wildly above, STOP and trim packages rather than committing.
- [ ] **Step 8:** Write `scripts/terminal/README.md`: artifact inventory, rebuild instructions, pinned upstream SHA, measured boot time, and the saved-state-snapshot follow-up note.
- [ ] **Step 9: Smoke boot** via a throwaway HTML page in the scratchpad (NOT committed) using `node_modules/v86/build/libv86.mjs` + `npx serve` over `public/`: construct V86 with `wasm_path`, `memory_size: 128MB`, `filesystem: { baseurl: "/terminal/rootfs-flat/", basefs: "/terminal/fs.json" }`, `bzimage_initrd_from_filesystem: true`, `cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0"`, `autostart: true`. Confirm the `C:\>` prompt, `ls /home/bonzi`, `bonzi`. **BIOS fallback:** if the boot hangs dark, fetch `bios/seabios.bin` + `bios/vgabios.bin` from the v86 repo into `public/v86/` (and out of gitignore) and pass `bios: {url}`, `vga_bios: {url}` — record whichever configuration worked in README.md; T7 must copy it exactly. Record measured cold-boot time.
- [ ] **Step 10:** `npm run typecheck && npm run lint && npm test` (must stay green; postinstall must not break a fresh `npm ci`).
- [ ] **Step 11:** Commit (include `public/terminal`): `add v86 terminal image`

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
- Produces (note: vitest runs in NODE env — these modules take injectable targets; tests never touch `window`):
  ```ts
  // idle.ts
  export interface IdleDoc { visibilityState: DocumentVisibilityState; addEventListener: Document["addEventListener"]; removeEventListener: Document["removeEventListener"]; }
  export function createIdleWatcher(
    ms: number,
    onIdle: () => void,
    opts?: { target?: EventTarget; doc?: IdleDoc }
  ): { arm: () => void; disarm: () => void };
  // listens pointermove/pointerdown/keydown/wheel/touchstart/scroll (passive) on opts.target
  // (default window), resets the countdown on any of them, pauses while doc.visibilityState
  // === "hidden" (default document). Components call it with no opts.

  // eval-map.ts
  export interface EvalPoint { label: string; whiteShare: number } // whiteShare 0..1, bottom-up
  export function evalAtProgress(p: number): EvalPoint;
  // anchors (piecewise linear whiteShare, label switches at midpoints):
  // 0→{+0.2,0.52} 0.25→{+0.8,0.58} 0.5→{+2.1,0.70} 0.75→{+5.8,0.88} 0.9..1→{M4,0.98}
  // Bonzi is White (hero Scholar's Mate, Qxf7#), so White's share GROWS.

  // boot-flag.ts
  export const BOOT_FLAG = "cbb-booted";
  export function shouldBoot(storage: Pick<Storage, "getItem"> | null): boolean; // null → false
  export function markBooted(storage: Pick<Storage, "setItem"> | null): void;   // null → no-op
  export function clearBootFlag(storage: Pick<Storage, "removeItem"> | null): void;
  export function safeSessionStorage(): Storage | null;
  // try { return window.sessionStorage } catch { return null } — accessing the PROPERTY
  // throws in cookie-blocked browsers; every call site goes through this.
  ```
- Produces components (all `"use client"`):
  - `<Screensaver idleMs={45000} />` — renders `null` under reduced motion. Otherwise arms the idle watcher; on idle shows fixed inset-0 z-[90] black canvas, rAF loop bouncing 4 glyphs (♟♞♛♜, 72px, colors `#008080 #ffffff #7b4fb5 #c0c0c0`), DVD-style edge bounce, devicePixelRatio-aware; ANY watched input hides it and re-arms.
  - `<ShutdownOverlay open onDone={() => void} />` — ALWAYS functional (this is UI, not decoration). With motion: step-dim (CSS `animation: 400ms steps(5)`) to black, then the message; under reduced motion: instant black, no dim. Centered `r-term`-style `<p>`, `color:#ffb300`, text exactly `It is now safe to turn off your computer.`; any click/keydown → `onDone`. `role="alertdialog"`, `aria-label="Shut down"`, tabIndex -1, focused on open, `z-[100]` (above screensaver 90 / terminal 70 / taskbar 50).
  - `<EvalProgress />` — fixed left edge, `hidden lg:block`, `aria-hidden`, ~10px × 40vh bar (white fill bottom-up per `whiteShare`, black remainder, 1px `--r-dark` border) + tiny `r-term` label under it. Passive scroll listener + rAF throttle computing `p = scrollY / (scrollHeight - innerHeight)`. `data-testid="eval-progress"`.

**Steps:**

- [ ] **Step 1: Failing tests for the three pure modules** (node environment — injectable doubles, no jsdom):

```ts
// idle.test.ts
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
```

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
```

```ts
// boot-flag.test.ts
import { expect, test } from "vitest";
import { BOOT_FLAG, clearBootFlag, markBooted, shouldBoot } from "./boot-flag";

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

test("boots only when flag unset", () => {
  const s = fakeStorage();
  expect(shouldBoot(s)).toBe(true);
  markBooted(s);
  expect(shouldBoot(s)).toBe(false);
  expect(s.store.has(BOOT_FLAG)).toBe(true);
  clearBootFlag(s);
  expect(shouldBoot(s)).toBe(true);
});

test("null storage is safe and never boots", () => {
  expect(shouldBoot(null)).toBe(false);
  markBooted(null); // must not throw
  clearBootFlag(null); // must not throw
});
```

- [ ] **Step 2:** Run — expect FAIL. **Step 3:** Implement the three modules. **Step 4:** Run — PASS.
- [ ] **Step 5:** Implement the three components per the interface block.
- [ ] **Step 6:** Not mounted anywhere yet (T9 wires them). typecheck/lint/test pass.
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
  // p<seg.start → {null,false}; first 70% of segment → {0..1, false}; last 30% and beyond → {null, true}
  ```
- `cascade.css`:
  ```css
  .cascade--armed [data-stack-key] { visibility: hidden; }
  .cascade--armed [data-stack-key].cascade-open { visibility: visible; }
  .cascade-outline { position: fixed; border: 2px solid var(--r-dark); outline: 1px dotted var(--r-highlight); pointer-events: none; z-index: 60; }
  ```
  (Imported by `analyzer-walkthrough.tsx` in T6 — a stylesheet nothing imports is dead code.)

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
- Consumes: `useDockStore` setters (T1); `loadGsap` (T1); `shouldBoot`/`markBooted`/`safeSessionStorage` (T3); `[data-dock-slots]`, `[data-taskbar]` DOM contracts (T1); `useSectionDock` (T1).
- Produces: hero registered as dock target with active tracking.

**Steps:**

- [ ] **Step 1:** Refactor `use-hero-scroll.ts` to use `loadGsap()` (keep the `.catch` fallback un-hiding the dialog).
- [ ] **Step 2: Retarget the minimize tween.** Replace the fixed `x`/`y` in the `win` tween (`use-hero-scroll.ts:66-67`) with slot-seeking function values, and add `invalidateOnRefresh: true` to the TIMELINE'S `scrollTrigger` config (`use-hero-scroll.ts:39-44`) — it is a ScrollTrigger option, NOT a tween var; timeline invalidation re-runs the function values on refresh/resize:

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
(`x: () => slotDelta().x, y: () => slotDelta().y`. The stage is sticky — `hero.css:17-23` — so viewport-space deltas measured at refresh hold during the scrub; `transform-origin: bottom left` already set at `hero.css:27`.)
- [ ] **Step 3: Dock trigger.** Same matchMedia block: `ScrollTrigger.create({ trigger: section, start: "35% top", onEnter: () => useDockStore.getState().setDocked("hero", true), onLeaveBack: () => useDockStore.getState().setDocked("hero", false) })`; kill in cleanup.
- [ ] **Step 4:** In `hero-section.tsx`: `useSectionDock("hero", sectionRef, { dockOnExit: false })`.
- [ ] **Step 5: No-flash boot gate — LANDING PAGE ONLY.** The marketing layout also wraps `/privacy` and `/terms`; the boot must not run (or consume the session flag) there. In `(marketing)/layout.tsx` add before `{children}`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `try{if(location.pathname==="/"&&!sessionStorage.getItem("cbb-booted")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("boot-pending")}catch(e){}`,
  }}
/>
```
And in `hero.css`: `.boot-pending .hero-window, .boot-pending [data-taskbar] { visibility: hidden; }` (hero.css is only loaded by the landing page, matching the pathname gate).
- [ ] **Step 6: `boot-cascade.tsx`** (`"use client"`, mounted in the marketing layout): on mount, if `!document.documentElement.classList.contains("boot-pending")` do nothing (this also covers legal pages — the script never adds the class there). Else `loadGsap()` then a one-shot timeline: remove the class, `gsap.set` initial states (`[data-taskbar]` `yPercent: 100`; `.hero-window` `autoAlpha: 0, scale: 0.2, transformOrigin: "bottom left"`), then `[data-taskbar]` → `yPercent: 0` (0.2s, stepped) and `.hero-window` → `autoAlpha: 1, scale: 1` (0.35s, stepped), total ≤0.9s. `markBooted(safeSessionStorage())` at start. Fast-forward on ANY of `pointerdown | keydown | wheel | scroll` (scroll included — Playwright and impatient humans scroll programmatically before 0.9s elapses; without it the boot tween's final writes land after the scrub has taken the window, re-showing it over the checkmate dialog): jump `tl.progress(1)` and remove listeners. If `loadGsap` rejects, remove the class so nothing stays hidden.
- [ ] **Step 7:** Verify manually: fresh session on `/` boots once; reload doesn't; `/privacy` fresh session — no hidden taskbar, no animation, flag NOT consumed; scroll-during-boot jumps cleanly; scroll-and-return minimize lands on the taskbar slot and the "Chess Bonzi Buddy" button pops exactly as the window dies.
- [ ] **Step 8:** `npm test -- hero-timeline` still green; full typecheck/lint/test.
- [ ] **Step 9:** Commit: `hero minimizes into taskbar`

---

### Task 6: Walkthrough cascade wiring

**Files:**
- Modify: `src/components/landing/analyzer-walkthrough.tsx`
- Modify: `src/components/landing/window-stack.tsx`
- Modify: `src/components/retro/retro-window.tsx` (add `containerProps`)
- Create: `src/components/landing/cascade/use-cascade-scroll.ts`

**Interfaces:**
- Consumes: `SEGMENTS`, `OUTLINE_STEPS`, `outlineRect`, `segmentPhase`, `cascade.css` (T4); `loadGsap` (T1); `useSectionDock` + `useDockStore` `registerScrollFn` (T1); `[data-dock-slots]` (T1).
- Produces: each `StackWindow` root carries `data-stack-key={item.key}`; `RetroWindow` gains optional `containerProps?: HTMLAttributes<HTMLElement>` spread on its root `<section>`.

**Steps:**

- [ ] **Step 1:** Add `containerProps` to `retro-window.tsx` (spread on root `<section>`, before the explicit props so explicit ones win). In `window-stack.tsx` `StackWindow`, pass `containerProps={{ "data-stack-key": item.key }}`.
- [ ] **Step 2:** Register docks: in `StackWindow`, `const winRef = useRef<HTMLElement>(null)` on the RetroWindow `ref`, and `useSectionDock(item.key as DockId, winRef, { pinnedContainer: () => pinnedContainer?.current ?? null })` where `pinnedContainer` is a new optional `WindowStack` prop (`RefObject<HTMLElement | null>`) — WITHOUT it, ScrollTriggers inside the pinned section compute start positions from unpinned layout and dock/activate up to ~250vh early on lg+. Only dock keys in `DOCK_ORDER` get the hook (import/review/practice all are).
- [ ] **Step 3:** `use-cascade-scroll.ts`: `useCascadeScroll(sectionRef: RefObject<HTMLElement | null>)`. Guard `prefersReducedMotion()`. `loadGsap()` → `gsap.matchMedia().add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", ...)`:
  - add `cascade--armed` to the section;
  - `const st = ScrollTrigger.create({ trigger: section, start: "top top", end: "+=250%", pin: true, scrub: 0.3, onUpdate, onRefresh })`;
  - `onRefresh`: cache the three window rects and the `[data-dock-slots]` slot stub rect (`{x: slots.left + 4, y: slots.top + 2, w: 120, h: 22}`) ONCE per refresh — the section is pinned, don't re-measure per frame;
  - `onUpdate(self)`: per segment compute `segmentPhase(self.progress, seg)`; maintain one lazily created `.cascade-outline` div per segment appended to `section.closest(".retro")` — NOT `document.body` (the retro CSS variables `--r-dark`/`--r-highlight` are scoped to `.retro`, and body would silently lose them) and NOT inside the pinned section (a transformed ancestor from pinning would hijack `position: fixed`); while `outlineT !== null` position it via `outlineRect(slotRect, windowRect, outlineT)` — skip the style write when the snapped step hasn't changed; when `revealed` flips true add `cascade-open` to the window and hide the outline; on reverse flip remove/reshow;
  - register precise dock jumps: for each seg, `registerScrollFn(seg.key, () => st.start + (st.end - st.start) * seg.end)` — clicking a taskbar button must land where the window is REVEALED, not at pin start where everything is still hidden; cleanup calls `registerScrollFn(seg.key, null)`;
  - cleanup: remove class + `cascade-open`s, kill trigger, remove outline divs, `mm.revert()`.
- [ ] **Step 4:** `analyzer-walkthrough.tsx`: convert to `"use client"`; `import "./cascade/cascade.css"` (mirror `hero-section.tsx:13` — WITHOUT this import the entire cascade silently no-ops); `const sectionRef = useRef<HTMLElement>(null)` on the `<section>`; `useCascadeScroll(sectionRef)`; pass `pinnedContainer={sectionRef}` to `WindowStack`.
- [ ] **Step 5:** Manual at 1440×900: pin engages; windows open in order with stepped outlines from the taskbar area; reverse closes them; demos play once revealed; taskbar buttons appear near the pin's end via the pinnedContainer-corrected triggers (verify they don't appear ~250vh early); clicking "Review" in the taskbar lands with Review visible. At 375px and reduced motion: static layout identical to today.
- [ ] **Step 6:** Verify hero triggers after the pin (document got 250vh longer — ScrollTrigger auto-refresh should handle; scroll the whole page).
- [ ] **Step 7:** typecheck/lint/test; e2e only per the port-3000 guard.
- [ ] **Step 8:** Commit: `pin walkthrough cascade`

---

### Task 7: Terminal window on the app desktop

**Files:**
- Create: `src/lib/terminal/create-vm.ts`
- Create: `src/components/windows/terminal-window.tsx` (dynamic wrapper)
- Create: `src/components/windows/terminal-window-inner.tsx` (xterm + VM)
- Modify: `src/stores/window-store.ts` (+ `src/stores/window-store.test.ts`)
- Modify: `src/components/desktop/icons.tsx`
- Modify: `src/components/desktop/app-taskbar.tsx` (Start-menu item)
- Modify: `src/app/(app)/app/page.tsx`

**Interfaces:**
- Consumes: `/terminal/fs.json`, `/terminal/rootfs-flat/`, `/v86/v86.wasm` (T2) and the exact boot options recorded in `scripts/terminal/README.md` (including any BIOS fallback T2 needed).
- Produces:
  ```ts
  // create-vm.ts
  export interface TerminalVM { send(data: string): void; onOutput(cb: (chunk: Uint8Array) => void): () => void; destroy(): Promise<void>; }
  export async function createVM(): Promise<TerminalVM>;
  ```
  window id `"terminal"`, `WINDOW_SIZES.terminal = { w: 680, h: 460 }`, `ICON_LABELS.terminal = "MS-DOS Prompt"`; `<TerminalWindow />` (default-exported wrapper) reused by T9's marketing overlay.

**Steps:**

- [ ] **Step 1: Failing store test** — extend `window-store.test.ts`: `WINDOW_IDS` includes `"terminal"`, `WINDOW_SIZES.terminal` defined, `open("terminal")` focuses it.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Add `"terminal"` to `WindowId`/`WINDOW_IDS`/`WINDOW_SIZES`. **Step 4:** Run — PASS. (Typecheck now forces the icons/labels/defs additions below — `Record<WindowId, …>` types at `icons.tsx:156,165` and `(app)/app/page.tsx:247`.)
- [ ] **Step 5: `create-vm.ts`.** `const { V86 } = await import("v86");` (verified: npm `v86` ships ESM `build/libv86.mjs` with named `V86` export) then:

```ts
const emulator = new V86({
  wasm_path: "/v86/v86.wasm",
  memory_size: 128 * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  filesystem: { baseurl: "/terminal/rootfs-flat/", basefs: "/terminal/fs.json" },
  bzimage_initrd_from_filesystem: true,
  cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci console=ttyS0",
  autostart: true,
  disable_keyboard: true,
  disable_mouse: true,
  // plus bios/vga_bios URLs IF scripts/terminal/README.md says the smoke boot needed them
});
```
`add_listener("serial0-output-byte", (byte: number) => …)` batching into per-animation-frame `Uint8Array` chunks for `onOutput`; `send` → `emulator.serial0_send(data)`; `destroy` → `emulator.destroy()` (returns a Promise). These names are verified against v86's shipped `v86.d.ts` — still re-check against the installed pinned version before coding.
- [ ] **Step 6: Split component.** `terminal-window.tsx` = `next/dynamic(() => import("./terminal-window-inner"), { ssr: false, loading: … r-skeleton })` — the repo's lazy idiom (`review-demo.tsx:8-11`). `terminal-window-inner.tsx` STATICALLY imports `@xterm/xterm`, `@xterm/addon-fit`, and `import "@xterm/xterm/css/xterm.css"` (static top-level import — a runtime `import()` of CSS is Turbopack-risky for zero benefit; the CSS rides the inner chunk).
  VM lifecycle (StrictMode-safe): create inside `useEffect`; keep the instance in a ref; cleanup destroys AND clears the ref; if the effect is cleaned up before `createVM()` resolves, destroy the VM when the promise settles. xterm theme `{ background: "#000000", foreground: "#c0c0c0", cursor: "#c0c0c0" }`, `fontFamily: '"Courier New", monospace'`, `fontSize: 14`; FitAddon refit via `ResizeObserver`. Boot status line: `Starting MS-DOS… (fine, it's Linux — 15-30s)`. Error state: `r-paper` panel `BONZI.SYS: A fatal exception 0E has occurred.` + RetroButton "Retry" (teardown + recreate). Container `data-testid="terminal-xterm"`.
- [ ] **Step 7:** `icons.tsx`: `TerminalIcon` — 16×16 rect-grid SVG matching neighbors (gray `#c0c0c0` bezel, black screen, teal prompt glyph rects, stand); add `terminal: "MS-DOS Prompt"` to `ICON_LABELS` and the icon to `WINDOW_ICONS`.
- [ ] **Step 8:** `app-taskbar.tsx`: add `{ label: "MS-DOS Prompt", onSelect: () => open("terminal") }` to `menuItems` (`app-taskbar.tsx:26-36`) after "Profile" — the Start menu is hardcoded there; the desktop icon and taskbar button come free from the `WINDOW_IDS` loops, the menu item does NOT.
- [ ] **Step 9:** `(app)/app/page.tsx`: `terminal: { title: ICON_LABELS.terminal, render: () => <TerminalWindow /> }` in `defs`.
- [ ] **Step 10:** Manual at `localhost:4110/app`: open via desktop icon AND Start menu; kernel boot scrolls in xterm; `C:\>` prompt; `ls /home/bonzi`, `bonzi`, `vi` open/quit; minimize keeps the VM alive (minimized windows stay mounted per `desktop-window.tsx`); close destroys it (re-open boots fresh); StrictMode dev double-mount doesn't leak a second VM (check no duplicate serial output).
- [ ] **Step 11:** typecheck/lint/test. **Step 12:** Commit: `add ms dos prompt window`

---

### Task 8: Bonzi scroll companion

**Files:**
- Create: `src/components/landing/bonzi-companion.tsx`
- Modify: `src/app/(marketing)/page.tsx` (mount it)

**Interfaces:**
- Consumes: `useDockStore` (`active`), `loadGsap`, `BonziAvatar`, `usePrefersReducedMotion`.

**Steps:**

- [ ] **Step 1:** Implement `bonzi-companion.tsx` (`"use client"`):
  - Render gate: `usePrefersReducedMotion()` false AND `matchMedia("(min-width: 1440px)")` tracked with a listener — at 1280px the margin is ~40px and Bonzi + bubble would overlap the Review window's text; 1440 keeps him in genuinely empty margin. Else `null`.
  - Wrapper: `<div aria-hidden className="pointer-events-none fixed z-40" style={{ right: "max(8px, calc((100vw - 1240px) / 2 - 96px))", top: 0 }}>` containing `<BonziAvatar gif={gif} quip={quip} size="md" />`.
  - On mount: `loadGsap()`; `const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power2.out" })`; ScrollTrigger over the document (`trigger: document.body, start: "top top", end: "bottom bottom", onUpdate`) mapping progress → `yTo(lerp(0.15, 0.72, progress) * innerHeight)`; velocity via `self.getVelocity()`: `|v| > 2800` and idle → `gif = "backflip"` 1.8s then `"idle"`, debounced 4s.
  - Section reactions from `useDockStore` `active`: `{ showcase: { gif: "wave", quip: "That's me!" }, import: { gif: "point", quip: "Feed me your games." }, review: { gif: "shocked", quip: "Ooh. I saw that blunder too." }, practice: { gif: "talk", quip: "Try not to hang the queen this time." } }`; gif 2.5s then idle; quip once per section per pageview (ref Set), bubble cleared after 3.5s.
  - Priority: section reaction wins over backflip; never interrupt an active reaction.
- [ ] **Step 2:** Mount `<BonziCompanion />` at the end of `(marketing)/page.tsx`'s `<main>`.
- [ ] **Step 3:** Manual: 1536×960 — rides down, waves at showcase, backflips on a fling, no content overlap; absent at 1280 and under reduced motion.
- [ ] **Step 4:** typecheck/lint/test. **Step 5:** Commit: `add bonzi scroll companion`

---

### Task 9: Marketing integration (shutdown, screensaver, eval bar, terminal item)

**Files:**
- Modify: `src/components/landing/marketing-taskbar.tsx`
- Create: `src/components/landing/marketing-terminal.tsx`
- Modify: `src/app/(marketing)/page.tsx` (mount screensaver + eval bar)

**Interfaces:**
- Consumes: `<Screensaver />`, `<ShutdownOverlay />`, `<EvalProgress />`, `clearBootFlag` + `safeSessionStorage` (T3); `<TerminalWindow />` (T7); `DEFAULT_MENU_ITEMS` (T1).

**Steps:**

- [ ] **Step 1:** `marketing-terminal.tsx`: `"use client"`; fixed centered wrapper (`w-[min(94vw,700px)]`, `z-[70]`), `RetroWindow` title `"MS-DOS Prompt"`, draggable via `useDrag` + `titleBarProps` (copy `hero-section.tsx:30-45`), `statusBar` with a RetroButton "Close" + hint `Esc closes (when the prompt isn't focused)`. Escape handling: close ONLY when focus is outside the terminal container (`!containerRef.current?.contains(document.activeElement)`) — inside the VM, Esc belongs to vi and friends. Body renders `<TerminalWindow />` (already a `next/dynamic` ssr:false wrapper, so v86/xterm load only on open).
- [ ] **Step 2:** `marketing-taskbar.tsx`: state `{ terminalOpen, shuttingDown }`; menu = `[...DEFAULT_MENU_ITEMS]` with `{ label: "MS-DOS Prompt", onSelect: () => setTerminalOpen(true) }` and `{ label: "Shut Down…", onSelect: () => setShuttingDown(true) }` inserted before the GitHub item. Render `{terminalOpen && <MarketingTerminal onClose={() => setTerminalOpen(false)} />}` and `<ShutdownOverlay open={shuttingDown} onDone={reboot} />` where:

```ts
const reboot = () => {
  clearBootFlag(safeSessionStorage()); // null-safe in cookie-blocked browsers
  window.scrollTo(0, 0);
  location.reload();
};
```
- [ ] **Step 3:** Mount `<Screensaver idleMs={45000} />` and `<EvalProgress />` in `(marketing)/page.tsx`.
- [ ] **Step 4:** Manual sweep: Shut Down dims to the orange message (instant under reduced motion, still functional); click reboots and the boot cascade replays; MS-DOS Prompt opens/boots/drags; Esc in `vi` does NOT close the window, Esc after clicking the title bar does; idle (temporarily 3s locally, restore 45000 before commit) → bouncing pieces; eval bar slides toward M4. Known + accepted: the screensaver can arm invisibly behind the z-100 shutdown overlay after 45s idle — harmless (opaque cover, next input reloads); do NOT add state plumbing for it.
- [ ] **Step 5:** typecheck/lint/test. **Step 6:** Commit: `wire marketing easter eggs`

---

### Task 10: E2E coverage and full verification

**Files:**
- Modify: `e2e/landing.spec.ts`
- Modify: `e2e/desktop.spec.ts`

**Context — the cascade breaks three EXISTING tests at the default 1280×720 viewport:** `demoWindow()` (`e2e/landing.spec.ts:15-19`) locates windows by `getByRole("region")`, and `visibility:hidden` elements are excluded from the accessibility tree, so under `cascade--armed` the locator never resolves for "review demo scrubber…" (:104), "practice demo…" (:130), "import demo is tagged…" (:138). Fixing these is part of this task, not collateral.

**Steps:**

- [ ] **Step 1: Reveal helper + demo test rework.** Add to `landing.spec.ts`:

```ts
// Park the cascade at its end so all three windows are revealed before locating.
async function revealCascade(page: Page) {
  await page.evaluate(() => {
    const section = document.querySelector("[aria-labelledby='walkthrough-heading']")!;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + window.innerHeight * 2.5); // pin distance is +=250%
  });
  await page.waitForTimeout(400); // scrub settle (0.3s smoothing)
}
```
Call it inside `demoWindow()` (or at the top of the three demo tests) before locating; then `scrollIntoViewIfNeeded` will land at the pin's end where windows are revealed. Keep assertions otherwise unchanged.
- [ ] **Step 2: New landing tests** (follow in-file style; reduced-motion via `browser.newContext({ reducedMotion: "reduce" })` like `landing.spec.ts:56` — there is no separate Playwright project):
  - `taskbar docks section buttons on scroll`: scroll to page bottom; expect buttons `Import`, `Review`, `Practice`, `BonziBUDDY.exe` visible in the taskbar; click `Review`; expect the Review window visible in viewport (this exercises the registered scrollFn landing at reveal progress, not pin start).
  - `eval bar tracks scroll`: `data-testid="eval-progress"` visible at 1440×900, absent at 375px.
  - `boot cascade runs once per session`: fresh context → hero window visible within 2s AND `sessionStorage["cbb-booted"]` set; reload → `documentElement` never has `boot-pending`.
  - reduced-motion context: all dock buttons present immediately; `.cascade--armed` absent.
- [ ] **Step 3: Desktop test:** `opens the MS-DOS Prompt from the Start menu` — click Start, click "MS-DOS Prompt", expect a window titled `MS-DOS Prompt` and `data-testid="terminal-xterm"` attached within 10s. Do NOT wait for the full Linux boot.
- [ ] **Step 4:** Full suite: `npm run typecheck && npm run lint && npm test`; then e2e per the port-3000 guard (Global Constraints). Existing tests that must stay green: overflow at 375/1024px, reduced-motion pair, checkmate dialog, start-menu Escape, all desktop specs.
- [ ] **Step 5:** Commit: `cover retro motion e2e`

---

## Review triage record (2026-08-31)

All three reviewer verdicts were REVISE; every blocking/important finding was accepted and folded in above:
- Correctness: node-env tests (injectable idle watcher), /app Start-menu item, cascade.css import, `invalidateOnRefresh` placement, legal-page boot gate, dock-click scrollFns, demo e2e rework, xterm CSS static import, files-list fixes, line-cite drift, reduced-motion shutdown behavior, gsap-loader retry.
- Regression: demo e2e breakage owned by T10, pinnedContainer for in-pin triggers, scrollFn jumps, safeSessionStorage everywhere, `scroll` in boot fast-forward, companion gate 1440px, StrictMode VM lifecycle, shutdown z-100, Esc-vs-vi scoping, gitignore /public/v86/.
- Simplicity: T2 rebased on upstream `tools/docker/alpine` (KERNEL=virt + linux-firmware-none + upstream mkinitfs form), dead doc URL replaced, `bzimage_initrd_from_filesystem` (no duplicate kernel artifacts), exact v86 pin + BIOS fallback protocol, DEFAULT_MENU_ITEMS exported, per-refresh rect caching, spec amended (boot scale-zoom, non-dithered screensaver glyphs).

## Self-review notes

- Spec §1 → T1/T5; §2 → T4/T6; §3 → T8; §4 → T3/T5/T9; §5 → T2/T7 (both entry points: T7 app icon+menu, T9 marketing menu). No uncovered spec sections.
- Cross-task names checked: `DockId`, `useSectionDock(id, ref, {dockOnExit, pinnedContainer})`, `loadGsap`, `registerScrollFn`, `SEGMENTS`/`segmentPhase`/`outlineRect`, `createVM`, `TerminalWindow`, `safeSessionStorage`/`clearBootFlag`, `data-dock-slots`/`data-stack-key`/`data-taskbar`, `DEFAULT_MENU_ITEMS` consistent across tasks.
- Known risks: v86 API drift (T7 re-checks pinned version), upstream recipe drift (T2 pins SHA, upstream wins), BIOS requirement unknown until T2 step 9 (fallback protocol recorded in README for T7), pinnedContainer on unpinned fallback (T1 step 6 verify).
