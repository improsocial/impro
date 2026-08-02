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

test.describe("Community plugins view", () => {
  test("lists every registry plugin (local and remote)", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/plugins/community");
    const view = page.locator("#community-plugins-view");
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

  test("marks the Plugins sidebar item as active", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/plugins/community");
    await expect(page.locator("#community-plugins-view")).toBeVisible({
      timeout: 10000,
    });
    const pluginsNavIcon = page.locator(
      '[data-testid="sidebar-nav-plugins"] .icon',
    );
    await expect(pluginsNavIcon).toHaveClass(/filled/);

    await page.goto(`/plugins/community/${REMOTE_ID}`);
    await expect(page.locator("#community-plugin-listing-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(pluginsNavIcon).toHaveClass(/filled/);
  });

  test("clicking the active Plugins nav item returns to installed plugins", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    for (const url of [
      "/plugins/community",
      `/plugins/community/${REMOTE_ID}`,
    ]) {
      await page.goto(url);
      await page.locator('[data-testid="sidebar-nav-plugins"]').click();
      await expect(page.locator("#installed-plugins-view")).toBeVisible({
        timeout: 10000,
      });
      await expect(page).toHaveURL(/\/plugins\/installed/);
    }
  });

  test("shows an installed badge for installed plugins", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    mockServer.installedPlugins = [
      { id: REMOTE_ID, version: "1.0.0", enabled: true },
    ];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/plugins/community");
    const view = page.locator("#community-plugins-view");
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

    await page.goto("/plugins/community");
    const view = page.locator("#community-plugins-view");
    const item = view.locator(".plugin-list-item", {
      hasText: "Remote Themes",
    });
    await expect(item).toBeVisible({ timeout: 10000 });

    await item.locator(".plugin-list-item-link").click();

    await expect(page).toHaveURL(
      new RegExp(`/plugins/community/${REMOTE_ID}$`),
    );
    const detail = page.locator("#community-plugin-listing-view");
    await expect(
      detail.locator('[data-testid="plugin-listing-name"]'),
    ).toHaveText("Remote Themes", { timeout: 10000 });
  });

  test("renders for logged-out users without installed badges", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);

    await page.goto("/plugins/community");
    const view = page.locator("#community-plugins-view");
    await expect(
      view.locator(".plugin-list-item", { hasText: "Remote Themes" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      view.locator('[data-testid="plugin-installed-badge"]'),
    ).toHaveCount(0);
  });

  test("shows an intro with a sign-in CTA only when logged out", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);

    await page.goto("/plugins/community");
    const view = page.locator("#community-plugins-view");
    await expect(
      view.locator('[data-testid="community-plugins-intro"]'),
    ).toBeVisible({ timeout: 10000 });
    await view.locator('[data-testid="plugins-intro-login-button"]').click();
    await expect(page).toHaveURL(/\/login/);

    await login(page);
    await page.goto("/plugins/community");
    await expect(
      view.locator(".plugin-list-item", { hasText: "Remote Themes" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      view.locator('[data-testid="community-plugins-intro"]'),
    ).toHaveCount(0);
  });

  test("logged out, the Plugins nav item points at the community listings", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);

    await page.goto("/");
    await page.locator('[data-testid="sidebar-nav-plugins"]').click();
    await expect(page.locator("#community-plugins-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/plugins\/community$/);

    await page.goto(`/plugins/community/${REMOTE_ID}`);
    await expect(page.locator("#community-plugin-listing-view")).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="sidebar-nav-plugins"]').click();
    await expect(page).toHaveURL(/\/plugins\/community$/);
  });

  test("logged out, clicking the active Plugins nav item scrolls to top", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = Array.from({ length: 30 }, (_, index) => ({
      ...REGISTRY_ENTRY,
      id: `${REMOTE_ID}-${index}`,
      name: `Remote Themes ${index}`,
    }));
    await mockServer.setup(page);

    await page.goto("/plugins/community");
    await expect(
      page.locator("#community-plugins-view .plugin-list"),
    ).toBeVisible({ timeout: 10000 });
    await page.mouse.wheel(0, 2000);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);

    await page.locator('[data-testid="sidebar-nav-plugins"]').click();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveURL(/\/plugins\/community$/);
  });

  test("redirects the old settings URL to /plugins/community", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.registryEntries = [REGISTRY_ENTRY];
    await mockServer.setup(page);
    await login(page);

    await page.goto("/settings/plugins/community");
    await expect(page).toHaveURL(/\/plugins\/community$/);
    await expect(
      page.locator('#community-plugins-view [data-testid="header-title"]'),
    ).toContainText("Community plugins", { timeout: 10000 });
  });
});
