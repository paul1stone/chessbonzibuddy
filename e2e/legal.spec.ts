import { expect, test } from "@playwright/test";

for (const [path, heading] of [
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms of use"],
] as const) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    // The landing's footer is gone; these pages cross-link to each other instead.
    await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link")).toHaveText([
      "Privacy",
      "Terms",
      "Play Bonzi Buddy",
    ]);
    // The taskbar follows the visitor here, but its window buttons must not: dock-store is
    // module-global and a finale session would otherwise leak the running desktop onto /terms.
    await expect(page.locator("[data-taskbar-button]")).toHaveCount(0);
  });
}
