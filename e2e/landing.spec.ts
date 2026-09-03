import { expect, test, type Locator, type Page } from "@playwright/test";

/** pieceSquares() for the untouched starting position. */
const START_POSITION_SQUARES =
  "a8,b8,c8,d8,e8,f8,g8,h8,a7,b7,c7,d7,e7,f7,g7,h7,a2,b2,c2,d2,e2,f2,g2,h2,a1,b1,c1,d1,e1,f1,g1,h1";

/** Squares that currently hold a piece, in DOM order: a cheap board-position fingerprint. */
function pieceSquares(scope: Locator): Promise<string> {
  return scope
    .locator("[data-square]:has([data-piece])")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-square")).join(","));
}

/** Same query the cascade arms on: anywhere else the walkthrough is a plain page section. */
const CASCADE_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

/**
 * The armed cascade pins the walkthrough and keeps every window `visibility: hidden` until its
 * segment reveals it, so park the scrub at the end of the pin (`+=210%`) first. Returns false
 * when nothing is armed and the caller still owns bringing the window on screen.
 */
async function revealCascade(page: Page): Promise<boolean> {
  if (!(await page.evaluate((q) => matchMedia(q).matches, CASCADE_QUERY))) return false;
  const section = page.locator("[aria-labelledby='walkthrough-heading']");
  // Re-targeted every poll: the hero grows to 300vh once its own trigger lands, which moves
  // the section down after an early measurement.
  await expect
    .poll(
      () =>
        section.evaluate((el) => {
          // Pinning parks the section itself at the viewport top; only its pin-spacer still
          // reports the document position the scroll target is measured from.
          const holder = el.closest(".pin-spacer") ?? el;
          window.scrollTo(0, holder.getBoundingClientRect().top + window.scrollY + window.innerHeight * 2.1);
          return el.querySelectorAll("[data-stack-key].cascade-open").length;
        }),
      { timeout: 20_000 }
    )
    .toBe(3);
  return true;
}

/** Landing demos mount their lazy chunk on first intersection, so bring the window on screen. */
async function demoWindow(page: Page, name: string): Promise<Locator> {
  // The parked pin already holds every window on screen, and scrolling would rewind the scrub.
  const parked = await revealCascade(page);
  const win = page.getByRole("region", { name, exact: true });
  if (!parked) await win.scrollIntoViewIfNeeded();
  return win;
}

/**
 * Parks the scroll on the finale — the page's last section, a real desktop — and waits for the
 * taskbar to hand its section buttons over to that desktop's window buttons.
 *
 * Re-scrolled every poll for the same reason `revealCascade` is: the hero grows to 300vh and
 * the walkthrough pins three viewports, both after first paint, so an early measurement of
 * where the section starts is never the final one.
 */
async function arriveAtFinale(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const finale = document.querySelector("[data-finale]");
          if (!finale) return "no finale section";
          window.scrollTo(0, finale.getBoundingClientRect().top + window.scrollY);
          // The section buttons live in this container, and the swap unmounts it whole.
          return document.querySelector("[data-dock-slots]") ? "still docked" : "arrived";
        }),
      { timeout: 30_000 }
    )
    .toBe("arrived");
}

/**
 * First visit of a session zooms the hero window up out of the taskbar. Any pointerdown
 * fast-forwards that animation, which moves the window between mousedown and mouseup — the
 * click then lands on an ancestor and never reaches the link. Wait for the zoom to land.
 */
async function bootSettled(page: Page) {
  await expect
    .poll(() =>
      page
        .locator(".hero-window")
        .evaluate((el) => `${getComputedStyle(el).visibility} ${getComputedStyle(el).opacity}`)
    )
    .toBe("visible 1");
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
    await bootSettled(page);
    await page.getByRole("link", { name: "Play Bonzi Buddy" }).first().click();
    await expect(page).toHaveURL(/\/app\?view=play-bonzi/);
    await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  });

  test("start menu opens with a click and closes with Escape", async ({ page }) => {
    await page.goto("/");
    // The boot slides the taskbar up; a click that starts mid-slide misses the button.
    await bootSettled(page);
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

  test("has no horizontal overflow at 1024px", async ({ browser }) => {
    // Guards the walkthrough's 12-column grid at iPad-landscape widths, where the tracks are
    // narrow enough that the windows fill them instead of capping at 560px.
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(1024);
    await context.close();
  });

  test("shows the checkmate dialog after scrolling through the hero", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid=hero-canvas] canvas").waitFor({ timeout: 15000 });
    // The section is only 300vh once the scrub is armed, and the first-visit boot gate can
    // hold that until after the canvas is already up.
    await page.locator(".hero--motion").waitFor({ timeout: 15000 });
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

  test("docks a taskbar button per section and jumps back to one", async ({ page }) => {
    await page.goto("/");
    // Parked one viewport above the finale — the page bottom is now the desktop, where the
    // bar legitimately swaps these buttons for the real window ones. Re-scrolled every poll:
    // the hero grows to 300vh once its trigger lands, so the first measurement is not final.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const finale = document.querySelector("[data-finale]");
            if (!finale) return "no finale";
            window.scrollTo(
              0,
              finale.getBoundingClientRect().top + window.scrollY - window.innerHeight
            );
            return [...document.querySelectorAll("[data-dock-button]")]
              .map((el) => el.getAttribute("data-dock-button"))
              .join(",");
          }),
        { timeout: 20_000 }
      )
      .toBe("hero,showcase,import,review,practice");

    const dock = page.locator("[data-dock-slots]");
    for (const label of ["BonziBUDDY.exe", "Import", "Review", "Practice"]) {
      await expect(dock.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    // The jump uses the scroll fn the cascade registered, which lands where the window is
    // revealed rather than at the top of the pin where everything is still hidden.
    await dock.getByRole("button", { name: "Review", exact: true }).click();
    const review = page.getByRole("region", { name: "Review", exact: true });
    await expect(review).toBeVisible();
    await expect(review).toBeInViewport();
  });

  test("the eval bar tracks scroll, and only on wide viewports", async ({ browser }) => {
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await wide.newPage();
    await page.goto("/");
    const bar = page.locator("[data-testid=eval-progress]");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("+0.3");
    // The bar scores the hero game: mate lands at 85% of the 200vh scrub (~1530px here).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            window.scrollTo(0, window.innerHeight * 1.75);
            return document.querySelector("[data-testid=eval-progress] p")?.textContent;
          }),
        { timeout: 20_000 }
      )
      .toBe("1-0");
    // Past the hold the bar fades out and stays gone for the rest of the page.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3));
    await expect(bar).toBeHidden({ timeout: 20_000 });
    await wide.close();

    const narrow = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const phone = await narrow.newPage();
    await phone.goto("/");
    await expect(phone.locator("[data-testid=eval-progress]")).toBeHidden();
    await narrow.close();
  });

  test("the boot cascade plays once per session", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // The pre-paint gate class is transient, so latch it rather than sampling for it.
    await page.addInitScript(() => {
      const w = window as unknown as { bootPending: boolean };
      w.bootPending = document.documentElement?.classList.contains("boot-pending") ?? false;
      new MutationObserver(() => {
        if (document.documentElement.classList.contains("boot-pending")) w.bootPending = true;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    const sawBootPending = () =>
      page.evaluate(() => (window as unknown as { bootPending: boolean }).bootPending);

    await page.goto("/");
    await expect(page.locator(".hero-window")).toBeVisible({ timeout: 2000 });
    expect(await page.evaluate(() => sessionStorage.getItem("cbb-booted"))).not.toBeNull();
    expect(await sawBootPending()).toBe(true);

    await page.reload();
    await expect(page.locator(".hero-window")).toBeVisible();
    expect(await sawBootPending()).toBe(false);
    await context.close();
  });

  test("the scroll ends at a real desktop, and the taskbar hands over to it", async ({ page }) => {
    // The finale plays /app's icon stagger on first arrival; seeding the flag it writes on
    // completion keeps an icon from moving out from under the double-click below.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("cbb-app-booted", "1");
      } catch {
        // Blocked storage only means the stagger plays; nothing here depends on the write.
      }
    });
    await page.goto("/");
    await arriveAtFinale(page);

    // The embedded desktop is the real one: same icons, drawn from the same store.
    const finale = page.locator("[data-finale]");
    await expect(finale.locator("[data-desktop-icon]").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-taskbar-button]")).toHaveCount(0);

    // A window opens in place — on the landing page, into the landing page's own taskbar.
    await finale.locator('[data-desktop-icon="games"]').dblclick();
    await expect(page.getByRole("dialog", { name: "My games" })).toBeVisible();
    await expect(page.locator('[data-taskbar-button="games"]')).toBeVisible();

    // The handed-over bar serves the desktop's own menu: app items, no Home (we are home),
    // Shut Down and About above GitHub — the same order /app shows.
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Start menu" }).locator("li")).toHaveText([
      "Play Bonzi Buddy",
      "My games",
      "Import",
      "Practice",
      "Profile",
      "MS-DOS Prompt",
      "Privacy",
      "Terms",
      "Shut Down…",
      "About Chess Bonzi Buddy",
      "GitHub",
    ]);
    await page.keyboard.press("Escape");

    // Scrolling back into the story hands the bar to the sections again. One viewport up, not
    // the top of the page: the sections undock behind you, so at scrollY 0 there is nothing
    // for the bar to show either way.
    await page.evaluate(() => {
      const finale = document.querySelector("[data-finale]")!;
      window.scrollTo(0, finale.getBoundingClientRect().top + window.scrollY - window.innerHeight);
    });
    await expect(page.locator("[data-taskbar-button]")).toHaveCount(0);
    await expect(page.locator("[data-dock-slots]")).toHaveCount(1);
    await expect(page.locator("[data-dock-button]").first()).toBeVisible();
  });

  test("the mobile finale grid opens the window each icon points at", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await context.newPage();
    await page.goto("/");

    // No desktop on a phone: the finale is a tap grid into /app, so its links are the whole
    // feature. Re-scrolled every poll, as ever — the hero and the pins both grow late.
    const icons = page.locator("[data-finale-icon]");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const finale = document.querySelector("[data-finale]");
            if (!finale) return 0;
            window.scrollTo(0, finale.getBoundingClientRect().top + window.scrollY);
            return document.querySelectorAll("[data-finale-icon]").length;
          }),
        { timeout: 30_000 }
      )
      .toBe(7);

    // Every href is inverted out of the deep-link whitelist, so a missing entry would ship a
    // literal `?view=undefined` rather than fail anywhere visible.
    const hrefs = await icons.evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.filter((href) => !/^\/app\?view=[a-z-]+$/.test(href))).toEqual([]);

    // A NON-play link: ViewParamSync used to whitelist play-bonzi alone, so every other icon
    // landed the visitor on a bare desktop with nothing open.
    await page.locator('[data-finale-icon="practice"]').click();
    await expect(page).toHaveURL(/\/app\?view=practice$/);
    await expect(page.getByRole("dialog", { name: "Practice" })).toBeVisible();
    await context.close();
  });

  test("carries the share metadata and favicons a link preview needs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Chess Bonzi Buddy");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Chess Bonzi Buddy"
    );
    // Absolute, from metadataBase: crawlers reject a relative og:image outright.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https:\/\/.+\/og\.png$/
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:alt"]')).not.toHaveAttribute("content", "");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /^https:\/\/.+\/og\.png$/
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon-32.png");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png"
    );

    // The tags promise files that have to exist: og.png is committed, not generated on deploy.
    for (const path of ["/og.png", "/favicon-32.png", "/apple-touch-icon.png"]) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
  });

  test("respects reduced motion: every dock button is there from the start", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const dock = page.locator("[data-dock-slots]");
    for (const label of ["Chess Bonzi Buddy", "BonziBUDDY.exe", "Import", "Review", "Practice"]) {
      await expect(dock.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.locator(".cascade--armed")).toHaveCount(0);
    await context.close();
  });
});
