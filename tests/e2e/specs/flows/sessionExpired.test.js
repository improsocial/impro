import { test, expect } from "../../base.js";
import { loginWithAccounts } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../fixtures.js";

// The footer nav (used to detect a logged-in boot) only renders on small
// viewports.
test.use({ viewport: { width: 375, height: 667 } });

test.describe("Session expiry flow", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    mockServer.addProfile(userProfile);
    await mockServer.setup(page);
  });

  test("stale token soft-logs-out and lands on login with the handle prefilled", async ({
    page,
  }) => {
    mockServer.failTokenRefresh();
    await loginWithAccounts(page, [
      { did: userProfile.did, handle: userProfile.handle, expired: true },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(`/login?handle=${userProfile.handle}`, {
      timeout: 10000,
    });
    await expect(page.locator('input[name="handle"]')).toHaveValue(
      userProfile.handle,
    );

    // The account entry survives the soft logout so the handle can be
    // prefilled; only the session tokens are cleared.
    const stored = await page.evaluate(
      (did) => ({
        accounts: JSON.parse(localStorage.getItem("oauth_accounts")),
        session: localStorage.getItem("oauth_session:" + did),
      }),
      userProfile.did,
    );
    expect(
      stored.accounts.some((account) => account.did === userProfile.did),
    ).toBe(true);
    expect(stored.session).toBe(null);
  });

  test("successful token refresh keeps the session and stays on the app", async ({
    page,
  }) => {
    await loginWithAccounts(page, [
      { did: userProfile.did, handle: userProfile.handle, expired: true },
    ]);

    await page.goto("/");

    await expect(
      page.locator('[data-testid="footer-nav-profile"]'),
    ).toBeVisible({ timeout: 10000 });
    const session = await page.evaluate(
      (did) => JSON.parse(localStorage.getItem("oauth_session:" + did)),
      userProfile.did,
    );
    expect(session.accessToken).toBe("mock-access-token-refreshed");
  });
});
