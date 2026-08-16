import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  TEST_PLUGIN_ID,
  TEST_PLUGIN_NAME,
  TEST_PLUGIN_DEFAULTS,
  TEST_PLUGIN_MANIFEST,
  TAB_LOAD_ERROR_MESSAGE,
  PLUGIN_LOAD_FAILURE_MESSAGE,
  getThrowingTabPluginSource,
  getFailingPluginSource,
  getNoSettingsPluginSource,
  getTestPluginSource,
  getFetchPermissionPluginSource,
  REQUESTED_FETCH_ORIGIN,
} from "../../testPlugins.js";

const PLUGIN_ID = TEST_PLUGIN_ID;

function seedEnabled(mockServer) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];
}

async function gotoDetailView(page) {
  await page.goto(`/plugin/${PLUGIN_ID}/settings`);
  const view = page.locator("#plugin-settings-view");
  await expect(view.locator(".setting-item").first()).toBeVisible({
    timeout: 10000,
  });
  return view;
}

test.describe("Plugin settings view", () => {
  test("renders the header with the plugin name", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      TEST_PLUGIN_NAME,
    );
  });

  test("renders all four setting controls", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const settings = view.locator(".setting-item");
    await expect(settings).toHaveCount(4);

    await expect(
      settings.filter({ hasText: "Greeting" }).locator("input[type=text]"),
    ).toBeVisible();
    await expect(
      settings.filter({ hasText: "Loud mode" }).locator("toggle-switch"),
    ).toBeVisible();
    await expect(
      settings.filter({ hasText: "Theme" }).locator("select"),
    ).toBeVisible();
    await expect(
      settings.filter({ hasText: "Reset settings" }).locator("button"),
    ).toBeVisible();
  });

  // The plugin-content typography defaults inset headings and prose, which
  // would double up on setting rows — those carry their own padding.
  test("does not inset the name and description inside a setting row", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const row = view.locator(".setting-item").first();
    await expect(row).toHaveCSS("padding", "16px");
    await expect(row.locator(".setting-item-name")).toHaveCSS("padding", "0px");
    await expect(row.locator(".setting-item-desc")).toHaveCSS("padding", "0px");
  });

  test("hydrates controls from stored preferences", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.pluginSettings.set(PLUGIN_ID, {
      greeting: "Bonjour",
      loud: true,
      theme: "dark",
    });
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const settings = view.locator(".setting-item");

    await expect(
      settings.filter({ hasText: "Greeting" }).locator("input[type=text]"),
    ).toHaveValue("Bonjour");
    await expect(
      settings.filter({ hasText: "Loud mode" }).locator("toggle-switch"),
    ).toHaveAttribute("checked", "");
    await expect(
      settings.filter({ hasText: "Theme" }).locator("select"),
    ).toHaveValue("dark");
  });

  test("persists a text change to preferences", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const greetingInput = view
      .locator(".setting-item")
      .filter({ hasText: "Greeting" })
      .locator("input[type=text]");

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await greetingInput.fill("Howdy");
    await greetingInput.dispatchEvent("change");
    await putPrefs;

    await expect
      .poll(() => mockServer.pluginSettings.get(PLUGIN_ID))
      .toMatchObject({ greeting: "Howdy" });
  });

  test("persists a toggle change to preferences", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const toggle = view
      .locator(".setting-item")
      .filter({ hasText: "Loud mode" })
      .locator("toggle-switch");

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await toggle.click();
    await putPrefs;

    await expect
      .poll(() => mockServer.pluginSettings.get(PLUGIN_ID))
      .toMatchObject({ loud: true });
  });

  test("persists a dropdown change to preferences", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const dropdown = view
      .locator(".setting-item")
      .filter({ hasText: "Theme" })
      .locator("select");

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await dropdown.selectOption("dark");
    await putPrefs;

    await expect
      .poll(() => mockServer.pluginSettings.get(PLUGIN_ID))
      .toMatchObject({ theme: "dark" });
  });

  test("reset button restores defaults", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.pluginSettings.set(PLUGIN_ID, {
      greeting: "Bonjour",
      loud: true,
      theme: "dark",
    });
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    const view = await gotoDetailView(page);
    const greetingInput = view
      .locator(".setting-item")
      .filter({ hasText: "Greeting" })
      .locator("input[type=text]");
    await expect(greetingInput).toHaveValue("Bonjour");
    // Typing sets the input's dirty-value flag, after which it ignores its
    // value attribute — so only a real remount can restore the default
    await greetingInput.fill("Hola");
    await greetingInput.dispatchEvent("change");
    const resetButton = view
      .locator(".setting-item")
      .filter({ hasText: "Reset settings" })
      .locator("button");

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await resetButton.click();
    await putPrefs;

    await expect
      .poll(() => mockServer.pluginSettings.get(PLUGIN_ID))
      .toMatchObject(TEST_PLUGIN_DEFAULTS);
    // The plugin's refresh({reset:true}) has to remount the tab: patching only
    // sets attributes, which a live input ignores
    await expect(greetingInput).toHaveValue(TEST_PLUGIN_DEFAULTS.greeting);
  });

  test("surfaces an error when the setting tab fails to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getThrowingTabPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    await page.goto(`/plugin/${PLUGIN_ID}/settings`);
    const view = page.locator("#plugin-settings-view");
    const error = view.locator('[data-testid="plugin-content-error"]');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toContainText(TAB_LOAD_ERROR_MESSAGE);
    // The view must settle on the error, not spin forever.
    await expect(view.locator(".plugins-loading-state")).toHaveCount(0);
  });

  // The view stays cached in the DOM while the user navigates away, so a
  // reload has to re-invoke display() rather than keep the tree it captured
  // from the previous registration.
  test("re-renders the tab after the plugin is reloaded", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    // One real page load; everything after is SPA navigation, so the settings
    // view is restored from cache rather than rebuilt.
    await page.goto("/plugins/installed");
    await expect(page.locator("#installed-plugins-view")).toBeVisible({
      timeout: 10000,
    });
    const settingsLink = page
      .locator(`[href="/plugin/${PLUGIN_ID}/settings"]`)
      .first();
    await settingsLink.click();
    const view = page.locator("#plugin-settings-view");
    const firstSetting = view.locator(".setting-item").first();
    await expect(firstSetting).toContainText("Greeting", { timeout: 10000 });

    mockServer.localPluginSource = getTestPluginSource().replace(
      '.setName("Greeting")',
      '.setName("Reloaded")',
    );
    await page.goBack();
    await expect(page.locator("#installed-plugins-view")).toBeVisible({
      timeout: 10000,
    });
    await page.locator(".plugin-reload-button").click();
    await settingsLink.click();

    await expect(firstSetting).toContainText("Reloaded", { timeout: 10000 });
  });

  test("surfaces the reason a plugin failed to load", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getFailingPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    await page.goto(`/plugin/${PLUGIN_ID}/settings`);
    const view = page.locator("#plugin-settings-view");
    const failure = view.locator('[data-testid="plugin-detail-load-failed"]');
    await expect(failure).toBeVisible({ timeout: 10000 });
    await expect(failure).toContainText(PLUGIN_LOAD_FAILURE_MESSAGE);
    // A failed load must not read as "this plugin has no settings"
    await expect(
      view.locator('[data-testid="plugin-detail-no-settings"]'),
    ).toHaveCount(0);
  });

  test("shows a not-found message for an uninstalled plugin", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    // No installed plugins seeded.

    await page.goto("/plugin/does-not-exist__LOCAL/settings");
    const view = page.locator("#plugin-settings-view");
    await expect(
      view.locator('[data-testid="plugin-detail-not-found"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows a disabled message for an installed but disabled plugin", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: false }];

    await page.goto(`/plugin/${PLUGIN_ID}/settings`);
    const view = page.locator("#plugin-settings-view");
    await expect(
      view.locator('[data-testid="plugin-detail-disabled"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows a no-settings message for a plugin without a setting tab", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.localPluginSource = getNoSettingsPluginSource();
    await mockServer.setup(page);
    await login(page);
    seedEnabled(mockServer);

    await page.goto(`/plugin/${PLUGIN_ID}/settings`);
    const view = page.locator("#plugin-settings-view");
    await expect(
      view.locator('[data-testid="plugin-detail-no-settings"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe("User-granted fetch origins", () => {
    function seedPromptingPlugin(mockServer) {
      mockServer.installedPlugins = [
        {
          ...TEST_PLUGIN_MANIFEST,
          enabled: true,
          permissions: { userFetch: true },
        },
      ];
    }

    test("grants an origin from the prompt and lists it in settings", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.localPluginSource = getFetchPermissionPluginSource();
      await mockServer.setup(page);
      await login(page);
      seedPromptingPlugin(mockServer);

      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await expect(
        page.locator('[data-testid="fetch-permission-prompt"]'),
      ).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="modal-confirm-button"]').click();

      const networkAccess = page.locator(
        '[data-testid="plugin-network-access"]',
      );
      await expect(networkAccess).toBeVisible({ timeout: 10000 });
      await expect(networkAccess).toContainText(REQUESTED_FETCH_ORIGIN);
    });

    test("revoking removes the origin", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.localPluginSource = getFetchPermissionPluginSource();
      await mockServer.setup(page);
      await login(page);
      seedPromptingPlugin(mockServer);

      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await page
        .locator('[data-testid="modal-confirm-button"]')
        .click({ timeout: 10000 });
      const networkAccess = page.locator(
        '[data-testid="plugin-network-access"]',
      );
      await expect(networkAccess).toBeVisible({ timeout: 10000 });

      await networkAccess
        .locator('[data-testid="revoke-fetch-origin"]')
        .click();
      await expect(networkAccess).toBeHidden({ timeout: 10000 });
    });

    test("renders plugin-owned and system-owned settings as separate sections", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.localPluginSource = getTestPluginSource();
      await mockServer.setup(page);
      await login(page);
      mockServer.installedPlugins = [
        {
          ...TEST_PLUGIN_MANIFEST,
          enabled: true,
          permissions: { userFetch: true },
          userGrantedFetchOrigins: [REQUESTED_FETCH_ORIGIN],
        },
      ];

      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await expect(
        page.locator('[data-testid="plugin-owned-settings"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.locator('[data-testid="plugin-system-settings"]'),
      ).toBeVisible();
    });

    test("omits the system section when nothing is granted", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.localPluginSource = getTestPluginSource();
      await mockServer.setup(page);
      await login(page);
      seedEnabled(mockServer);

      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await expect(
        page.locator('[data-testid="plugin-owned-settings"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.locator('[data-testid="plugin-system-settings"]'),
      ).toBeHidden();
    });

    test("declining leaves nothing granted", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.localPluginSource = getFetchPermissionPluginSource();
      await mockServer.setup(page);
      await login(page);
      seedPromptingPlugin(mockServer);

      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await page
        .locator('[data-testid="modal-cancel-button"]')
        .click({ timeout: 10000 });
      await expect(
        page.locator('[data-testid="plugin-network-access"]'),
      ).toBeHidden();
    });
  });

  test.describe("Logged-out behavior", () => {
    test("redirects to /login when not authenticated", async ({ page }) => {
      await page.goto(`/plugin/${PLUGIN_ID}/settings`);
      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
