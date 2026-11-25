import { test, expect } from "../../base.js";
import { loginWithAccounts } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import {
  createFeedGenerator,
  createProfile,
} from "../../../shared/factories.js";

test.use({ viewport: { width: 375, height: 667 } });

async function openSwitcherDialog(page) {
  await page.locator('[data-testid="menu-button"]').click();
  await page
    .locator('[data-testid="sidebar-profile-account-switcher-button"]')
    .click();
  const dialog = page.locator('[data-testid="account-switcher-dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function switchToAccount(page, did) {
  const dialog = await openSwitcherDialog(page);
  await dialog
    .locator(`[data-testid="account-switcher-item"][data-did="${did}"]`)
    .click();
  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("oauth_current_did")),
      { timeout: 10000 },
    )
    .toBe(did);
}

async function storedAccountDids(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("oauth_accounts")).map(
      (account) => account.did,
    ),
  );
}

async function removeAccountFromDialog(dialog, page, did) {
  await dialog.locator('[data-testid="account-switcher-edit"]').click();
  await dialog
    .locator(
      `[data-testid="account-switcher-item"][data-did="${did}"] [data-testid="account-switcher-remove"]`,
    )
    .click();
  await page.locator('[data-testid="modal-confirm-button"]').click();
}

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
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("the sidebar account switcher button opens the dialog without navigating", async ({
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

  test("the sidebar button shows a stack of the other accounts", async ({
    page,
  }) => {
    await page.locator('[data-testid="menu-button"]').click();
    await expect(
      page.locator('[data-testid="sidebar-account-stack-item"]'),
    ).toHaveCount(1);
  });

  test("clicking an avatar in the sidebar stack switches to that account", async ({
    page,
  }) => {
    await page.locator('[data-testid="menu-button"]').click();
    await page
      .locator(
        `[data-testid="sidebar-account-stack-item"][data-did="${otherProfile.did}"]`,
      )
      .click();

    await expect
      .poll(
        () => page.evaluate(() => localStorage.getItem("oauth_current_did")),
        { timeout: 10000 },
      )
      .toBe(otherProfile.did);
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator(
        `[data-testid="sidebar-account-stack-item"][data-did="${userProfile.did}"]`,
      ),
    ).toHaveCount(1);
  });

  test("shows a sign out button for the current account", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);
    await expect(
      dialog.locator('[data-testid="account-switcher-sign-out"]'),
    ).toContainText(`@${userProfile.handle}`);
  });

  test("signing out from the switcher goes to the login page", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    await dialog.locator('[data-testid="account-switcher-sign-out"]').click();
    await expect(dialog).toHaveCount(0);
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });
  });

  test("hydrates account rows with profile data", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);

    const otherRow = dialog.locator(
      `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
    );
    await expect(otherRow).toContainText(otherProfile.displayName);
    await expect(otherRow).toContainText(`@${otherProfile.handle}`);
  });

  test("falls back to stored account info when profiles are slow to load", async ({
    page,
  }) => {
    mockServer.getProfilesDelayMs = 5000;
    await page.reload();
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
    const dialog = await openSwitcherDialog(page);

    const otherRow = dialog.locator(
      `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
    );
    await expect(
      otherRow.locator('[data-testid="account-switcher-skeleton"]'),
    ).toBeVisible();
    await expect(
      otherRow.locator('[data-testid="account-switcher-skeleton"]'),
    ).toHaveCount(0, { timeout: 4500 });
    await expect(otherRow).toContainText(`@${otherProfile.handle}`);
    await expect(otherRow).not.toContainText(otherProfile.displayName);

    await expect(otherRow).toContainText(otherProfile.displayName, {
      timeout: 10000,
    });
  });

  test("dismisses with Escape", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);

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
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
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

  test("each account keeps its own home feed selection across switches", async ({
    page,
  }) => {
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    await page.reload();

    const view = page.locator("#home-view");
    const tabs = view.locator(".tab-bar-button");
    await expect(tabs).toHaveCount(2, { timeout: 10000 });
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/active/);

    // The other account doesn't have that feed pinned
    mockServer.setPinnedFeeds([]);
    await switchToAccount(page, otherProfile.did);

    await expect(tabs).toHaveCount(1, { timeout: 10000 });
    await expect(tabs.nth(0)).toHaveClass(/active/);

    // Falling back to Following for the other account must not have discarded
    // the first account's selection
    mockServer.setPinnedFeeds([feed.uri]);
    await switchToAccount(page, userProfile.did);

    await expect(tabs).toHaveCount(2, { timeout: 10000 });
    await expect(tabs.nth(1)).toHaveClass(/active/);
  });

  test("edit mode removes another account without leaving the dialog", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    const editButton = dialog.locator('[data-testid="account-switcher-edit"]');
    await editButton.click();
    await expect(editButton).toHaveAttribute("data-teststate", "editing");
    await expect(
      dialog.locator('[data-testid="account-switcher-add"]'),
    ).toBeVisible();
    await expect(
      dialog.locator('[data-testid="account-switcher-sign-out"]'),
    ).toBeVisible();
    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${userProfile.did}"] [data-testid="account-switcher-remove"]`,
      ),
    ).toHaveCount(0);

    await dialog
      .locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"] [data-testid="account-switcher-remove"]`,
      )
      .click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(
      dialog.locator('[data-testid="account-switcher-item"]'),
    ).toHaveCount(1);
    await expect(dialog).toBeVisible();
    await expect(editButton).toHaveCount(0);
    await expect(
      dialog.locator('[data-testid="account-switcher-add"]'),
    ).toBeVisible();
    expect(await storedAccountDids(page)).toEqual([userProfile.did]);
    await expect
      .poll(() =>
        page.evaluate(
          (did) => localStorage.getItem(`oauth_session:${did}`),
          otherProfile.did,
        ),
      )
      .toBeNull();
  });

  test("cancelling the removal keeps the account", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);
    await dialog.locator('[data-testid="account-switcher-edit"]').click();
    await dialog
      .locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"] [data-testid="account-switcher-remove"]`,
      )
      .click();
    await page.locator('[data-testid="modal-cancel-button"]').click();

    await expect(
      dialog.locator('[data-testid="account-switcher-item"]'),
    ).toHaveCount(2);
    expect(await storedAccountDids(page)).toContain(otherProfile.did);
  });
});

test.describe("Account switch flow with a single account", () => {
  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(userProfile);
    await mockServer.setup(page);
    await loginWithAccounts(page, [
      { did: userProfile.did, handle: userProfile.handle },
    ]);
    await page.goto("/");
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("the sidebar shows only the ellipsis button", async ({ page }) => {
    await page.locator('[data-testid="menu-button"]').click();
    await expect(
      page.locator('[data-testid="sidebar-profile-account-switcher-button"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="sidebar-account-avatar-stack"]'),
    ).toHaveCount(0);
  });
  test("the dialog has no edit button", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);
    await expect(
      dialog.locator('[data-testid="account-switcher-item"]'),
    ).toHaveCount(1);
    await expect(
      dialog.locator('[data-testid="account-switcher-edit"]'),
    ).toHaveCount(0);
  });
});

test.describe("Account switch flow with an account needing re-auth", () => {
  let otherProfile;

  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
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
      { did: otherProfile.did, handle: otherProfile.handle, needsReauth: true },
    ]);
    await page.goto("/");
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows the re-auth state on the account without a session", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    const otherRow = dialog.locator(
      `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
    );
    await expect(otherRow).toHaveAttribute("data-teststate", "reauth");
    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${userProfile.did}"]`,
      ),
    ).toHaveAttribute("data-teststate", "current");
  });

  test("leaves the re-auth account out of the sidebar stack", async ({
    page,
  }) => {
    await page.locator('[data-testid="menu-button"]').click();
    await expect(
      page.locator('[data-testid="sidebar-profile-account-switcher-button"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="sidebar-account-avatar-stack"]'),
    ).toHaveCount(0);
  });

  test("a re-auth account can be removed", async ({ page }) => {
    const dialog = await openSwitcherDialog(page);
    await removeAccountFromDialog(dialog, page, otherProfile.did);

    await expect(
      dialog.locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
      ),
    ).toHaveCount(0);
    expect(await storedAccountDids(page)).toEqual([userProfile.did]);
  });

  test("selecting a re-auth account starts the OAuth flow", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);

    await page.route("**/plc.directory/**", (route) =>
      route.fulfill({ status: 500, body: "" }),
    );
    await dialog
      .locator(
        `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
      )
      .click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page).not.toHaveURL(/\/login/);
    // The account is still saved; only its session is missing.
    const accounts = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("oauth_accounts")),
    );
    expect(accounts.some((account) => account.did === otherProfile.did)).toBe(
      true,
    );
  });
});

test.describe("Account switch flow on desktop", () => {
  test.use({ viewport: { width: 1300, height: 800 } });

  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
    const otherProfile = createProfile({
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
    await expect(page.locator('[data-testid="sidebar-account"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("clicking the sidebar account row opens the switcher", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="sidebar-account-switcher-button"]')
      .click();
    await expect(
      page.locator('[data-testid="account-switcher-dialog"]'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("clicking the sidebar account avatar opens the profile", async ({
    page,
  }) => {
    await page.locator('[data-testid="sidebar-account-avatar"]').click();
    await expect(page).toHaveURL(`/profile/${userProfile.did}`);
    await expect(
      page.locator('[data-testid="account-switcher-dialog"]'),
    ).toHaveCount(0);
  });
});

test.describe("Account switch flow on tablet", () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
    const otherProfile = createProfile({
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
      page.locator('[data-testid="sidebar-account-avatar"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking the sidebar account avatar opens the switcher", async ({
    page,
  }) => {
    const box = await page
      .locator('[data-testid="sidebar-account-avatar"]')
      .boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(
      page.locator('[data-testid="account-switcher-dialog"]'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Account switch flow with many accounts", () => {
  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
    const otherProfiles = Array.from({ length: 11 }, (_, i) =>
      createProfile({
        did: `did:plc:otheruser${i}`,
        handle: `otheruser${i}.bsky.social`,
        displayName: `Other User ${i}`,
      }),
    );
    mockServer.addProfile(userProfile);
    for (const profile of otherProfiles) {
      mockServer.addProfile(profile);
    }
    await mockServer.setup(page);

    await loginWithAccounts(page, [
      { did: userProfile.did, handle: userProfile.handle },
      ...otherProfiles.map((profile) => ({
        did: profile.did,
        handle: profile.handle,
      })),
    ]);
    await page.goto("/");
    await expect(page.locator('[data-testid="footer-nav-home"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("keeps the sign out button visible and scrolls the account list", async ({
    page,
  }) => {
    const dialog = await openSwitcherDialog(page);
    await expect(
      dialog.locator('[data-testid="account-switcher-sign-out"]'),
    ).toBeInViewport();
    const addRow = dialog.locator('[data-testid="account-switcher-add"]');
    await addRow.scrollIntoViewIfNeeded();
    await expect(addRow).toBeInViewport();
  });
});
