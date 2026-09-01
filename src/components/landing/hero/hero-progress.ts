// Smoothed hero scrub progress, written by useHeroScroll every frame. Module-level so
// consumers outside the hero tree (the eval bar) ride the exact same scrub, lag and all.
export const heroProgressRef: { current: number } = { current: 0 };
