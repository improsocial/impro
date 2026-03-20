import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.use({ viewport: { width: 375, height: 667 } });

test.describe("Footer navigation flow", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to Search when clicking Search", async ({ page }) => {
    await page.locator('[data-testid="footer-nav-search"]').click();

    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/search/);
  });

  test("should navigate to Chat when clicking Chat", async ({ page }) => {
    await page.locator('[data-testid="footer-nav-chat"]').click();

    await expect(page.locator("#chat-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/messages/);
  });

  test("should navigate to Notifications when clicking Notifications", async ({
    page,
  }) => {
    await page.locator('[data-testid="footer-nav-notifications"]').click();

    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("should navigate to Profile when clicking Profile", async ({ page }) => {
    await page.locator('[data-testid="footer-nav-profile"]').click();

    await expect(page.locator("#profile-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/profile\//);
  });

  test("should navigate back to Home when clicking Home from another view", async ({
    page,
  }) => {
    await page.locator('[data-testid="footer-nav-search"]').click();
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });

    await page.locator('#search-view [data-testid="footer-nav-home"]').click();

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL("/");
  });
});
