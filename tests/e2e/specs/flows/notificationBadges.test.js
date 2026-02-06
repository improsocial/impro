import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createMessage,
  createNotification,
  createPost,
  createProfile,
} from "../../factories.js";

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
});

const bob = createProfile({
  did: "did:plc:bob1",
  handle: "bob.bsky.social",
  displayName: "Bob",
});

const charlie = createProfile({
  did: "did:plc:charlie1",
  handle: "charlie.bsky.social",
  displayName: "Charlie",
});

test.describe("Notification and Chat Badges", () => {
  test("should show notification unread count badge in sidebar", async ({
    page,
  }) => {
    const post = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/badge1",
      text: "Badge test post",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: post.uri,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "follow",
        author: bob,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "repost",
        author: charlie,
        reasonSubject: post.uri,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const badge = page.locator(
      '[data-testid="sidebar-nav-notifications"] [data-testid="status-badge"]',
    );
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toContainText("3");
  });

  test("should clear notification badge after viewing notifications", async ({
    page,
  }) => {
    const post = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/badge2",
      text: "Another test post",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: post.uri,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "follow",
        author: bob,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    // Verify badge shows before visiting notifications
    const badge = page.locator(
      '[data-testid="sidebar-nav-notifications"] [data-testid="status-badge"]',
    );
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toContainText("2");

    // Navigate to notifications — this calls updateSeen
    const updateSeenPromise = page.waitForRequest((req) =>
      req.url().includes("app.bsky.notification.updateSeen"),
    );
    await page.locator('[data-testid="sidebar-nav-notifications"]').click();

    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
    await updateSeenPromise;

    // Badge should disappear after notifications are marked as seen
    await expect(badge).toBeHidden({ timeout: 10000 });
  });

  test("should show chat unread badge and clear after reading messages", async ({
    page,
  }) => {
    const aliceConvo = createConvo({
      id: "convo-badge-1",
      otherMember: alice,
      lastMessage: createMessage({
        id: "msg-badge-1",
        text: "Unread from Alice",
        senderDid: alice.did,
      }),
      unreadCount: 3,
    });

    const bobConvo = createConvo({
      id: "convo-badge-2",
      otherMember: bob,
      lastMessage: createMessage({
        id: "msg-badge-2",
        text: "Unread from Bob",
        senderDid: bob.did,
      }),
      unreadCount: 1,
    });

    const mockServer = new MockServer();
    mockServer.addConvos([aliceConvo, bobConvo]);
    mockServer.addConvoMessages("convo-badge-1", [
      createMessage({
        id: "msg-badge-1",
        text: "Unread from Alice",
        senderDid: alice.did,
      }),
    ]);
    mockServer.addConvoMessages("convo-badge-2", [
      createMessage({
        id: "msg-badge-2",
        text: "Unread from Bob",
        senderDid: bob.did,
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    // Verify chat badge shows count of 2 unread conversations
    const homeView = page.locator("#home-view");
    const chatBadge = homeView.locator(
      '[data-testid="sidebar-nav-chat"] .status-badge-text',
    );
    await expect(chatBadge).toBeVisible({ timeout: 10000 });
    await expect(chatBadge).toContainText("2");

    // Navigate to chat and open Alice's conversation (triggers updateRead)
    await homeView.locator('[data-testid="sidebar-nav-chat"]').click();
    await expect(page.locator("#chat-view")).toBeVisible({ timeout: 10000 });

    await page.locator("#chat-view .convo-item").first().click();
    await expect(page.locator("#chat-detail-view")).toBeVisible({
      timeout: 10000,
    });

    // Navigate to home to verify badge updated
    await page
      .locator('#chat-detail-view [data-testid="sidebar-nav-home"]')
      .click();
    await expect(homeView).toBeVisible({ timeout: 10000 });

    // Chat badge should now show 1 (only Bob's convo is still unread)
    await expect(
      homeView.locator('[data-testid="sidebar-nav-chat"] .status-badge-text'),
    ).toContainText("1", { timeout: 15000 });
  });

  test.describe("Footer badges (mobile)", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("should show notification unread count badge in footer", async ({
      page,
    }) => {
      const post = createPost({
        uri: "at://did:plc:testuser123/app.bsky.feed.post/badge3",
        text: "Footer badge test",
        authorHandle: "testuser.bsky.social",
        authorDisplayName: "Test User",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([post]);
      mockServer.addNotifications([
        createNotification({
          reason: "like",
          author: alice,
          reasonSubject: post.uri,
          isRead: false,
          indexedAt: new Date().toISOString(),
        }),
        createNotification({
          reason: "follow",
          author: bob,
          isRead: false,
          indexedAt: new Date().toISOString(),
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

      const badge = page.locator(
        '[data-testid="footer-nav-notifications"] [data-testid="status-badge"]',
      );
      await expect(badge).toBeVisible({ timeout: 10000 });
      await expect(badge).toContainText("2");
    });
  });
});
