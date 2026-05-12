import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { TEST_PLUGIN_ID } from "../../../testPlugin.js";

function seedInstalled(mockServer) {
  mockServer.installedPlugins = [
    { id: TEST_PLUGIN_ID, version: "1.0.0", enabled: false },
  ];
}

test.describe("Settings plugins view", () => {
  test("lists installed plugins with manifest info", async ({ page }) => {
    const mockServer = new MockServer();
    seedInstalled(mockServer);
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

  test("shows empty state when no plugins are installed", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const view = page.locator("#settings-plugins-view");
    await expect(view.locator(".plugins-empty-state")).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".plugin-list-item")).toHaveCount(0);
  });

  test("enabling a plugin shows the Settings link", async ({ page }) => {
    const mockServer = new MockServer();
    seedInstalled(mockServer);
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

  test("uninstall button removes the plugin after confirmation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    seedInstalled(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const sampleItem = page.locator(".plugin-list-item", {
      hasText: "Test Plugin",
    });
    await expect(sampleItem).toBeVisible({ timeout: 10000 });

    await sampleItem.locator(".plugin-uninstall-button").click();

    const dialog = page.locator("dialog.modal-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".modal-dialog-title")).toContainText(
      "Uninstall plugin?",
    );
    await dialog.locator(".confirm-button").click();

    await expect(page.locator(".toast")).toContainText("Uninstalled");
    await expect(page.locator(".plugin-list-item")).toHaveCount(0);
    await expect(page.locator(".plugins-empty-state")).toBeVisible();
  });

  test("uninstall button does nothing when cancelled", async ({ page }) => {
    const mockServer = new MockServer();
    seedInstalled(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const sampleItem = page.locator(".plugin-list-item", {
      hasText: "Test Plugin",
    });
    await expect(sampleItem).toBeVisible({ timeout: 10000 });
    await sampleItem.locator(".plugin-uninstall-button").click();

    const dialog = page.locator("dialog.modal-dialog");
    await dialog.locator(".cancel-button").click();

    await expect(sampleItem).toBeVisible();
    await expect(page.locator(".plugin-list-item")).toHaveCount(1);
  });

  test("enabling a plugin via toggle navigates to settings link", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    seedInstalled(mockServer);
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
