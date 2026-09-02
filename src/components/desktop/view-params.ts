import type { WindowId } from "@/stores/window-store";

/**
 * Deep-link whitelist: `?view=<key>` opens the mapped window. ViewParamSync does the opening;
 * the shell reads this only to know a link already chose, so its auto-open must stand down.
 *
 * A leaf on purpose — type-only imports, nothing at runtime. The `(app)` layout pulls
 * ViewParamSync in, so anything reachable from here lands in the layout's chunk.
 *
 * Null-prototype so a hostile `?view=` can't reach an inherited member: on a plain literal
 * `?view=toString` resolves Object.prototype.toString and hands `open()` a function.
 */
export const VIEW_PARAM_WINDOWS: Record<string, WindowId> = Object.assign(
  Object.create(null) as Record<string, WindowId>,
  {
    "play-bonzi": "play",
    games: "games",
    import: "import",
    review: "review",
    practice: "practice",
    profile: "profile",
    terminal: "terminal",
  } satisfies Record<string, WindowId>
);
