import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
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

    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("system-notifications-enabled"),
        ),
      )
      .toBe("true");
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

  test.describe("push notifications", () => {
    test("with no service named, push cannot be turned on", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      // The service is named under Advanced, so the row's subtitle links there.
      const unset = page.locator(
        '[data-testid="settings-section-push-notifications"] [data-testid="notification-service-unset"]',
      );
      await expect(unset).toBeVisible({ timeout: 10000 });
      await expect(unset).toHaveAttribute("href", "/settings/advanced");
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).toHaveAttribute("disabled", "");
    });

    test("picking a service on Advanced updates this page on the way back", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      const pushRow = page.locator(
        '[data-testid="settings-section-push-notifications"]',
      );
      await expect(
        pushRow.locator('[data-testid="notification-service-unset"]'),
      ).toBeVisible({ timeout: 10000 });

      await page
        .locator('[data-testid="notification-service-unset"]')
        .click({ timeout: 10000 });
      await page
        .locator('select[name="notificationService"]')
        .selectOption("custom");
      await page
        .locator('[data-testid="notification-service-input"]')
        .fill(notificationService.did);
      await page.locator('[data-testid="notification-service-save"]').click();
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();

      // The page stays cached in the DOM, so it only updates because it reads
      // the service's signals rather than a snapshot taken when it was built.
      await page.goBack();
      await expect(
        pushRow.locator('[data-testid="notification-service-unset"]'),
      ).toHaveCount(0, { timeout: 10000 });
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).not.toHaveAttribute("disabled", "");
    });

    test("the subtitle link navigates to Advanced", async ({ page }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await page
        .locator('[data-testid="notification-service-unset"]')
        .click({ timeout: 10000 });

      await expect(page).toHaveURL(/\/settings\/advanced$/);
      await expect(
        page.locator('select[name="notificationService"]'),
      ).toBeVisible();
    });

    test("with a service named, the toggle is usable", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).not.toHaveAttribute("disabled", "", { timeout: 10000 });
      await expect(
        page.locator('[data-testid="notification-service-unset"]'),
      ).toHaveCount(0);
    });
  });
});
