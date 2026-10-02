import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

test.describe("Settings Content and media view", () => {
  test("should display header and all settings sections", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/content-and-media");

    const view = page.locator("#settings-content-and-media-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="settings-section-autoplay"]'),
    ).toBeVisible();
    await expect(
      view.locator('[data-testid="settings-section-trending"]'),
    ).toBeVisible();
  });

  test("should enable autoplay by default", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/content-and-media");

    const view = page.locator("#settings-content-and-media-view");
    await expect(
      view.locator('[data-testid="autoplay-toggle"]'),
    ).toHaveAttribute("checked", "", { timeout: 10000 });
  });

  test("should keep autoplay disabled after a reload", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/content-and-media");

    const view = page.locator("#settings-content-and-media-view");
    const toggle = view.locator('[data-testid="autoplay-toggle"]');
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("checked");

    await page.reload();
    await expect(
      page.locator(
        '#settings-content-and-media-view [data-testid="autoplay-toggle"]',
      ),
    ).not.toHaveAttribute("checked", { timeout: 10000 });
  });

  test("should keep trending topics hidden after a reload", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/content-and-media");

    const view = page.locator("#settings-content-and-media-view");
    const toggle = view.locator('[data-testid="trending-toggle"]');
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("checked");

    await page.reload();
    await expect(
      page.locator(
        '#settings-content-and-media-view [data-testid="trending-toggle"]',
      ),
    ).not.toHaveAttribute("checked", { timeout: 10000 });
  });
});
