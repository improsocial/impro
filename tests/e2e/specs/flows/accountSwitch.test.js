import { test, expect } from "../../base.js";
import { loginWithAccounts, longPress } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../fixtures.js";
import { createProfile } from "../../factories.js";

// The footer (the long-press trigger) only renders on small viewports.
test.use({ viewport: { width: 375, height: 667 } });

test.describe("Account switch flow", () => {
  let mockServer;
  let otherProfile;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    otherProfile = createProfile({
      did: "did:plc:otheruser456",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
    });
    mockServer.addProfile(userProfile);
    mockServer.addProfile(otherProfile);
    await mockServer.setup(page);

    await loginWithAccounts(page, [
      { did: userProfile.did, handle: userProfile.handle },
      { did: otherProfile.did, handle: otherProfile.handle },
    ]);
    await page.goto("/");
    await expect(
      page.locator('[data-testid="footer-nav-profile"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  async function openSwitcherDialog(page) {
    await longPress(page, page.locator('[data-testid="footer-nav-profile"]'));
    const dialog = page.locator('[data-testid="account-switcher-dialog"]');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("long-press on the profile tab opens the dialog without navigating", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    await expect(page).toHaveURL("/");
    await expect(
      dialog.locator('[data-testid="account-switcher-item"]'),
    ).toHaveCount(2);
    await expect(
      dialog.locator(
        '[data-testid="account-switcher-item"][data-teststate="current"]',
      ),
    ).toHaveAttribute("data-did", userProfile.did);
    await expect(
      dialog.locator('[data-testid="account-switcher-add"]'),
    ).toBeVisible();
  });

  test("hydrates account rows with profile data", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);

    const otherRow = dialog.locator(
      `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
    );
    await expect(otherRow).toContainText(otherProfile.displayName);
    await expect(otherRow).toContainText(`@${otherProfile.handle}`);
  });

  test("short press still navigates to the profile", async ({ page }) => {
    await page.locator('[data-testid="footer-nav-profile"]').click();

    await expect(page).toHaveURL(`/profile/${userProfile.handle}`, {
      timeout: 10000,
    });
    await expect(
      page.locator('[data-testid="account-switcher-dialog"]'),
    ).toHaveCount(0);
  });

  test("hides the close button on mobile and dismisses with Escape", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    await expect(
      dialog.locator('[data-testid="account-switcher-close"]'),
    ).toBeHidden();
    await page.keyboard.press("Escape");

    await expect(dialog).toHaveCount(0);
  });

  test("clicking the backdrop dismisses the dialog", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);

    // Clicks on a modal dialog's ::backdrop are dispatched with the <dialog>
    // element itself as the target, which the component treats as a dismiss.
    await page.mouse.click(187, 100);

    await expect(dialog).toHaveCount(0);
  });

  test("selecting another account reloads the app as that account", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    await dialog
      .locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
      )
      .click();

    // The switch flips the current-account pointer and reloads.
    await expect
      .poll(
        () => page.evaluate(() => localStorage.getItem("oauth_current_did")),
        { timeout: 10000 },
      )
      .toBe(otherProfile.did);
    await expect(
      page.locator('[data-testid="footer-nav-profile"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="account-switcher-dialog"]'),
    ).toHaveCount(0);
  });

  test("selecting the current account closes the dialog without reloading", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    await page.evaluate(() => {
      window.__testNoReloadMarker = true;
    });

    await dialog
      .locator(
        `[data-testid="account-switcher-item"][data-did="${userProfile.did}"]`,
      )
      .click();

    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__testNoReloadMarker)).toBe(true);
  });

  test("add account navigates to login in add-account mode", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    await dialog.locator('[data-testid="account-switcher-add"]').click();

    await expect(page).toHaveURL(/\/login\?addAccount=1/, { timeout: 10000 });
  });

  test("shows a spinner and disables the list while a switch is pending", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    const otherRow = dialog.locator(
      `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
    );
    await expect(
      otherRow.locator('[data-testid="account-spinner"]'),
    ).toHaveCount(0);

    // Block the reload that switching triggers so the pending state stays
    // observable.
    await mockServer.blockNavigations(page);
    await otherRow.click();

    await expect(
      otherRow.locator('[data-testid="account-spinner"]'),
    ).toBeVisible();
    await expect(otherRow).toHaveAttribute("data-teststate", "pending");
    await expect(otherRow).toBeDisabled();
    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${userProfile.did}"]`,
      ),
    ).toBeDisabled();
    await expect(
      dialog.locator('[data-testid="account-switcher-add"]'),
    ).toBeDisabled();

    // The dialog can't be dismissed while the switch is in flight.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  });

  test("shows a spinner on the add row while navigating to login", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    const addRow = dialog.locator('[data-testid="account-switcher-add"]');
    await expect(addRow.locator('[data-testid="account-spinner"]')).toHaveCount(
      0,
    );

    await mockServer.blockNavigations(page);
    await addRow.click();

    await expect(
      addRow.locator('[data-testid="account-spinner"]'),
    ).toBeVisible();
    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
      ),
    ).toBeDisabled();
  });

  test("resets the pending add state when restored from the back/forward cache", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    const addRow = dialog.locator('[data-testid="account-switcher-add"]');

    await mockServer.blockNavigations(page);
    await addRow.click();
    await expect(
      addRow.locator('[data-testid="account-spinner"]'),
    ).toBeVisible();

    // Playwright disables the back/forward cache, so simulate the restore
    // that happens when the user navigates back from the login page.
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });

    await expect(addRow.locator('[data-testid="account-spinner"]')).toHaveCount(
      0,
    );
    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
      ),
    ).toBeEnabled();

    // The dialog is dismissable again.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
