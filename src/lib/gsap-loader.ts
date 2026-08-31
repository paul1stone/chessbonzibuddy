type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

export interface GsapBundle {
  gsap: GsapModule["gsap"];
  ScrollTrigger: ScrollTriggerModule["ScrollTrigger"];
}

let bundle: Promise<GsapBundle> | null = null;

// One shared dynamic import so GSAP loads once and stays out of the initial bundle.
export function loadGsap(): Promise<GsapBundle> {
  if (bundle) return bundle;

  const pending = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
    const gsap = g.gsap ?? g.default;
    const ScrollTrigger = st.ScrollTrigger ?? st.default;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  });

  // A failed chunk load must not disable motion forever: drop the cache so a later mount retries.
  pending.catch(() => {
    if (bundle === pending) bundle = null;
  });

  bundle = pending;
  return pending;
}
