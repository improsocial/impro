import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  TEST_PLUGIN_ID,
  TEST_PLUGIN_MANIFEST,
  PAGE_TITLE,
  getPagesPluginSource,
} from "../../testPlugins.js";

test.describe("Plugin page navigation flow", () => {
  test("a plugin's sidebar item opens its page", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];

    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page
      .locator(`[data-testid="sidebar-plugin-item"][title="${PAGE_TITLE}"]`)
      .click();

    const view = page.locator("#plugin-page-view");
    await expect(
      view.locator('[data-testid="plugin-page-renders"]'),
    ).toHaveText("1", { timeout: 10000 });
    await expect(page).toHaveURL(`/plugin/${TEST_PLUGIN_ID}/pages/dashboard`);
  });
});
