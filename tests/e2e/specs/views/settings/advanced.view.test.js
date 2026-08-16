import assert from "node:assert/strict";
import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { notificationService } from "../../../testData.js";

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

    test("shows an error toast when the URL is not a supported repo URL", async ({
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
        "Invalid repo URL",
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

  test.describe("Notification service section", () => {
    test("defaults to None and sits between App View and Install plugin", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await expect(select).toHaveValue("none");
      await expect(select.locator("option")).toHaveText([
        "None",
        "7778777.online/courier",
        "Custom",
      ]);
      // None is inert, so neither the DID input nor the warning shows.
      await expect(
        page.locator('[data-testid="notification-service-input"]'),
      ).toHaveCount(0);
      await expect(
        page.locator("#notification-service-form .warning-area"),
      ).toHaveCount(0);

      const formIds = await page.evaluate(() =>
        [...document.querySelectorAll("#settings-advanced-view main form")].map(
          (form) => form.id,
        ),
      );
      assert.deepEqual(formIds, [
        "settings-advanced-form",
        "notification-service-form",
        "install-unregistered-plugin-form",
      ]);
    });

    test("save is disabled until the selection changes", async ({ page }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      const save = page.locator('[data-testid="notification-service-save"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await expect(save).toBeDisabled();

      await select.selectOption("courier-7778777");
      await expect(save).toBeEnabled();

      await select.selectOption("none");
      await expect(save).toBeDisabled();
    });

    test("selecting a listed service needs no custom DID input", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await select.selectOption("courier-7778777");

      // The preset already names a DID, so nothing is asked of the user.
      await expect(
        page.locator('[data-testid="notification-service-input"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="notification-service-save"]'),
      ).toBeEnabled();
    });

    test("Custom reveals the DID input and stores what is entered", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await select.selectOption("custom");

      const input = page.locator('[data-testid="notification-service-input"]');
      await expect(input).toBeVisible();
      await input.fill(notificationService.did);
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        notificationService.name,
      );
      expect(mockServer.notificationServiceDid).toBe(notificationService.did);
    });

    test("a stored service that matches no preset selects Custom and prefills it", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      await expect(
        page.locator('select[name="notificationService"]'),
      ).toHaveValue("custom", { timeout: 10000 });
      await expect(
        page.locator('[data-testid="notification-service-input"]'),
      ).toHaveValue(notificationService.did);
    });

    test("a stored preset DID selects that preset, not Custom", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid("did:web:courier.7778777.online");
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      await expect(
        page.locator('select[name="notificationService"]'),
      ).toHaveValue("courier-7778777", { timeout: 10000 });
      await expect(
        page.locator('[data-testid="notification-service-input"]'),
      ).toHaveCount(0);
    });

    test("selecting None clears the stored service", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toHaveValue("custom", { timeout: 10000 });

      await select.selectOption("none");
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect.poll(() => mockServer.notificationServiceDid).toBeNull();
    });

    test("rejects input that isn't a DID without hitting the network", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await select.selectOption("custom");
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill("notifs.example.com");
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(
        page.locator('[data-testid="notification-service-error"]'),
      ).toBeVisible();
      expect(mockServer.notificationServiceDid).toBeNull();
    });

    test("a service that won't resolve is rejected and not stored", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.failNotificationServiceLookup();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/settings/advanced");

      const select = page.locator('select[name="notificationService"]');
      await expect(select).toBeVisible({ timeout: 10000 });
      await select.selectOption("custom");
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill(notificationService.did);
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(
        page.locator('[data-testid="notification-service-error"]'),
      ).toBeVisible({ timeout: 10000 });
      // The previous state must survive a failed switch, so nothing is stored.
      expect(mockServer.notificationServiceDid).toBeNull();
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
