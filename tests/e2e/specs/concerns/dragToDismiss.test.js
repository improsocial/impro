import { test, expect } from "../../base.js";
import { login, loginWithAccounts, longPress } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";
import { userProfile } from "../../fixtures.js";

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

// Dispatches a touchstart→touchmove→touchend sequence on eventSourceSelector.
// startTouchTarget optionally specifies a child element for touchstart (to test ignoreTouchTarget).
async function drag(
  page,
  { eventSourceSelector, startTouchTargetSelector, startY, endY },
) {
  await page.evaluate(
    ({ eventSourceSelector, startTouchTargetSelector, startY, endY }) => {
      const eventSource = document.querySelector(eventSourceSelector);
      const startTarget = startTouchTargetSelector
        ? document.querySelector(startTouchTargetSelector)
        : eventSource;
      const rect = eventSource.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;

      startTarget.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [
            new Touch({
              identifier: 1,
              target: startTarget,
              clientX,
              clientY: startY,
            }),
          ],
          bubbles: true,
          cancelable: true,
        }),
      );
      eventSource.dispatchEvent(
        new TouchEvent("touchmove", {
          touches: [
            new Touch({
              identifier: 1,
              target: startTarget,
              clientX,
              clientY: endY,
            }),
          ],
          bubbles: true,
          cancelable: true,
        }),
      );
      eventSource.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [
            new Touch({
              identifier: 1,
              target: startTarget,
              clientX,
              clientY: endY,
            }),
          ],
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { eventSourceSelector, startTouchTargetSelector, startY, endY },
  );
}

// Simulate the on-screen keyboard by shrinking the visual viewport, which is
// how drag-to-dismiss detects the keyboard is up.
async function simulateKeyboardOpen(page) {
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      get: () => window.innerHeight - 300,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
}

async function setupFeedWithPost(page) {
  const mockServer = new MockServer();
  const post = createPost({
    uri: "at://did:plc:author1/app.bsky.feed.post/post1",
    text: "A post",
    authorHandle: "author1.bsky.social",
    authorDisplayName: "Author One",
  });
  mockServer.addTimelinePosts([post]);
  await mockServer.setup(page);
  await login(page);
  await page.goto("/");
  await expect(
    page.locator("#home-view").locator('[data-testid="feed-item"]'),
  ).toHaveCount(1, { timeout: 10000 });
}

test.describe("Drag-to-dismiss", () => {
  test.describe("report dialog", () => {
    async function openReportDialog(page) {
      await setupFeedWithPost(page);
      await page
        .locator('#home-view [data-testid="feed-item"] .text-button')
        .click();
      await page.locator('[data-testid="menu-action-post-report"]').click();
      const reportDialog = page.locator("report-dialog .report-dialog");
      await expect(reportDialog).toBeVisible({ timeout: 5000 });
      return reportDialog;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startY: 300,
        endY: 400,
      });
      await expect(
        page.locator("report-dialog .report-dialog"),
      ).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const reportDialog = await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startY: 300,
        endY: 330,
      });
      await expect(reportDialog).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const reportDialog = await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startTouchTargetSelector: "report-dialog .report-option-card",
        startY: 300,
        endY: 430,
      });
      await expect(reportDialog).toBeVisible();
    });

    test("does not dismiss while the keyboard is open", async ({ page }) => {
      const reportDialog = await openReportDialog(page);
      await simulateKeyboardOpen(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startY: 300,
        endY: 430,
      });
      await expect(reportDialog).toBeVisible();
    });

    test("does not dismiss when the body is scrolled away from the top", async ({
      page,
    }) => {
      // A short viewport forces the stepper body to overflow and scroll.
      await page.setViewportSize({ width: 390, height: 400 });
      const reportDialog = await openReportDialog(page);

      const scrollTop = await reportDialog
        .locator(".report-dialog-body")
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
      expect(scrollTop).toBeGreaterThan(0);

      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startTouchTargetSelector: "report-dialog .report-step-header",
        startY: 200,
        endY: 380,
      });
      await expect(reportDialog).toBeVisible();
    });
  });

  test.describe("edit profile dialog", () => {
    async function openEditProfileDialog(page) {
      const mockServer = new MockServer();
      mockServer.addProfile(
        createProfile({
          did: userProfile.did,
          handle: userProfile.handle,
          displayName: "Test User",
          description: "Original description",
        }),
      );
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userProfile.did}`);
      await page
        .locator('#profile-view [data-testid="edit-profile-button"]')
        .click({ timeout: 10000 });
      const dialog = page.locator("edit-profile-dialog .edit-profile-dialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      return dialog;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openEditProfileDialog(page);
      await drag(page, {
        eventSourceSelector: "edit-profile-dialog .edit-profile-dialog",
        startY: 300,
        endY: 400,
      });
      await expect(
        page.locator("edit-profile-dialog .edit-profile-dialog"),
      ).not.toBeVisible({ timeout: 2000 });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const dialog = await openEditProfileDialog(page);
      await drag(page, {
        eventSourceSelector: "edit-profile-dialog .edit-profile-dialog",
        startY: 300,
        endY: 330,
      });
      await expect(dialog).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const dialog = await openEditProfileDialog(page);
      await drag(page, {
        eventSourceSelector: "edit-profile-dialog .edit-profile-dialog",
        startTouchTargetSelector:
          "edit-profile-dialog .edit-profile-dialog button",
        startY: 300,
        endY: 430,
      });
      await expect(dialog).toBeVisible();
    });

    test("does not dismiss while the keyboard is open", async ({ page }) => {
      const dialog = await openEditProfileDialog(page);
      await simulateKeyboardOpen(page);
      await drag(page, {
        eventSourceSelector: "edit-profile-dialog .edit-profile-dialog",
        startY: 300,
        endY: 430,
      });
      await expect(dialog).toBeVisible();
    });

    test("does not dismiss when the body is scrolled away from the top", async ({
      page,
    }) => {
      // A short viewport forces the dialog body to overflow and scroll.
      await page.setViewportSize({ width: 390, height: 400 });
      const dialog = await openEditProfileDialog(page);

      const scrollTop = await dialog
        .locator(".edit-profile-dialog-content")
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
      expect(scrollTop).toBeGreaterThan(0);

      await drag(page, {
        eventSourceSelector: "edit-profile-dialog .edit-profile-dialog",
        startTouchTargetSelector: "edit-profile-dialog .edit-profile-field",
        startY: 200,
        endY: 380,
      });
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("context menu", () => {
    async function openContextMenu(page) {
      await setupFeedWithPost(page);
      await page
        .locator('#home-view [data-testid="feed-item"] .text-button')
        .click();
      const contextMenu = page.locator("context-menu .context-menu[open]");
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      return contextMenu;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startY: 300,
        endY: 400,
      });
      await expect(
        page.locator("context-menu .context-menu[open]"),
      ).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const contextMenu = await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startY: 300,
        endY: 330,
      });
      await expect(contextMenu).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const contextMenu = await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startTouchTargetSelector: "context-menu context-menu-item button",
        startY: 300,
        endY: 430,
      });
      await expect(contextMenu).toBeVisible();
    });

    // Suppressing dismiss while the keyboard is open is the default, so this
    // caller gets it without opting in.
    test("does not dismiss while the keyboard is open", async ({ page }) => {
      const contextMenu = await openContextMenu(page);
      await simulateKeyboardOpen(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startY: 300,
        endY: 400,
      });
      await expect(contextMenu).toBeVisible();
    });
  });

  test.describe("post notifications dialog", () => {
    async function openPostNotificationsDialog(page) {
      const otherUser = createProfile({
        did: "did:plc:otheruser1",
        handle: "otheruser.bsky.social",
        displayName: "Other User",
        viewer: {
          following: "at://did:plc:testuser123/app.bsky.graph.follow/xyz",
        },
      });
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);
      await page
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });
      const dialog = page.locator(
        "post-notifications-dialog .post-notifications-dialog",
      );
      await expect(dialog).toBeVisible({ timeout: 5000 });
      return dialog;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openPostNotificationsDialog(page);
      await drag(page, {
        eventSourceSelector:
          "post-notifications-dialog .post-notifications-dialog",
        startY: 600,
        endY: 700,
      });
      await expect(
        page.locator("post-notifications-dialog .post-notifications-dialog"),
      ).not.toBeVisible({ timeout: 2000 });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const dialog = await openPostNotificationsDialog(page);
      await drag(page, {
        eventSourceSelector:
          "post-notifications-dialog .post-notifications-dialog",
        startY: 600,
        endY: 630,
      });
      await expect(dialog).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const dialog = await openPostNotificationsDialog(page);
      await drag(page, {
        eventSourceSelector:
          "post-notifications-dialog .post-notifications-dialog",
        startTouchTargetSelector:
          "post-notifications-dialog .post-notifications-dialog-save",
        startY: 600,
        endY: 730,
      });
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("post composer", () => {
    async function openPostComposer(page) {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/");
      await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="floating-compose-button"]').click();
      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 5000 });
      return composer;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startY: 300,
        endY: 400,
      });
      await expect(
        page.locator("post-composer .post-composer"),
      ).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const composer = await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startY: 300,
        endY: 330,
      });
      await expect(composer).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const composer = await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startTouchTargetSelector: "post-composer .post-composer button",
        startY: 300,
        endY: 430,
      });
      await expect(composer).toBeVisible();
    });

    test("does not dismiss while the keyboard is open", async ({ page }) => {
      const composer = await openPostComposer(page);
      await simulateKeyboardOpen(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startY: 300,
        endY: 430,
      });
      await expect(composer).toBeVisible();
    });

    test("does not dismiss when the body is scrolled away from the top", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const originalPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "This is a very long quoted post. ".repeat(40),
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      mockServer.addTimelinePosts([originalPost]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/");

      const feedItem = page.locator('#home-view [data-testid="feed-item"]');
      await expect(feedItem).toHaveCount(1, { timeout: 10000 });
      await feedItem.locator('[data-testid="repost-button"]').click();
      await page.locator('[data-testid="menu-action-quote-post"]').click();

      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 10000 });

      // Wait for the editor's auto-focus to settle, then blur it, so its
      // scroll-into-view can't reset our scroll position mid-test.
      const editor = composer.locator(".rich-text-input");
      await expect(editor).toBeFocused();
      await editor.evaluate((element) => element.blur());

      // Scroll the body down; a dismiss drag should now scroll instead.
      const scrollTop = await composer
        .locator(".post-composer-scroll-area")
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
      expect(scrollTop).toBeGreaterThan(0);

      await drag(page, {
        eventSourceSelector: "post-composer .post-composer-scroll-area",
        startTouchTargetSelector: "post-composer .post-composer-embed-preview",
        startY: 400,
        endY: 600,
      });
      await expect(composer).toBeVisible();
    });
  });

  test.describe("account switcher dialog", () => {
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

    async function openAccountSwitcher(page) {
      await longPress(page, page.locator('[data-testid="footer-nav-profile"]'));
      const dialog = page.locator('[data-testid="account-switcher-dialog"]');
      await expect(dialog).toBeVisible();
      return dialog;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openAccountSwitcher(page);
      await drag(page, {
        eventSourceSelector: '[data-testid="account-switcher-dialog"]',
        startY: 600,
        endY: 700,
      });
      await expect(
        page.locator('[data-testid="account-switcher-dialog"]'),
      ).toHaveCount(0, { timeout: 2000 });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const dialog = await openAccountSwitcher(page);
      await drag(page, {
        eventSourceSelector: '[data-testid="account-switcher-dialog"]',
        startY: 600,
        endY: 630,
      });
      await expect(dialog).toBeVisible();
    });

    test("drag starting on an account row does not dismiss", async ({
      page,
    }) => {
      const dialog = await openAccountSwitcher(page);
      await drag(page, {
        eventSourceSelector: '[data-testid="account-switcher-dialog"]',
        startTouchTargetSelector: '[data-testid="account-switcher-item"]',
        startY: 600,
        endY: 730,
      });
      await expect(dialog).toBeVisible();
    });

    test("does not dismiss while a switch is pending", async ({ page }) => {
      const dialog = await openAccountSwitcher(page);
      await mockServer.blockNavigations(page);
      await dialog
        .locator(
          `[data-testid="account-switcher-item"][data-did="${otherProfile.did}"]`,
        )
        .click();
      await expect(
        dialog.locator('[data-testid="account-spinner"]'),
      ).toBeVisible();

      await drag(page, {
        eventSourceSelector: '[data-testid="account-switcher-dialog"]',
        startY: 600,
        endY: 730,
      });
      await expect(dialog).toBeVisible();
    });
  });
});
