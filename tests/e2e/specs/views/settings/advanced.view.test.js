import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

test.describe("Settings Advanced view", () => {
  test("should display header and App View section", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Advanced",
      { timeout: 10000 },
    );

    await expect(view).toContainText("App View");
    await expect(view.locator('select[name="appview"]')).toBeVisible();
  });

  test("should display app view dropdown with all options", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    const select = view.locator('select[name="appview"]');
    await expect(select).toBeVisible({ timeout: 10000 });
    await expect(select.locator("option")).toHaveText([
      "Bluesky",
      "Blacksky",
      "Custom",
    ]);
  });

  test("custom option reveals DID inputs and toggles off when a default is reselected", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    const select = view.locator('select[name="appview"]');
    await expect(select).toBeVisible({ timeout: 10000 });

    await expect(view.locator('input[name="appViewServiceDid"]')).toHaveCount(
      0,
    );

    await select.selectOption("custom");
    await expect(view.locator('input[name="appViewServiceDid"]')).toBeVisible();
    await expect(view.locator('input[name="chatServiceDid"]')).toBeVisible();
    await expect(
      view.locator('[data-testid="custom-appview-warning"]'),
    ).toBeVisible();

    await select.selectOption("bluesky");
    await expect(view.locator('input[name="appViewServiceDid"]')).toHaveCount(
      0,
    );
  });

  test("prefills the dropdown from localStorage", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "appview-config",
        JSON.stringify({
          id: "blacksky",
          appViewServiceDid: "did:web:api.blacksky.community#bsky_appview",
          chatServiceDid: "did:web:api.blacksky.community#bsky_chat",
        }),
      );
    });

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    await expect(view.locator('select[name="appview"]')).toHaveValue(
      "blacksky",
      { timeout: 10000 },
    );
  });

  test("prefills custom DID inputs when stored config is custom", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "appview-config",
        JSON.stringify({
          id: "custom",
          appViewServiceDid: "did:web:custom.example#bsky_appview",
          chatServiceDid: "did:web:custom.example#bsky_chat",
        }),
      );
    });

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    await expect(view.locator('select[name="appview"]')).toHaveValue("custom", {
      timeout: 10000,
    });
    await expect(view.locator('input[name="appViewServiceDid"]')).toHaveValue(
      "did:web:custom.example#bsky_appview",
    );
    await expect(view.locator('input[name="chatServiceDid"]')).toHaveValue(
      "did:web:custom.example#bsky_chat",
    );
  });

  test("apply button is disabled until the form is dirty", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    const select = view.locator('select[name="appview"]');
    await expect(select).toBeVisible({ timeout: 10000 });

    const applyButton = view.getByRole("button", { name: "Save and reload" });
    await expect(applyButton).toBeDisabled();

    await select.selectOption("blacksky");
    await expect(applyButton).toBeEnabled();

    await select.selectOption("bluesky");
    await expect(applyButton).toBeDisabled();
  });

  test("apply button re-enables when custom DIDs are edited", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "appview-config",
        JSON.stringify({
          id: "custom",
          appViewServiceDid: "did:web:custom.example#bsky_appview",
          chatServiceDid: "did:web:custom.example#bsky_chat",
        }),
      );
    });

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    const applyButton = view.getByRole("button", { name: "Save and reload" });
    await expect(view.locator('select[name="appview"]')).toHaveValue("custom", {
      timeout: 10000,
    });
    await expect(applyButton).toBeDisabled();

    const appViewInput = view.locator('input[name="appViewServiceDid"]');
    await appViewInput.fill("did:web:other.example#bsky_appview");
    await expect(applyButton).toBeEnabled();

    await appViewInput.fill("did:web:custom.example#bsky_appview");
    await expect(applyButton).toBeDisabled();
  });

  test("applying a new app view persists the config and reloads the page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/advanced");

    const view = page.locator("#settings-advanced-view");
    const select = view.locator('select[name="appview"]');
    await expect(select).toBeVisible({ timeout: 10000 });

    await select.selectOption("blacksky");
    await view.getByRole("button", { name: "Save and reload" }).click();

    await page.waitForURL("/settings/advanced", { timeout: 10000 });

    const storedConfig = await page.evaluate(() =>
      localStorage.getItem("appview-config"),
    );
    expect(storedConfig).not.toBeNull();
    expect(JSON.parse(storedConfig).id).toBe("blacksky");
  });

  test.describe("Install plugin from URL section", () => {
    test("renders the URL input and submit button", async ({ page }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/settings/advanced");

      const view = page.locator("#settings-advanced-view");
      await expect(view).toContainText("Install plugin from URL", {
        timeout: 10000,
      });
      await expect(
        view.locator('[data-testid="install-unregistered-plugin-input"]'),
      ).toBeVisible();
      await expect(
        view.locator('[data-testid="install-unregistered-plugin-submit"]'),
      ).toBeVisible();
    });

    test("shows an error toast when the URL is not a GitHub URL", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/settings/advanced");

      const view = page.locator("#settings-advanced-view");
      await view
        .locator('[data-testid="install-unregistered-plugin-input"]')
        .fill("https://example.com/owner/repo");
      await view
        .locator('[data-testid="install-unregistered-plugin-submit"]')
        .click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "Invalid GitHub URL",
      );
    });

    test("shows an error toast when the plugin id is already in the registry", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.registryEntries = [
        {
          id: "remote-plugin",
          name: "Remote Plugin",
          repo: "alice/remote-plugin",
        },
      ];
      mockServer.liveManifest = {
        id: "remote-plugin",
        name: "Remote Plugin",
        version: "1.0.0",
      };
      await mockServer.setup(page);

      await login(page);
      await page.goto("/settings/advanced");

      const view = page.locator("#settings-advanced-view");
      await view
        .locator('[data-testid="install-unregistered-plugin-input"]')
        .fill("https://github.com/alice/remote-plugin");
      await view
        .locator('[data-testid="install-unregistered-plugin-submit"]')
        .click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "in the registry",
      );
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/settings/advanced");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
