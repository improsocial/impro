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

function detailUrl(id = REMOTE_ID) {
  return `/settings/plugins/community/${id}`;
}

test.describe("Settings community plugin listing view", () => {
  test("shows the plugin's header info and renders its README", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.pluginReadme = "# Overview\n\nDetailed readme body text.";
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl());
    const view = page.locator("#settings-community-plugin-listing-view");
    await expect(
      view.locator('[data-testid="plugin-listing-name"]'),
    ).toHaveText("Remote Themes", { timeout: 10000 });

    const header = view.locator('[data-testid="plugin-listing-header"]');
    await expect(header).toContainText("Version: 1.0.0");
    await expect(header).toContainText("By alice");
    await expect(header).toContainText("Adds extra themes");
    await expect(header.locator(".plugin-listing-repo a")).toHaveAttribute(
      "href",
      "https://github.com/alice/remote-themes",
    );

    // README markdown is rendered into the component.
    const readme = view.locator('[data-testid="plugin-listing-readme"]');
    await expect(readme.locator("h1")).toHaveText("Overview", {
      timeout: 10000,
    });
    await expect(readme).toContainText("Detailed readme body text.");
  });

  test("omits the README section when the plugin has none", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.pluginReadme = null;
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl());
    const view = page.locator("#settings-community-plugin-listing-view");
    await expect(
      view.locator('[data-testid="plugin-listing-header"]'),
    ).toBeVisible({ timeout: 10000 });

    await expect(view.locator(".plugin-listing-readme")).toHaveCount(0);
    await expect(
      view.locator('[data-testid="plugin-listing-readme"]'),
    ).toHaveCount(0);
  });

  test("installing flips the button to Uninstall", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl());
    const view = page.locator("#settings-community-plugin-listing-view");
    const button = view.locator(
      '[data-testid="plugin-listing-install-button"]',
    );
    await expect(button).toHaveText("Install", { timeout: 10000 });

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await button.click();
    await putPrefs;

    await expect(button).toHaveText("Uninstall", { timeout: 10000 });
    await expect(
      mockServer.installedPlugins.map((plugin) => plugin.id),
    ).toEqual([REMOTE_ID]);
  });

  test("uninstalling flips the button back to Install", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.installedPlugins = [
      { id: REMOTE_ID, version: "1.0.0", enabled: true },
    ];
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl());
    const view = page.locator("#settings-community-plugin-listing-view");
    const button = view.locator(
      '[data-testid="plugin-listing-install-button"]',
    );
    await expect(button).toHaveText("Uninstall", { timeout: 10000 });

    await button.click();
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await confirmButton.click();
    await putPrefs;

    await expect(button).toHaveText("Install", { timeout: 10000 });
    await expect(mockServer.installedPlugins).toEqual([]);
  });

  test("cancelling the uninstall confirm leaves the plugin installed", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.installedPlugins = [
      { id: REMOTE_ID, version: "1.0.0", enabled: true },
    ];
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl());
    const view = page.locator("#settings-community-plugin-listing-view");
    const button = view.locator(
      '[data-testid="plugin-listing-install-button"]',
    );
    await expect(button).toHaveText("Uninstall", { timeout: 10000 });

    await button.click();
    const cancelButton = page.locator("button.cancel-button");
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    await expect(button).toHaveText("Uninstall");
    await expect(
      mockServer.installedPlugins.map((plugin) => plugin.id),
    ).toEqual([REMOTE_ID]);
  });

  test("shows a not-found message for an unknown plugin", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto(detailUrl("does-not-exist"));
    const view = page.locator("#settings-community-plugin-listing-view");
    await expect(
      view.locator('[data-testid="plugin-listing-not-found"]'),
    ).toBeVisible({ timeout: 10000 });
  });
});
