import { expect, test } from "@playwright/test";

for (const [path, heading] of [
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms of use"],
] as const) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("link", { name: "Back to desktop" })).toHaveAttribute("href", "/");
  });
}
