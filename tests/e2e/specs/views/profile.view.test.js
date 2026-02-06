import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

const otherUser = createProfile({
  did: "did:plc:otheruser1",
  handle: "otheruser.bsky.social",
  displayName: "Other User",
  followersCount: 120,
  followsCount: 45,
  postsCount: 87,
  description: "Hello, I'm a test user!",
});

function setupProfileRoute(page, profile) {
  return page.route("**/xrpc/app.bsky.actor.getProfile*", (route) => {
    const url = new URL(route.request().url());
    const actor = url.searchParams.get("actor");
    if (actor === profile.did) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profile),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(userProfile),
    });
  });
}

function setupConvoAvailabilityRoute(page, { canChat = false } = {}) {
  return page.route("**/xrpc/chat.bsky.convo.getConvoAvailability*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ canChat }),
    }),
  );
}

test.describe("Profile view", () => {
  test("should display profile name, handle, and stats", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Other User",
      { timeout: 10000 },
    );
    await expect(view.locator(".profile-handle")).toContainText(
      "@otheruser.bsky.social",
    );
    await expect(view.locator('[data-testid="profile-stats"]')).toContainText(
      "120 followers",
    );
    await expect(view.locator('[data-testid="profile-stats"]')).toContainText(
      "45 following",
    );
    await expect(view.locator('[data-testid="profile-stats"]')).toContainText(
      "87 posts",
    );
  });

  test("should display profile description", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator(".profile-description")).toContainText(
      "Hello, I'm a test user!",
      { timeout: 10000 },
    );
  });

  test("should display 'Follows you' badge when the user follows you", async ({
    page,
  }) => {
    const followingUser = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        followedBy: "at://did:plc:otheruser1/app.bsky.graph.follow/abc",
      },
    };
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, followingUser);

    await login(page);
    await page.goto(`/profile/${followingUser.did}`);

    const view = page.locator("#profile-view");
    await expect(
      view.locator('[data-testid="follows-you-badge"]'),
    ).toContainText("Follows you", { timeout: 10000 });
  });

  test("should show '+ Follow' button for unfollowed profiles", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="follow-button"]')).toContainText(
      "+ Follow",
      { timeout: 10000 },
    );
  });

  test("should show 'Following' button for followed profiles", async ({
    page,
  }) => {
    const followedUser = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        following: "at://did:plc:testuser123/app.bsky.graph.follow/xyz",
      },
    };
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, followedUser);

    await login(page);
    await page.goto(`/profile/${followedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="follow-button"]')).toContainText(
      "Following",
      { timeout: 10000 },
    );
  });

  test("should display posts in the author feed", async ({ page }) => {
    const post1 = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "First post by other user",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    const post2 = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post2",
      text: "Second post by other user",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });

    const mockServer = new MockServer();
    mockServer.addAuthorFeedPosts(otherUser.did, "posts_and_author_threads", [
      post1,
      post2,
    ]);
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("First post by other user");
    await expect(view).toContainText("Second post by other user");
  });

  test("should show empty feed message when there are no posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(
      view.locator('[data-testid="feed-end-message"]').first(),
    ).toContainText("Feed is empty.", { timeout: 10000 });
  });

  test("should show Posts, Replies, and Media tabs", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    const tabBar = view.locator(".tab-bar");
    await expect(tabBar.locator(".tab-bar-button")).toHaveCount(3, {
      timeout: 10000,
    });
    await expect(tabBar.locator(".tab-bar-button").nth(0)).toContainText(
      "Posts",
    );
    await expect(tabBar.locator(".tab-bar-button").nth(1)).toContainText(
      "Replies",
    );
    await expect(tabBar.locator(".tab-bar-button").nth(2)).toContainText(
      "Media",
    );
  });

  test("should switch active tab when clicking tab buttons", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    const tabBar = view.locator(".tab-bar");

    // Posts tab should be active by default
    await expect(tabBar.locator(".tab-bar-button.active")).toContainText(
      "Posts",
      { timeout: 10000 },
    );

    // Click Replies tab
    await tabBar.locator(".tab-bar-button", { hasText: "Replies" }).click();
    await expect(tabBar.locator(".tab-bar-button.active")).toContainText(
      "Replies",
    );

    // Click Media tab
    await tabBar.locator(".tab-bar-button", { hasText: "Media" }).click();
    await expect(tabBar.locator(".tab-bar-button.active")).toContainText(
      "Media",
    );

    // Click back to Posts tab
    await tabBar.locator(".tab-bar-button", { hasText: "Posts" }).click();
    await expect(tabBar.locator(".tab-bar-button.active")).toContainText(
      "Posts",
    );
  });

  test("should show Likes tab on own profile", async ({ page }) => {
    const currentUserProfile = {
      ...userProfile,
      followersCount: 10,
      followsCount: 5,
      postsCount: 20,
    };

    const mockServer = new MockServer();
    await mockServer.setup(page);
    // Override getProfile to return enriched current user profile for own DID
    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUserProfile),
      }),
    );

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const view = page.locator("#profile-view");
    const tabBar = view.locator(".tab-bar");
    await expect(tabBar.locator(".tab-bar-button")).toHaveCount(4, {
      timeout: 10000,
    });
    await expect(tabBar.locator(".tab-bar-button").nth(3)).toContainText(
      "Likes",
    );
  });

  test("should not show follow or chat buttons on own profile", async ({
    page,
  }) => {
    const currentUserProfile = {
      ...userProfile,
      followersCount: 10,
      followsCount: 5,
      postsCount: 20,
    };

    const mockServer = new MockServer();
    await mockServer.setup(page);
    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUserProfile),
      }),
    );

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Test User",
      { timeout: 10000 },
    );
    await expect(
      view.locator('[data-testid="follow-button"]'),
    ).not.toBeVisible();
    await expect(view.locator('[data-testid="chat-button"]')).not.toBeVisible();
  });

  test("should show chat button for other users", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page, { canChat: true });
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="chat-button"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display 'User Blocked' badge and hide feed for blocked profiles", async ({
    page,
  }) => {
    const blockedUser = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        blocking: "at://did:plc:testuser123/app.bsky.graph.block/abc",
      },
    };

    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, blockedUser);

    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toContainText(
      "User Blocked",
      { timeout: 10000 },
    );
    await expect(view.locator(".feed-end-message")).toContainText(
      "Posts hidden",
    );
    // Should not show follow button; should show unblock button instead
    await expect(
      view.locator('[data-testid="follow-button"]'),
    ).not.toBeVisible();
    await expect(view.locator('[data-testid="unblock-button"]')).toContainText(
      "Unblock",
    );
  });

  test("should not show 'Follows you' badge for blocked profiles", async ({
    page,
  }) => {
    const blockedFollower = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        followedBy: "at://did:plc:otheruser1/app.bsky.graph.follow/abc",
        blocking: "at://did:plc:testuser123/app.bsky.graph.block/xyz",
      },
    };

    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, blockedFollower);

    await login(page);
    await page.goto(`/profile/${blockedFollower.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="follows-you-badge"]'),
    ).not.toBeVisible();
  });

  test("should navigate to profile by handle", async ({ page }) => {
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post for handle resolution",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.handle}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Other User",
      { timeout: 10000 },
    );
  });

  test("should open context menu with profile actions", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await setupConvoAvailabilityRoute(page);
    await setupProfileRoute(page, otherUser);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Other User",
      { timeout: 10000 },
    );

    // Open context menu
    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await expect(menu.locator("context-menu-item")).toHaveCount(6, {
      timeout: 5000,
    });
    await expect(
      menu.locator("context-menu-item", { hasText: "Open in bsky.app" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Copy link to profile" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Search posts" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Mute Account" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Block Account" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Report account" }),
    ).toBeVisible();
  });
});
