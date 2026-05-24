import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import {
  TEST_PLUGIN_ID,
  TEST_PLUGIN_NAME,
  TEST_PLUGIN_DEFAULTS,
  TEST_PLUGIN_MANIFEST,
} from "../../../testPlugin.js";

const PLUGIN_ID = TEST_PLUGIN_ID;

function seedEnabled(mockServer) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];
}

async function gotoDetailView(page) {
  await page.goto(`/settings/plugins/${PLUGIN_ID}`);
  const view = page.locator("#settings-plugin-detail-view");
  await expect(view.locator(".setting-item").first()).toBeVisible({
    timeout: 10000,
  });
  return view;
}

test.describe("Settings plugin detail view", () => {
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
  });

  test.describe("Logged-out behavior", () => {
    test("redirects to /login when not authenticated", async ({ page }) => {
      await page.goto(`/settings/plugins/${PLUGIN_ID}`);
      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
