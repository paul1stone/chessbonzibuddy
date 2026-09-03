import { expect, test, type Locator, type Page } from "@playwright/test";

// Windows are `role="dialog"` labelled by their title bar text (ICON_LABELS).
const PLAY = { name: "Play Bonzi Buddy" } as const;

/**
 * The first engine use of a session — starting a game, or draining the analysis queue — opens
 * a Win98 confirm in front of Stockfish's 113 MB download; every later one is latched past it.
 *
 * `settled` is whatever proves the gate is behind us; pass it wherever the latch may already be
 * set, so a second call in the same page never blocks on a dialog that will not come.
 */
async function passEngineGate(page: Page, settled?: Locator) {
  const gate = page.getByRole("dialog", { name: "Download Stockfish" });
  await expect(settled ? gate.or(settled).first() : gate).toBeVisible({ timeout: 20_000 });
  if (!(await gate.isVisible())) return;
  await gate.getByRole("button", { name: "Download", exact: true }).click();
  // Localhost, but still 113 MB through the dev server's static handler, and the dialog only
  // closes once the body has been drained to the end.
  await expect(gate).toHaveCount(0, { timeout: 180_000 });
}

/**
 * Every test but the cascade one starts past the first visit of a session: that boot slides the
 * taskbar up and holds each icon at scale(0.6) for ~700ms, long enough to move an icon out from
 * under a click. Seeding the flag AppBoot writes on completion skips the whole thing.
 */
async function openDesktop(page: Page, url = "/app") {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("cbb-app-booted", "1");
    } catch {
      // Blocked storage only means the cascade plays; nothing here depends on the write.
    }
  });
  await page.goto(url);
}

/** Every open window's title-bar close glyph, topmost first. */
const closeGlyphs = (page: Page) => page.locator('[role="dialog"]:visible .r-title [aria-label="Close"]');

/**
 * /app opens My games straight over the icon column, so the surface tests shut it first to get
 * bare desktop under the pointer.
 */
async function clearDesktop(page: Page) {
  const closers = closeGlyphs(page);
  for (let n = await closers.count(); n > 0; n--) await closers.first().click();
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
}

/** Viewport box of a desktop icon, which is absolutely positioned out of the desktop store. */
async function iconBox(page: Page, id: string) {
  const box = await page.locator(`[data-desktop-icon="${id}"]`).boundingBox();
  expect(box, `desktop icon ${id} has no box`).not.toBeNull();
  return box!;
}

/** Computed background of the desktop surface — the icons' own container. */
function desktopBackground(page: Page) {
  return page.evaluate(
    () => getComputedStyle(document.querySelector("[data-desktop-icon]")!.parentElement!).backgroundColor
  );
}

test.describe("win98 desktop app", () => {
  test("shows desktop, icons, and taskbar", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await openDesktop(page);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    // First match is the desktop icon; the taskbar button for an open window is the last.
    await expect(page.getByRole("button", PLAY).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: "My games" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("opens play from a desktop icon, boots the board, and Bonzi replies", async ({ page }) => {
    // The download the gate asks for lands in front of everything else this test measures.
    test.setTimeout(240_000);
    await openDesktop(page);
    await page.getByRole("button", PLAY).first().dblclick();
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();

    // 1+0 keeps Stockfish's own clock allocation small: on the 5+0 default it spends
    // ~20s on move 1, which measures its time management rather than the engine wiring.
    // Measured end to end here: ~3.5s engine handshake plus a ~2s search.
    await dialog.getByRole("button", { name: "1+0", exact: true }).click();
    const board = dialog.locator("[data-column]").first();
    await dialog.getByRole("button", { name: "Start game" }).click();
    await passEngineGate(page, board);
    await expect(board).toBeVisible({ timeout: 15000 });

    // Click-to-move: select e2, then click the legal target e4.
    await dialog.locator('[data-square="e2"]').click();
    await dialog.locator('[data-square="e4"]').click();

    const log = dialog.locator(".r-scroll.r-bevel-in");
    const firstMoveRow = log.locator("div.grid").nth(1); // nth(0) is the #/White/Black header
    await expect(firstMoveRow).toContainText(/1\.\s*e4/);

    // Bonzi answers: the black cell of move 1 fills in with the engine's reply.
    // 30s, not 15s: the wasm handshake is slower on a cold or loaded machine, and a
    // generous budget only costs time when the test is genuinely failing.
    await expect(firstMoveRow.locator("span").nth(2)).toHaveText(/\S/, { timeout: 30000 });
  });

  test("deep link opens the play window", async ({ page }) => {
    await openDesktop(page, "/app?view=play-bonzi");
    await expect(page.getByRole("dialog", PLAY)).toBeVisible();
  });

  test("drags a window by its title bar", async ({ page }) => {
    await openDesktop(page, "/app?view=play-bonzi");
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
    await openDesktop(page, "/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Minimize" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", PLAY).last().click();
    await expect(dialog).toBeVisible();
  });

  test("opens the MS-DOS Prompt from the Start menu", async ({ page }) => {
    await openDesktop(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    // Scoped to the menu: there is a desktop icon by the same name.
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await menu.getByRole("button", { name: "MS-DOS Prompt" }).click();
    const dialog = page.getByRole("dialog", { name: "MS-DOS Prompt" });
    await expect(dialog).toBeVisible();
    // The xterm host attaching is the wiring under test; the Linux boot behind it takes 15-30s.
    await expect(dialog.locator("[data-testid=terminal-xterm]")).toBeAttached({ timeout: 10000 });
  });

  test("a marquee sweep selects the icons it crosses", async ({ page }) => {
    await openDesktop(page);
    await clearDesktop(page);
    const play = await iconBox(page, "play");
    const profile = await iconBox(page, "profile");

    // Start clear of the column so the press lands on the desktop itself — a marquee that begins
    // on an icon is a drag — then sweep down-left across exactly the two icons below it.
    await page.mouse.move(play.x + play.width + 60, play.y - 8);
    await page.mouse.down();
    await page.mouse.move(play.x + 4, profile.y + profile.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator('[data-desktop-icon="play"]')).toHaveClass(/icon-selected/);
    await expect(page.locator('[data-desktop-icon="profile"]')).toHaveClass(/icon-selected/);
    await expect(page.locator("[data-desktop-icon].icon-selected")).toHaveCount(2);

    // A press that never becomes a sweep is a plain click on empty desktop.
    await page.mouse.click(play.x + play.width + 60, play.y - 8);
    await expect(page.locator("[data-desktop-icon].icon-selected")).toHaveCount(0);
  });

  test("meta-click toggles one icon in and out of the selection", async ({ page }) => {
    await openDesktop(page);
    await clearDesktop(page);
    const selected = page.locator("[data-desktop-icon].icon-selected");
    const play = page.locator('[data-desktop-icon="play"]');
    const profile = page.locator('[data-desktop-icon="profile"]');

    await play.click();
    await expect(selected).toHaveCount(1);

    // Meta, never Control: on macOS a Ctrl+click synthesizes a contextmenu instead of a click.
    await profile.click({ modifiers: ["Meta"] });
    await expect(selected).toHaveCount(2);

    await profile.click({ modifiers: ["Meta"] });
    await expect(selected).toHaveCount(1);
    await expect(play).toHaveClass(/icon-selected/);
  });

  test("the desktop menu opens on right-click and Escape closes only the menu", async ({ page }) => {
    await openDesktop(page);
    const games = page.getByRole("dialog", { name: "My games" });
    await expect(games).toBeVisible();

    // Right of the cascaded windows and below the icon column: bare desktop.
    await page.mouse.click(900, 300, { button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Refresh" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    // The window frames minimize on Escape, so the menu has to swallow its own.
    await expect(games).toBeVisible();
  });

  test("right-click inside a window body keeps the native menu", async ({ page }) => {
    await openDesktop(page);
    const body = page.getByRole("dialog", { name: "My games" }).locator(".r-body");
    await expect(body).toBeVisible();

    // Read defaultPrevented off the event once dispatch has returned: React runs its own
    // contextmenu handlers synchronously inside dispatchEvent, so this sees their verdict.
    const prevented = await body.evaluate((el) => {
      const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("Display Properties repaints the desktop on Apply", async ({ page }) => {
    await openDesktop(page);
    await page.mouse.click(900, 300, { button: "right" });
    await page.getByRole("menuitem", { name: "Properties" }).click();

    const display = page.getByRole("dialog", { name: "Display Properties" });
    await expect(display).toBeVisible();
    const before = await desktopBackground(page);
    expect(before).not.toBe("rgb(128, 0, 0)");

    await display.getByRole("button", { name: "Maroon" }).click();
    await display.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => desktopBackground(page)).toBe("rgb(128, 0, 0)");
  });

  test("an icon drag survives a reload", async ({ page }) => {
    // Rehydrating stored positions must not disagree with the server markup.
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await openDesktop(page);
    await clearDesktop(page);
    const icon = page.locator('[data-desktop-icon="terminal"]');
    const from = await iconBox(page, "terminal");
    const at = async () => {
      const b = (await icon.boundingBox())!;
      return `${Math.round(b.x)},${Math.round(b.y)}`;
    };

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 260, from.y + from.height / 2 - 120, { steps: 10 });
    await page.mouse.up();

    const dropped = await at();
    expect(dropped).not.toBe(`${Math.round(from.x)},${Math.round(from.y)}`);

    await page.reload();
    // Positions land in a client effect, so the first paint is still the default grid slot.
    await expect.poll(at).toBe(dropped);
    expect(errors).toEqual([]);
  });

  test("the taskbar menu minimizes every window", async ({ page }) => {
    await openDesktop(page);
    const windows = page.locator('[role="dialog"]:visible');
    await expect(windows).toHaveCount(1);

    const bar = (await page.locator("[data-taskbar]").boundingBox())!;
    // Past the window buttons, short of the clock: the bare bar, which owns the window-list menu.
    await page.mouse.click(bar.x + bar.width - 140, bar.y + bar.height / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Minimize All Windows" }).click();

    await expect(windows).toHaveCount(0);
    // Minimized, not closed: every taskbar button is still there to restore from.
    await expect(page.locator("[data-taskbar-button]")).toHaveCount(1);
  });

  test("the system menu closes the window from the title bar", async ({ page }) => {
    await openDesktop(page, "/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    const title = (await dialog.locator(".r-title").boundingBox())!;
    const rightClickTitle = () =>
      page.mouse.click(title.x + title.width / 2, title.y + title.height / 2, { button: "right" });

    await rightClickTitle();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // The menu portals to the .retro layer but still bubbles through the React tree, so its
    // Escape has to stop short of the frame's own minimize handler.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await rightClickTitle();
    await menu.getByRole("menuitem", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("the terminal resumes from its saved state", async ({ page }) => {
    // A fresh page, always: v86 restores the snapshot once per document, so reopening the
    // window in a page that already booted it legitimately falls back to a cold boot.
    await openDesktop(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await menu.getByRole("button", { name: "MS-DOS Prompt" }).click();

    const dialog = page.getByRole("dialog", { name: "MS-DOS Prompt" });
    await expect(dialog.locator("[data-testid=terminal-xterm]")).toBeAttached({ timeout: 30000 });
    // The notice renders from the same first paint as the xterm host and clears when `C:\>`
    // arrives, so an empty count is the prompt — a cold boot would still be 15-30s away.
    // The xterm itself is a canvas; there is no terminal text to assert on.
    await expect(dialog.locator("[data-testid=terminal-boot-notice]")).toHaveCount(0, { timeout: 8000 });
  });

  test("the boot cascade plays once per session", async ({ page }) => {
    // Deliberately unseeded. Both classes come and go inside ~700ms, so latch them.
    await page.addInitScript(() => {
      const w = window as unknown as { sawBoot: { taskbar: boolean; icons: boolean } };
      w.sawBoot = { taskbar: false, icons: false };
      new MutationObserver(() => {
        if (document.querySelector("[data-taskbar].taskbar-boot")) w.sawBoot.taskbar = true;
        if (document.querySelector("[data-desktop-icon].boot-pop")) w.sawBoot.icons = true;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    const sawBoot = () =>
      page.evaluate(() => (window as unknown as { sawBoot: { taskbar: boolean; icons: boolean } }).sawBoot);

    await page.goto("/app");
    await expect(page.locator("[data-desktop-icon]").first()).toBeVisible();
    await expect.poll(sawBoot).toEqual({ taskbar: true, icons: true });
    // The flag is written when the cascade finishes, which is also when it drops its classes.
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("cbb-app-booted"))).toBe("1");
    await expect(page.locator(".boot-pop, .taskbar-boot")).toHaveCount(0);

    await page.reload();
    await expect(page.locator("[data-desktop-icon]").first()).toBeVisible();
    await page.waitForTimeout(900); // longer than the cascade it must not replay
    expect(await sawBoot()).toEqual({ taskbar: false, icons: false });
  });

  test("mobile shows a single maximized window", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await ctx.newPage();
    await openDesktop(page, "/app?view=play-bonzi");
    const dialog = page.getByRole("dialog", PLAY);
    await expect(dialog).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await ctx.close();
  });

  test("mobile opens play on arrival, and a deep link stands that down", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 } });

    // M5: a phone arrives to play Bonzi, not to a file manager. Nothing downloads on open —
    // the 113 MB gate is at Start game — so this must not put a dialog in front of anyone.
    const page = await ctx.newPage();
    await openDesktop(page);
    const play = page.getByRole("dialog", PLAY);
    await expect(play).toBeVisible();
    await expect(page.getByRole("dialog", { name: "My games" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Download Stockfish" })).toHaveCount(0);

    // Closing it lands on the tap grid, never a blank screen.
    await play.locator('.r-title [aria-label="Close"]').click();
    await expect(page.locator('[data-desktop-icon="play"]')).toBeVisible();

    // A view param picked the window already, so the auto-open stands down rather than
    // stacking play on top of it. This is what the finale's mobile grid links land on.
    const linked = await ctx.newPage();
    await openDesktop(linked, "/app?view=practice");
    await expect(linked.getByRole("dialog", { name: "Practice" })).toBeVisible();
    await expect(linked.getByRole("dialog", PLAY)).toHaveCount(0);

    await ctx.close();
  });

  test("the Start menu lists every window, each with an icon", async ({ page }) => {
    await openDesktop(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await expect(menu.locator("li")).toHaveText([
      "Play Bonzi Buddy",
      "My games",
      "Import",
      "Practice",
      "Profile",
      "MS-DOS Prompt",
      "Home",
      "Privacy",
      "Terms",
      "GitHub",
      "About Chess Bonzi Buddy",
    ]);

    // L11: every row carries a 16px icon, so no label ever sits against an empty slot.
    // Each row is one link or button whose first child is the icon slot.
    const iconless = await menu
      .locator("li > *")
      .evaluateAll((rows) =>
        rows
          .filter((row) => !row.firstElementChild?.firstElementChild)
          .map((row) => row.textContent?.trim() ?? "")
      );
    expect(iconless).toEqual([]);
  });

  test("About opens from the Start menu and carries the disclaimer", async ({ page }) => {
    await openDesktop(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "Start menu" });
    await menu.getByRole("button", { name: "About Chess Bonzi Buddy" }).click();
    // The deleted landing footer's disclaimer and credits live here now.
    const about = page.getByRole("dialog", { name: "About Chess Bonzi Buddy" });
    await expect(about).toBeVisible();
    await expect(about).toContainText("BonziOS 1.0");
    await expect(about).toContainText(/not affiliated/i);
    await about.getByRole("button", { name: "OK" }).click();
    await expect(about).toHaveCount(0);
  });

  test("the analysis queue drains every queued game behind one gate", async ({ page }) => {
    // One engine download, one engine init, then two games of real Stockfish.
    test.setTimeout(300_000);

    // There is no DATABASE_URL here, so both endpoints are faked: the queue is what is under
    // test, not the API. Four plies is a whole game to the pipeline.
    const PGN = '[Event "e2e"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 *';
    const GAMES = [
      { id: "queued-game-one", whitePlayer: "Alice", blackPlayer: "Bob" },
      { id: "queued-game-two", whitePlayer: "Carol", blackPlayer: "Dave" },
    ];
    const body = (i: number) => ({
      ...GAMES[i],
      chessComUrl: `https://www.chess.com/game/live/${i + 1}`,
      pgn: PGN,
      result: "*",
      playedAt: null,
      analysis: null,
      whiteAccuracy: null,
      blackAccuracy: null,
      createdAt: new Date().toISOString(),
    });

    let imported = 0;
    const analyzed: string[] = [];
    await page.route("**/api/games/import", (route) =>
      route.fulfill({ json: body(Math.min(imported++, GAMES.length - 1)) })
    );
    await page.route("**/api/games/*/analysis", (route) => {
      const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
      analyzed.push(id);
      const i = GAMES.findIndex((g) => g.id === id);
      return route.fulfill({ json: { ...body(i), whiteAccuracy: 90, blackAccuracy: 90 } });
    });

    // Play open holds the queue: analysis and Bonzi each run their own 113 MB engine.
    await openDesktop(page, "/app?view=play-bonzi");
    await expect(page.getByRole("dialog", PLAY)).toBeVisible();

    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Start menu" })
      .getByRole("button", { name: "Import" })
      .click();
    const importWindow = page.getByRole("dialog", { name: "Import" });
    await importWindow.getByRole("tab", { name: "Paste URL" }).click();

    for (const [i, game] of GAMES.entries()) {
      await importWindow.getByRole("textbox").fill(`https://www.chess.com/game/live/${i + 1}`);
      await importWindow.getByRole("button", { name: "Import", exact: true }).click();
      // Every import opens its own review window on top; close it to get the form back.
      const review = page.getByRole("dialog", {
        name: `${game.whitePlayer} vs ${game.blackPlayer}`,
      });
      await review.locator('.r-title [aria-label="Close"]').click();
      await expect(review).toHaveCount(0);
    }

    // Both queued, neither started: the play window is still open.
    expect(analyzed).toEqual([]);

    await page.getByRole("dialog", PLAY).locator('.r-title [aria-label="Close"]').click();
    // One gate for the whole drain, asked before the first dequeue.
    await passEngineGate(page);
    await expect
      .poll(() => analyzed, { timeout: 240_000 })
      .toEqual(["queued-game-one", "queued-game-two"]);
  });

  test("the app route is titled Desktop", async ({ page }) => {
    await openDesktop(page);
    await expect(page).toHaveTitle("Desktop | Chess Bonzi Buddy");
  });
});
