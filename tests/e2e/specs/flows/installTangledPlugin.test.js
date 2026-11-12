import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  MockTangledProvider,
  TANGLED_PLUGIN_ID,
  TANGLED_PLUGIN_NAME,
} from "../../mockTangled.js";

const OWNER_HANDLE = "repo-owner.test";

// Boot the app with a mock Tangled provider serving one repo. Returns the
// provider so tests can assert on the requests it answered.
async function setupTangledInstall(page, repoOptions = {}) {
  const mockServer = new MockServer();
  mockServer.registryEntries = [];
  await mockServer.setup(page);

  const tangled = new MockTangledProvider();
  const repo = tangled.addRepo({
    ownerHandle: OWNER_HANDLE,
    name: "tangled-test-plugin",
    ...repoOptions,
  });
  // After MockServer.setup so these routes take precedence over its
  // generic identity/record handlers.
  await tangled.setup(page);

  await login(page);
  return { mockServer, tangled, repo };
}

// Drive the Settings > Advanced unregistered-install flow for a repo URL.
async function installFromUrl(page, url, pluginName) {
  await page.goto("/settings/advanced");
  const urlInput = page.locator(
    '[data-testid="install-unregistered-plugin-input"]',
  );
  await expect(urlInput).toBeVisible({ timeout: 10000 });
  await urlInput.fill(url);

  const putPrefs = page.waitForResponse((res) =>
    res.url().includes("app.bsky.actor.putPreferences"),
  );
  await page
    .locator('[data-testid="install-unregistered-plugin-submit"]')
    .click();
  await expect(page.locator('[data-testid="install-prompt"]')).toBeVisible({
    timeout: 15000,
  });
  await page.locator('[data-testid="modal-confirm-button"]').click();
  await putPrefs;
  await expect(page.locator('[data-testid="toast"]')).toContainText(
    `Installed ${pluginName}`,
    { timeout: 15000 },
  );
}

// Assert the plugin is installed, enabled, and its bundle actually ran.
async function assertInstalledAndRunning(page) {
  await page.goto("/plugins/installed");
  const item = page
    .locator("#installed-plugins-view")
    .locator(".plugin-list-item", { hasText: TANGLED_PLUGIN_NAME });
  await expect(item).toBeVisible({ timeout: 10000 });
  await expect(item.locator(".plugin-toggle")).toHaveAttribute("checked", "");

  // The pages-plugin fixture registers a "dashboard" page; rendering it
  // proves the fetched main.js loaded and executed in the sandbox worker.
  await page.goto(`/plugin/${TANGLED_PLUGIN_ID}/pages/dashboard`);
  await expect(page.locator('[data-testid="plugin-page-prose"]')).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Tangled plugin install (offline mock)", () => {
  test("declaration-only repo on a git knot installs and runs", async ({
    page,
  }) => {
    const { tangled, repo } = await setupTangledInstall(page, {
      shape: "declaration",
      knotApi: "git",
    });

    await installFromUrl(page, tangled.repoUrl(repo), TANGLED_PLUGIN_NAME);
    await assertInstalledAndRunning(page);

    // The declaration fallback was exercised: the legacy record missed,
    // the declaration answered, and the repo DID's knot was resolved.
    const labels = tangled.requests.map((r) => r.label);
    expect(labels).toContain("record.legacy");
    expect(labels).toContain("record.declaration");
    expect(labels).toContain("plc.repo");
    expect(labels).toContain("knot.describe");
    expect(labels.some((l) => l.startsWith("blob.git:manifest.json"))).toBe(
      true,
    );
    expect(labels.some((l) => l.startsWith("blob.git:main.js"))).toBe(true);
    // No legacy blob API on a git knot.
    expect(labels.some((l) => l.startsWith("blob.legacy:"))).toBe(false);
  });

  test("legacy repo on a git knot installs and runs", async ({ page }) => {
    const { tangled, repo } = await setupTangledInstall(page, {
      shape: "legacy",
      knotApi: "git",
    });

    await installFromUrl(page, tangled.repoUrl(repo), TANGLED_PLUGIN_NAME);
    await assertInstalledAndRunning(page);

    // The legacy record answered directly; the declaration was never read.
    const labels = tangled.requests.map((r) => r.label);
    expect(labels).toContain("record.legacy");
    expect(labels).not.toContain("record.declaration");
    expect(labels.some((l) => l.startsWith("blob.git:main.js"))).toBe(true);
  });

  test("declaration-only repo on a legacy knot installs and runs", async ({
    page,
  }) => {
    const { tangled, repo } = await setupTangledInstall(page, {
      shape: "declaration",
      knotApi: "legacy",
    });

    await installFromUrl(page, tangled.repoUrl(repo), TANGLED_PLUGIN_NAME);
    await assertInstalledAndRunning(page);

    // describeKnot 404'd, so assets came from the legacy blob API.
    const labels = tangled.requests.map((r) => r.label);
    expect(labels).toContain("record.declaration");
    expect(labels).toContain("knot.describe");
    expect(labels.some((l) => l.startsWith("blob.legacy:manifest.json"))).toBe(
      true,
    );
    expect(labels.some((l) => l.startsWith("blob.legacy:main.js"))).toBe(true);
    expect(labels.some((l) => l.startsWith("blob.git:"))).toBe(false);
  });

  test("community-listing install from a tangled: repo", async ({ page }) => {
    const mockServer = new MockServer();
    const tangled = new MockTangledProvider();
    const repo = tangled.addRepo({
      ownerHandle: OWNER_HANDLE,
      name: "tangled-test-plugin",
      shape: "declaration",
      knotApi: "git",
    });
    mockServer.registryEntries = [
      {
        id: TANGLED_PLUGIN_ID,
        name: TANGLED_PLUGIN_NAME,
        author: "Tangled Test Author",
        description: "A plugin served from a mock Tangled repo",
        repo: `tangled:${OWNER_HANDLE}/${repo.name}`,
      },
    ];
    await mockServer.setup(page);
    await tangled.setup(page);
    await login(page);

    // Install from the community listing (not the unregistered URL box).
    await page.goto("/plugins/community");
    const installItem = page
      .locator("#community-plugins-view")
      .locator(".plugin-list-item", { hasText: TANGLED_PLUGIN_NAME });
    await expect(installItem).toBeVisible({ timeout: 10000 });
    await installItem.locator(".plugin-list-item-link").click();

    const installButton = page.locator(
      '[data-testid="plugin-listing-install-button"]',
    );
    await expect(installButton).toHaveAttribute(
      "data-teststate",
      "not-installed",
      { timeout: 10000 },
    );
    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await installButton.click();
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await putPrefs;

    await assertInstalledAndRunning(page);

    const labels = tangled.requests.map((r) => r.label);
    expect(labels).toContain("record.declaration");
    expect(labels.some((l) => l.startsWith("blob.git:main.js"))).toBe(true);
  });
});
