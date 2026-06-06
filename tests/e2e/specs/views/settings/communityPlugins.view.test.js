import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

const REMOTE_ID = "remote-themes";
const REGISTRY_ENTRY = {
  id: REMOTE_ID,
  name: "Remote Themes",
  author: "alice",
  repo: "alice/remote-themes",
  description: "Adds extra themes",
};

test.describe("Settings community plugins view", () => {
  test("lists every registry plugin (local and remote)", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/settings/plugins/community");
    const view = page.locator("#settings-community-plugins-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Community plugins",
      { timeout: 10000 },
    );

    const items = view.locator(".plugin-list-item");
    await expect(items).toHaveCount(2);
    await expect(
      view.locator(".plugin-list-item", { hasText: "Remote Themes" }),
    ).toBeVisible();
    await expect(
      view.locator(".plugin-list-item", { hasText: "Test Plugin" }),
    ).toBeVisible();

    // Install/uninstall interactions now live on the detail page, not here.
    await expect(view.locator(".plugin-install-button")).toHaveCount(0);
  });

  test("shows an installed badge for installed plugins", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.installedPlugins = [
      { id: REMOTE_ID, version: "1.0.0", enabled: true },
    ];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/settings/plugins/community");
    const view = page.locator("#settings-community-plugins-view");
    const installedItem = view.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(
      installedItem.locator('[data-testid="plugin-installed-badge"]'),
    ).toBeVisible({ timeout: 10000 });

    // The (not installed) local test plugin should have no badge.
    const otherItem = view.locator(".plugin-list-item", {
      hasText: "Test Plugin",
    });
    await expect(
      otherItem.locator('[data-testid="plugin-installed-badge"]'),
    ).toHaveCount(0);
  });

  test("clicking a plugin opens its detail page", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/settings/plugins/community");
    const view = page.locator("#settings-community-plugins-view");
    const item = view.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(item).toBeVisible({ timeout: 10000 });

    await item.locator(".plugin-list-item-link").click();

    await expect(page).toHaveURL(
      new RegExp(`/settings/plugins/community/${REMOTE_ID}$`),
    );
    const detail = page.locator("#settings-community-plugin-listing-view");
    await expect(
      detail.locator('[data-testid="plugin-listing-name"]'),
    ).toHaveText("Remote Themes", { timeout: 10000 });
  });
});
