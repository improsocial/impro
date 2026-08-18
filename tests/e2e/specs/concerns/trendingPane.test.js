import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createTrend } from "../../../shared/factories.js";

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

  test("shows an error state and recovers on retry", async ({ page }) => {
    let shouldFail = true;
    await page.route("**/xrpc/app.bsky.unspecced.getTrends*", (route) => {
      if (shouldFail) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "InternalServerError" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trends: [createTrend({ topic: "gardening" })],
        }),
      });
    });

    await page.goto("/");
    const pane = page.locator('[data-testid="trending-pane"]');
    await expect(pane.locator('[data-testid="trending-error"]')).toBeVisible({
      timeout: 10000,
    });

    shouldFail = false;
    await pane.locator('[data-testid="trending-error"] button').click();

    await expect(pane.locator('[data-testid="trending-row"]')).toHaveCount(1);
    await expect(pane.locator('[data-testid="trending-error"]')).toHaveCount(0);
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
  });
});
