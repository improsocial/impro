import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  TEST_PLUGIN_ID,
  TEST_PLUGIN_NAME,
  TEST_PLUGIN_MANIFEST,
  PAGE_TITLE,
  PAGE_LOAD_ERROR_MESSAGE,
  PLUGIN_LOAD_FAILURE_MESSAGE,
  getPagesPluginSource,
  getThrowingPagePluginSource,
  getFailingPluginSource,
  getNoSettingsPluginSource,
} from "../../testPlugins.js";

const PLUGIN_ID = TEST_PLUGIN_ID;

function seedEnabled(mockServer) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];
}

async function gotoPage(page, pageId = "dashboard") {
  await page.goto(`/plugin/${PLUGIN_ID}/pages/${pageId}`);
  return page.locator("#plugin-page-view");
}

test.describe("Plugin page view", () => {
  test("renders a runtime-registered page and its title", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    await expect(
      view.locator('[data-testid="plugin-page-renders"]'),
    ).toHaveText("1", { timeout: 10000 });
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      PAGE_TITLE,
    );
  });

  test("insets the plugin's headings and prose from the viewport edge", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    const prose = view.locator('[data-testid="plugin-page-prose"]');
    await expect(prose).toBeVisible({ timeout: 10000 });
    await expect(prose).toHaveCSS("padding-left", "16px");
    await expect(view.locator("h3")).toHaveCSS("padding", "16px");
    // Lists sit further in so their markers land inside the inset
    const list = view.locator('[data-testid="plugin-page-list"]');
    await expect(list).toHaveCSS("padding-left", "32px");
    await expect(list).toHaveCSS("padding-right", "16px");
  });

  test("renders each of a plugin's pages at its own URL", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page, "feed-alpha");
    await expect(view.locator('[data-testid="plugin-page-feed"]')).toHaveText(
      "alpha",
      { timeout: 10000 },
    );

    await page.goto(`/plugin/${PLUGIN_ID}/pages/feed-beta`);
    await expect(view.locator('[data-testid="plugin-page-feed"]')).toHaveText(
      "beta",
      { timeout: 10000 },
    );
  });

  test("re-invokes display when the plugin calls refreshPage", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getPagesPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    const renders = view.locator('[data-testid="plugin-page-renders"]');
    await expect(renders).toHaveText("1", { timeout: 10000 });
    await view.locator('[data-testid="plugin-page-refresh"]').click();
    await expect(renders).toHaveText("2");
  });

  test("shows a not-found message for an uninstalled plugin", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);

    const view = await gotoPage(page);
    await expect(
      view.locator('[data-testid="plugin-page-not-found"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows a disabled message for an installed but disabled plugin", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: false }];

    const view = await gotoPage(page);
    await expect(
      view.locator('[data-testid="plugin-page-disabled"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows a not-found message once a loaded plugin has no such page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getNoSettingsPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    await expect(
      view.locator('[data-testid="plugin-page-unknown"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("surfaces the reason a plugin failed to load", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getFailingPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    const failure = view.locator('[data-testid="plugin-page-load-failed"]');
    await expect(failure).toBeVisible({ timeout: 10000 });
    await expect(failure).toContainText(PLUGIN_LOAD_FAILURE_MESSAGE);
  });

  test("surfaces an error thrown by the page's display callback", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getThrowingPagePluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    const error = view.locator('[data-testid="plugin-content-error"]');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toContainText(PAGE_LOAD_ERROR_MESSAGE);
  });

  test("falls back to the plugin name in the header before the page loads", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getNoSettingsPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoPage(page);
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      TEST_PLUGIN_NAME,
      { timeout: 10000 },
    );
  });
});
