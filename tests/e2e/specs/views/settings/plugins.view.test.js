import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

test.describe("Settings plugins view", () => {
  test("lists available plugins with manifest info", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const view = page.locator("#settings-plugins-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Plugins",
      { timeout: 10000 },
    );

    const items = view.locator(".plugin-list-item");
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    await expect(items).toHaveCount(1);
    await expect(items.first().locator(".plugin-list-item-name")).toContainText(
      "Test Plugin",
    );
  });

  test("enabling a plugin shows the Settings link", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const sampleItem = page.locator(".plugin-list-item", {
      hasText: "Test Plugin",
    });
    await expect(sampleItem).toBeVisible({ timeout: 10000 });
    await expect(sampleItem.locator(".plugin-settings-link")).toHaveCount(0);

    await sampleItem.locator(".plugin-toggle").click();

    await expect(sampleItem.locator(".plugin-settings-link")).toBeVisible({
      timeout: 10000,
    });
  });

  test("enabling a plugin via toggle navigates to settings link", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const sampleItem = page.locator(".plugin-list-item", {
      hasText: "Test Plugin",
    });
    await expect(sampleItem).toBeVisible({ timeout: 10000 });
    await sampleItem.locator(".plugin-toggle").click();
    await sampleItem.locator(".plugin-settings-link").click();

    await expect(page).toHaveURL("/settings/plugins/test-plugin", {
      timeout: 10000,
    });
  });
});
