import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

const PLUGIN_ID = "unregistered-themes";
const PLUGIN_NAME = "Unregistered Themes";
const REPO_URL = "https://github.com/alice/unregistered-themes";

test.describe("Unregistered plugin install flow", () => {
  test("installing from advanced settings shows the plugin on the plugins view", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [];
    mockServer.liveManifest = {
      id: PLUGIN_ID,
      name: PLUGIN_NAME,
      version: "1.0.0",
      author: "alice",
      description: "Adds extra themes",
    };
    await mockServer.setup(page);
    // The shared versioned-manifest route falls back to "remote-plugin" when
    // the registry is empty; override it so the load step gets a manifest
    // whose id matches what we installed.
    await page.route(
      "**/raw.githubusercontent.com/alice/unregistered-themes/1.0.0/manifest.json",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockServer.liveManifest),
        }),
    );
    await login(page);

    await page.goto("/settings/advanced");
    const urlInput = page.locator(
      '[data-testid="install-unregistered-plugin-input"]',
    );
    await expect(urlInput).toBeVisible();
    await urlInput.fill(REPO_URL);

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await page
      .locator('[data-testid="install-unregistered-plugin-submit"]')
      .click();
    await putPrefs;
    await expect(page.locator('[data-testid="toast"]')).toContainText(
      `Installed ${PLUGIN_NAME}`,
    );

    await page.goto("/settings/plugins");
    const plugins = page.locator("#settings-plugins-view");
    const item = plugins.locator(".plugin-list-item", { hasText: PLUGIN_NAME });
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".plugin-toggle")).toHaveAttribute("checked", "");
  });
});
