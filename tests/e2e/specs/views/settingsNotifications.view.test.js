import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

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
});
