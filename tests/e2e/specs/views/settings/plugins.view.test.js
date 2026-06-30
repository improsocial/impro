import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { TEST_PLUGIN_ID, TEST_PLUGIN_MANIFEST } from "../../../testPlugin.js";

function seedInstalled(mockServer) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: false }];
}

const REMOTE_ID = "remote-themes";
const REMOTE_REGISTRY_ENTRY = {
  id: REMOTE_ID,
  name: "Remote Themes",
  author: "alice",
  repo: "alice/remote-themes",
  description: "Adds extra themes",
};

function seedRemoteInstalled(mockServer, { installedVersion, liveVersion }) {
  mockServer.registryEntries = [REMOTE_REGISTRY_ENTRY];
  mockServer.installedPlugins = [
    {
      id: REMOTE_ID,
      name: REMOTE_REGISTRY_ENTRY.name,
      author: REMOTE_REGISTRY_ENTRY.author,
      description: REMOTE_REGISTRY_ENTRY.description,
      repo: REMOTE_REGISTRY_ENTRY.repo,
      version: installedVersion,
      enabled: false,
    },
  ];
  mockServer.liveManifest = {
    id: REMOTE_ID,
    name: REMOTE_REGISTRY_ENTRY.name,
    version: liveVersion,
  };
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

    const dialog = page.locator("dialog.confirm-modal");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".modal-dialog-title")).toContainText(
      "Uninstall plugin?",
    );
    await dialog.locator(".confirm-button").click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
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

    const dialog = page.locator("dialog.confirm-modal");
    await dialog.locator(".cancel-button").click();

    await expect(sampleItem).toBeVisible();
    await expect(page.locator(".plugin-list-item")).toHaveCount(1);
  });

  test("check for updates shows toast and no Update button when up to date", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    seedRemoteInstalled(mockServer, {
      installedVersion: "1.0.0",
      liveVersion: "1.0.0",
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const view = page.locator("#settings-plugins-view");
    const headerButton = view.locator(".plugin-check-updates-button");
    await expect(headerButton).toContainText("Check for updates", {
      timeout: 10000,
    });
    await headerButton.click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect(headerButton).toContainText("Check for updates");
    await expect(view.locator(".plugin-update-button")).toHaveCount(0);
  });

  test("check for updates surfaces per-plugin Update button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    seedRemoteInstalled(mockServer, {
      installedVersion: "1.0.0",
      liveVersion: "1.0.1",
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const view = page.locator("#settings-plugins-view");
    const headerButton = view.locator(".plugin-check-updates-button");
    await expect(headerButton).toContainText("Check for updates", {
      timeout: 10000,
    });
    await headerButton.click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "1 update available",
    );
    await expect(headerButton).toContainText("Update all");

    const sampleItem = view.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    const updateButton = sampleItem.locator(".plugin-update-button");
    await expect(updateButton).toBeVisible();
    await updateButton.click();

    await expect(page.locator('[data-testid="toast"]').last()).toContainText(
      "Updated Remote Themes to v1.0.1",
    );
    await expect(sampleItem.locator(".plugin-update-button")).toHaveCount(0);
    await expect(headerButton).toContainText("Check for updates");
  });

  test("Update all updates every outdated plugin", async ({ page }) => {
    const mockServer = new MockServer();
    seedRemoteInstalled(mockServer, {
      installedVersion: "1.0.0",
      liveVersion: "1.0.1",
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/plugins");

    const view = page.locator("#settings-plugins-view");
    const headerButton = view.locator(".plugin-check-updates-button");
    await expect(headerButton).toContainText("Check for updates", {
      timeout: 10000,
    });
    await headerButton.click();
    await expect(headerButton).toContainText("Update all");

    await headerButton.click();

    await expect(page.locator('[data-testid="toast"]').last()).toContainText(
      "Updated 1 plugin",
    );
    await expect(view.locator(".plugin-update-button")).toHaveCount(0);
    await expect(headerButton).toContainText("Check for updates");
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

    await expect(page).toHaveURL(`/settings/plugins/${TEST_PLUGIN_ID}`, {
      timeout: 10000,
    });
  });
});
