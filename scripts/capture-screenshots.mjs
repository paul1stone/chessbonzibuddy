// Captures the hero poster. Requires `npm run dev` on BASE_URL.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("public/screenshots");
const MANIFEST = path.resolve("src/components/landing/hero/poster.json");
const manifest = { hero: false };

await mkdir(OUT, { recursive: true });
// Headless scrollbars are painted over the canvas and would land in the poster.
const browser = await chromium.launch({ args: ["--hide-scrollbars"] });

// The hero canvas always renders at INTERNAL_WIDTH (400) and is CSS-upscaled with
// image-rendering: pixelated, so capturing at a 400-wide viewport gives native pixels
// (same 16:10 framing, no resampled dither) and the browser upscales the poster identically.
const POSTER_VIEWPORT = { width: 400, height: 250 };

async function captureHeroPoster() {
  const page = await browser.newPage({ viewport: POSTER_VIEWPORT });
  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("[data-testid=hero-canvas] canvas", { timeout: 15000 });
  await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    window.scrollTo(0, 0.85 * (hero.offsetHeight - window.innerHeight));
  });
  await page.waitForTimeout(1500);
  // Playwright composites whatever overlaps the element, so drop the fixed taskbar and the
  // dev-only Next.js overlay. The canvas is alpha:true, so the previous poster would also show
  // through it and compound its own artifacts on every run; hide it to keep the capture idempotent.
  await page.addStyleTag({
    content: "nextjs-portal, .hero-poster, [data-poster-hide] { display: none !important }",
  });
  await page.evaluate(() => {
    document.querySelector("[aria-controls=start-menu]")?.parentElement?.setAttribute("data-poster-hide", "");
  });
  const canvas = page.locator("[data-testid=hero-canvas] canvas");
  const png = await canvas.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(path.join(OUT, "hero-poster.webp"));
  manifest.hero = true;
  await page.close();
}

try {
  await captureHeroPoster();
} finally {
  await browser.close();
  // Never regress the flag to false when the file it points at is still on disk
  // (a botched run must not silently swap the landing hero back to the placeholder).
  const { existsSync } = await import("node:fs");
  manifest.hero ||= existsSync(path.join(OUT, "hero-poster.webp"));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest", manifest);
}
