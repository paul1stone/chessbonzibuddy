import type { ReactNode } from "react";
import type { WindowId } from "@/stores/window-store";

// 32x32 desktop icons drawn on a 16x16 pixel grid, scaled 2x. Rect-only artwork with
// crispEdges so every edge lands on a whole pixel, like the real Win98 icon set.

const SVG_PROPS = {
  width: 32,
  height: 32,
  viewBox: "0 0 16 16",
  shapeRendering: "crispEdges" as const,
  "aria-hidden": true,
  focusable: false,
} as const;

export function GamesIcon() {
  return (
    <svg {...SVG_PROPS}>
      {/* manila folder */}
      <rect x="1" y="1" width="7" height="4" fill="#000000" />
      <rect x="2" y="2" width="5" height="2" fill="#ffe9a0" />
      <rect x="1" y="4" width="14" height="11" fill="#000000" />
      <rect x="2" y="5" width="12" height="9" fill="#ffc83d" />
      <rect x="2" y="5" width="12" height="1" fill="#ffe9a0" />
      {/* knight, facing left: ear top right, muzzle jutting left, jaw notch */}
      <g fill="#000080">
        <rect x="9" y="6" width="2" height="1" />
        <rect x="8" y="7" width="3" height="1" />
        <rect x="6" y="8" width="6" height="1" />
        <rect x="4" y="9" width="8" height="1" />
        <rect x="3" y="10" width="9" height="1" />
        <rect x="5" y="11" width="7" height="1" />
        <rect x="6" y="12" width="6" height="1" />
        <rect x="4" y="13" width="9" height="1" />
      </g>
      <rect x="8" y="9" width="1" height="1" fill="#ffc83d" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg {...SVG_PROPS}>
      {/* floppy disk */}
      <rect x="1" y="1" width="14" height="14" fill="#000000" />
      <rect x="2" y="2" width="12" height="12" fill="#000080" />
      {/* shutter */}
      <rect x="5" y="2" width="6" height="4" fill="#ffffff" />
      <rect x="8" y="3" width="2" height="3" fill="#000080" />
      {/* label */}
      <rect x="3" y="8" width="10" height="6" fill="#ffffff" />
      {/* down arrow into the label */}
      <g fill="#008000">
        <rect x="7" y="8" width="2" height="3" />
        <rect x="5" y="11" width="6" height="1" />
        <rect x="6" y="12" width="4" height="1" />
        <rect x="7" y="13" width="2" height="1" />
      </g>
    </svg>
  );
}

export function ReviewIcon() {
  return (
    <svg {...SVG_PROPS}>
      {/* checkered corner, 2px cells */}
      <rect x="0" y="4" width="12" height="12" fill="#ffffff" />
      <g fill="#808080">
        <rect x="0" y="4" width="2" height="2" />
        <rect x="4" y="4" width="2" height="2" />
        <rect x="8" y="4" width="2" height="2" />
        <rect x="2" y="6" width="2" height="2" />
        <rect x="6" y="6" width="2" height="2" />
        <rect x="10" y="6" width="2" height="2" />
        <rect x="0" y="8" width="2" height="2" />
        <rect x="4" y="8" width="2" height="2" />
        <rect x="8" y="8" width="2" height="2" />
        <rect x="2" y="10" width="2" height="2" />
        <rect x="6" y="10" width="2" height="2" />
        <rect x="10" y="10" width="2" height="2" />
        <rect x="0" y="12" width="2" height="2" />
        <rect x="4" y="12" width="2" height="2" />
        <rect x="8" y="12" width="2" height="2" />
        <rect x="2" y="14" width="2" height="2" />
        <rect x="6" y="14" width="2" height="2" />
        <rect x="10" y="14" width="2" height="2" />
      </g>
      {/* magnifier handle */}
      <g fill="#000000">
        <rect x="11" y="10" width="2" height="2" />
        <rect x="12" y="11" width="2" height="2" />
        <rect x="13" y="12" width="2" height="2" />
        {/* lens rim */}
        <rect x="6" y="0" width="6" height="1" />
        <rect x="6" y="9" width="6" height="1" />
        <rect x="4" y="1" width="2" height="1" />
        <rect x="12" y="1" width="2" height="1" />
        <rect x="4" y="8" width="2" height="1" />
        <rect x="12" y="8" width="2" height="1" />
        <rect x="3" y="2" width="1" height="6" />
        <rect x="14" y="2" width="1" height="6" />
      </g>
      {/* lens glass, octagonal so it sits inside the rim */}
      <g fill="#1084d0">
        <rect x="6" y="1" width="6" height="1" />
        <rect x="4" y="2" width="10" height="6" />
        <rect x="6" y="8" width="6" height="1" />
      </g>
      <rect x="5" y="3" width="2" height="2" fill="#ffffff" />
    </svg>
  );
}

export function PracticeIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="8" cy="8" r="8" fill="#000000" />
      <circle cx="8" cy="8" r="7" fill="#800000" />
      <circle cx="8" cy="8" r="5" fill="#ffffff" />
      <circle cx="8" cy="8" r="3" fill="#800000" />
      <circle cx="8" cy="8" r="1.5" fill="#ffe9a0" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/bonzi/idle-still.png" width={32} height={32} alt="" className="[image-rendering:pixelated]" />
  );
}

export function ProfileIcon() {
  return (
    <svg {...SVG_PROPS}>
      {/* id card */}
      <rect x="0" y="2" width="16" height="12" fill="#000000" />
      <rect x="1" y="3" width="14" height="10" fill="#c0c0c0" />
      {/* photo */}
      <rect x="2" y="4" width="6" height="8" fill="#ffffff" />
      <g fill="#000080">
        <rect x="4" y="5" width="2" height="2" />
        <rect x="3" y="6" width="4" height="1" />
        <rect x="4" y="8" width="2" height="1" />
        <rect x="3" y="9" width="4" height="3" />
        {/* card text lines */}
        <rect x="9" y="5" width="5" height="1" />
        <rect x="9" y="7" width="5" height="1" />
        <rect x="9" y="9" width="5" height="1" />
        <rect x="9" y="11" width="3" height="1" />
      </g>
    </svg>
  );
}

export const WINDOW_ICONS: Record<WindowId, ReactNode> = {
  games: <GamesIcon />,
  import: <ImportIcon />,
  review: <ReviewIcon />,
  practice: <PracticeIcon />,
  play: <PlayIcon />,
  profile: <ProfileIcon />,
};
