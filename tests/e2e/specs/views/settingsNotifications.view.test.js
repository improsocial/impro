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
      // Records when permission was asked for, so tests can assert it happened
      // before the handoff navigation rather than after it.
      window.__permissionRequests = 0;
      const request = MockNotification.requestPermission.bind(MockNotification);
      MockNotification.requestPermission = async () => {
        window.__permissionRequests += 1;
        return request();
      };
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

    const toggle = page.locator('[data-testid="desktop-notifications-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await expect(toggle).not.toHaveAttribute("checked", "");

    await toggle.click();

    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
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

    const toggle = page.locator('[data-testid="desktop-notifications-toggle"]');
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
        '[data-testid="desktop-notifications-toggle"]',
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

    const toggle = page.locator('[data-testid="desktop-notifications-toggle"]');
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });

    await toggle.click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    await expect(toggle).not.toHaveAttribute("checked", "");
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("system-notifications-enabled"),
        ),
      )
      .toBeNull();
  });

  test.describe("push notifications", () => {
    // Push is for devices where a tab isn't reliably open, so every case below
    // needs a touch-only device — on desktop the setting is disabled outright.
    test.use({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    });

    test("is disabled on a desktop device", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        hasTouch: false,
        isMobile: false,
      });
      const page = await context.newPage();
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      // Even with a service chosen, desktop gets in-tab notifications instead.
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).toHaveAttribute("disabled", "", { timeout: 10000 });
      await context.close();
    });

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

    test("asks for permission before leaving for the handoff", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      const toggle = page.locator('[data-testid="push-notifications-toggle"]');
      await expect(toggle).not.toHaveAttribute("disabled", "", {
        timeout: 10000,
      });
      expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);

      await toggle.click();
      // iOS Safari only raises the prompt inside a user gesture, and the
      // handoff return has none — so it must be asked for on this press.
      await page
        .locator(
          '[data-testid="choice-modal"] [data-testid="modal-choice-without-previews"]',
        )
        .click();

      await expect
        .poll(() => page.evaluate(() => window.__permissionRequests))
        .toBeGreaterThan(0);
      await expect(page).toHaveURL(
        new RegExp(
          notificationService.authUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      );
      expect(new URL(page.url()).searchParams.get("chat_previews")).toBe("0");
    });

    test("message previews are chosen from the same prompt", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      const toggle = page.locator('[data-testid="push-notifications-toggle"]');
      await expect(toggle).not.toHaveAttribute("disabled", "", {
        timeout: 10000,
      });
      await toggle.click();
      await page
        .locator(
          '[data-testid="choice-modal"] [data-testid="modal-choice-with-previews"]',
        )
        .click();

      await expect(page).toHaveURL(
        new RegExp(
          notificationService.authUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      );
      expect(new URL(page.url()).searchParams.get("chat_previews")).toBe("1");
    });

    test("cancelling the prompt asks for no permission", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "default" });
      await login(page);
      await page.goto("/settings/notifications");

      const toggle = page.locator('[data-testid="push-notifications-toggle"]');
      await expect(toggle).not.toHaveAttribute("disabled", "", {
        timeout: 10000,
      });
      await toggle.click();
      await page
        .locator(
          '[data-testid="choice-modal"] [data-testid="modal-choice-cancel"]',
        )
        .click();

      await expect(page.locator('[data-testid="choice-modal"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
      await expect(page).toHaveURL(/\/settings\/notifications$/);
    });

    test("a denied prompt stops before the handoff", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, {
        initial: "default",
        onPrompt: "denied",
      });
      await login(page);
      await page.goto("/settings/notifications");

      const toggle = page.locator('[data-testid="push-notifications-toggle"]');
      await expect(toggle).not.toHaveAttribute("disabled", "", {
        timeout: 10000,
      });
      await toggle.click();
      await page
        .locator(
          '[data-testid="choice-modal"] [data-testid="modal-choice-without-previews"]',
        )
        .click();

      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      // Never sent through the handoff, so the page never left settings.
      await expect(page).toHaveURL(/\/settings\/notifications$/);
    });

    test("turning push off clears the stored preference", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "granted" });
      await login(page);
      await page.addInitScript(() => {
        localStorage.setItem("push-notifications-enabled", "true");
      });
      await page.goto("/settings/notifications");

      const toggle = page.locator('[data-testid="push-notifications-toggle"]');
      await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });

      await toggle.click();

      await expect(toggle).not.toHaveAttribute("checked", "");
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            localStorage.getItem("push-notifications-enabled"),
          ),
        )
        .toBeNull();
    });

    test("a stale authorization shows the re-auth warning with the toggle still on", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      mockServer.failRegisterPushWithAuthError();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "granted" });
      await login(page);
      await page.addInitScript(() => {
        localStorage.setItem("push-notifications-enabled", "true");
        localStorage.setItem("push-notifications-needs-reauth", "true");
      });
      await page.goto("/settings/notifications");

      const warning = page.locator('[data-testid="push-reauth-warning"]');
      await expect(warning).toBeVisible({ timeout: 10000 });
      // Only the authorization is stale — the user's choice stays on.
      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).toHaveAttribute("checked", "");
    });

    test("the re-authorize button restarts the enable flow", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      mockServer.failRegisterPushWithAuthError();
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "granted" });
      await login(page);
      await page.addInitScript(() => {
        localStorage.setItem("push-notifications-enabled", "true");
        localStorage.setItem("push-notifications-needs-reauth", "true");
      });
      await page.goto("/settings/notifications");

      await page
        .locator('[data-testid="push-reauth-button"]')
        .click({ timeout: 10000 });
      await page
        .locator(
          '[data-testid="choice-modal"] [data-testid="modal-choice-without-previews"]',
        )
        .click();

      await expect(page).toHaveURL(
        new RegExp(
          notificationService.authUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      );
    });

    test("no re-auth warning while the authorization is good", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setNotificationServiceDid(notificationService.did);
      await mockServer.setup(page);
      await stubNotificationPermission(page, { initial: "granted" });
      await login(page);
      await page.addInitScript(() => {
        localStorage.setItem("push-notifications-enabled", "true");
      });
      await page.goto("/settings/notifications");

      await expect(
        page.locator('[data-testid="push-notifications-toggle"]'),
      ).toHaveAttribute("checked", "", { timeout: 10000 });
      await expect(
        page.locator('[data-testid="push-reauth-warning"]'),
      ).toHaveCount(0);
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
