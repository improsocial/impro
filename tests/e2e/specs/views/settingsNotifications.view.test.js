import { test, expect } from "../../base.js";
import { login, selectNotificationService } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { notificationService } from "../../testData.js";

// Stubs the Notification API so permission prompts are deterministic in CI
// (headless browsers have no real OS notification center to grant/deny).
// `initial` is the permission state on page load; `onPrompt` is what the
// mock resolves to the first time requestPermission() is actually called
// (only takes effect starting from "default" -- real browsers never
// re-prompt once a decision has already been made).
async function stubNotificationPermission(
  page,
  { initial = "default", onPrompt = "granted" } = {},
) {
  await page.addInitScript(
    ({ initialPermission, promptResult }) => {
      class MockNotification {
        static permission = initialPermission;
        static async requestPermission() {
          if (MockNotification.permission === "default") {
            MockNotification.permission = promptResult;
          }
          return MockNotification.permission;
        }
        constructor() {}
        close() {}
      }
      window.Notification = MockNotification;
    },
    { initialPermission: initial, promptResult: onPrompt },
  );
}

test.describe("Settings > Notifications view", () => {
  test("toggle starts unchecked and enables after granting permission", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await stubNotificationPermission(page, {
      initial: "default",
      onPrompt: "granted",
    });
    await login(page);
    await page.goto("/settings/notifications");

    const toggle = page.locator('[data-testid="system-notifications-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await expect(toggle).not.toHaveAttribute("checked", "");

    await toggle.click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await confirmModal.locator('[data-testid="modal-confirm-button"]').click();

    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("system-notifications-enabled"),
        ),
      )
      .toBe("true");
  });

  test("declining the confirm dialog leaves notifications disabled", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await stubNotificationPermission(page, { initial: "default" });
    await login(page);
    await page.goto("/settings/notifications");

    const toggle = page.locator('[data-testid="system-notifications-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });

    await toggle.click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await confirmModal.locator('[data-testid="modal-cancel-button"]').click();

    await expect(toggle).not.toHaveAttribute("checked", "");
    expect(
      await page.evaluate(() =>
        localStorage.getItem("system-notifications-enabled"),
      ),
    ).toBeNull();
  });

  test("shows an error toast when the browser denies permission", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await stubNotificationPermission(page, {
      initial: "default",
      onPrompt: "denied",
    });
    await login(page);
    await page.goto("/settings/notifications");

    const toggle = page.locator('[data-testid="system-notifications-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });

    await toggle.click();
    await page
      .locator(
        '[data-testid="confirm-modal"] [data-testid="modal-confirm-button"]',
      )
      .click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(toggle).not.toHaveAttribute("checked", "");
  });

  test.describe("on a touch-only device", () => {
    test.use({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    });

    test("shows the toggle disabled", async ({ page }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      const toggle = page.locator(
        '[data-testid="system-notifications-toggle"]',
      );
      await expect(toggle).toBeVisible({ timeout: 10000 });
      await expect(toggle).toHaveAttribute("disabled", "");

      await toggle.click({ force: true });

      await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(
        0,
      );
      expect(
        await page.evaluate(() =>
          localStorage.getItem("system-notifications-enabled"),
        ),
      ).toBeNull();
    });
  });

  test("turning the toggle off clears the stored preference without a confirm dialog", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await stubNotificationPermission(page, { initial: "granted" });
    await login(page);
    await page.addInitScript(() => {
      localStorage.setItem("system-notifications-enabled", "true");
    });
    await page.goto("/settings/notifications");

    const toggle = page.locator('[data-testid="system-notifications-toggle"]');
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });

    await toggle.click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    await expect(toggle).not.toHaveAttribute("checked", "");
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("system-notifications-enabled"),
        ),
      )
      .toBeNull();
  });

  test.describe("notification service selection", () => {
    test("with no service chosen, push cannot be turned on", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await expect(
        page.locator('[data-testid="notification-service-unset"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).toHaveAttribute("disabled", "");
      await expect(
        page.locator('[data-testid="notification-service-change"]'),
      ).toHaveAttribute("data-teststate", "unset");
    });

    test("entering a service DID resolves it and enables the push toggle", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await page
        .locator('[data-testid="notification-service-change"]')
        .click({ timeout: 10000 });
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill(notificationService.did);
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        notificationService.name,
      );
      await expect(
        page.locator('[data-testid="notification-service-unset"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).not.toHaveAttribute("disabled", "");
      expect(
        await page.evaluate(() =>
          localStorage.getItem("courier-push-service-did"),
        ),
      ).toBe(notificationService.did);
    });

    test("a previously chosen service is shown by name on load", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await selectNotificationService(page);
      await page.goto("/settings/notifications");

      const section = page.locator(
        '[data-testid="settings-section-notification-service"]',
      );
      await expect(section).toContainText(notificationService.name, {
        timeout: 10000,
      });
      await expect(section).toContainText(notificationService.did);
      await expect(
        page.locator('[data-testid="notification-service-change"]'),
      ).toHaveAttribute("data-teststate", "set");
    });

    test("rejects input that isn't a DID without hitting the network", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await page
        .locator('[data-testid="notification-service-change"]')
        .click({ timeout: 10000 });
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill("notifs.example.com");
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(
        page.locator('[data-testid="notification-service-error"]'),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          localStorage.getItem("courier-push-service-did"),
        ),
      ).toBeNull();
    });

    test("a service that won't resolve is rejected and not stored", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.failNotificationServiceLookup();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await page
        .locator('[data-testid="notification-service-change"]')
        .click({ timeout: 10000 });
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill(notificationService.did);
      await page.locator('[data-testid="notification-service-save"]').click();

      await expect(
        page.locator('[data-testid="notification-service-error"]'),
      ).toBeVisible({ timeout: 10000 });
      // The old state must survive a failed switch, so nothing is stored.
      expect(
        await page.evaluate(() =>
          localStorage.getItem("courier-push-service-did"),
        ),
      ).toBeNull();
    });
  });
});
