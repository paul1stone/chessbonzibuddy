// Regenerates the committed share assets: public/og.png, public/favicon-32.png,
// public/apple-touch-icon.png. Requires `npm run dev` on BASE_URL for the og capture.
//   BASE_URL=http://localhost:4110 node scripts/capture-share-assets.mjs
import { chromium } from "@playwright/test";
import sharp from "sharp";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PUBLIC = path.resolve("public");
const BONZI = path.join(PUBLIC, "bonzi/idle-still.png");

// The og:image frame is the TOP of the hero, not the poster's 0.85 scrub point: the share card has
// to carry the headline, the CTAs and Bonzi. Deeper into the scrub the window has already flown off
// and all a crawler gets is a bare chessboard.
const OG = { width: 1200, height: 630 };

// Bonzi's head inside the 200x160 sprite (alpha bbox is 61,40..139,150; the neck is at y~86).
const HEAD = { left: 73, top: 34, width: 54, height: 54 };

// The taskbar clock renders the wall time — the one difference between two runs a reader would
// actually notice — so it is stamped in the DOM. 4:23 PM for 4/23/1999, the install date the icon
// property sheets already claim.
//
// Note it is NOT done with page.clock: faking Date before goto stalls GSAP, so the boot cascade
// never runs and the capture comes back with the hero window hidden and the taskbar off-screen.
// Nor does page.clock make og.png byte-stable — CameraRig (chess-scene.tsx) idles on a +/-3deg,
// 12s orbit off three's own clock, so ~1% of pixels differ between runs no matter what. The
// framing is identical; only the exact frame is not. Regenerate when the landing visuals change,
// not on a schedule.
const FAKE_CLOCK = "4:23 PM";

async function captureOg() {
  // Headless scrollbars paint over the page and would land in the card.
  const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
  try {
    const page = await browser.newPage({ viewport: OG, deviceScaleFactor: 1 });
    await page.goto(`${BASE_URL}/`);
    await page.waitForSelector("[data-testid=hero-canvas] canvas", { timeout: 30000 });
    // The marketing layout hides the page until the boot cascade finishes.
    await page.waitForFunction(() => !document.documentElement.classList.contains("boot-pending"));
    await page.addStyleTag({ content: "nextjs-portal { display: none !important }" });
    await page.evaluate(() => window.scrollTo(0, 0));
    // Let the renderer settle: the canvas draws the board over several frames.
    await page.waitForTimeout(2000);
    // The taskbar clock is the only `time` element on the page (asserted, so a second one is a
    // loud failure rather than a silently un-stamped capture).
    await page.evaluate((clock) => {
      const times = document.querySelectorAll("time");
      if (times.length !== 1) throw new Error(`expected 1 <time>, found ${times.length}`);
      times[0].textContent = clock;
    }, FAKE_CLOCK);
    const png = await page.screenshot();
    // The art is dithered into a small palette already, so 256 colours is visually lossless
    // and keeps the committed binary an order of magnitude smaller than truecolour.
    await sharp(png).png({ palette: true, colors: 256, effort: 10 }).toFile(path.join(PUBLIC, "og.png"));
  } finally {
    await browser.close();
  }
}

async function rasterizeIcons() {
  // Nearest-neighbour on both: the source is a 1999 sprite and the icons should read as pixels.
  await sharp(BONZI)
    .extract(HEAD)
    .resize(32, 32, { kernel: "nearest" })
    .png()
    .toFile(path.join(PUBLIC, "favicon-32.png"));
  // 54 -> 180 is not an integer step, so scale 3x and pad: every source pixel stays square.
  // Flattened onto the Win98 face grey because iOS composites transparency onto black.
  await sharp(BONZI)
    .extract(HEAD)
    .resize(162, 162, { kernel: "nearest" })
    .extend({ top: 9, bottom: 9, left: 9, right: 9, background: "#c0c0c0" })
    .flatten({ background: "#c0c0c0" })
    .png()
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
}

await rasterizeIcons();
await captureOg();
console.log("wrote og.png, favicon-32.png, apple-touch-icon.png");
