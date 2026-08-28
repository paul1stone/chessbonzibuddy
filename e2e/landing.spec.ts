import { expect, test } from "@playwright/test";

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
});
