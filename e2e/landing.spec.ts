import { expect, test, type Locator } from "@playwright/test";

/** pieceSquares() for the untouched starting position. */
const START_POSITION_SQUARES =
  "a8,b8,c8,d8,e8,f8,g8,h8,a7,b7,c7,d7,e7,f7,g7,h7,a2,b2,c2,d2,e2,f2,g2,h2,a1,b1,c1,d1,e1,f1,g1,h1";

/** Squares that currently hold a piece, in DOM order: a cheap board-position fingerprint. */
function pieceSquares(scope: Locator): Promise<string> {
  return scope
    .locator("[data-square]:has([data-piece])")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-square")).join(","));
}

/** Landing demos mount their lazy chunk on first intersection, so bring the window on screen. */
async function demoWindow(page: import("@playwright/test").Page, name: string): Promise<Locator> {
  const win = page.getByRole("region", { name, exact: true });
  await win.scrollIntoViewIfNeeded();
  return win;
}

test.describe("landing page", () => {
  test("renders the hero and both calls to action", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Play chess against a purple gorilla from 1999.");
    await expect(page.getByRole("link", { name: "Play Bonzi Buddy" }).first()).toHaveAttribute("href", "/app?view=play-bonzi");
    await expect(page.getByRole("link", { name: "Analyze my games" }).first()).toHaveAttribute("href", "/app");
    await expect(page.getByAltText("Bonzi Buddy").first()).toBeVisible();
    await expect(page.locator("[data-testid=hero-canvas] canvas")).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test("deep-links into the play view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Play Bonzi Buddy" }).first().click();
    await expect(page).toHaveURL(/\/app\?view=play-bonzi/);
    await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  });

  test("start menu opens with a click and closes with Escape", async ({ page }) => {
    await page.goto("/");
    const start = page.getByRole("button", { name: "Start" });
    await start.click();
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(start).toBeFocused();
  });

  test("respects reduced motion: no canvas, dialog in flow", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-testid=hero-canvas]")).toHaveCount(0);
    await expect(page.locator(".hero--motion")).toHaveCount(0);
    await expect(page.locator(".hero-poster")).toBeVisible();
    await expect(page.getByText("Checkmate. Bonzi wins in four moves.")).toBeVisible();
    await context.close();
  });

  test("has no horizontal overflow at 375px", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await context.newPage();
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await context.close();
  });

  test("shows the checkmate dialog after scrolling through the hero", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid=hero-canvas] canvas").waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const hero = document.querySelector(".hero") as HTMLElement;
      window.scrollTo(0, hero.offsetHeight - window.innerHeight);
    });
    await page.waitForTimeout(1500);
    await expect(page.getByRole("link", { name: "Rematch" })).toBeVisible();
  });

  test("unmounts the poster once the canvas is live", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-testid=hero-canvas] canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".hero-poster")).toHaveCount(0);
  });

  test("review demo scrubber takes over and changes the board", async ({ page }) => {
    await page.goto("/");
    const review = await demoWindow(page, "Review");
    const slider = review.getByRole("slider", { name: "Scrub through the game" });
    await expect(slider).toBeVisible({ timeout: 15000 });

    // Keyboard, not fill(): setting a range input's value programmatically leaves React's
    // value tracker in sync, so no change event fires and the demo never sees the scrub.
    // One real key press latches userTouched, which stops the autoplay interval for good.
    await slider.press("ArrowRight");
    await page.waitForTimeout(1000); // let the board's 200ms move animation settle
    const held = await slider.inputValue();
    const scrubbed = await pieceSquares(review);
    await page.waitForTimeout(2000); // longer than the 1400ms autoplay step
    await expect(slider).toHaveValue(held);
    expect(await pieceSquares(review)).toBe(scrubbed);

    // And the board follows the scrubber: ply 0 is the untouched starting position.
    await slider.press("Home");
    await expect(slider).toHaveValue("0");
    await expect.poll(() => pieceSquares(review)).toBe(START_POSITION_SQUARES);

    await slider.press("End");
    await expect.poll(() => pieceSquares(review)).not.toBe(START_POSITION_SQUARES);
  });

  test("practice demo poses the game's worst move as a puzzle", async ({ page }) => {
    await page.goto("/");
    const practice = await demoWindow(page, "Practice");
    await expect(practice.getByText(/Find the better move\./)).toBeVisible({ timeout: 15000 });
    await expect(practice.getByText("Drag a piece to play your move.")).toBeVisible();
    await expect(practice.getByRole("button", { name: "Show answer" })).toBeVisible();
  });

  test("import demo is tagged as a demo", async ({ page }) => {
    await page.goto("/");
    const importWindow = await demoWindow(page, "Import");
    await expect(importWindow).toContainText("Demo");
    await expect(
      importWindow.getByText(/a Chess\.com game link is pasted/)
    ).toBeAttached();
  });

  test("respects reduced motion: demos rest on their end states", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    // The import demo is scripted, not chess-driven: reduced motion pins it on its end
    // frame, so the link is fully typed, every row is listed, and nothing ticks onward.
    const importWindow = await demoWindow(page, "Import");
    await expect(importWindow).toContainText("chess.com/game/live/");
    const rows = importWindow.getByText(/\d+ min (blitz|rapid)/);
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toBeVisible();
    await expect(rows.last()).toBeVisible();
    const importFrame = await importWindow.innerText();
    await page.waitForTimeout(2000);
    expect(await importWindow.innerText()).toBe(importFrame);

    const review = await demoWindow(page, "Review");
    await expect(review.getByRole("slider", { name: "Scrub through the game" })).toBeVisible({
      timeout: 15000,
    });
    await expect(review).toContainText(/10\.\.\.\s*cxb5/);
    const before = await pieceSquares(review);
    await page.waitForTimeout(2000);
    expect(await pieceSquares(review)).toBe(before);

    await context.close();
  });
});
