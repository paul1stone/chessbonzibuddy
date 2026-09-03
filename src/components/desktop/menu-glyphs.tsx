// L11: 16x16 Start-menu glyphs for the items that have no desktop icon of their own. Same
// rect-only, crispEdges construction as the 32px window icons, drawn at menu size.

const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  shapeRendering: "crispEdges" as const,
  "aria-hidden": true,
  focusable: false,
} as const;

export function HomeGlyph() {
  return (
    <svg {...SVG_PROPS}>
      {/* roof */}
      <g fill="#800000">
        <rect x="7" y="2" width="2" height="1" />
        <rect x="6" y="3" width="4" height="1" />
        <rect x="5" y="4" width="6" height="1" />
        <rect x="4" y="5" width="8" height="1" />
        <rect x="3" y="6" width="10" height="1" />
        <rect x="2" y="7" width="12" height="1" />
      </g>
      {/* walls and door */}
      <rect x="4" y="8" width="8" height="6" fill="#000000" />
      <rect x="5" y="9" width="6" height="4" fill="#ffe9a0" />
      <rect x="7" y="10" width="2" height="4" fill="#000080" />
    </svg>
  );
}

export function DocGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="1" width="10" height="14" fill="#000000" />
      <rect x="4" y="2" width="8" height="12" fill="#ffffff" />
      <g fill="#808080">
        <rect x="5" y="4" width="6" height="1" />
        <rect x="5" y="6" width="6" height="1" />
        <rect x="5" y="8" width="6" height="1" />
        <rect x="5" y="10" width="4" height="1" />
      </g>
    </svg>
  );
}

/** A power plate: the button you press to stop the machine. */
export function ShutDownGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="12" height="12" fill="#000000" />
      <rect x="3" y="3" width="10" height="10" fill="#c0c0c0" />
      {/* The power mark: a stem standing in an open-topped ring. */}
      <g fill="#800000">
        <rect x="7" y="4" width="2" height="4" />
        <rect x="4" y="6" width="2" height="3" />
        <rect x="10" y="6" width="2" height="3" />
        <rect x="5" y="9" width="6" height="2" />
      </g>
    </svg>
  );
}

/** The 1999 shorthand for "this link leaves the app". */
export function GlobeGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <g fill="#000000">
        <rect x="5" y="1" width="6" height="1" />
        <rect x="3" y="2" width="10" height="1" />
        <rect x="2" y="3" width="12" height="10" />
        <rect x="3" y="13" width="10" height="1" />
        <rect x="5" y="14" width="6" height="1" />
      </g>
      <g fill="#0000a0">
        <rect x="6" y="2" width="4" height="1" />
        <rect x="4" y="3" width="8" height="1" />
        <rect x="3" y="4" width="10" height="8" />
        <rect x="4" y="12" width="8" height="1" />
        <rect x="6" y="13" width="4" height="1" />
      </g>
      {/* meridian and equator */}
      <g fill="#ffffff">
        <rect x="7" y="3" width="2" height="10" />
        <rect x="3" y="7" width="10" height="2" />
      </g>
    </svg>
  );
}
