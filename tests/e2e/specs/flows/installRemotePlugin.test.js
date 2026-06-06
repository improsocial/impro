import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

const REMOTE_ID = "remote-themes";
const REGISTRY_ENTRY = {
  id: REMOTE_ID,
  name: "Remote Themes",
  author: "alice",
  repo: "alice/remote-themes",
  description: "Adds extra themes",
};

test.describe("Remote plugin install flow", () => {
  test("installing from community view enables the plugin on the plugins view", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    // Open the plugin's detail page from the community view, then install.
    await page.goto("/settings/plugins/community");
    const community = page.locator("#settings-community-plugins-view");
    const installItem = community.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(installItem).toBeVisible({ timeout: 10000 });
    await installItem.locator(".plugin-list-item-link").click();

    const listing = page.locator("#settings-community-plugin-listing-view");
    const installButton = listing.locator(
      '[data-testid="plugin-listing-install-button"]',
    );
    await expect(installButton).toHaveText("Install", { timeout: 10000 });
    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await installButton.click();
    await putPrefs;

    // Navigate back to the plugins list; the installed plugin should appear.
    await page.goto("/settings/plugins");
    const plugins = page.locator("#settings-plugins-view");
    const remoteItem = plugins.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(remoteItem).toBeVisible({ timeout: 10000 });
    await expect(remoteItem.locator(".plugin-toggle")).toHaveAttribute(
      "checked",
      "",
    );
  });
});
