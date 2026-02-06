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
    await expect(nav.locator(".vertical-nav-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(nav.locator(".vertical-nav-label")).toContainText(
      "Appearance",
    );
  });

  test("should navigate to appearance settings when clicking Appearance", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator(".vertical-nav-label")).toContainText(
      "Appearance",
      { timeout: 10000 },
    );

    await view.locator(".vertical-nav-item", { hasText: "Appearance" }).click();

    await expect(page).toHaveURL("/settings/appearance", { timeout: 10000 });
  });

  test("should display Sign out button", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator(".danger-button")).toContainText("Sign out", {
      timeout: 10000,
    });
  });

  test("should display version info", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    await expect(view.locator(".version-info")).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".version-info")).toContainText("Impro v");
  });

  test("should display footer links", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings");

    const view = page.locator("#settings-view");
    const footer = view.locator(".settings-footer-links");
    await expect(footer).toBeVisible({ timeout: 10000 });
    await expect(footer).toContainText("Terms");
    await expect(footer).toContainText("Privacy Policy");
    await expect(footer).toContainText("GitHub");
  });
});
