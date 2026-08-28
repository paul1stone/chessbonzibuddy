# Retro Landing Page and Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app-first `/` with a static Windows-98-styled landing page whose hero is a scroll-driven, pixelated, flat-shaded 3D chess game (Scholar's mate, Bonzi as White), add a small reusable retro design system, legal pages, and keep the existing app fully working at `/app`.

**Architecture:** Route groups split marketing (`(marketing)`: `/`, `/privacy`, `/terms`, static) from the app (`(app)`: `/app`, the existing page moved verbatim). The hero is DOM window chrome over a lazily mounted React Three Fiber canvas rendered at 400px internal width with a Bayer dither post pass; one scrubbed GSAP ScrollTrigger timeline drives both the canvas (via a smoothed progress ref) and the DOM choreography; everything degrades to a static poster under `prefers-reduced-motion`. Pieces are procedural Three.js geometry (no model downloads).

**Tech Stack:** Next.js 16.1.6 App Router, React 19.2, Tailwind v4, three 0.185, @react-three/fiber 9.7, postprocessing 6.39 + @react-three/postprocessing 3.1, gsap 3.15 + @gsap/react, vitest, @playwright/test 1.62, sharp (dev).

**Spec:** `docs/superpowers/specs/2026-08-28-retro-landing-design.md`

## Global Constraints

- Product name in all new UI/metadata: `Chess Bonzi Buddy`. Never "Chess Analyzer" in new code.
- Copy: sentence case, active voice, no em-dashes in body copy, no emoji, no "It's not X, it's Y". Taunts only from `src/lib/bonzi/quips.ts`.
- Marketing pages use no icon library (no `lucide-react` imports under `src/app/(marketing)` or `src/components/retro|landing`).
- Radius is always 0 in retro UI. Colors only via the `--r-*` tokens in `src/styles/retro.css`; `--r-bonzi` only on Bonzi's speech bubble.
- Reduced motion: no ScrollTrigger choreography, no `<canvas>`; poster + normal-flow dialog instead.
- Do not modify anything under `src/components/play`, `src/components/review`, `src/components/practice`, `src/components/import`, `src/components/chess`, `src/app/api`, `src/db`, `src/lib/engine.ts`, `src/lib/server`.
- Exact dependency versions (verified 2026-08-28): `three@0.185.1 @react-three/fiber@9.7.0 postprocessing@6.39.4 @react-three/postprocessing@3.1.1 gsap@3.15.0 @gsap/react@2.1.2` (no Lenis: ScrollTrigger's `scrub: 0.3` provides the smoothing); dev `@playwright/test@1.62.1 vitest@^4 @types/three@^0.185 sharp@^0.35`. Pin these; do not add `@react-three/drei`.
- Git: commit per task with a 3-5 word plain message (no prefixes, no colons, no Co-Authored-By). Never push.
- Verification commands: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`. Lint baseline: 8 pre-existing errors across 4 files (bonzi-avatar.tsx x5, speech-bubble.tsx, board.tsx, board-panel.tsx). Task 5 Step 1b fixes the two bonzi files; from then on only the two board files' errors are allowed.
- Node 24.17, npm 11. ffmpeg is at `/opt/homebrew/bin/ffmpeg`. Task 0 installs the Playwright chromium build; do not assume one is cached (the cache holds revision 1194, but @playwright/test 1.62.1 needs 1234).

---

### Task 0: Tooling and dependencies

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.mjs:8-15`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Modify: `.gitignore` (append)

**Interfaces:**
- Produces: npm scripts `typecheck`, `test`, `test:e2e`, `screenshots`; vitest picks up `src/**/*.test.ts`; Playwright picks up `e2e/**/*.spec.ts` and boots `next dev` on port 3000.

- [ ] **Step 1: Install runtime and dev dependencies at pinned versions**

```bash
npm install three@0.185.1 @react-three/fiber@9.7.0 postprocessing@6.39.4 @react-three/postprocessing@3.1.1 gsap@3.15.0 @gsap/react@2.1.2
npm install -D @playwright/test@1.62.1 vitest@^4 @types/three@^0.185 sharp@^0.35
npx playwright install chromium
```

Expected: no peer-dependency errors (fiber 9.7 wants `react >=19 <19.3`; repo has 19.2.3). The playwright install downloads chromium revision 1234 into `~/Library/Caches/ms-playwright` (the cached 1194 is for an older Playwright and will not be used).

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block add (keep existing entries):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:e2e": "playwright test",
"screenshots": "node scripts/capture-screenshots.mjs"
```

- [ ] **Step 3: Ignore generated Stockfish bundles in ESLint**

Replace the `globalIgnores([...])` array in `eslint.config.mjs` with:

```js
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/stockfish/**",
    ".stockfish/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: Append to `.gitignore`**

```
# playwright
/playwright-report/
/test-results/
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npx eslint . 2>&1 | tail -3 && npx vitest run --passWithNoTests`
Expected: typecheck clean; eslint error count drops from 24 to 8 (the 16 Stockfish `no-require-imports` errors are gone); vitest reports no test files.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json eslint.config.mjs vitest.config.ts playwright.config.ts .gitignore
git commit -m "add 3d scroll and test tooling"
```

---

### Task 1: Route split, app moves to /app

**Files:**
- Modify: `src/app/layout.tsx` (rewrite)
- Create: `src/app/(app)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(app)/app/page.tsx` (git mv, NO edits — the page moves verbatim)
- Create: `src/app/(app)/app/view-param-sync.tsx`
- Modify: `src/components/ui/sonner.tsx` (hardcode dark theme)

**Interfaces:**
- Produces: URL `/app` serves the existing app; `/app?view=play-bonzi` opens the play view. Root layout renders only `<html><body>` with `globals.css`; nothing else depends on it.

- [ ] **Step 1: Move the page**

```bash
mkdir -p "src/app/(app)/app"
git mv src/app/page.tsx "src/app/(app)/app/page.tsx"
```

- [ ] **Step 2: Rewrite `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Chess Bonzi Buddy",
    template: "%s | Chess Bonzi Buddy",
  },
  description:
    "Play chess against Bonzi Buddy, a purple gorilla from 1999 who runs on Stockfish and talks trash. Then import your games and find out where they went wrong.",
  icons: { icon: "/coolmonkey.gif" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/layout.tsx`**

```tsx
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Toaster } from "@/components/ui/sonner";
import { ViewParamSync } from "./app/view-param-sync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dark ${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
      <Suspense fallback={null}>
        <ViewParamSync />
      </Suspense>
      <DashboardLayout>{children}</DashboardLayout>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
```

next-themes is dropped entirely: nothing in the app calls `setTheme`, the app is permanently dark, and next-themes' `forcedTheme` would write `class="dark"` onto `<html>` at runtime and never remove it, leaking dark tokens into the marketing pages on client-side navigation. The `.dark` wrapper div is what activates shadcn's `@custom-variant dark (&:is(.dark *))`. Leave `src/components/theme-provider.tsx` in place but unimported.

- [ ] **Step 4: Create `src/app/(app)/app/view-param-sync.tsx`**

```tsx
"use client";

import { useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "@/stores/game-store";

// Lets the landing page deep-link into a view: /app?view=play-bonzi
export function ViewParamSync() {
  const params = useSearchParams();
  const setView = useGameStore((s) => s.setView);
  const view = params.get("view");

  useLayoutEffect(() => {
    if (view === "play-bonzi") setView("play-bonzi");
  }, [view, setView]);

  return null;
}
```

Mounted once in the layout (Step 3), so the deep link works from every in-session state, not just the states a fresh visitor lands in. `useLayoutEffect` lands the view switch before paint on client-side navigations; the one-frame flash of the prerendered import view on a cold load of `/app?view=play-bonzi` is inherent to a static client page and accepted. (`setView` is a Zustand setter, not a React state setter, so the `set-state-in-effect` lint rule does not apply.) `Suspense` is required by Next for `useSearchParams`.

- [ ] **Step 5: Hardcode the dark theme in `src/components/ui/sonner.tsx`**

With no ThemeProvider, `useTheme()` would report `"system"` and the toasts would flip light. Read the file; replace the `useTheme()` usage so the `<Sonner>` element receives `theme="dark"` as a literal, and remove the `next-themes` import. Change nothing else in the file.

- [ ] **Step 6: Verify manually**

Run: `npm run dev` then open `http://localhost:3000/app` (sidebar + login card render, dark purple theme intact; trigger a toast by linking a bogus username and confirm it renders dark) and `http://localhost:3000/app?view=play-bonzi` (the "Play Bonzi Buddy" setup with the waving gif renders). Inspect `<html>`: no `dark` class and no inline `color-scheme` style. `http://localhost:3000/` now 404s; that is expected until Task 7.
Run: `npm run typecheck && npx eslint src/app`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components/ui/sonner.tsx
git commit -m "move app under app route"
```

---

### Task 2: Retro design system, fonts, marketing layout

**Files:**
- Create: `src/styles/retro.css`
- Modify: `src/app/globals.css:1-3` (add import)
- Create: `src/fonts/ms_sans_serif.woff2`, `src/fonts/ms_sans_serif_bold.woff2`, `src/fonts/MS-SANS-SERIF-LICENSE.txt`, `src/fonts/retro-fonts.ts`
- Create: `public/bonzi/idle-still.png`
- Create: `src/components/retro/retro-window.tsx`, `retro-button.tsx`, `retro-dialog.tsx`, `taskbar.tsx`, `index.ts`
- Create: `src/app/(marketing)/layout.tsx`

**Interfaces:**
- Produces:
  - `RetroWindow(props: { title: string; children: ReactNode; className?: string; style?: CSSProperties; statusBar?: ReactNode; ref?: Ref<HTMLElement>; id?: string; "aria-labelledby"?: string })` (server-compatible; no event handlers)
  - `RetroButton(props: { href?: string; variant?: "normal" | "default"; size?: "md" | "lg"; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>)`
  - `RetroDialog(props: { title: string; children: ReactNode; actions: ReactNode; className?: string; ref?: Ref<HTMLElement> })`
  - `Taskbar()` client component; `msSans`, `vt323` font objects exposing `.variable`.
  - CSS classes: `.retro`, `.r-face`, `.r-bevel-out`, `.r-bevel-in`, `.r-title`, `.r-btn`, `.r-btn--default`, `.r-btn--lg`, `.r-body`, `.r-term`, `.r-paper`, `.r-sep`.

- [ ] **Step 1: Copy the pixel font and its license out of the 98.css package**

```bash
cd /private/tmp/claude-501/-Users-fv-123-chessbonzibuddy/223a078e-2ce5-43ae-9163-0cb984f48029/scratchpad
npm pack 98.css@0.1.21 --silent && tar -xzf 98.css-0.1.21.tgz
mkdir -p /Users/fv_123/chessbonzibuddy/src/fonts
cp package/dist/ms_sans_serif.woff2 package/dist/ms_sans_serif_bold.woff2 /Users/fv_123/chessbonzibuddy/src/fonts/
cp "package/fonts/src/ms-sans-serif/license.txt" /Users/fv_123/chessbonzibuddy/src/fonts/MS-SANS-SERIF-LICENSE.txt
ls -la /Users/fv_123/chessbonzibuddy/src/fonts
```

Expected: two woff2 files (6.5 KB and ~7 KB) and the CC BY-SA 3.0 license text naming "lou" and fontstruct.com.

- [ ] **Step 2: Extract a still frame of idle.gif**

```bash
/opt/homebrew/bin/ffmpeg -y -loglevel error -i public/bonzi/idle.gif -frames:v 1 public/bonzi/idle-still.png && file public/bonzi/idle-still.png
```

Expected: a PNG, same dimensions as the gif.

- [ ] **Step 3: Create `src/fonts/retro-fonts.ts`**

```ts
import localFont from "next/font/local";
import { VT323 } from "next/font/google";

// Pixelated MS Sans Serif by lou (FontStruct), CC BY-SA 3.0. See MS-SANS-SERIF-LICENSE.txt.
export const msSans = localFont({
  src: [
    { path: "./ms_sans_serif.woff2", weight: "400", style: "normal" },
    { path: "./ms_sans_serif_bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
  preload: true,
});

export const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-term",
  display: "swap",
  preload: false,
});
```

- [ ] **Step 4: Create `src/styles/retro.css`**

```css
/* Windows 98 design tokens and primitives. Scoped under .retro so the app's shadcn theme is untouched. */
.retro {
  --r-desktop: #008080;
  --r-face: #c0c0c0;
  --r-face-light: #dfdfdf;
  --r-highlight: #ffffff;
  --r-shadow: #808080;
  --r-dark: #000000;
  --r-title-a: #000080;
  --r-title-b: #1084d0;
  --r-title-text: #ffffff;
  --r-paper: #ffffff;
  --r-disabled: #808080;
  --r-bonzi: #7b4fb5;
  --r-taskbar-h: 30px;

  font-family: var(--font-ui), "MS Sans Serif", Tahoma, sans-serif;
  font-size: 11px;
  line-height: 1.35;
  color: var(--r-dark);
  background: var(--r-desktop);
  -webkit-font-smoothing: none;
  text-rendering: optimizeSpeed;
}

.retro *,
.retro *::before,
.retro *::after {
  border-radius: 0;
}

.r-face { background: var(--r-face); }
.r-paper { background: var(--r-paper); }

.r-bevel-out {
  box-shadow:
    inset -1px -1px var(--r-dark),
    inset 1px 1px var(--r-highlight),
    inset -2px -2px var(--r-shadow),
    inset 2px 2px var(--r-face-light);
}

.r-bevel-in {
  box-shadow:
    inset -1px -1px var(--r-highlight),
    inset 1px 1px var(--r-dark),
    inset -2px -2px var(--r-face-light),
    inset 2px 2px var(--r-shadow);
}

/* Two-stop navy to blue: the literal Windows 98 title bar (stated brief exception). */
.r-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 3px 3px 6px;
  background: linear-gradient(90deg, var(--r-title-a), var(--r-title-b));
  color: var(--r-title-text);
  font-weight: 700;
  user-select: none;
}
.r-title-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 14px;
  background: var(--r-face);
  color: var(--r-dark);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  box-shadow:
    inset -1px -1px var(--r-dark),
    inset 1px 1px var(--r-highlight),
    inset -2px -2px var(--r-shadow),
    inset 2px 2px var(--r-face-light);
}

.r-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 75px;
  min-height: 23px;
  padding: 0 12px;
  background: var(--r-face);
  color: var(--r-dark);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  box-shadow:
    inset -1px -1px var(--r-dark),
    inset 1px 1px var(--r-highlight),
    inset -2px -2px var(--r-shadow),
    inset 2px 2px var(--r-face-light);
}
.r-btn:active {
  padding-top: 2px;
  box-shadow:
    inset -1px -1px var(--r-highlight),
    inset 1px 1px var(--r-dark),
    inset -2px -2px var(--r-face-light),
    inset 2px 2px var(--r-shadow);
}
.r-btn--default {
  font-weight: 700;
  outline: 1px solid var(--r-dark);
}
.r-btn--lg {
  min-height: 32px;
  padding: 0 18px;
  font-size: 14px;
}
.r-btn:focus-visible,
.retro button:focus-visible {
  outline: 1px dotted var(--r-dark);
  outline-offset: -4px;
}
.retro a:not(.r-btn):focus-visible {
  outline: 2px solid var(--r-highlight);
  outline-offset: 2px;
}
.retro a:not(.r-btn) {
  color: inherit;
  text-decoration: underline;
}

.r-body {
  font-family: Verdana, Tahoma, "DejaVu Sans", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: auto;
  text-rendering: auto;
}
.r-term {
  font-family: var(--font-term), "Courier New", monospace;
  font-size: 18px;
  line-height: 1.2;
}

.r-sep {
  height: 2px;
  border-top: 1px solid var(--r-shadow);
  border-bottom: 1px solid var(--r-highlight);
}

@media (prefers-reduced-motion: reduce) {
  .retro * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Import it from `src/app/globals.css`**

After line 3 (`@import "shadcn/tailwind.css";`) add:

```css
@import "../styles/retro.css";
```

- [ ] **Step 6: Create `src/components/retro/retro-window.tsx`**

```tsx
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface RetroWindowProps {
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  statusBar?: ReactNode;
  ref?: Ref<HTMLElement>;
  id?: string;
  "aria-labelledby"?: string;
}

export function RetroWindow({
  title,
  children,
  className,
  style,
  statusBar,
  ref,
  id,
  "aria-labelledby": labelledBy,
}: RetroWindowProps) {
  return (
    <section
      ref={ref}
      id={id}
      style={style}
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      className={cn("r-face r-bevel-out p-[3px]", className)}
    >
      <div className="r-title">
        <span className="truncate">{title}</span>
        <span className="ml-auto flex gap-[2px]" aria-hidden="true">
          <span className="r-title-glyph">_</span>
          <span className="r-title-glyph">□</span>
          <span className="r-title-glyph">×</span>
        </span>
      </div>
      <div className="p-3">{children}</div>
      {statusBar !== undefined && (
        <div className="r-bevel-in mx-[1px] mb-[1px] px-2 py-[3px] text-[11px]">{statusBar}</div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Create `src/components/retro/retro-button.tsx`**

```tsx
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  variant?: "normal" | "default";
  size?: "md" | "lg";
  children: ReactNode;
}

export function RetroButton({
  href,
  variant = "normal",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: RetroButtonProps) {
  const cls = cn("r-btn", variant === "default" && "r-btn--default", size === "lg" && "r-btn--lg", className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 8: Create `src/components/retro/retro-dialog.tsx`**

```tsx
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { RetroWindow } from "./retro-window";

interface RetroDialogProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}

export function RetroDialog({ title, children, actions, className, ref }: RetroDialogProps) {
  return (
    <RetroWindow ref={ref} title={title} className={cn("w-[min(92vw,380px)]", className)}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center bg-[var(--r-title-a)] font-serif text-[22px] font-bold italic text-[var(--r-title-text)]"
        >
          i
        </span>
        <div className="r-body pt-1">{children}</div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
    </RetroWindow>
  );
}
```

- [ ] **Step 9: Create `src/components/retro/taskbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MENU_ITEMS: { href: string; label: string; external?: boolean }[] = [
  { href: "/app?view=play-bonzi", label: "Play Bonzi Buddy" },
  { href: "/app", label: "Analyze my games" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "https://github.com/paul1stone/chessbonzibuddy", label: "GitHub", external: true },
];

function Clock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className="tabular-nums" suppressHydrationWarning>
      {time ?? " "}
    </time>
  );
}

export function Taskbar() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="r-face fixed inset-x-0 bottom-0 z-50 flex h-[var(--r-taskbar-h)] items-center gap-1 border-t-2 border-[var(--r-highlight)] px-[2px]"
    >
      <button
        ref={buttonRef}
        type="button"
        className="r-btn h-[22px] min-w-0 gap-1 px-2 font-bold"
        aria-expanded={open}
        aria-controls="start-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bonzi/idle-still.png" alt="" width={16} height={16} />
        Start
      </button>

      {open && (
        <nav
          id="start-menu"
          aria-label="Start menu"
          className="r-face r-bevel-out absolute bottom-[var(--r-taskbar-h)] left-0 flex w-[220px] p-[3px]"
        >
          {/* Period-accurate Win98 Start-menu sidebar stripe */}
          <div
            className="flex w-[24px] items-end justify-center bg-[var(--r-title-a)] py-2 text-[14px] font-bold text-[var(--r-title-text)] [writing-mode:vertical-rl] rotate-180"
            aria-hidden="true"
          >
            Chess Bonzi Buddy
          </div>
          <ul className="flex-1">
            {MENU_ITEMS.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    className="block px-3 py-[6px] no-underline hover:bg-[var(--r-title-a)] hover:text-[var(--r-title-text)]"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="block px-3 py-[6px] no-underline hover:bg-[var(--r-title-a)] hover:text-[var(--r-title-text)]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="r-bevel-in ml-auto flex h-[22px] items-center px-2">
        <Clock />
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Create `src/components/retro/index.ts`**

```ts
export { RetroWindow } from "./retro-window";
export { RetroButton } from "./retro-button";
export { RetroDialog } from "./retro-dialog";
export { Taskbar } from "./taskbar";
```

- [ ] **Step 11: Create `src/app/(marketing)/layout.tsx`**

No `metadata` export: the root layout's default already yields the title "Chess Bonzi Buddy", and a plain string here would combine with the root template into "Chess Bonzi Buddy | Chess Bonzi Buddy".

```tsx
import { msSans, vt323 } from "@/fonts/retro-fonts";
import { Taskbar } from "@/components/retro";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`retro ${msSans.variable} ${vt323.variable} min-h-screen pb-[var(--r-taskbar-h)]`}>
      {children}
      <Taskbar />
    </div>
  );
}
```

- [ ] **Step 12: Smoke-check with a throwaway page, then delete it**

Create `src/app/(marketing)/retro-smoke/page.tsx`:

```tsx
import { RetroButton, RetroDialog, RetroWindow } from "@/components/retro";

export default function Smoke() {
  return (
    <main className="grid gap-6 p-8">
      <RetroWindow title="Chess Bonzi Buddy" statusBar="Ready">
        <h1 className="text-[33px] font-bold">Play chess against a purple gorilla from 1999.</h1>
        <p className="r-body mt-3">Body copy in Verdana. <a href="/app">A link</a>.</p>
        <p className="r-term mt-3">VT323 terminal text: CHECKMATE.</p>
        <div className="mt-4 flex gap-2">
          <RetroButton variant="default" size="lg" href="/app">Play Bonzi Buddy</RetroButton>
          <RetroButton size="lg">Analyze my games</RetroButton>
        </div>
      </RetroWindow>
      <RetroDialog title="Chess Bonzi Buddy" actions={<RetroButton variant="default">OK</RetroButton>}>
        Checkmate. Bonzi wins in four moves.
      </RetroDialog>
    </main>
  );
}
```

Run `npm run dev`, open `http://localhost:3000/retro-smoke`, and confirm: teal desktop, grey beveled windows, navy gradient title bars with three glyphs, pixel font (crisp, not smoothed) at 11px, headline chunky at 33px, buttons sunken while pressed, dotted focus rect when tabbing, Start menu opens/closes with click and Escape, clock shows the time. The page is a Server Component and must render without error (RetroWindow takes no event handlers). Screenshot for the reviewer with Playwright: `npx playwright screenshot --viewport-size=1200,900 http://localhost:3000/retro-smoke /private/tmp/claude-501/-Users-fv-123-chessbonzibuddy/223a078e-2ce5-43ae-9163-0cb984f48029/scratchpad/retro-smoke.png`.

Then delete the smoke page: `rm -r "src/app/(marketing)/retro-smoke"`.

- [ ] **Step 13: Verify and commit**

Run: `npm run typecheck && npx eslint src/components/retro src/app src/fonts`
Expected: clean.

```bash
git add src/styles src/fonts src/components/retro "src/app/(marketing)" src/app/globals.css public/bonzi/idle-still.png
git commit -m "add retro design system"
```

---

### Task 3: Hero timeline and procedural piece geometry (pure, tested)

**Files:**
- Create: `src/components/landing/hero/hero-timeline.ts`
- Create: `src/components/landing/hero/hero-timeline.test.ts`
- Create: `src/components/landing/hero/piece-geometry.ts`
- Create: `src/components/landing/hero/piece-geometry.test.ts`
- Create: `src/lib/motion.ts`

**Interfaces:**
- Produces (consumed by Task 4):
  - `type PieceType = "p" | "n" | "b" | "r" | "q" | "k"`, `type Color = "w" | "b"`, `type Square` (algebraic string)
  - `INITIAL_PIECES: PieceState[]` where `PieceState = { id: string; type: PieceType; color: Color; square: Square }`
  - `boardAt(progress: number): RenderPiece[]` where `RenderPiece = { id; type; color; x: number; y: number; z: number; yaw: number; pitch: number; captured: boolean }`
  - `cameraAt(progress: number): { position: [number, number, number]; target: [number, number, number] }`
  - `squareToXZ(square: Square): [number, number]`
  - `createPieceGeometry(type: PieceType): THREE.BufferGeometry`
  - Constants `MOVE_START = 0.1`, `MOVE_END = 0.85`, `HIDE_BELOW_Y = -1.5`
  - From `src/lib/motion.ts`: `prefersReducedMotion(): boolean` (SSR-safe, false on server), `supportsWebGL(): boolean`, `usePrefersReducedMotion(): boolean` (React hook, `useSyncExternalStore`-based, live-updates on media-query change)

- [ ] **Step 1: Write the failing timeline tests**

`src/components/landing/hero/hero-timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  boardAt,
  cameraAt,
  CAM_LOW,
  CAM_TOP,
  INITIAL_PIECES,
  MOVE_END,
  MOVE_START,
  SCHOLARS_MATE,
  squareToXZ,
} from "./hero-timeline";

const byId = (id: string, progress: number) => {
  const piece = boardAt(progress).find((p) => p.id === id);
  if (!piece) throw new Error(`missing ${id}`);
  return piece;
};

describe("squareToXZ", () => {
  it("centers the board on the origin with rank 1 nearest +z", () => {
    expect(squareToXZ("a1")).toEqual([-3.5, 3.5]);
    expect(squareToXZ("h8")).toEqual([3.5, -3.5]);
    expect(squareToXZ("e4")).toEqual([0.5, 0.5]);
  });
});

describe("boardAt", () => {
  it("starts with all 32 pieces on their squares at rest", () => {
    const pieces = boardAt(0);
    expect(pieces).toHaveLength(32);
    for (const p of pieces) {
      const init = INITIAL_PIECES.find((i) => i.id === p.id)!;
      const [x, z] = squareToXZ(init.square);
      expect(p.x).toBeCloseTo(x);
      expect(p.z).toBeCloseTo(z);
      expect(p.y).toBe(0);
      expect(p.captured).toBe(false);
    }
  });

  it("lifts the e2 pawn mid-way through the first ply", () => {
    const slice = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;
    const mid = MOVE_START + slice / 2;
    const pawn = byId("wp4", mid);
    expect(pawn.y).toBeGreaterThan(0.3);
    expect(pawn.z).toBeLessThan(squareToXZ("e2")[1]);
    expect(pawn.z).toBeGreaterThan(squareToXZ("e4")[1]);
  });

  it("ends with the queen on f7 and the f7 pawn captured and falling", () => {
    const queen = byId("wq3", 1);
    const [fx, fz] = squareToXZ("f7");
    expect(queen.x).toBeCloseTo(fx);
    expect(queen.z).toBeCloseTo(fz);
    expect(queen.y).toBe(0);

    const victim = byId("bp5", 1);
    expect(victim.captured).toBe(true);
    expect(victim.y).toBeLessThan(0);

    expect(byId("bp4", 1).z).toBeCloseTo(squareToXZ("e5")[1]);
    expect(byId("bn1", 1).x).toBeCloseTo(squareToXZ("c6")[0]);
    expect(byId("wb5", 1).x).toBeCloseTo(squareToXZ("c4")[0]);
    expect(byId("bn6", 1).z).toBeCloseTo(squareToXZ("f6")[1]);
  });

  it("clamps progress outside [0, 1]", () => {
    expect(boardAt(-1)).toEqual(boardAt(0));
    expect(boardAt(2)).toEqual(boardAt(1));
  });
});

describe("cameraAt", () => {
  it("interpolates from the top view to the low view by MOVE_END", () => {
    expect(cameraAt(0).position).toEqual(CAM_TOP.position);
    expect(cameraAt(MOVE_END).position).toEqual(CAM_LOW.position);
    expect(cameraAt(1).position).toEqual(CAM_LOW.position);
    const mid = cameraAt(MOVE_END / 2).position;
    expect(mid[1]).toBeLessThan(CAM_TOP.position[1]);
    expect(mid[1]).toBeGreaterThan(CAM_LOW.position[1]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/components/landing/hero/hero-timeline.test.ts`
Expected: FAIL, cannot resolve `./hero-timeline`.

- [ ] **Step 3: Write `src/components/landing/hero/hero-timeline.ts`**

```ts
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface PieceState {
  id: string;
  type: PieceType;
  color: Color;
  square: Square;
}

export interface Ply {
  from: Square;
  to: Square;
  captures?: Square;
}

export interface RenderPiece {
  id: string;
  type: PieceType;
  color: Color;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  captured: boolean;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

// 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#
export const SCHOLARS_MATE: Ply[] = [
  { from: "e2", to: "e4" },
  { from: "e7", to: "e5" },
  { from: "d1", to: "h5" },
  { from: "b8", to: "c6" },
  { from: "f1", to: "c4" },
  { from: "g8", to: "f6" },
  { from: "h5", to: "f7", captures: "f7" },
];

export const MOVE_START = 0.1;
export const MOVE_END = 0.85;
export const LIFT = 0.6;
export const TUMBLE = 0.15;
export const HIDE_BELOW_Y = -1.5;

export const CAM_TOP: CameraPose = { position: [0, 11, 2.5], target: [0, 0, 0] };
export const CAM_LOW: CameraPose = { position: [6, 3.2, 7], target: [0, 0, 0] };

const FILES = "abcdefgh";
const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export const INITIAL_PIECES: PieceState[] = (() => {
  const out: PieceState[] = [];
  for (let f = 0; f < 8; f++) {
    const file = FILES[f];
    out.push({ id: `w${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "w", square: `${file}1` as Square });
    out.push({ id: `wp${f}`, type: "p", color: "w", square: `${file}2` as Square });
    out.push({ id: `bp${f}`, type: "p", color: "b", square: `${file}7` as Square });
    out.push({ id: `b${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "b", square: `${file}8` as Square });
  }
  return out;
})();

export function squareToXZ(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return [file - 3.5, 3.5 - rank];
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface ActiveMove {
  id: string;
  from: Square;
  to: Square;
  t: number;
}

export function boardAt(progress: number): RenderPiece[] {
  const p = clamp01(progress);
  const squares = new Map<string, Square>(INITIAL_PIECES.map((pc) => [pc.id, pc.square]));
  const capturedAt = new Map<string, number>();
  const sliceLen = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;

  const occupant = (square: Square) => {
    for (const [id, sq] of squares) {
      if (sq === square && !capturedAt.has(id)) return id;
    }
    throw new Error(`no piece on ${square}`);
  };

  let active: ActiveMove | null = null;

  SCHOLARS_MATE.forEach((ply, i) => {
    const start = MOVE_START + i * sliceLen;
    const end = start + sliceLen;
    if (p < start) return;
    const mover = occupant(ply.from);
    if (p >= end) {
      if (ply.captures) capturedAt.set(occupant(ply.captures), start + sliceLen / 2);
      squares.set(mover, ply.to);
      return;
    }
    const t = easeInOutQuad((p - start) / sliceLen);
    if (ply.captures && t > 0.5) capturedAt.set(occupant(ply.captures), start + sliceLen / 2);
    active = { id: mover, from: ply.from, to: ply.to, t };
  });

  return INITIAL_PIECES.map((pc) => {
    const yaw = pc.color === "b" ? Math.PI : 0;
    const base = { id: pc.id, type: pc.type, color: pc.color };
    const capTime = capturedAt.get(pc.id);

    if (capTime !== undefined) {
      const u = clamp01((p - capTime) / TUMBLE);
      const [x0, z0] = squareToXZ(squares.get(pc.id)!);
      return {
        ...base,
        x: x0 + 1.6 * u,
        y: 1.2 * u - 3 * u * u,
        z: z0 - 0.4 * u,
        yaw: yaw + u * Math.PI * 2,
        pitch: u * Math.PI,
        captured: true,
      };
    }

    if (active && active.id === pc.id) {
      const [x0, z0] = squareToXZ(active.from);
      const [x1, z1] = squareToXZ(active.to);
      const t = active.t;
      return {
        ...base,
        x: x0 + (x1 - x0) * t,
        y: Math.sin(t * Math.PI) * LIFT,
        z: z0 + (z1 - z0) * t,
        yaw,
        pitch: 0,
        captured: false,
      };
    }

    const [x, z] = squareToXZ(squares.get(pc.id)!);
    return { ...base, x, y: 0, z, yaw, pitch: 0, captured: false };
  });
}

export function cameraAt(progress: number): CameraPose {
  const u = easeInOutCubic(clamp01(clamp01(progress) / MOVE_END));
  const lerp = (a: number, b: number) => a + (b - a) * u;
  return {
    position: [
      lerp(CAM_TOP.position[0], CAM_LOW.position[0]),
      lerp(CAM_TOP.position[1], CAM_LOW.position[1]),
      lerp(CAM_TOP.position[2], CAM_LOW.position[2]),
    ],
    target: [0, 0, 0],
  };
}
```

Note on ids: the queen starts on d1 so its id is `wq3`; the light-squared bishop on f1 is `wb5`; knights are `bn1` (b8) and `bn6` (g8); pawns are `wp4` (e2), `bp4` (e7), `bp5` (f7). The tests rely on these.

- [ ] **Step 4: Run the timeline tests**

Run: `npx vitest run src/components/landing/hero/hero-timeline.test.ts`
Expected: PASS (6 tests). If `cameraAt(MOVE_END).position` fails by floating error, compare with `toBeCloseTo` per component; `easeInOutCubic(1)` is exactly 1 so `toEqual` should hold.

- [ ] **Step 5: Write the failing geometry tests**

`src/components/landing/hero/piece-geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Box3 } from "three";
import { createPieceGeometry, PIECE_HEIGHTS } from "./piece-geometry";
import type { PieceType } from "./hero-timeline";

const TYPES: PieceType[] = ["p", "n", "b", "r", "q", "k"];

describe("createPieceGeometry", () => {
  it.each(TYPES)("builds a bounded, low-poly %s", (type) => {
    const geo = createPieceGeometry(type);
    geo.computeBoundingBox();
    const box = geo.boundingBox as Box3;
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(PIECE_HEIGHTS[type], 1);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThan(0.8);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    expect(tris).toBeGreaterThan(20);
    expect(tris).toBeLessThan(1200);
    expect(geo.attributes.normal).toBeDefined();
  });

  it("makes the king taller than the queen, and the queen taller than the rest", () => {
    expect(PIECE_HEIGHTS.k).toBeGreaterThan(PIECE_HEIGHTS.q);
    for (const t of ["p", "n", "b", "r"] as PieceType[]) {
      expect(PIECE_HEIGHTS.q).toBeGreaterThan(PIECE_HEIGHTS[t]);
    }
  });
});
```

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run src/components/landing/hero/piece-geometry.test.ts`
Expected: FAIL, cannot resolve `./piece-geometry`.

- [ ] **Step 7: Write `src/components/landing/hero/piece-geometry.ts`**

```ts
import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PieceType } from "./hero-timeline";

const SEGMENTS = 10;

// [radius, height] pairs, bottom to top, in board-square units.
const PROFILES: Record<Exclude<PieceType, "n">, [number, number][]> = {
  p: [[0, 0], [0.32, 0], [0.32, 0.06], [0.22, 0.12], [0.14, 0.3], [0.11, 0.36], [0.19, 0.4], [0.16, 0.47], [0.09, 0.55], [0, 0.55]],
  r: [[0, 0], [0.34, 0], [0.34, 0.08], [0.25, 0.14], [0.22, 0.5], [0.3, 0.55], [0.3, 0.7], [0.18, 0.7], [0.18, 0.62], [0, 0.62]],
  b: [[0, 0], [0.33, 0], [0.33, 0.07], [0.2, 0.14], [0.14, 0.45], [0.21, 0.55], [0.17, 0.68], [0.08, 0.76], [0, 0.8]],
  q: [[0, 0], [0.36, 0], [0.36, 0.08], [0.23, 0.16], [0.14, 0.55], [0.23, 0.7], [0.19, 0.78], [0.25, 0.85], [0.11, 0.9], [0, 0.9]],
  k: [[0, 0], [0.36, 0], [0.36, 0.08], [0.23, 0.16], [0.14, 0.6], [0.23, 0.76], [0.19, 0.84], [0.1, 0.9], [0, 0.9]],
};

// Knight silhouette (x, y), counter-clockwise, base centered on x=0.
const KNIGHT: [number, number][] = [
  [-0.28, 0], [0.28, 0], [0.28, 0.08], [0.18, 0.14], [0.16, 0.36], [0.3, 0.5], [0.34, 0.62],
  [0.22, 0.75], [0.02, 0.72], [-0.1, 0.6], [-0.06, 0.5], [-0.18, 0.4], [-0.18, 0.14], [-0.28, 0.08],
];

export const PIECE_HEIGHTS: Record<PieceType, number> = {
  p: 0.55,
  n: 0.75,
  b: 0.8,
  r: 0.7,
  q: 0.98,
  k: 1.12,
};

function lathe(profile: [number, number][]): BufferGeometry {
  return new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), SEGMENTS);
}

function finish(geo: BufferGeometry): BufferGeometry {
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

export function createPieceGeometry(type: PieceType): BufferGeometry {
  switch (type) {
    case "n": {
      const shape = new Shape(KNIGHT.map(([x, y]) => new Vector2(x, y)));
      const geo = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
      geo.translate(0, 0, -0.15);
      return finish(geo);
    }
    case "q": {
      const body = lathe(PROFILES.q);
      const crown = new SphereGeometry(0.08, 6, 4);
      crown.translate(0, 0.9, 0);
      return finish(mergeGeometries([body, crown].map((g) => g.toNonIndexed()), false)!);
    }
    case "k": {
      const body = lathe(PROFILES.k);
      const post = new BoxGeometry(0.06, 0.22, 0.06);
      post.translate(0, 1.01, 0);
      const bar = new BoxGeometry(0.18, 0.06, 0.06);
      bar.translate(0, 1.03, 0);
      return finish(mergeGeometries([body, post, bar].map((g) => g.toNonIndexed()), false)!);
    }
    default:
      return finish(lathe(PROFILES[type]));
  }
}
```

`mergeGeometries` needs every input to have the same attribute set; `toNonIndexed()` normalizes lathe (indexed) and box/sphere (indexed) to plain position/normal/uv, which is why it is applied to all.

- [ ] **Step 8: Run the geometry tests**

Run: `npx vitest run src/components/landing/hero/piece-geometry.test.ts`
Expected: PASS. If the `three/examples/jsm/...` import fails under vitest, add `"three/examples/jsm/utils/BufferGeometryUtils.js"` to `test.server.deps.inline` in `vitest.config.ts` and rerun. If a height assertion is off by more than 0.05, adjust `PIECE_HEIGHTS` to the geometry (heights are k 1.12 = 0.9 body + 0.22 post centered at 1.01 → top 1.12; q 0.98 = sphere top at 0.9 + 0.08).

- [ ] **Step 9: Create `src/lib/motion.ts`**

The hook exists because calling a `useState` setter directly in an effect body (`setReduced(prefersReducedMotion())`) is an error under `react-hooks/set-state-in-effect` in this repo's ESLint config; `useSyncExternalStore` is the lint-clean, tear-free way to read a media query.

```ts
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

// SSR snapshot is false: server markup assumes motion; the client corrects before paint.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
```

- [ ] **Step 10: Verify and commit**

Run: `npm run typecheck && npx eslint src/components/landing src/lib/motion.ts`
Expected: clean.

```bash
git add src/components/landing/hero src/lib/motion.ts
git commit -m "add hero timeline and pieces"
```

---

### Task 4: Hero canvas, dither pass, scroll hook

**Files:**
- Create: `src/components/landing/hero/dither-effect.ts`
- Create: `src/components/landing/hero/chess-scene.tsx`
- Create: `src/components/landing/hero/hero-canvas.tsx`
- Create: `src/components/landing/hero/hero-canvas-loader.tsx`
- Create: `src/components/landing/hero/use-hero-scroll.ts`

**Interfaces:**
- Consumes (Task 3): `boardAt`, `cameraAt`, `INITIAL_PIECES`, `createPieceGeometry`, `HIDE_BELOW_Y`; `prefersReducedMotion`, `supportsWebGL` from `@/lib/motion`.
- Produces (Task 7):
  - `HeroCanvasLoader(props: { progressRef: RefObject<number>; stageRef: RefObject<HTMLElement | null>; poster: ReactNode })` — always renders `poster`; mounts the canvas above it after idle when motion is allowed and WebGL works; pauses the frame loop while the stage is out of the viewport.
  - `useHeroScroll(refs: { sectionRef: RefObject<HTMLElement | null>; windowRef: RefObject<HTMLElement | null>; dialogRef: RefObject<HTMLElement | null>; progressRef: RefObject<number> }): void` — adds class `hero--motion` to the section while motion is enabled.

There is no Lenis and no smooth-scroll wrapper: native scrolling everywhere, with ScrollTrigger's `scrub: 0.3` supplying the smoothing on the hero. This avoids wheel hijacking on the legal pages and a whole class of mount-order bugs.

- [ ] **Step 1: Create `src/components/landing/hero/dither-effect.ts`**

```ts
import { Effect } from "postprocessing";
import { Uniform } from "three";

// 4x4 ordered (Bayer) dither with per-channel quantization. Runs after the low-res render.
const fragmentShader = /* glsl */ `
uniform float levels;

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float threshold = bayer4(gl_FragCoord.xy) - 0.5;
  vec3 c = inputColor.rgb + threshold / levels;
  outputColor = vec4(floor(c * levels + 0.5) / levels, inputColor.a);
}
`;

export class DitherEffect extends Effect {
  constructor({ levels = 6 }: { levels?: number } = {}) {
    super("DitherEffect", fragmentShader, {
      uniforms: new Map<string, Uniform>([["levels", new Uniform(levels)]]),
    });
  }
}
```

- [ ] **Step 2: Create `src/components/landing/hero/chess-scene.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D, type Mesh } from "three";
import { boardAt, cameraAt, HIDE_BELOW_Y, INITIAL_PIECES, type PieceType } from "./hero-timeline";
import { createPieceGeometry } from "./piece-geometry";

const LIGHT_SQUARE = new Color("#d9c9a3");
const DARK_SQUARE = new Color("#6e4b2a");
const PIECE_TYPES: PieceType[] = ["p", "n", "b", "r", "q", "k"];
const IDLE_PERIOD = 12;
const IDLE_AMPLITUDE = (3 * Math.PI) / 180;

function Board() {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let i = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        dummy.position.set(file - 3.5, -0.05, 3.5 - rank);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, (file + rank) % 2 === 0 ? DARK_SQUARE : LIGHT_SQUARE);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 64]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[8.6, 0.12, 8.6]} />
        <meshLambertMaterial color="#3a2a1a" flatShading />
      </mesh>
    </group>
  );
}

function Pieces({ progressRef }: { progressRef: RefObject<number> }) {
  const geometries = useMemo(
    () => Object.fromEntries(PIECE_TYPES.map((t) => [t, createPieceGeometry(t)])) as Record<PieceType, ReturnType<typeof createPieceGeometry>>,
    []
  );
  const white = useMemo(() => new MeshLambertMaterial({ color: "#f0e6d2", flatShading: true }), []);
  const black = useMemo(() => new MeshLambertMaterial({ color: "#2b2b2b", flatShading: true }), []);
  const meshes = useRef(new Map<string, Mesh>());

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      white.dispose();
      black.dispose();
    };
  }, [geometries, white, black]);

  useFrame(() => {
    for (const piece of boardAt(progressRef.current)) {
      const mesh = meshes.current.get(piece.id);
      if (!mesh) continue;
      mesh.position.set(piece.x, piece.y, piece.z);
      mesh.rotation.set(piece.pitch, piece.yaw, 0);
      mesh.visible = !(piece.captured && piece.y < HIDE_BELOW_Y);
    }
  });

  return (
    <>
      {INITIAL_PIECES.map((piece) => (
        <mesh
          key={piece.id}
          ref={(el) => {
            if (el) meshes.current.set(piece.id, el);
            else meshes.current.delete(piece.id);
          }}
          geometry={geometries[piece.type]}
          material={piece.color === "w" ? white : black}
        />
      ))}
    </>
  );
}

function CameraRig({ progressRef }: { progressRef: RefObject<number> }) {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const { position, target } = cameraAt(progressRef.current);
    const idle = Math.sin((clock.elapsedTime * Math.PI * 2) / IDLE_PERIOD) * IDLE_AMPLITUDE;
    const c = Math.cos(idle);
    const s = Math.sin(idle);
    camera.position.set(position[0] * c - position[2] * s, position[1], position[0] * s + position[2] * c);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

export function ChessScene({ progressRef }: { progressRef: RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[-4, 8, 3]} intensity={2.6} color="#fff2d8" />
      <Board />
      <Pieces progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
    </>
  );
}
```

- [ ] **Step 3: Create `src/components/landing/hero/hero-canvas.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { ChessScene } from "./chess-scene";
import { DitherEffect } from "./dither-effect";

const INTERNAL_WIDTH = 400;

function useRetroDpr() {
  const [dpr, setDpr] = useState(0.3);
  useEffect(() => {
    const update = () => setDpr(Math.min(1, Math.max(0.15, INTERNAL_WIDTH / window.innerWidth)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return dpr;
}

interface HeroCanvasProps {
  progressRef: RefObject<number>;
  active: boolean;
  onContextLost?: () => void;
}

export function HeroCanvas({ progressRef, active, onContextLost }: HeroCanvasProps) {
  const dpr = useRetroDpr();
  const dither = useMemo(() => new DitherEffect({ levels: 6 }), []);

  return (
    <Canvas
      dpr={dpr}
      flat
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      camera={{ fov: 40, near: 0.5, far: 60, position: [0, 11, 2.5] }}
      style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <ChessScene progressRef={progressRef} />
      <EffectComposer multisampling={0}>
        <primitive object={dither} />
      </EffectComposer>
    </Canvas>
  );
}
```

- [ ] **Step 4: Create `src/components/landing/hero/hero-canvas-loader.tsx`**

No `visibilitychange` handling: the frame loop runs on requestAnimationFrame, which browsers already throttle or pause in hidden tabs. The IntersectionObserver stays because the idle camera orbit would otherwise render at 60fps forever after the user scrolls past the hero.

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion, supportsWebGL } from "@/lib/motion";

const HeroCanvas = dynamic(() => import("./hero-canvas").then((m) => m.HeroCanvas), { ssr: false });

interface HeroCanvasLoaderProps {
  progressRef: RefObject<number>;
  stageRef: RefObject<HTMLElement | null>;
  poster: ReactNode;
}

type Status = "poster" | "canvas" | "failed";

export function HeroCanvasLoader({ progressRef, stageRef, poster }: HeroCanvasLoaderProps) {
  const [status, setStatus] = useState<Status>("poster");
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion() || !supportsWebGL()) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = w.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => setStatus("canvas"));
    return () => cancel(id);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [stageRef]);

  return (
    <>
      {poster}
      {status === "canvas" && (
        <div className="absolute inset-0" aria-hidden="true" data-testid="hero-canvas">
          <HeroCanvas progressRef={progressRef} active={inView} onContextLost={() => setStatus("failed")} />
        </div>
      )}
    </>
  );
}
```

(The `setStatus` and `setInView` calls sit behind scheduled callbacks — an idle callback and an observer callback — which the `react-hooks/set-state-in-effect` rule accepts; only a bare setState in the effect body is an error.)

- [ ] **Step 5: Create `src/components/landing/hero/use-hero-scroll.ts`**

One timeline, one ScrollTrigger. The proxy tween is what smooths the canvas: with `scrub: 0.3` GSAP eases the playhead toward the scroll position every ticker frame, so `proxy.p` (and therefore the pieces) glides even when the wheel steps.

```ts
"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  windowRef: RefObject<HTMLElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  progressRef: RefObject<number>;
}

// Scrubs hero progress into a ref (read by the canvas each frame) and choreographs the DOM window/dialog.
export function useHeroScroll({ sectionRef, windowRef, dialogRef, progressRef }: HeroScrollRefs) {
  useGSAP(
    () => {
      const section = sectionRef.current;
      const win = windowRef.current;
      const dialog = dialogRef.current;
      if (!section || !win || !dialog) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        section.classList.add("hero--motion");

        const proxy = { p: 0 };
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
          },
        });
        // Full-length linear tween: timeline positions equal scroll fractions,
        // and its onUpdate publishes smoothed progress to the canvas.
        tl.to(
          proxy,
          {
            p: 1,
            duration: 1,
            ease: "none",
            onUpdate: () => {
              progressRef.current = proxy.p;
            },
          },
          0
        );
        tl.fromTo(
          win,
          { scale: 1, autoAlpha: 1, x: 0, y: 0 },
          {
            scale: 0.15,
            autoAlpha: 0,
            x: () => -window.innerWidth * 0.42,
            y: () => window.innerHeight * 0.42,
            ease: "power2.in",
            duration: 0.3,
          },
          0.05
        );
        tl.fromTo(
          dialog,
          { xPercent: -50, yPercent: -50, autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.08 },
          0.9
        );

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          section.classList.remove("hero--motion");
          progressRef.current = 0;
        };
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );
}
```

`autoAlpha` (not `opacity`) drives `visibility: hidden` at 0, so the faded-out window and the not-yet-shown dialog drop out of the tab order instead of remaining invisible focus stops.

- [ ] **Step 6: Verify the canvas in isolation with a throwaway page**

Create `src/app/(marketing)/canvas-smoke/page.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { HeroCanvasLoader } from "@/components/landing/hero/hero-canvas-loader";

export default function CanvasSmoke() {
  const progressRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <div className="p-4">
      <input
        type="range"
        min={0}
        max={1000}
        defaultValue={0}
        aria-label="progress"
        onChange={(e) => {
          progressRef.current = Number(e.target.value) / 1000;
        }}
      />
      <div ref={stageRef} className="relative mt-2 h-[80vh] w-full">
        <HeroCanvasLoader progressRef={progressRef} stageRef={stageRef} poster={<div className="absolute inset-0 bg-[var(--r-desktop)]" />} />
      </div>
    </div>
  );
}
```

Run `npm run dev`, open `http://localhost:3000/canvas-smoke`. Expected: within ~1 s a pixelated board with 32 flat-shaded pieces appears; dragging the slider plays Scholar's mate (e-pawn, e-pawn, queen to h5, knight, bishop, knight, queen takes f7, pawn tumbles off); camera swoops from above to a low angle; visible dither pattern in shaded areas; the scene gently sways. Check DevTools console: no errors, no "Multiple instances of Three.js" warning. Screenshot at slider ~85% to the scratchpad for the reviewer. Then `rm -r "src/app/(marketing)/canvas-smoke"`.

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck && npx eslint src/components/landing`
Expected: clean.

```bash
git add src/components/landing
git commit -m "add pixelated hero canvas"
```

---

### Task 5: Bonzi showcase, analyzer walkthrough, footer

**Files:**
- Modify: `src/lib/bonzi/quips.ts:8` (export `QUIP_MAP`)
- Modify: `src/components/bonzi/bonzi-avatar.tsx:27-40` (lint-only: refs written during render)
- Modify: `src/components/bonzi/speech-bubble.tsx:11-19` (lint-only: setState in effect)
- Create: `src/components/landing/screenshots.json`
- Create: `src/components/landing/bonzi-showcase.tsx`
- Create: `src/components/landing/window-stack.tsx`
- Create: `src/components/landing/analyzer-walkthrough.tsx`
- Create: `src/components/landing/landing-footer.tsx`

**Interfaces:**
- Consumes (Task 2): `RetroWindow`, `RetroButton`; `BonziAvatar` (existing), `getBonziReaction` (existing).
- Produces (Task 7): `BonziShowcase()`, `AnalyzerWalkthrough()`, `LandingFooter()`; `QUIP_MAP` export; manifest shape `{ hero: boolean; import: boolean; review: boolean; practice: boolean }`.

- [ ] **Step 1: Export the quip table**

In `src/lib/bonzi/quips.ts` line 8 change `const QUIP_MAP` to `export const QUIP_MAP`.

- [ ] **Step 1b: Fix the two pre-existing react-hooks lint errors in the Bonzi components (behavior unchanged)**

In `src/components/bonzi/bonzi-avatar.tsx` replace lines 27-40 (from `const [imgError, setImgError]` through the closing `}` of the `if (gif !== prevGifRef.current)` block) with React's adjust-state-during-render pattern, which the `react-hooks/refs` rule accepts:

```tsx
  const [imgError, setImgError] = useState(false);
  // Remount the <img> on every gif change so the animation restarts from frame 0.
  const [seq, setSeq] = useState(0);
  const [prevGif, setPrevGif] = useState(gif);
  if (gif !== prevGif) {
    setPrevGif(gif);
    setSeq((s) => s + 1);
    setImgError(false);
  }
```

and change the `key` on the `<img>` from `` key={`${gif}-${seqRef.current}`} `` to `` key={`${gif}-${seq}`} ``. Remove the now-unused `useRef` import.

In `src/components/bonzi/speech-bubble.tsx` replace lines 11-19 (the `useState(false)` and the `useEffect`) with:

```tsx
  const [show, setShow] = useState(visible);
  if (visible && !show) setShow(true);

  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setShow(false), 400);
    return () => clearTimeout(timer);
  }, [visible]);
```

Run: `npx eslint src/components/bonzi`
Expected: no errors (warnings are fine).

- [ ] **Step 2: Create the manifest `src/components/landing/screenshots.json`**

```json
{ "hero": false, "import": false, "review": false, "practice": false }
```

- [ ] **Step 3: Create `src/components/landing/bonzi-showcase.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { RetroWindow } from "@/components/retro";
import { getBonziReaction } from "@/lib/bonzi/bonzi-engine";
import { QUIP_MAP } from "@/lib/bonzi/quips";
import type { BonziEvent, BonziGifState } from "@/lib/bonzi/types";
import { usePrefersReducedMotion } from "@/lib/motion";

const SCRIPT: BonziEvent[] = ["game_start", "bonzi_capture", "bonzi_check", "bonzi_checkmate"];
const STEP_MS = 2800;
const LOOP_PAUSE_MS = 4000;
const MAX_LOG = 8;

interface LogLine {
  key: number;
  event: BonziEvent;
  gif: BonziGifState;
  quip: string;
}

// Deterministic first line so server and client render the same markup.
const FIRST_LINE: LogLine = { key: 0, event: "game_start", gif: "wave", quip: QUIP_MAP.game_start.quips[0] };
const STATIC_LINES: LogLine[] = SCRIPT.map((event, i) => ({
  key: i,
  event,
  gif: QUIP_MAP[event].gif,
  quip: QUIP_MAP[event].quips[0],
}));

const LABELS: Partial<Record<BonziEvent, string>> = {
  game_start: "game start",
  bonzi_capture: "capture",
  bonzi_check: "check",
  bonzi_checkmate: "checkmate",
};

export function BonziShowcase() {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const [log, setLog] = useState<LogLine[]>([FIRST_LINE]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.5), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;
    let step = 1;
    let timer = 0;
    const next = () => {
      const event = SCRIPT[step % SCRIPT.length];
      const reaction = getBonziReaction(event);
      setLog((lines) => [...lines.slice(-(MAX_LOG - 1)), { key: Date.now(), event, gif: reaction.gif, quip: reaction.quip }]);
      step += 1;
      timer = window.setTimeout(next, event === "bonzi_checkmate" ? STEP_MS + LOOP_PAUSE_MS : STEP_MS);
    };
    timer = window.setTimeout(next, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [reduced, inView]);

  const lines = reduced ? STATIC_LINES : log;
  const current = lines[lines.length - 1];

  return (
    <RetroWindow ref={ref} title="BonziBUDDY.exe" className="mx-auto w-[min(92vw,860px)]" aria-labelledby="showcase-heading">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center justify-center gap-3">
          {reduced ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/bonzi/idle-still.png" alt="Bonzi Buddy" className="h-24 w-24" />
          ) : (
            <BonziAvatar gif={current.gif} quip={current.quip} size="lg" />
          )}
        </div>
        <div>
          <h2 id="showcase-heading" className="text-[22px] font-bold leading-tight">
            Stockfish moves, playground mouth.
          </h2>
          <p className="r-body mt-2">
            Every capture, check, and checkmate gets a comment. The lines are hand-written and he never repeats one within three turns.
          </p>
          <ol className="r-paper r-bevel-in r-term mt-4 h-[180px] overflow-hidden p-3" aria-label="Game log">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-3">
                <span className="text-[var(--r-disabled)]">[{LABELS[line.event] ?? line.event}]</span>
                <span>Bonzi: {line.quip}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </RetroWindow>
  );
}
```

- [ ] **Step 4: Create `src/components/landing/window-stack.tsx`**

A static, non-overlapping diagonal cascade — the deliberate alternative to three cards in a row. No client JS, no z-order games: every window's copy is fully readable at rest.

```tsx
import type { CSSProperties, ReactNode } from "react";
import { RetroWindow } from "@/components/retro";

export interface StackItem {
  key: string;
  title: string;
  content: ReactNode;
}

// Win98-style cascade: each window steps 48px right on md+; plain vertical stack below md.
export function WindowStack({ items }: { items: StackItem[] }) {
  return (
    <div className="grid gap-6 md:pr-[96px]">
      {items.map((item, i) => {
        const style = { "--depth": i } as CSSProperties;
        return (
          <RetroWindow
            key={item.key}
            title={item.title}
            className="w-full md:w-[560px] md:translate-x-[calc(48px*var(--depth))]"
            style={style}
          >
            {item.content}
          </RetroWindow>
        );
      })}
    </div>
  );
}
```

Server component (no "use client"). The `--depth` custom property drives the offset only through the md+ arbitrary `translate` utility, so mobile stays stacked and untransformed; the container's right padding leaves room for the two 48px steps.

- [ ] **Step 5: Create `src/components/landing/analyzer-walkthrough.tsx`**

```tsx
import Image from "next/image";
import shots from "./screenshots.json";
import { WindowStack, type StackItem } from "./window-stack";

type ShotKey = "import" | "review" | "practice";

const ITEMS: { key: ShotKey; title: string; copy: string; alt: string }[] = [
  {
    key: "import",
    title: "Import",
    copy: "Paste a Chess.com game link, or pull your last 50 games from Chess.com or Lichess and pick the ones worth a look.",
    alt: "Import screen listing recent games from Chess.com with checkboxes to select which to import",
  },
  {
    key: "review",
    title: "Review",
    copy: "Stockfish 18 grades every move from best to blunder, scores accuracy for both sides, and estimates the rating you played at.",
    alt: "Review screen with a chessboard, a color-coded move list, and accuracy summary",
  },
  {
    key: "practice",
    title: "Practice",
    copy: "Every mistake becomes a puzzle. Find the move you should have played.",
    alt: "Practice screen asking for the best move in a position where a mistake was made",
  },
];

function Shot({ item }: { item: (typeof ITEMS)[number] }) {
  if (shots[item.key]) {
    return (
      <Image
        src={`/screenshots/${item.key}.png`}
        alt={item.alt}
        width={1200}
        height={750}
        sizes="(min-width: 768px) 560px, 92vw"
        className="r-bevel-in h-auto w-full"
      />
    );
  }
  return (
    <div className="r-bevel-in r-body flex aspect-[16/10] items-center justify-center bg-[var(--r-face)] p-6 text-center text-[var(--r-disabled)]">
      Screenshot pending. This screen is being redesigned in part 2.
    </div>
  );
}

export function AnalyzerWalkthrough() {
  const items: StackItem[] = ITEMS.map((item) => ({
    key: item.key,
    title: item.title,
    content: (
      <>
        <Shot item={item} />
        <p className="r-body mt-3">{item.copy}</p>
      </>
    ),
  }));

  return (
    <section aria-labelledby="walkthrough-heading" className="mx-auto w-[min(92vw,960px)]">
      <h2 id="walkthrough-heading" className="mb-6 text-[33px] font-bold leading-tight text-[var(--r-highlight)]">
        Then find out what went wrong.
      </h2>
      <WindowStack items={items} />
    </section>
  );
}
```

- [ ] **Step 6: Create `src/components/landing/landing-footer.tsx`**

```tsx
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="r-face r-bevel-out mx-auto mt-16 w-[min(92vw,960px)] p-4 text-[11px]">
      <p className="r-body">
        Chess Bonzi Buddy is a hobby project. Not affiliated with Bonzi Software, Chess.com, or Lichess.
      </p>
      <nav aria-label="Footer" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="https://github.com/paul1stone/chessbonzibuddy" rel="noreferrer">GitHub</a>
      </nav>
      <div className="r-sep my-3" />
      <p>
        Credits: Stockfish 18, chess.js, react-chessboard. MS Sans Serif pixel font by lou, CC BY-SA 3.0.
      </p>
    </footer>
  );
}
```

- [ ] **Step 7: Verify with a throwaway page, then delete it**

Create `src/app/(marketing)/sections-smoke/page.tsx`:

```tsx
import { BonziShowcase } from "@/components/landing/bonzi-showcase";
import { AnalyzerWalkthrough } from "@/components/landing/analyzer-walkthrough";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function SectionsSmoke() {
  return (
    <main className="grid gap-16 py-16">
      <BonziShowcase />
      <AnalyzerWalkthrough />
      <LandingFooter />
    </main>
  );
}
```

Open `http://localhost:3000/sections-smoke`. Expected: showcase window with Bonzi waving and the first quip; after ~3 s the log appends a capture quip and the gif changes to laugh, then check, then a backflip on checkmate, then pauses and loops; three cascaded windows with "Screenshot pending" frames, each stepped 48px right of the previous on desktop, all copy fully readable; footer links work. Emulate reduced motion in DevTools (Rendering > Emulate CSS media feature prefers-reduced-motion): the showcase shows the still image and four static lines. At 375px width the three windows stack vertically. Then `rm -r "src/app/(marketing)/sections-smoke"`.

- [ ] **Step 8: Verify and commit**

Run: `npm run typecheck && npx eslint src/components/landing src/lib/bonzi src/components/bonzi`
Expected: clean.

```bash
git add src/components/landing src/lib/bonzi/quips.ts src/components/bonzi
git commit -m "add landing sections"
```

---

### Task 6: Privacy and terms pages

**Files:**
- Create: `src/app/(marketing)/privacy/page.tsx`
- Create: `src/app/(marketing)/terms/page.tsx`
- Create: `src/components/landing/legal-page.tsx`

**Interfaces:**
- Consumes (Task 2): `RetroWindow`, `RetroButton`.
- Produces: routes `/privacy` and `/terms`.

- [ ] **Step 1: Create `src/components/landing/legal-page.tsx`**

```tsx
import type { ReactNode } from "react";
import { RetroButton, RetroWindow } from "@/components/retro";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-[min(92vw,760px)] py-10">
      <RetroWindow title={`${title} - Chess Bonzi Buddy`} statusBar={`Last updated ${updated}`} aria-labelledby="legal-heading">
        <article className="r-body r-paper r-bevel-in p-5 [&_h1]:mb-4 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[16px] [&_h2]:font-bold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
          <h1 id="legal-heading">{title}</h1>
          {children}
        </article>
        <div className="mt-4 flex justify-end">
          <RetroButton href="/">Back to desktop</RetroButton>
        </div>
      </RetroWindow>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/(marketing)/privacy/page.tsx`**

```tsx
import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="28 August 2026">
      <p>
        Chess Bonzi Buddy is a hobby project. This page describes what the site stores and why. There are no accounts and no passwords.
      </p>

      <h2>What stays in your browser</h2>
      <p>
        When you link a Chess.com or Lichess account, the site keeps the username you typed and your cached ratings in your browser&apos;s local storage under the key <code>chess-analyzer-profile</code>. Nothing else identifies you. You can remove it at any time with the clear profile control in the app, or by clearing site data in your browser.
      </p>

      <h2>What is stored on the server</h2>
      <p>
        When you import a game, the site stores that game in a Postgres database hosted by Neon in the United States: the source URL, the PGN, both player names, the result, the date played, and the Stockfish analysis once it runs. Games are listed for whoever enters the same username; they are not private. You can delete any game from the sidebar. Deletion is immediate and permanent.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li>Chess.com and Lichess public APIs are called with the username you enter to fetch ratings and recent games.</li>
        <li>Vercel hosts the site and keeps standard request logs, which can include your IP address, for a limited time.</li>
        <li>Stockfish runs on the server and, in play mode, inside your browser. No game data is sent anywhere else.</li>
      </ul>
      <p>The site sets no cookies, runs no analytics scripts, and shows no ads.</p>

      <h2>Requests</h2>
      <p>
        To ask for data to be removed or to report a problem, open an issue at{" "}
        <a href="https://github.com/paul1stone/chessbonzibuddy/issues" rel="noreferrer">
          github.com/paul1stone/chessbonzibuddy/issues
        </a>
        .
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the bottom of this window changes with it.</p>
    </LegalPage>
  );
}
```

- [ ] **Step 3: Create `src/app/(marketing)/terms/page.tsx`**

```tsx
import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="28 August 2026">
      <p>By using Chess Bonzi Buddy you agree to the following. They are short because the site is small.</p>

      <h2>What the site is</h2>
      <p>
        A free hobby project for playing chess against an engine with a talking mascot, and for analyzing your own games. It is provided as is, with no guarantee of availability or accuracy.
      </p>

      <h2>Analysis is approximate</h2>
      <p>
        Move classifications, accuracy scores, and estimated ratings come from Stockfish at limited depth plus formulas that are still being refined. They will not always match Chess.com or Lichess. Use them as a guide, not a verdict.
      </p>

      <h2>Your games</h2>
      <ul>
        <li>Only import games you have the right to share. Imported games are visible to anyone who enters the same username.</li>
        <li>Do not use the site to abuse the Chess.com or Lichess APIs, or to get around their terms.</li>
        <li>Do not try to break the site or access data that is not yours.</li>
      </ul>

      <h2>Bonzi</h2>
      <p>
        Bonzi Buddy&apos;s commentary is scripted humor. It is not advice, and he is not affiliated with Bonzi Software, Chess.com, or Lichess.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, the site&apos;s author is not liable for any loss arising from use of the site, including lost games, lost data, or a bruised ego.
      </p>

      <h2>Changes</h2>
      <p>These terms may change. The date at the bottom of this window shows the current version.</p>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Verify**

Open `http://localhost:3000/privacy` and `/terms`: a single window with a white sunken document area, readable Verdana body copy, headings in bold, "Back to desktop" button, taskbar below. Tab through: the GitHub link shows a focus outline; the button shows the dotted rect.
Run: `npm run typecheck && npx eslint "src/app/(marketing)" src/components/landing/legal-page.tsx`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/privacy" "src/app/(marketing)/terms" src/components/landing/legal-page.tsx
git commit -m "add privacy and terms pages"
```

Note for the final report: both pages must be listed for the user to read before any deploy — they are legal copy, and sign-off is theirs, not ours.

---

### Task 7: Hero section and landing page composition

**Files:**
- Create: `src/components/landing/hero/hero.css`
- Create: `src/components/landing/hero/hero-poster.tsx`
- Create: `src/components/landing/hero/hero-section.tsx`
- Create: `src/app/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `useHeroScroll`, `HeroCanvasLoader` (Task 4); `RetroWindow`, `RetroDialog`, `RetroButton` (Task 2); `BonziShowcase`, `AnalyzerWalkthrough`, `LandingFooter`, `QUIP_MAP`, manifest (Task 5); `BonziAvatar` (existing).
- Produces: route `/`.

- [ ] **Step 1: Create `src/components/landing/hero/hero.css`**

```css
.hero {
  min-height: 100svh;
}
.hero--motion {
  height: 300vh;
}
.hero-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  position: relative;
  min-height: 100svh;
  padding: 24px 0;
}
.hero--motion .hero-stage {
  position: sticky;
  top: 0;
  height: 100svh;
  padding: 0;
  overflow: hidden;
}
.hero-window {
  position: relative;
  width: min(92vw, 560px);
  transform-origin: bottom left;
}
.hero-dialog {
  position: relative;
}
.hero--motion .hero-window {
  will-change: transform, opacity;
}
.hero--motion .hero-dialog {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
}
/* Motion users must not see (or tab into) the checkmate dialog before GSAP takes over. */
@media (prefers-reduced-motion: no-preference) {
  .hero-dialog {
    visibility: hidden;
    opacity: 0;
  }
}
.hero-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
```

- [ ] **Step 2: Create `src/components/landing/hero/hero-poster.tsx`**

```tsx
import shots from "../screenshots.json";

// Static fallback behind the hero: the LCP-safe image, also what reduced-motion users see.
export function HeroPoster() {
  if (!shots.hero) {
    return <div className="hero-poster bg-[var(--r-desktop)]" aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/screenshots/hero-poster.webp"
      alt="Pixelated 3D chessboard after Scholar's mate, the white queen on f7"
      className="hero-poster"
      width={1440}
      height={900}
      loading="eager"
      fetchPriority="low"
      decoding="async"
    />
  );
}
```

- [ ] **Step 3: Create `src/components/landing/hero/hero-section.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { BonziAvatar } from "@/components/bonzi/bonzi-avatar";
import { RetroButton, RetroDialog, RetroWindow } from "@/components/retro";
import { QUIP_MAP } from "@/lib/bonzi/quips";
import { HeroCanvasLoader } from "./hero-canvas-loader";
import { HeroPoster } from "./hero-poster";
import { useHeroScroll } from "./use-hero-scroll";
import "./hero.css";

// "Bonzi Buddy wants to play chess! Click OK to lose." Fixed index so SSR and client match.
const HERO_QUIP = QUIP_MAP.game_start.quips[4];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);

  useHeroScroll({ sectionRef, windowRef, dialogRef, progressRef });

  return (
    <section ref={sectionRef} className="hero" aria-labelledby="hero-heading">
      <div ref={stageRef} className="hero-stage">
        <div className="absolute inset-0" aria-hidden="true">
          <HeroCanvasLoader progressRef={progressRef} stageRef={stageRef} poster={<HeroPoster />} />
        </div>

        <RetroWindow ref={windowRef} title="Chess Bonzi Buddy" className="hero-window" statusBar="Scroll to watch a game">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <h1 id="hero-heading" className="text-[33px] font-bold leading-[1.05] sm:text-[44px]">
                Play chess against a purple gorilla from 1999.
              </h1>
              <p className="r-body mt-4">
                Bonzi Buddy runs on Stockfish and talks trash the whole game. Lose, then import the game and find out exactly where it went wrong.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <RetroButton href="/app?view=play-bonzi" variant="default" size="lg">
                  Play Bonzi Buddy
                </RetroButton>
                <RetroButton href="/app" size="lg">
                  Analyze my games
                </RetroButton>
              </div>
            </div>
            <div className="justify-self-end">
              <BonziAvatar gif="wave" quip={HERO_QUIP} size="lg" />
            </div>
          </div>
        </RetroWindow>

        <RetroDialog
          ref={dialogRef}
          title="Chess Bonzi Buddy"
          className="hero-dialog"
          actions={
            <>
              <RetroButton href="/app?view=play-bonzi" variant="default">
                Rematch
              </RetroButton>
              <RetroButton href="/app">Show me why</RetroButton>
            </>
          }
        >
          Checkmate. Bonzi wins in four moves.
        </RetroDialog>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `src/app/(marketing)/page.tsx`**

```tsx
import { HeroSection } from "@/components/landing/hero/hero-section";
import { BonziShowcase } from "@/components/landing/bonzi-showcase";
import { AnalyzerWalkthrough } from "@/components/landing/analyzer-walkthrough";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <div className="grid gap-20 py-20">
        <BonziShowcase />
        <AnalyzerWalkthrough />
      </div>
      <LandingFooter />
    </main>
  );
}
```

- [ ] **Step 5: Verify the full page**

`npm run dev`, open `http://localhost:3000/`:
1. First paint: teal desktop, hero window with headline, copy, two buttons, Bonzi waving with the quip, status bar "Scroll to watch a game", taskbar with Start and clock. No canvas yet; then within ~1 s the pixelated board appears behind the window.
2. Scroll: the window shrinks toward the Start button and fades; the pieces play Scholar's mate as you scroll; the camera drops to a low angle; near the end the checkmate dialog appears centered with Rematch / Show me why; continuing scrolls into the showcase, the walkthrough cascade, footer.
3. Scroll back up: everything reverses smoothly, no jumps; scrolling is native (no wheel hijack) with the scrub easing the animation.
4. Both CTAs navigate: Play → `/app?view=play-bonzi` shows the play setup; Analyze → `/app`.
5. DevTools: no console errors; Network shows the three/fiber chunk requested only after the page is interactive.
6. Reduced motion emulation, reload: no canvas (`[data-testid=hero-canvas]` absent), teal panel behind (poster arrives in Task 8), window at full size, dialog directly below the window, native scrolling.
7. 375px: window fills 92vw, headline wraps at 33px, buttons wrap, no horizontal scrollbar, taskbar visible.
Screenshot desktop at top and at ~85% scroll to the scratchpad for the reviewer.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npx eslint src/components/landing "src/app/(marketing)"`
Expected: clean.

```bash
git add src/components/landing "src/app/(marketing)"
git commit -m "add retro landing page"
```

---

### Task 8: Screenshot and poster capture

**Files:**
- Create: `scripts/capture-screenshots.mjs`
- Create: `public/screenshots/hero-poster.webp` (generated)
- Modify: `src/components/landing/screenshots.json` (generated)
- Create (only if `DATABASE_URL` is set): `public/screenshots/import.png`, `review.png`, `practice.png`

**Interfaces:**
- Consumes: routes `/` and `/app?view=play-bonzi` (Tasks 1, 7), manifest shape (Task 5).
- Produces: images referenced by `HeroPoster` and `AnalyzerWalkthrough`; the manifest flags.

- [ ] **Step 1: Create `scripts/capture-screenshots.mjs`**

```js
// Captures real product screenshots and the hero poster. Requires `npm run dev` on BASE_URL.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("public/screenshots");
const MANIFEST = path.resolve("src/components/landing/screenshots.json");
const manifest = { hero: false, import: false, review: false, practice: false };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function captureHeroPoster() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("[data-testid=hero-canvas] canvas", { timeout: 15000 });
  await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    window.scrollTo(0, 0.85 * (hero.offsetHeight - window.innerHeight));
  });
  await page.waitForTimeout(1500);
  const canvas = page.locator("[data-testid=hero-canvas] canvas");
  const png = await canvas.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(path.join(OUT, "hero-poster.webp"));
  manifest.hero = true;
  await page.close();
}

async function captureAnalyzer() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set; skipping import/review/practice screenshots");
    return;
  }
  // Import a public game through the real API, analyze it, then screenshot each view.
  const gameUrl = process.env.SCREENSHOT_GAME_URL;
  if (!gameUrl) {
    console.log("SCREENSHOT_GAME_URL not set; skipping import/review/practice screenshots");
    return;
  }
  const res = await fetch(`${BASE_URL}/api/games/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: gameUrl }),
  });
  if (!res.ok) throw new Error(`import failed: ${res.status} ${await res.text()}`);
  const game = await res.json();
  const analyze = await fetch(`${BASE_URL}/api/games/${game.id}/analyze`, { method: "POST" });
  await analyze.text(); // drains the SSE stream until analysis completes

  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
  await page.goto(`${BASE_URL}/app`);
  await page.evaluate((username) => {
    localStorage.setItem(
      "chess-analyzer-profile",
      JSON.stringify({ state: { chessComUsername: username, lichessUsername: "", chessComRatings: null, lichessRatings: null }, version: 0 })
    );
  }, game.whitePlayer);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "import.png") });
  manifest.import = true;

  await page.getByText(game.whitePlayer, { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "review.png") });
  manifest.review = true;

  await page.getByRole("button", { name: /practice/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "practice.png") });
  manifest.practice = true;
  await page.close();
}

try {
  await captureHeroPoster();
  await captureAnalyzer();
} finally {
  await browser.close();
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest", manifest);
}
```

Before running, read `src/app/api/games/import/route.ts` to confirm the request body field name and the response shape (`id`, `whitePlayer`), and `src/components/layout/sidebar.tsx` for how a game row is labeled; adjust the selectors above to match what you find. (Verified in review: import takes `{ url }` and returns the full game record including `id` and `whitePlayer`; sidebar rows read "{whitePlayer} vs {blackPlayer}".) If `DATABASE_URL` or `SCREENSHOT_GAME_URL` (a public Chess.com game URL, e.g. one from your own game history) is not set locally, the analyzer branch is skipped by design.

- [ ] **Step 2: Run it**

With `npm run dev` running in another terminal:

```bash
npm run screenshots && ls -la public/screenshots && cat src/components/landing/screenshots.json
```

Expected: `hero-poster.webp` (under 150 KB; pixel blocks compress well), manifest `hero: true`, the other three `true` only with a database and a game URL. Open `hero-poster.webp` and confirm it shows the board at the low camera angle with the queen on f7 and no window chrome in the shot.

- [ ] **Step 3: Confirm the page uses them**

Reload `http://localhost:3000/` with reduced motion emulated: the poster is now behind the window instead of the teal panel. Check `/` normal: no visible change (canvas covers the poster).

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-screenshots.mjs public/screenshots src/components/landing/screenshots.json
git commit -m "capture landing screenshots"
```

---

### Task 9: End-to-end tests and build verification

**Files:**
- Create: `e2e/landing.spec.ts`
- Create: `e2e/legal.spec.ts`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write `e2e/landing.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the hero and both calls to action", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Play chess against a purple gorilla from 1999.");
    await expect(page.getByRole("link", { name: "Play Bonzi Buddy" }).first()).toHaveAttribute("href", "/app?view=play-bonzi");
    await expect(page.getByRole("link", { name: "Analyze my games" }).first()).toHaveAttribute("href", "/app");
    await expect(page.getByAltText("Bonzi Buddy").first()).toBeVisible();
    await expect(page.locator("[data-testid=hero-canvas] canvas")).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test("deep-links into the play view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Play Bonzi Buddy" }).first().click();
    await expect(page).toHaveURL(/\/app\?view=play-bonzi/);
    await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  });

  test("start menu opens with a click and closes with Escape", async ({ page }) => {
    await page.goto("/");
    const start = page.getByRole("button", { name: "Start" });
    await start.click();
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(start).toBeFocused();
  });

  test("respects reduced motion: no canvas, dialog in flow", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-testid=hero-canvas]")).toHaveCount(0);
    await expect(page.locator(".hero--motion")).toHaveCount(0);
    await expect(page.getByText("Checkmate. Bonzi wins in four moves.")).toBeVisible();
    await context.close();
  });

  test("has no horizontal overflow at 375px", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await context.newPage();
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await context.close();
  });

  test("shows the checkmate dialog after scrolling through the hero", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid=hero-canvas] canvas").waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const hero = document.querySelector(".hero") as HTMLElement;
      window.scrollTo(0, hero.offsetHeight - window.innerHeight);
    });
    await page.waitForTimeout(1500);
    await expect(page.getByRole("link", { name: "Rematch" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Write `e2e/legal.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

for (const [path, heading] of [
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms of use"],
] as const) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("link", { name: "Back to desktop" })).toHaveAttribute("href", "/");
  });
}
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: 8 passed. If the reduced-motion test finds the dialog hidden, check that `hero.css`'s `.hero-dialog` has no opacity rule outside `.hero--motion` and that `useHeroScroll` only calls `gsap.set` inside the `no-preference` match.

- [ ] **Step 4: Full verification**

```bash
npm run typecheck
npx eslint . --quiet -f json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const bad=d.filter(f=>f.errorCount>0&&!/board(-panel)?\.tsx$/.test(f.filePath));if(bad.length){console.error("new lint errors in:",bad.map(f=>f.filePath));process.exit(1)}console.log("lint gate ok (only pre-existing board.tsx / board-panel.tsx errors)")'
npm run test
npm run build 2>&1 | tail -30
```

Expected: typecheck clean; lint errors only the two pre-existing files; 13 unit tests pass (6 timeline + 7 geometry); build succeeds and the route table shows `○` (static) for `/`, `/privacy`, `/terms` and `ƒ` or `○` for `/app` (either is fine; it is a client page).

Then start `npm run start` and check the JS budget:

```bash
npm run build >/dev/null && npm run start &
sleep 5
curl -s http://localhost:3000/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u | while read f; do printf "%8d %s\n" "$(curl -s "http://localhost:3000$f" | gzip -9 | wc -c)" "$f"; done | sort -n
```

(`next start` may serve identity encoding locally, so the pipeline gzips client-side to measure the budget as gzip bytes; kill any still-running dev server first — both bind :3000.) Expected: the initial chunks referenced by `/` total under 130 KB; the three/fiber chunk is not in the initial HTML (it loads via the dynamic import). Record the numbers in the final report.

- [ ] **Step 5: Lighthouse (record, do not gate)**

```bash
CHROME_PATH=$(ls -d ~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium | tail -1) npx lighthouse http://localhost:3000/ --preset=perf --form-factor=mobile --screenEmulation.mobile --quiet --chrome-flags="--headless=new" --output=json --output-path=/private/tmp/claude-501/-Users-fv-123-chessbonzibuddy/223a078e-2ce5-43ae-9163-0cb984f48029/scratchpad/lh.json && node -e 'const r=require("/private/tmp/claude-501/-Users-fv-123-chessbonzibuddy/223a078e-2ce5-43ae-9163-0cb984f48029/scratchpad/lh.json");for(const k of ["performance","accessibility"])console.log(k,r.categories[k]?.score)'
```

 Report performance and accessibility scores (targets 85 / 95). If either is below target, list the top three audits from `r.audits` with the lowest scores in the report rather than tuning blindly.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "add landing e2e tests"
```

---

## Parallelization map

| Wave | Tasks | Why this wave |
|---|---|---|
| 1 | Task 0 | Everything needs the deps and scripts; it owns `package.json`. |
| 2 | Task 1, Task 2, Task 3 | Disjoint files: app route move (`src/app/layout.tsx`, `(app)/`, `ui/sonner.tsx`), design system (`retro/`, `styles/`, `fonts/`, `(marketing)/layout.tsx`, `globals.css`), pure hero logic (`landing/hero/*.ts` + `lib/motion.ts`). |
| 3 | Task 4, Task 5, Task 6 | Task 4 needs Task 3's exports; Tasks 5 and 6 need Task 2's components. Files are disjoint (`hero/*.tsx`; `landing/*.tsx` + `quips.ts` + `bonzi/*`; `(marketing)/privacy|terms` + `legal-page.tsx`). |
| 4 | Task 7 | Composes Tasks 4 and 5. |
| 5 | Task 8 | Needs the live `/` and `/app` routes. |
| 6 | Task 9 | Needs the poster/manifest from Task 8 for the reduced-motion visual check and runs the full build. |
