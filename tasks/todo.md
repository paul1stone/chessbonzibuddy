# Frontend overhaul

## PART 2: Win98 desktop app + live demos (current)
Spec: docs/superpowers/specs/2026-08-28-win98-desktop-app-design.md
Plan: docs/superpowers/plans/2026-08-31-win98-desktop-app.md
- [x] Scope: full Win98 desktop app (user), scripted import demo (user)
- [x] App internals explored; spec + plan written and committed (05b8fbd)
- [ ] Plan review (Fable x3) — simplify DONE: accept Task5 split 5a/5b, 3 file-spec bullets, hoist color map, cut opacity hack, shared useInView, "Start game" case, reword Task2 note + statusbar class; Task 10 stays wave 5 (Task 9 touches window-stack for statusBar — reviewer missed); flag lucide-in-windows at check-in. regression DONE: 3 blocking accepted (import must open review; CSS-hide not unmount for minimize/mobile — worker/gameRef/clock survival; review+practice empty states) + 6 should-fix + 6 nits accepted; "Start game" rename safe (Playwright name match case-insensitive). Correctness pending
- [x] Triage + revise done (00660dd); upstream analyzer rework pulled and absorbed into plan/spec (client-side analyzeGame, forced classification, DI-based fixture script)
- [x] User check-in — approved 2026-08-31; lucide icons stay (no objection)
- [ ] Build waves:
  - [x] Task 0 be20fe8 review PASS; nbsp + RetroPanel min-w-0 fixes 9bb7aba; CLOSED. Task 1 6e751e5 PASS + hardening 1f2f167; CLOSED
  - [x] Task 3 d572357 (accepted deviation: render-time stop-playback; review in flight); lint baseline now 1 error (board.tsx) after ignore fixes 7655e58+5f977dc
  - [x] Task 3 review: FAIL→fixed (eval-bar bevel + board frame 6px) in 87fa3c5; CLOSED
  - [x] Task 8 8cb17e7 review PASS (fixture replay-verified); picker spec fixed + script polish; CLOSED. Note: analyze.ts init() outside try/finally can leak a child on init timeout (upstream, logged for final review)
  - [ ] In flight: Task 4 0bb4047 + Task 5b 01cb722 landed (reviews running); Task 2 c6d0702 landed (transform check PASS, review dispatched; board start-alias crash fixed by fixer); Task 6 7bc244a landed (review dispatched); Task 5a 97be797 landed (ReviewStatusBar separate export; review dispatched); Task 9 06982a6 landed (review + Task 10 dispatched); Task 7 implementing (deps 0/3/8 all closed, files disjoint from wave 3)
  - [ ] Reviews: Task 4 CLOSED (fixer f321e94: visible tick + aria-pressed, press-shift restored via ! utilities, APG tablist nav); Task 5b PASS (cursor-suffix fixed by fixer; swatch-hex defect REJECTED — piece palette is plan-sanctioned via eval-bar; contrast question logged for final review); Task 2 CLOSED (fixer 7d54d7d: all four minors, cycle → DAG); Task 6 PASS (defect pre-fixed by 8831e3d; em-dash log strings deferred to Task 11); Task 5a review running. WATCH: reviewer reproduced 'engine handshake never resolves' in worktree harnesses at BOTH 7bc244a and parent — conflicts with implementer's live harness (engine answered e5); Task 7's real-app verification must confirm Bonzi replies; if it fails there, suspect the upstream engine.ts rework, not wave 3; implementers 5a/6 self-audited cascade fixes e88d005/8831e3d routed to their reviewers
  - [ ] Then: Task 10 (after 9), Task 11, final review
- [ ] Final Fable review
- [x] Part 1 pushed to origin/main (9794a8d)

# Part 1 (done): retro landing page + design system

Spec: docs/superpowers/specs/2026-08-28-retro-landing-design.md
Plan: docs/superpowers/plans/2026-08-28-retro-landing.md
Pipeline: /build (Fable plan → Fable plan review → Opus build with Opus step reviews → Fable final review)

## Phase 1: Plan
- [x] Brainstorm: scope (keep all features, redesign UI), tone (full retro '90s desktop), page scope (hero + story), approach A (screensaver 3D)
- [x] Research: scroll-animation techniques, asset licensing, AI-generation verdict (no)
- [x] Spec written and committed
- [x] Plan written, self-reviewed, committed

## Phase 2: Plan review (Fable, 3 lenses)
- [x] Correctness + missed call sites — 3 blocking (Lenis wiring, set-state-in-effect lint, chromium revision) + copy/metadata/smoke/dialog fixes; all accepted
- [x] Regression risk — accepted: playwright install chromium (blocking), drop next-themes + Toaster theme=dark, remove marketing metadata title, ViewParamSync in (app) layout w/ useLayoutEffect, gzip budget, eslint coverage ignore. COOP/COEP + portals confirmed non-issues
- [x] Simpler alternatives + brief compliance — 12 findings; accepted: drop Lenis (remount bug + redundant), static stagger for WindowStack, move lib/motion.ts to wave 2, cut visibilitychange, token/comment nits, spec wording (rook rim, non-overlap cascade)
- [x] Triage findings, revise plan, re-review — delta review confirms all 12 fixes, READY TO BUILD; spec synced
- [x] User check-in — approved 2026-08-31; lucide icons stay (no objection) on final plan

## Phase 3: Build (Opus implementers, Opus step reviews)
- [x] Wave 1: Task 0 tooling — c36fd33, review PASS (pins fixed in 5c8733f)
- [x] Wave 2: Task 1 aa60aff (PASS; color-scheme fix 40d4e3d), Task 2 bb135ab (PASS; nbsp fix efee671, focus-contrast fix 469510d), Task 3 ccaa8fa (PASS, 13/13 tests)
- [x] Wave 3: Task 4 dd0ec9c PASS (dither disposal a0763c1), Task 5 2dcb435 PASS (fixes 5e9718a; note: bonzi_check gif now 'point' in app play view too), Task 6 8fa0287 PASS after privacy copy fixes (f05b5f9, c15a02d)
- [x] Wave 4: Task 7 1e0dafb PASS
- [x] Wave 5: Task 8 98fa26c PASS + ghost fix 3031f42 PASS (manifest resilience 502a1e1)
- [x] Wave 6: Task 9 7a40eda — 9/9 e2e (dev+prod), 13/13 unit, lint gate ok, routes static, Lighthouse perf 0.94 / a11y 0.96; JS budget missed 194KB → fixed by lazy gsap e6c972b → 150.8KB modern (target 130 declared floor-limited); e2e re-verified 9/9 after fix

## Phase 4: Final review (Fable)
- [x] Full-diff review: SHIP, 0 blocking. Should-fixes applied: gsap import .catch + dialog unhide (f6b45e1); budget reporting corrected to ~194 KB gzip (not ~151 — my subtraction was wrong). Nits deferred to part 2: drop next-themes+theme-provider, reduced-motion status-bar copy, mid-session motion-toggle canvas idle.

## Part 2 (separate /build, user-confirmed 2026-08-28)
- Refactor the app UI (/app screens: sidebar, import, review, practice, play) to the retro design system
- Finish out the homepage: walkthrough windows become LIVE interactive demos (Review: mini chessboard scrubbing an analyzed game; Practice: real find-the-best-move puzzle via client-side chess.js; Import: short auto-playing capture) instead of static screenshots
- Draggable windows by title bar: hand-rolled pointerdown + setPointerCapture + translate (~40 lines, no lib); normal flow until first drag, disabled on small screens/reduced motion; verify pattern in part-2 research
- Analyzer screenshots once DATABASE_URL + SCREENSHOT_GAME_URL available; rename "Chess Analyzer" branding in sidebar/dashboard chrome
- Interim (end of part 1, after e2e run finishes): slim the "Screenshot pending" frames so the section reads less empty

## Open items for the user
- Analyzer screenshots need DATABASE_URL + SCREENSHOT_GAME_URL locally; otherwise the walkthrough ships honest "screenshot pending" frames until part 2
- Privacy/terms copy needs a read before deploy; ALSO confirm Neon project region is US (copy claims it), and note games API is unauthenticated (copy says games are not private)
- BonziBuddy trademark status unverified; footer disclaims affiliation

## Review (2026-08-28, part 1 complete)
- 30 commits, all 10 tasks implemented, step-reviewed, and fixed; Fable final review verdict SHIP.
- Delivered: Win98 landing page at / (scroll-driven pixelated 3D Scholar's mate hero, Bonzi showcase with live quips, walkthrough cascade, footer), /privacy + /terms, retro design system (src/components/retro + retro.css + pixel fonts), app intact at /app with ?view=play-bonzi deep link.
- Gates: typecheck clean; lint = 2 pre-existing board errors only; 13/13 unit; 9/9 e2e (dev + prod); / /privacy /terms /app all static; Lighthouse perf 0.94 / a11y 0.96; zero console errors.
- Honest misses: initial JS ~194 KB gzip vs 130 KB budget (three + gsap are lazy; remainder framework floor). Analyzer screenshots pending (no DATABASE_URL): honest placeholder frames.
- NOT pushed/deployed. User must: read /privacy + /terms, confirm Neon region is US, then decide on deploy.
