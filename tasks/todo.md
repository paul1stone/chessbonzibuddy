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
- [ ] Correctness + missed call sites
- [ ] Regression risk
- [ ] Simpler alternatives + brief compliance
- [ ] Triage findings, revise plan, re-review if needed
- [ ] User check-in on final plan

## Phase 3: Build (Opus implementers, Opus step reviews)
- [ ] Wave 1: Task 0 tooling
- [ ] Wave 2: Task 1 route split, Task 2 design system, Task 3 timeline + geometry
- [ ] Wave 3: Task 4 hero canvas, Task 5 sections, Task 6 legal pages
- [ ] Wave 4: Task 7 hero section + page
- [ ] Wave 5: Task 8 screenshots + poster
- [ ] Wave 6: Task 9 e2e + build verification

## Phase 4: Final review (Fable)
- [ ] Full-diff review against plan, fixes, faithful report

## Open items for the user
- Analyzer screenshots need DATABASE_URL + SCREENSHOT_GAME_URL locally; otherwise the walkthrough ships honest "screenshot pending" frames until part 2
- Privacy/terms copy needs a read before deploy
- BonziBuddy trademark status unverified; footer disclaims affiliation

## Review
(filled in at the end)
