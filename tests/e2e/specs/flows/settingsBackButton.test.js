import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Settings back button", () => {
  test("should navigate home when coming from a settings detail page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const settingsView = page.locator("#settings-view");
    await expect(
      settingsView.locator('[data-testid="settings-nav-appearance"]'),
    ).toBeVisible({ timeout: 10000 });

    await settingsView
      .locator('[data-testid="settings-nav-appearance"]')
      .click();
    await expect(page).toHaveURL("/settings/appearance", { timeout: 10000 });

    const appearanceView = page.locator("#settings-appearance-view");
    await appearanceView.locator('[data-testid="back-button"]').click();

    await expect(page).toHaveURL("/settings", { timeout: 10000 });

    // Now the back button on the settings index page should go home rather
    // than navigating back into the settings detail page that brought us here.
    await settingsView.locator('[data-testid="back-button"]').click();

    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("should navigate back to the previous non-settings page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search");
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });

    // Navigate via the in-app router so that previousRoute is populated.
    await page.waitForFunction(() => !!window.router);
    await page.evaluate(() => window.router.go("/settings"));

    const settingsView = page.locator("#settings-view");
    await expect(
      settingsView.locator('[data-testid="header-title"]'),
    ).toBeVisible({ timeout: 10000 });

    await settingsView.locator('[data-testid="back-button"]').click();

    await expect(page).toHaveURL("/search", { timeout: 10000 });
  });
});
