import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Sidebar navigation flow", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to Search when clicking Search", async ({ page }) => {
    await page.locator('[data-testid="sidebar-nav-search"]').click();

    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/search/);
  });

  test("should navigate to Notifications when clicking Notifications", async ({
    page,
  }) => {
    await page.locator('[data-testid="sidebar-nav-notifications"]').click();

    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("should navigate to Chat when clicking Chat", async ({ page }) => {
    await page.locator('[data-testid="sidebar-nav-chat"]').click();

    await expect(page.locator("#chat-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/messages/);
  });

  test("should navigate to Feeds when clicking Feeds", async ({ page }) => {
    await page.locator('[data-testid="sidebar-nav-feeds"]').click();

    await expect(page.locator("#feeds-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/feeds/);
  });

  test("should navigate to Bookmarks when clicking Saved", async ({ page }) => {
    await page.locator('[data-testid="sidebar-nav-bookmarks"]').click();

    await expect(page.locator("#bookmarks-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/bookmarks/);
  });

  test("should navigate to Profile when clicking Profile", async ({ page }) => {
    await page.locator('[data-testid="sidebar-nav-profile"]').click();

    await expect(page.locator("#profile-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/profile\//);
  });

  test("should navigate to Settings when clicking Settings", async ({
    page,
  }) => {
    await page.locator('[data-testid="sidebar-nav-settings"]').click();

    await expect(page.locator("#settings-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/settings/);
  });

  test("should navigate back to Home when clicking Home from another view", async ({
    page,
  }) => {
    await page.locator('[data-testid="sidebar-nav-search"]').click();
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });

    await page.locator('#search-view [data-testid="sidebar-nav-home"]').click();

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL("/");
  });
});
