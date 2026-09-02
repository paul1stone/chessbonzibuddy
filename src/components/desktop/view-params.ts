import type { WindowId } from "@/stores/window-store";

/**
 * Deep-link whitelist: `?view=<key>` opens the mapped window. ViewParamSync does the opening;
 * the shell reads this only to know a link already chose, so its auto-open must stand down.
 *
 * A leaf on purpose — type-only imports, nothing at runtime. The `(app)` layout pulls
 * ViewParamSync in, so anything reachable from here lands in the layout's chunk.
 */
export const VIEW_PARAM_WINDOWS: Record<string, WindowId> = {
  "play-bonzi": "play",
  games: "games",
  import: "import",
  review: "review",
  practice: "practice",
  profile: "profile",
  terminal: "terminal",
};
