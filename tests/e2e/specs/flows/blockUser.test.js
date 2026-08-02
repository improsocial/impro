import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createNotification,
  createPost,
  createProfile,
} from "../../../shared/factories.js";

test.describe("Block user flow", () => {
  test("should hide posts from home feed and show blocked state on profile after blocking", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from user to block",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is visible on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post from user to block");

    // Navigate to the user's profile and block them
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    await profileView.locator(".ellipsis-button").click();
    await page.locator('[data-testid="menu-action-profile-block"]').click();

    // Confirm the block in the confirmation dialog
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for the profile to show blocked state
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("You are blocking this user", { timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="unblock-button"]'),
    ).toContainText("Unblock");

    // Navigate back to home and verify posts are hidden
    await page.goto("/");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate back to profile and verify blocked state persists
    await page.goto(`/profile/${otherUser.did}`);
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("You are blocking this user", { timeout: 10000 });
  });

  test("should block a user from a post context menu and filter their posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from user to block via menu",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is visible on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });
    await expect(homeView).toContainText("Post from user to block via menu");

    // Open the post's context menu and block the user
    await feedItem.locator(".text-button").click();
    await page.locator('[data-testid="menu-action-post-block"]').click();

    // Confirm the block in the confirmation dialog
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Verify a toast confirms the block action
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 5000,
    });

    // Verify the post is filtered out of the feed
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to the blocked user's profile and verify blocked state
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("You are blocking this user", { timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="unblock-button"]'),
    ).toContainText("Unblock");
  });

  test("should not block the user when the confirmation dialog is cancelled", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post that should remain visible",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    await profileView.locator(".ellipsis-button").click();
    await page.locator('[data-testid="menu-action-profile-block"]').click();

    // Cancel the confirmation dialog
    const cancelButton = page.locator("button.cancel-button");
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // Profile should remain unblocked
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).not.toBeVisible();
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toBeVisible();

    // Posts should still appear on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post that should remain visible");
  });

  test("should back-navigate when blocking the author from a post thread", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post whose author I want to block",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Start on home so there's a page to go back to
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });

    // Navigate into the post thread
    await page.goto(`/profile/${otherUser.handle}/post/post1`);
    const threadView = page.locator("#post-detail-view");
    const largePost = threadView.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    // Block the author from the post thread's context menu
    await largePost.locator('[data-testid="post-action-more"]').click();
    await page.locator('[data-testid="menu-action-post-block"]').click();

    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Should back-navigate to home and the blocked user's post should be gone
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should not back-navigate when the block confirmation is cancelled", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post whose author I might block",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);

    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });

    await page.goto(`/profile/${otherUser.handle}/post/post1`);
    const threadView = page.locator("#post-detail-view");
    const largePost = threadView.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    await largePost.locator('[data-testid="post-action-more"]').click();
    await page.locator('[data-testid="menu-action-post-block"]').click();

    const cancelButton = page.locator('[data-testid="modal-cancel-button"]');
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // We should still be in the post thread — no back-navigation should happen
    await expect(threadView).toBeVisible();
    await expect(largePost).toBeVisible();
    await expect(largePost).toContainText("Post whose author I might block");
  });

  test("should not back-navigate when blocking the author fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post whose author I want to block",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    mockServer.addPosts([post]);
    mockServer.failCreateRecord("app.bsky.graph.block");
    await mockServer.setup(page);

    await login(page);

    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });

    await page.goto(`/profile/${otherUser.handle}/post/post1`);
    const threadView = page.locator("#post-detail-view");
    const largePost = threadView.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    await largePost.locator('[data-testid="post-action-more"]').click();
    await page.locator('[data-testid="menu-action-post-block"]').click();

    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // The block failed — we should still be on the post thread
    await expect(threadView).toBeVisible();
    await expect(largePost).toBeVisible();
    await expect(largePost).toContainText("Post whose author I want to block");
  });

  test("should immediately hide a blocked user's reply from the thread", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const mainPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/thread1",
      text: "Main thread post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 1,
    });

    const replier = createProfile({
      did: "did:plc:replier1",
      handle: "replier1.bsky.social",
      displayName: "Replier One",
    });

    const reply = createPost({
      uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
      text: "Reply from soon-to-be-blocked user",
      authorHandle: replier.handle,
      authorDisplayName: replier.displayName,
      reply: {
        parent: { uri: mainPost.uri, cid: mainPost.cid },
        root: { uri: mainPost.uri, cid: mainPost.cid },
      },
    });

    mockServer.addProfile(replier);
    mockServer.addPosts([mainPost, reply]);
    mockServer.setPostThread(mainPost.uri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: mainPost,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: reply,
          replies: [],
        },
      ],
    });
    await mockServer.setup(page);

    await login(page);

    await page.goto("/profile/author1.bsky.social/post/thread1");

    const view = page.locator("#post-detail-view");
    await expect(view).toContainText("Reply from soon-to-be-blocked user", {
      timeout: 10000,
    });

    // Block the reply's author from the reply's context menu
    const replyPost = view.locator('[data-testid="small-post"]');
    await replyPost.locator(".text-button").click();
    await page.locator('[data-testid="menu-action-post-block"]').click();

    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // The reply should disappear from the thread without a refresh
    await expect(view).not.toContainText("Reply from soon-to-be-blocked user", {
      timeout: 10000,
    });
  });

  test("should show content again after unblocking a user", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const blockedUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
      viewer: {
        blocking: "at://did:plc:testuser123/app.bsky.graph.block/block1",
      },
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from blocked user",
      authorHandle: blockedUser.handle,
      authorDisplayName: blockedUser.displayName,
    });
    mockServer.addProfile(blockedUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify posts are hidden on home initially (user is blocked)
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to blocked user's profile and unblock
    await page.goto(`/profile/${blockedUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("You are blocking this user", { timeout: 10000 });

    await profileView.locator('[data-testid="unblock-button"]').click();

    // Verify the blocked badge is gone and follow button returns
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).not.toBeVisible({ timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toBeVisible();

    // Navigate to home and verify posts reappear
    await page.goto("/");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post from blocked user");
  });

  test("should filter notifications from a blocked author", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const nicePerson = createProfile({
      did: "did:plc:nice1",
      handle: "nice.bsky.social",
      displayName: "Nice Person",
    });
    const soonBlocked = createProfile({
      did: "did:plc:blocker1",
      handle: "blocker.bsky.social",
      displayName: "Soon To Be Blocked",
    });
    mockServer.addProfile(nicePerson);
    mockServer.addProfile(soonBlocked);
    // soonBlocked listed first so its display name is the visible one in the
    // grouped follow notification; after blocking, nicePerson takes its place.
    mockServer.addNotifications([
      createNotification({
        reason: "follow",
        author: soonBlocked,
        uri: `at://${soonBlocked.did}/app.bsky.graph.follow/n1`,
        indexedAt: new Date().toISOString(),
      }),
      createNotification({
        reason: "follow",
        author: nicePerson,
        uri: `at://${nicePerson.did}/app.bsky.graph.follow/n2`,
        indexedAt: new Date().toISOString(),
      }),
    ]);
    await mockServer.setup(page);

    await login(page);

    await page.goto("/notifications");
    const notificationsView = page.locator("#notifications-view");
    await expect(notificationsView).toContainText("Soon To Be Blocked", {
      timeout: 10000,
    });

    // Block one of the notification authors from their profile
    await page.goto(`/profile/${soonBlocked.did}`);
    const profileView = page.locator("#profile-view");
    await profileView.locator(".ellipsis-button").click();
    await page.locator('[data-testid="menu-action-profile-block"]').click();
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toBeVisible({ timeout: 10000 });

    // The blocked user's notification should be filtered out
    await page.goto("/notifications");
    await expect(notificationsView).toContainText("Nice Person", {
      timeout: 10000,
    });
    await expect(notificationsView).not.toContainText("Soon To Be Blocked");
  });
});
