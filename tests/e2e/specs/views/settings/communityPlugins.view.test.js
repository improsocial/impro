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
  });

  test("installing a plugin flips the button to Uninstall", async ({
    page,
  }) => {
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
    await expect(item.locator(".plugin-install-button")).toHaveText("Install");

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await item.locator(".plugin-install-button").click();
    await putPrefs;

    await expect(item.locator(".plugin-install-button")).toHaveText(
      "Uninstall",
      { timeout: 10000 },
    );
    await expect(mockServer.installedPlugins.map((p) => p.id)).toEqual([
      REMOTE_ID,
    ]);
  });

  test("uninstalling flips the button back to Install", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.installedPlugins = [
      { id: REMOTE_ID, version: "1.0.0", enabled: true },
    ];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/settings/plugins/community");
    const view = page.locator("#settings-community-plugins-view");
    const item = view.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(item.locator(".plugin-install-button")).toHaveText(
      "Uninstall",
      { timeout: 10000 },
    );

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await item.locator(".plugin-install-button").click();
    await putPrefs;

    await expect(item.locator(".plugin-install-button")).toHaveText("Install", {
      timeout: 10000,
    });
    await expect(mockServer.installedPlugins).toEqual([]);
  });
});
