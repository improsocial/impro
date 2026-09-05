import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createTrend } from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

test.describe("Trending pane", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    mockServer.addTrends([
      createTrend({ topic: "gardening", link: "/search?q=gardening" }),
      createTrend({
        topic: "cats",
        displayName: "Cats",
        link: "/hashtag/cats",
      }),
    ]);
    await mockServer.setup(page);
    await login(page);
  });

  test("shows trending topics in the right column", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const pane = page.locator('[data-testid="trending-pane"]');
    await expect(pane).toBeVisible();
    await expect(pane.locator('[data-testid="trending-row"]')).toHaveCount(2);
    await expect(
      pane.locator('[data-testid="trending-row"]').first(),
    ).toContainText("gardening");
  });

  test("navigates to search when a trending topic is clicked", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="trending-row"]').first().click();

    await expect(page).toHaveURL(/\/search\?q=gardening/);
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });
  });

  test("is shown on chat routes too", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.locator("#chat-view")).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="trending-pane"]')).toBeVisible();
  });

  test("hides the pane when trends fail to load", async ({ page }) => {
    await page.route("**/xrpc/app.bsky.unspecced.getTrends*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="trending-pane"]')).toHaveCount(0);
  });

  test("stays hidden after being dismissed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="trending-pane"]')).toBeVisible({
      timeout: 10000,
    });

    await page.locator('[data-testid="trending-hide-button"]').click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page.locator('[data-testid="trending-pane"]')).toHaveCount(0);

    await page.reload();
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="trending-pane"]')).toHaveCount(0);

    const sessionState = await page.evaluate(
      (did) => JSON.parse(localStorage.getItem(`session-state:${did}`)),
      userProfile.did,
    );
    expect(sessionState.trendingHidden).toBe(true);
  });

  test("stays visible when another account hid it", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "session-state:did:plc:someoneelse",
        JSON.stringify({ trendingHidden: true }),
      );
    });
    await page.reload();
    await expect(page.locator('[data-testid="trending-pane"]')).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Trending pane when logged out", () => {
  test("always shows, even with a stale hidden preference", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addTrends([createTrend({ topic: "gardening" })]);
    await mockServer.setup(page);

    await page.goto("/");
    await page.evaluate((did) => {
      localStorage.setItem(
        `session-state:${did}`,
        JSON.stringify({ trendingHidden: true }),
      );
      localStorage.setItem(
        "display-preferences",
        JSON.stringify({ trendingHidden: true }),
      );
    }, userProfile.did);
    await page.reload();

    await expect(page.locator('[data-testid="trending-pane"]')).toBeVisible({
      timeout: 10000,
    });
  });
});
