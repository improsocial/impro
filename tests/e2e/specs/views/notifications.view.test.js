import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
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

test.describe("Notifications view", () => {
  test("should display empty state when there are no notifications", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator(".feed-end-message")).toContainText(
      "No notifications yet!",
      { timeout: 10000 },
    );
  });

  test("should display a follow notification", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addNotifications([
      createNotification({
        reason: "follow",
        author: alice,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    const item = view.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("Alice");
    await expect(item).toContainText("followed you");
  });

  test("should display a like notification with post preview", async ({
    page,
  }) => {
    const likedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/liked1",
      text: "My awesome post",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([likedPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: likedPost.uri,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    const item = view.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("Alice");
    await expect(item).toContainText("liked your post");
    await expect(view.locator(".notification-preview-text")).toContainText(
      "My awesome post",
    );
  });

  test("should display a repost notification with post preview", async ({
    page,
  }) => {
    const repostedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/reposted1",
      text: "Reposted content",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([repostedPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "repost",
        author: bob,
        reasonSubject: repostedPost.uri,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    const item = view.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("Bob");
    await expect(item).toContainText("reposted your post");
    await expect(view.locator(".notification-preview-text")).toContainText(
      "Reposted content",
    );
  });

  test("should group multiple likes on the same post", async ({ page }) => {
    const likedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/popular1",
      text: "Popular post",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([likedPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: likedPost.uri,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "like",
        author: bob,
        reasonSubject: likedPost.uri,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "like",
        author: charlie,
        reasonSubject: likedPost.uri,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    // Should be grouped into a single notification item
    const item = view.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("Alice");
    await expect(item).toContainText("2 others");
    await expect(item).toContainText("liked your post");
    // Should show 3 avatars
    await expect(item.locator(".notification-avatar")).toHaveCount(3);
  });

  test("should group multiple follows together", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addNotifications([
      createNotification({
        reason: "follow",
        author: alice,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "follow",
        author: bob,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    const item = view.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("Alice");
    await expect(item).toContainText("1 other");
    await expect(item).toContainText("followed you");
    await expect(item.locator(".notification-avatar")).toHaveCount(2);
  });

  test("should display a reply notification as a post", async ({ page }) => {
    const replyPostUri = "at://did:plc:alice1/app.bsky.feed.post/reply1";
    const parentPostUri = "at://did:plc:testuser123/app.bsky.feed.post/parent1";

    const replyPost = createPost({
      uri: replyPostUri,
      text: "Great point!",
      authorHandle: "alice.bsky.social",
      authorDisplayName: "Alice",
    });
    replyPost.record.reply = {
      parent: { uri: parentPostUri, cid: "bafyparent" },
      root: { uri: parentPostUri, cid: "bafyroot" },
    };

    const parentPost = createPost({
      uri: parentPostUri,
      text: "Original thought",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([replyPost, parentPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "reply",
        author: alice,
        uri: replyPostUri,
        reasonSubject: parentPostUri,
        record: {
          $type: "app.bsky.feed.post",
          text: "Great point!",
          reply: {
            parent: { uri: parentPostUri, cid: "bafyparent" },
            root: { uri: parentPostUri, cid: "bafyroot" },
          },
          createdAt: new Date().toISOString(),
        },
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view).toContainText("Great point!", { timeout: 10000 });
  });

  test("should show unread indicator on unread notifications", async ({
    page,
  }) => {
    const likedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/post1",
      text: "Test post",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([likedPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: likedPost.uri,
        isRead: false,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "follow",
        author: bob,
        isRead: true,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator(".notification-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view.locator(".notification-item.unread")).toHaveCount(1);
  });

  test("should display different notification types together", async ({
    page,
  }) => {
    const likedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/liked1",
      text: "Liked post text",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const repostedPost = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/reposted1",
      text: "Reposted post text",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([likedPost, repostedPost]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: likedPost.uri,
        indexedAt: "2025-01-15T14:00:00.000Z",
      }),
      createNotification({
        reason: "repost",
        author: bob,
        reasonSubject: repostedPost.uri,
        indexedAt: "2025-01-15T13:00:00.000Z",
      }),
      createNotification({
        reason: "follow",
        author: charlie,
        indexedAt: "2025-01-15T12:00:00.000Z",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    const items = view.locator(".notification-item");
    await expect(items).toHaveCount(3, { timeout: 10000 });
    await expect(items.nth(0)).toContainText("liked your post");
    await expect(items.nth(1)).toContainText("reposted your post");
    await expect(items.nth(2)).toContainText("followed you");
  });

  test("should show 'Post unavailable' for deleted posts", async ({ page }) => {
    // Don't add the post to mockServer.posts so it becomes unavailable
    const mockServer = new MockServer();
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: "at://did:plc:testuser123/app.bsky.feed.post/deleted1",
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator(".notification-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("liked your post");
    await expect(view.locator(".unavailable-post")).toContainText(
      "Post unavailable",
    );
  });

  test("should display post preview with images", async ({ page }) => {
    const postWithImages = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/img1",
      text: "Check out these photos",
      authorHandle: "testuser.bsky.social",
      authorDisplayName: "Test User",
    });
    postWithImages.record.embed = {
      $type: "app.bsky.embed.images",
      images: [
        { alt: "Photo 1", image: { ref: "img1" } },
        { alt: "Photo 2", image: { ref: "img2" } },
      ],
    };
    postWithImages.embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        { thumb: "http://localhost/img1.jpg", alt: "Photo 1" },
        { thumb: "http://localhost/img2.jpg", alt: "Photo 2" },
      ],
    };

    const mockServer = new MockServer();
    mockServer.addPosts([postWithImages]);
    mockServer.addNotifications([
      createNotification({
        reason: "like",
        author: alice,
        reasonSubject: postWithImages.uri,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator(".notification-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view.locator(".notification-preview-image")).toHaveCount(2);
  });

  test("should display 'No more notifications' at end of list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addNotifications([
      createNotification({
        reason: "follow",
        author: alice,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    // No cursor means no more notifications
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator(".notification-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view.locator(".feed-end-message")).toContainText(
      "No more notifications",
    );
  });

  test("should display header with 'Notifications' title", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const view = page.locator("#notifications-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Notifications",
      { timeout: 10000 },
    );
  });
});
