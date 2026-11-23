import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { createProfile } from "../../../../shared/factories.js";

const verifiedUser = createProfile({
  did: "did:plc:verifieduser123",
  handle: "verified.bsky.social",
  displayName: "Verified User",
  verification: {
    verifiedStatus: "valid",
    trustedVerifierStatus: "none",
  },
});

test.describe("Settings Verification view", () => {
  test("should show verification badges by default", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/verification");

    const view = page.locator("#settings-verification-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="verification-badges-toggle"]'),
    ).toHaveAttribute("checked", "", { timeout: 10000 });
  });

  test("should save hidden badges to preferences and keep it after a reload", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/verification");

    const toggle = page.locator(
      '#settings-verification-view [data-testid="verification-badges-toggle"]',
    );
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("checked");
    await expect
      .poll(() => mockServer.verificationPref)
      .toEqual({ hideBadges: true });

    await page.reload();
    await expect(
      page.locator(
        '#settings-verification-view [data-testid="verification-badges-toggle"]',
      ),
    ).not.toHaveAttribute("checked", { timeout: 10000 });
  });

  test("should hide verification badges when the preference is set", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(verifiedUser);
    mockServer.setVerificationPref({ hideBadges: true });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${verifiedUser.did}`);

    const profileName = page.locator('[data-testid="profile-name"]');
    await expect(profileName).toContainText("Verified User", {
      timeout: 10000,
    });
    await expect(
      profileName.locator('[data-testid="verification-badge"]'),
    ).toBeHidden();
  });

  test("should show verification badges when the preference is not set", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(verifiedUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${verifiedUser.did}`);

    await expect(
      page.locator(
        '[data-testid="profile-name"] [data-testid="verification-badge"]',
      ),
    ).toBeVisible({ timeout: 10000 });
  });
});
