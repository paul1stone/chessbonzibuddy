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
