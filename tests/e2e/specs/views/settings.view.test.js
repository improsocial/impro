import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Settings view", () => {
  test("should display header and Appearance menu item", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Settings",
      { timeout: 10000 },
    );

    const nav = view.locator(".vertical-nav");
    await expect(nav.locator(".vertical-nav-item")).toHaveCount(7, {
      timeout: 10000,
    });
    await expect(
      nav.locator('[data-testid="settings-nav-appearance"]'),
    ).toBeVisible();
    await expect(
      nav.locator('[data-testid="settings-nav-muted-words"]'),
    ).toBeVisible();
    await expect(
      nav.locator('[data-testid="settings-nav-muted-accounts"]'),
    ).toBeVisible();
    await expect(
      nav.locator('[data-testid="settings-nav-blocked-accounts"]'),
    ).toBeVisible();
    await expect(
      nav.locator('[data-testid="settings-nav-plugins"]'),
    ).toBeVisible();
    await expect(
      nav.locator('[data-testid="settings-nav-advanced"]'),
    ).toBeVisible();
  });

  test("should navigate to blocked accounts settings", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await view.locator('[data-testid="settings-nav-blocked-accounts"]').click();

    await expect(page).toHaveURL("/settings/blocked-accounts", {
      timeout: 10000,
    });
  });

  test("should navigate to appearance settings when clicking Appearance", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(
      view.locator('[data-testid="settings-nav-appearance"]'),
    ).toBeVisible({ timeout: 10000 });

    await view.locator('[data-testid="settings-nav-appearance"]').click();

    await expect(page).toHaveURL("/settings/appearance", { timeout: 10000 });
  });

  test("should display Sign out button", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator('[data-testid="settings-sign-out"]')).toBeVisible(
      { timeout: 10000 },
    );
  });

  test("should display version info", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator('[data-testid="version-info"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display footer links", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator('[data-testid="footer-link-terms"]')).toBeVisible(
      { timeout: 10000 },
    );
    await expect(
      view.locator('[data-testid="footer-link-privacy"]'),
    ).toBeVisible();
    await expect(
      view.locator('[data-testid="footer-link-github"]'),
    ).toBeVisible();
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/settings");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
