# Frontend overhaul, part 1: retro landing page + design system

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
- [ ] User check-in on final plan

## Phase 3: Build (Opus implementers, Opus step reviews)
- [x] Wave 1: Task 0 tooling — c36fd33, review PASS (pins fixed in 5c8733f)
- [x] Wave 2: Task 1 aa60aff (PASS; color-scheme fix 40d4e3d), Task 2 bb135ab (PASS; nbsp fix efee671, focus-contrast fix 469510d), Task 3 ccaa8fa (PASS, 13/13 tests)
- [ ] Wave 3: Task 4 dd0ec9c (review in flight), Task 5 implementing, Task 6 8fa0287 (review in flight)
- [ ] Wave 4: Task 7 hero section + page
- [ ] Wave 5: Task 8 screenshots + poster
- [ ] Wave 6: Task 9 e2e + build verification

## Phase 4: Final review (Fable)
- [ ] Full-diff review against plan, fixes, faithful report

## Open items for the user
- Analyzer screenshots need DATABASE_URL + SCREENSHOT_GAME_URL locally; otherwise the walkthrough ships honest "screenshot pending" frames until part 2
- Privacy/terms copy needs a read before deploy; ALSO confirm Neon project region is US (copy claims it), and note games API is unauthenticated (copy says games are not private)
- BonziBuddy trademark status unverified; footer disclaims affiliation

## Review
(filled in at the end)
