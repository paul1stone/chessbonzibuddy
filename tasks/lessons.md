# Lessons

## 2026-08-28 frontend overhaul part 1
- Compositing: never flip an invisible fallback (teal-on-teal poster) to real content without re-checking what composites through transparent layers above it (alpha WebGL canvas ghosted the new poster; user saw a double board). When a fallback becomes visible content, re-test every layer that sits over it.
- Shell discipline: `a && b; c && d` runs c even when b fails — I committed before lint passed. Chain the whole gate with && or check exit codes explicitly.
- Budget arithmetic: measure what ships, don't subtract by label. My "modern payload" subtraction of a nomodule chunk was based on a broken grep and understated the number by 40 KB. Sum the actual script tags and report that.
- Parallel implementers share one git index: `git mv` by one agent leaked into another's commit. Instruct every agent to commit with explicit pathspecs and check `git status` first (added mid-build; keep for part 2).
- Fixer-written code (my lazy-gsap rewrite) had no step review and was the file the final reviewer flagged (missing .catch). Anything the orchestrator writes post-review needs the same review bar as implementer output.

## 2026-08-31 part 2 build
- U+00A0 placeholders get silently flattened to ASCII space when agents retype code (second occurrence — part 1 hit the same bug in the same file). When code carries invisible-character intent, spell it out in the plan as an escape (`{"\u00a0"}`) instead of a literal.
