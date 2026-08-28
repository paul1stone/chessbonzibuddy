// Captures real product screenshots and the hero poster. Requires `npm run dev` on BASE_URL.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("public/screenshots");
const MANIFEST = path.resolve("src/components/landing/screenshots.json");
const manifest = { hero: false, import: false, review: false, practice: false };

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

async function captureAnalyzer() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set; skipping import/review/practice screenshots");
    return;
  }
  // Import a public game through the real API, analyze it, then screenshot each view.
  const gameUrl = process.env.SCREENSHOT_GAME_URL;
  if (!gameUrl) {
    console.log("SCREENSHOT_GAME_URL not set; skipping import/review/practice screenshots");
    return;
  }
  const res = await fetch(`${BASE_URL}/api/games/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: gameUrl }),
  });
  if (!res.ok) throw new Error(`import failed: ${res.status} ${await res.text()}`);
  const game = await res.json();
  const analyze = await fetch(`${BASE_URL}/api/games/${game.id}/analyze`, { method: "POST" });
  await analyze.text(); // drains the SSE stream until analysis completes

  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
  await page.goto(`${BASE_URL}/app`);
  await page.evaluate((username) => {
    localStorage.setItem(
      "chess-analyzer-profile",
      JSON.stringify({ state: { chessComUsername: username, lichessUsername: "", chessComRatings: null, lichessRatings: null }, version: 0 })
    );
  }, game.whitePlayer);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "import.png") });
  manifest.import = true;

  await page.getByText(game.whitePlayer, { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "review.png") });
  manifest.review = true;

  await page.getByRole("button", { name: /practice/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "practice.png") });
  manifest.practice = true;
  await page.close();
}

try {
  await captureHeroPoster();
  await captureAnalyzer();
} finally {
  await browser.close();
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest", manifest);
}
