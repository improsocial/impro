import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Persistent layout navigation", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
  });

  test("keeps a single layout whose active nav item follows navigation, including the not-found page", async ({
    page,
  }) => {
    const layoutRoot = page.locator("#main-layout");
    const homeNavItem = page.locator('[data-testid="sidebar-nav-home"]');
    const notificationsNavItem = page.locator(
      '[data-testid="sidebar-nav-notifications"]',
    );
    const settingsNavItem = page.locator(
      '[data-testid="sidebar-nav-settings"]',
    );

    // The chrome testids are singletons in the persistent layout
    await expect(homeNavItem).toHaveCount(1);
    await expect(layoutRoot).toBeVisible();

    // Home is active on "/" (active nav items render a filled icon)
    await expect(homeNavItem.locator(".icon.filled")).toBeVisible();
    await expect(
      notificationsNavItem.locator(".icon.filled"),
    ).not.toBeVisible();

    // Navigate to notifications — the active state moves
    await notificationsNavItem.click();
    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(notificationsNavItem.locator(".icon.filled")).toBeVisible();
    await expect(homeNavItem.locator(".icon.filled")).not.toBeVisible();

    // Navigate to settings — the active state moves again
    await settingsNavItem.click();
    await expect(page.locator("#settings-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(settingsNavItem.locator(".icon.filled")).toBeVisible();
    await expect(
      notificationsNavItem.locator(".icon.filled"),
    ).not.toBeVisible();

    // The not-found page keeps the layout, with no active nav item
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator("#not-found-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(layoutRoot).toBeVisible();
    await expect(layoutRoot.locator(".icon.filled")).not.toBeVisible();

    // Returning to a layout route restores the active nav item
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await expect(layoutRoot).toBeVisible();
    await expect(homeNavItem.locator(".icon.filled")).toBeVisible();
  });
});
