import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  TEST_PLUGIN_ID,
  TEST_PLUGIN_MANIFEST,
  MODAL_TITLE,
  getPagesPluginSource,
} from "../../testPlugins.js";

// Plugin-authored markup shares one set of typography defaults across every
// surface, but only full-page surfaces inset it — a modal supplies its own
// padding. List markers are the exception: they need room everywhere, since
// the global reset drops the UA list padding.
test.describe("Plugin content styling", () => {
  test("insets prose on a page but not inside a modal", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];

    await page.goto(`/plugin/${TEST_PLUGIN_ID}/pages/dashboard`);
    const pageProse = page.locator('[data-testid="plugin-page-prose"]');
    await expect(pageProse).toBeVisible({ timeout: 10000 });
    await expect(pageProse).toHaveCSS("padding-left", "16px");
    await expect(page.locator('[data-testid="plugin-page-list"]')).toHaveCSS(
      "padding-left",
      "32px",
    );

    await page
      .locator(`[data-testid="sidebar-plugin-item"][title="${MODAL_TITLE}"]`)
      .click();
    const modalProse = page.locator('[data-testid="plugin-modal-prose"]');
    await expect(modalProse).toBeVisible({ timeout: 10000 });
    await expect(modalProse).toHaveCSS("padding-left", "0px");
    // Markers still need their own room inside the modal's padding
    await expect(page.locator('[data-testid="plugin-modal-list"]')).toHaveCSS(
      "padding-left",
      "16px",
    );
  });
});
