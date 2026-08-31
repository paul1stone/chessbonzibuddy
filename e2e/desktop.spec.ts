import { expect, test } from "@playwright/test";

// Windows are `role="dialog"` labelled by their title bar text (ICON_LABELS).
const PLAY = { name: "Play Bonzi Buddy" } as const;

test.describe("win98 desktop app", () => {
  test("shows desktop, icons, and taskbar", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/app");
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    // First match is the desktop icon; the taskbar button for an open window is the last.
    await expect(page.getByRole("button", PLAY).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: "My games" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("opens play from a desktop icon, boots the board, and Bonzi replies", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", PLAY).first().dblclick();
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();

    // 1+0 keeps Stockfish's own clock allocation small: on the 5+0 default it spends
    // ~20s on move 1, which measures its time management rather than the engine wiring.
    await dialog.getByRole("button", { name: "1+0", exact: true }).click();
    await dialog.getByRole("button", { name: "Start game" }).click();
    await expect(dialog.locator("[data-column]").first()).toBeVisible({ timeout: 15000 });

    // Click-to-move: select e2, then click the legal target e4.
    await dialog.locator('[data-square="e2"]').click();
    await dialog.locator('[data-square="e4"]').click();

    const log = dialog.locator(".r-scroll.r-bevel-in");
    const firstMoveRow = log.locator("div.grid").nth(1); // nth(0) is the #/White/Black header
    await expect(firstMoveRow).toContainText(/1\.\s*e4/);

    // Bonzi answers: the black cell of move 1 fills in with the engine's reply.
    await expect(firstMoveRow.locator("span").nth(2)).toHaveText(/\S/, { timeout: 15000 });
  });

  test("deep link opens the play window", async ({ page }) => {
    await page.goto("/app?view=play-bonzi");
    await expect(page.getByRole("dialog", PLAY)).toBeVisible();
  });

  test("drags a window by its title bar", async ({ page }) => {
    await page.goto("/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    const title = dialog.locator(".r-title");
    const before = await dialog.evaluate((el) => el.style.transform);
    const box = (await title.boundingBox())!;
    // Grab the middle of the bar: the minimize/maximize/close glyphs sit at the right edge.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 5 });
    await page.mouse.up();
    const after = await dialog.evaluate((el) => el.style.transform);
    expect(before).toMatch(/^translate\(/);
    expect(after).not.toBe(before);
  });

  test("minimize hides and the taskbar restores", async ({ page }) => {
    await page.goto("/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Minimize" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", PLAY).last().click();
    await expect(dialog).toBeVisible();
  });

  test("mobile shows a single maximized window", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await ctx.newPage();
    await page.goto("/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await ctx.close();
  });
});
