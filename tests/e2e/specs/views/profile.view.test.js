import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import {
  createPost,
  createProfile,
  createFeedGenerator,
  createLabelerView,
} from "../../factories.js";

const otherUser = createProfile({
  did: "did:plc:otheruser1",
  handle: "otheruser.bsky.social",
  displayName: "Other User",
  followersCount: 120,
  followsCount: 45,
  postsCount: 87,
  description: "Hello, I'm a test user!",
});

const labelerUser = createProfile({
  did: "did:plc:labeler123",
  handle: "testlabeler.bsky.social",
  displayName: "Test Labeler",
  followersCount: 500,
  followsCount: 10,
  postsCount: 0,
  description: "A test labeler service",
  associated: { labeler: true },
});

const labelerView = createLabelerView({
  did: "did:plc:labeler123",
  handle: "testlabeler.bsky.social",
  displayName: "Test Labeler",
  creator: labelerUser,
  labelDefinitions: [
    {
      identifier: "custom-label",
      severity: "alert",
      blurs: "content",
      defaultSetting: "warn",
      adultOnly: false,
      locales: [
        {
          lang: "en",
          name: "Custom Label",
          description: "This is a custom content label",
        },
      ],
    },
    {
      identifier: "badge-label",
      severity: "inform",
      blurs: "none",
      defaultSetting: "warn",
      adultOnly: false,
      locales: [
        {
          lang: "en",
          name: "Badge Label",
          description: "This is a badge-type label",
        },
      ],
    },
    {
      identifier: "!system-label",
      severity: "alert",
      blurs: "content",
      defaultSetting: "hide",
      adultOnly: false,
      locales: [
        {
          lang: "en",
          name: "System Label",
          description: "This is a non-configurable system label",
        },
      ],
    },
  ],
});

test.describe("Profile view", () => {
  test("should display profile name, handle, and stats", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(followingUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(followedUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(otherUser);
    mockServer.addAuthorFeedPosts(otherUser.did, "posts_and_author_threads", [
      post1,
      post2,
    ]);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("First post by other user");
    await expect(view).toContainText("Second post by other user");
  });

  test("should load more posts when scrolling to the bottom of profile feed", async ({
    page,
  }) => {
    const posts = [];
    for (let i = 1; i <= 60; i++) {
      posts.push(
        createPost({
          uri: `at://did:plc:otheruser1/app.bsky.feed.post/profilepost${i}`,
          text: `Profile post ${i}`,
          authorHandle: otherUser.handle,
          authorDisplayName: otherUser.displayName,
        }),
      );
    }

    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    mockServer.addAuthorFeedPosts(
      otherUser.did,
      "posts_and_author_threads",
      posts,
    );
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    const items = view.locator('[data-testid="feed-item"]');

    // Wait for initial batch to load
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await items.count();
    expect(initialCount).toBeLessThan(60);

    // Scroll to bottom to trigger infinite scroll
    await items.last().scrollIntoViewIfNeeded();

    // Verify more posts loaded
    await expect(items).toHaveCount(60, { timeout: 10000 });
    await expect(view).toContainText("Profile post 60");
  });

  test("should show empty feed message when there are no posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(
      view.locator('[data-testid="feed-end-message"]').first(),
    ).toContainText("Feed is empty.", { timeout: 10000 });
  });

  test("should show Posts, Replies, and Media tabs", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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
    mockServer.addProfile(currentUserProfile);
    await mockServer.setup(page);

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
    mockServer.addProfile(currentUserProfile);
    await mockServer.setup(page);

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
    mockServer.addProfile({ ...otherUser, canChat: true });
    await mockServer.setup(page);

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
    mockServer.addProfile(blockedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toContainText(
      "You are blocking this user",
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
    mockServer.addProfile(blockedFollower);
    await mockServer.setup(page);
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

  test("should hide profile stats when profile is blocked", async ({
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
    mockServer.addProfile(blockedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="profile-stats"]'),
    ).not.toBeVisible();
  });

  test("should hide profile description when profile is blocked", async ({
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
    mockServer.addProfile(blockedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".profile-description")).not.toBeVisible();
  });

  test("should hide tab bar and show 'Posts hidden' for blocked profiles", async ({
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
    mockServer.addProfile(blockedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".tab-bar")).not.toBeVisible();
    await expect(view.locator(".feed-end-message")).toContainText(
      "Posts hidden",
    );
  });

  test("should navigate to profile by handle", async ({ page }) => {
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post for handle resolution",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });

    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    mockServer.addPosts([post]);
    await mockServer.setup(page);
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
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
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

  test("should show 'Unmute Account' in context menu for muted profiles", async ({
    page,
  }) => {
    const mutedUser = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        muted: true,
      },
    };

    const mockServer = new MockServer();
    mockServer.addProfile(mutedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${mutedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Other User",
      { timeout: 10000 },
    );

    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await expect(
      menu.locator("context-menu-item", { hasText: "Unmute Account" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      menu.locator("context-menu-item", { hasText: /^Mute Account$/ }),
    ).not.toBeVisible();
  });

  test("should show 'Unblock Account' in context menu for blocked profiles", async ({
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
    mockServer.addProfile(blockedUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="blocked-badge"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await expect(
      menu.locator("context-menu-item", { hasText: "Unblock Account" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      menu.locator("context-menu-item", { hasText: /^Block Account$/ }),
    ).not.toBeVisible();
  });

  test("should not show moderation actions on own profile context menu", async ({
    page,
  }) => {
    const currentUserProfile = {
      ...userProfile,
      followersCount: 10,
      followsCount: 5,
      postsCount: 20,
    };

    const mockServer = new MockServer();
    mockServer.addProfile(currentUserProfile);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Test User",
      { timeout: 10000 },
    );

    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await expect(menu.locator("context-menu-item")).toHaveCount(3, {
      timeout: 5000,
    });
    await expect(
      menu.locator("context-menu-item", { hasText: "Search posts" }),
    ).toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Mute Account" }),
    ).not.toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Block Account" }),
    ).not.toBeVisible();
    await expect(
      menu.locator("context-menu-item", { hasText: "Report account" }),
    ).not.toBeVisible();
  });

  test("should navigate to search page when clicking 'Search posts' on another user's profile", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Other User",
      { timeout: 10000 },
    );

    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await menu
      .locator("context-menu-item", { hasText: "Search posts" })
      .click();

    await expect(page).toHaveURL(
      /\/search\?q=from%3A%40otheruser\.bsky\.social&tab=posts/,
      { timeout: 10000 },
    );
  });

  test("should navigate to search page when clicking 'Search posts' on own profile", async ({
    page,
  }) => {
    const currentUserProfile = {
      ...userProfile,
      followersCount: 10,
      followsCount: 5,
      postsCount: 20,
    };

    const mockServer = new MockServer();
    mockServer.addProfile(currentUserProfile);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const view = page.locator("#profile-view");
    await expect(view.locator('[data-testid="profile-name"]')).toContainText(
      "Test User",
      { timeout: 10000 },
    );

    await view.locator(".ellipsis-button").click();

    const menu = view.locator("context-menu");
    await menu
      .locator("context-menu-item", { hasText: "Search posts" })
      .click();

    await expect(page).toHaveURL(
      /\/search\?q=from%3A%40testuser\.bsky\.social&tab=posts/,
      { timeout: 10000 },
    );
  });

  test("should display generic error when profile fails to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // Override getProfile to return 500 for a specific actor
    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      if (actor === "did:plc:erroruser") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "InternalServerError" }),
        });
      }
      return route.fallback();
    });

    await login(page);
    await page.goto("/profile/did:plc:erroruser");

    const view = page.locator("#profile-view");
    await expect(view.locator(".error-state")).toContainText(
      "There was an error loading the profile.",
      { timeout: 10000 },
    );
  });

  test("should display invalid handle error for malformed handles", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // Override getProfile to return 400 with invalid handle message
    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      if (actor === "did:plc:invaliduser") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "InvalidRequest",
            message: "Error: actor must be a valid did or a handle",
          }),
        });
      }
      return route.fallback();
    });

    await login(page);
    await page.goto("/profile/did:plc:invaliduser");

    const view = page.locator("#profile-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error: Invalid handle",
      { timeout: 10000 },
    );
  });

  test("should display 'Blocked by User' badge and hide feed when viewer.blockedBy is true", async ({
    page,
  }) => {
    const blockedByUser = {
      ...otherUser,
      viewer: {
        ...otherUser.viewer,
        blockedBy: true,
      },
    };

    const mockServer = new MockServer();
    mockServer.addProfile(blockedByUser);
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${blockedByUser.did}`);

    const view = page.locator("#profile-view");
    await expect(
      view.locator('[data-testid="blocked-by-badge"]'),
    ).toContainText("This user is blocking you", { timeout: 10000 });
    await expect(view.locator(".feed-end-message")).toContainText(
      "Posts hidden",
    );
    await expect(view.locator(".tab-bar")).not.toBeVisible();
    await expect(
      view.locator('[data-testid="follow-button"]'),
    ).not.toBeVisible();
    await expect(
      view.locator('[data-testid="unblock-button"]'),
    ).not.toBeVisible();
    await expect(view.locator('[data-testid="chat-button"]')).not.toBeVisible();
    await expect(
      view.locator('[data-testid="profile-stats"]'),
    ).not.toBeVisible();
    await expect(view.locator(".profile-description")).not.toBeVisible();
  });

  test.describe("Post notification subscription", () => {
    test("should show bell button on other user's profile", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="post-notifications-button"]'),
      ).toBeVisible({ timeout: 10000 });
    });

    test("should not show bell button on own profile", async ({ page }) => {
      const currentUserProfile = {
        ...userProfile,
        followersCount: 10,
        followsCount: 5,
        postsCount: 20,
      };

      const mockServer = new MockServer();
      mockServer.addProfile(currentUserProfile);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userProfile.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="profile-name"]'),
      ).toContainText("Test User", { timeout: 10000 });
      await expect(
        view.locator('[data-testid="post-notifications-button"]'),
      ).not.toBeVisible();
    });

    test("should not show bell button on blocked-by profile", async ({
      page,
    }) => {
      const blockedByUser = {
        ...otherUser,
        viewer: { ...otherUser.viewer, blockedBy: true },
      };

      const mockServer = new MockServer();
      mockServer.addProfile(blockedByUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${blockedByUser.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="blocked-by-badge"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        view.locator('[data-testid="post-notifications-button"]'),
      ).not.toBeVisible();
    });

    test("should show outline bell icon when not subscribed", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      const bellButton = view.locator(
        '[data-testid="post-notifications-button"]',
      );
      await expect(bellButton).toBeVisible({ timeout: 10000 });
      await expect(bellButton.locator(".notifications-icon:not(.filled)")).toBeVisible();
    });

    test("should show filled bell icon when subscribed", async ({ page }) => {
      const subscribedUser = {
        ...otherUser,
        viewer: {
          ...otherUser.viewer,
          activitySubscription: { post: true, reply: false },
        },
      };

      const mockServer = new MockServer();
      mockServer.addProfile(subscribedUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${subscribedUser.did}`);

      const view = page.locator("#profile-view");
      const bellButton = view.locator(
        '[data-testid="post-notifications-button"]',
      );
      await expect(bellButton).toBeVisible({ timeout: 10000 });
      await expect(bellButton.locator(".notifications-icon.filled")).toBeVisible();
    });

    test("should open post notifications dialog when bell button is clicked", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      const dialog = page.locator(".post-notifications-dialog");
      await expect(dialog).toBeVisible();
      await expect(
        page.locator(".post-notifications-dialog-title"),
      ).toContainText("Keep me posted");
      await expect(
        page.locator(".post-notifications-dialog-subtitle"),
      ).toContainText("Get notified of this account's activity");
    });

    test("should show Posts and Replies toggles in dialog", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      await expect(page.locator('[data-testid="toggle-posts"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="toggle-replies"]'),
      ).toBeVisible();
    });

    test("should have save button disabled when no changes are made", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      await expect(
        page.locator('[data-testid="save-subscription-button"]'),
      ).toBeDisabled();
    });

    test("should enable save button after toggling Posts on", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      await page
        .locator('[data-testid="toggle-posts"] .toggle-switch-track')
        .click();

      await expect(
        page.locator('[data-testid="save-subscription-button"]'),
      ).toBeEnabled();
    });

    test("should auto-disable Replies when Posts is toggled off", async ({
      page,
    }) => {
      const subscribedUser = {
        ...otherUser,
        viewer: {
          ...otherUser.viewer,
          activitySubscription: { post: true, reply: true },
        },
      };

      const mockServer = new MockServer();
      mockServer.addProfile(subscribedUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${subscribedUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      // Both toggles should be checked initially
      const postsToggle = page.locator('[data-testid="toggle-posts"]');
      const repliesToggle = page.locator('[data-testid="toggle-replies"]');
      await expect(postsToggle).toHaveAttribute("checked", "");
      await expect(repliesToggle).toHaveAttribute("checked", "");

      // Turn off Posts
      await postsToggle.locator(".toggle-switch-track").click();

      // Both should now be unchecked
      await expect(postsToggle).not.toHaveAttribute("checked", "");
      await expect(repliesToggle).not.toHaveAttribute("checked", "");
    });

    test("should auto-enable Posts when Replies is toggled on", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      // Initially both are off
      const postsToggle = page.locator('[data-testid="toggle-posts"]');
      const repliesToggle = page.locator('[data-testid="toggle-replies"]');
      await expect(postsToggle).not.toHaveAttribute("checked", "");
      await expect(repliesToggle).not.toHaveAttribute("checked", "");

      // Toggle Replies on — should auto-enable Posts
      await repliesToggle.locator(".toggle-switch-track").click();

      await expect(postsToggle).toHaveAttribute("checked", "");
      await expect(repliesToggle).toHaveAttribute("checked", "");
    });

    test("should close dialog and update bell icon after saving subscription", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      // Toggle Posts on
      await page
        .locator('[data-testid="toggle-posts"] .toggle-switch-track')
        .click();

      // Save
      await page.locator('[data-testid="save-subscription-button"]').click();

      // Dialog should close
      await expect(
        page.locator(".post-notifications-dialog"),
      ).not.toBeVisible();

      // Bell icon should now be filled
      const bellButton = view.locator(
        '[data-testid="post-notifications-button"]',
      );
      await expect(bellButton.locator(".notifications-icon.filled")).toBeVisible();
    });

    test("should close dialog when close button is clicked", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await view
        .locator('[data-testid="post-notifications-button"]')
        .click({ timeout: 10000 });

      await expect(
        page.locator(".post-notifications-dialog"),
      ).toBeVisible();

      await page.locator(".post-notifications-dialog-close").click();

      await expect(
        page.locator(".post-notifications-dialog"),
      ).not.toBeVisible();
    });

    test("should not show bell button when logged out", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);

      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="profile-name"]'),
      ).toContainText("Other User", { timeout: 10000 });
      await expect(
        view.locator('[data-testid="post-notifications-button"]'),
      ).not.toBeVisible();
    });
  });

  test.describe("Labeler profiles", () => {
    test("should show '+ Subscribe' button on a labeler profile", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="subscribe-button"]'),
      ).toContainText("+ Subscribe", { timeout: 10000 });
    });

    test("should show 'Labels' tab and 'Subscribed' button when subscribed to a labeler", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [
                  {
                    type: "timeline",
                    value: "following",
                    pinned: true,
                    id: "timeline-following",
                  },
                ],
              },
              {
                $type: "app.bsky.actor.defs#labelersPref",
                labelers: [{ did: "did:plc:labeler123" }],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Labels" }),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        view.locator('[data-testid="subscribe-button"]'),
      ).toContainText("Subscribed");
    });

    test("should list configurable labels in the labeler settings tab", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [
                  {
                    type: "timeline",
                    value: "following",
                    pinned: true,
                    id: "timeline-following",
                  },
                ],
              },
              {
                $type: "app.bsky.actor.defs#labelersPref",
                labelers: [{ did: "did:plc:labeler123" }],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      await expect(
        view.locator('[data-testid="label-preference-row"]'),
      ).toHaveCount(2, { timeout: 10000 });

      await expect(
        view.locator('[data-testid="label-preference-name"]').nth(0),
      ).toContainText("Custom Label");
      await expect(
        view.locator('[data-testid="label-preference-name"]').nth(1),
      ).toContainText("Badge Label");
    });

    test("should show Off/Warn/Hide toggle buttons, with 'Show badge' for badge labels", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [
                  {
                    type: "timeline",
                    value: "following",
                    pinned: true,
                    id: "timeline-following",
                  },
                ],
              },
              {
                $type: "app.bsky.actor.defs#labelersPref",
                labelers: [{ did: "did:plc:labeler123" }],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      const rows = view.locator('[data-testid="label-preference-row"]');
      await expect(rows).toHaveCount(2, { timeout: 10000 });

      // First row: custom-label (blurs: "content", severity: "alert")
      // Should show Off, Warn, Hide
      const firstRowButtons = rows
        .nth(0)
        .locator('[data-testid="label-pref-button"]');
      await expect(firstRowButtons).toHaveCount(3);
      await expect(firstRowButtons.nth(0)).toContainText("Off");
      await expect(firstRowButtons.nth(1)).toContainText("Warn");
      await expect(firstRowButtons.nth(2)).toContainText("Hide");

      // Second row: badge-label (blurs: "none", severity: "inform")
      // isBadgeLabel = true, severity = "inform", so Warn text is "Show badge"
      const secondRowButtons = rows
        .nth(1)
        .locator('[data-testid="label-pref-button"]');
      await expect(secondRowButtons).toHaveCount(3);
      await expect(secondRowButtons.nth(0)).toContainText("Off");
      await expect(secondRowButtons.nth(1)).toContainText("Show badge");
      await expect(secondRowButtons.nth(2)).toContainText("Hide");
    });

    test("should show label descriptions for each configurable label", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [
                  {
                    type: "timeline",
                    value: "following",
                    pinned: true,
                    id: "timeline-following",
                  },
                ],
              },
              {
                $type: "app.bsky.actor.defs#labelersPref",
                labelers: [{ did: "did:plc:labeler123" }],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      const rows = view.locator('[data-testid="label-preference-row"]');
      await expect(rows).toHaveCount(2, { timeout: 10000 });

      await expect(
        rows.nth(0).locator(".label-preference-description"),
      ).toContainText("This is a custom content label");
      await expect(
        rows.nth(1).locator(".label-preference-description"),
      ).toContainText("This is a badge-type label");
    });

    test("should not show non-configurable labels (prefixed with !) in settings", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(labelerUser);
      await mockServer.setup(page);

      await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) => {
        const url = new URL(route.request().url());
        const dids = url.searchParams.getAll("dids");
        if (dids.includes("did:plc:labeler123")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ views: [labelerView] }),
          });
        }
        return route.fallback();
      });

      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [
                  {
                    type: "timeline",
                    value: "following",
                    pinned: true,
                    id: "timeline-following",
                  },
                ],
              },
              {
                $type: "app.bsky.actor.defs#labelersPref",
                labelers: [{ did: "did:plc:labeler123" }],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto(`/profile/${labelerUser.did}`);

      const view = page.locator("#profile-view");
      const rows = view.locator('[data-testid="label-preference-row"]');
      // Only 2 configurable labels shown (custom-label and badge-label)
      // !system-label is filtered out
      await expect(rows).toHaveCount(2, { timeout: 10000 });

      const labelList = view.locator('[data-testid="label-preference-list"]');
      await expect(labelList).not.toContainText("System Label");
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should display Posts and Media tabs only (no Replies or Likes)", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);

      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(tabBar.locator(".tab-bar-button")).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(tabBar.locator(".tab-bar-button").nth(0)).toContainText(
        "Posts",
      );
      await expect(tabBar.locator(".tab-bar-button").nth(1)).toContainText(
        "Media",
      );
    });

    test("should hide follow/block/mute actions", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);

      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await expect(view.locator('[data-testid="profile-name"]')).toContainText(
        "Other User",
        { timeout: 10000 },
      );

      // Chat button should be hidden for logged-out users
      await expect(
        view.locator('[data-testid="chat-button"]'),
      ).not.toBeVisible();

      // Open context menu — should only have non-authenticated items
      await view.locator(".ellipsis-button").click();

      const menu = view.locator("context-menu");
      await expect(menu.locator("context-menu-item")).toHaveCount(2, {
        timeout: 5000,
      });
      await expect(
        menu.locator("context-menu-item", { hasText: "Open in bsky.app" }),
      ).toBeVisible();
      await expect(
        menu.locator("context-menu-item", { hasText: "Copy link to profile" }),
      ).toBeVisible();
    });

    test("should filter out posts from !no-unauthenticated authors in profile feed", async ({
      page,
    }) => {
      const restrictedPost = createPost({
        uri: "at://did:plc:private1/app.bsky.feed.post/post1",
        text: "This post should be hidden",
        authorHandle: "private.bsky.social",
        authorDisplayName: "Private User",
        loggedOut: true,
      });
      const visiblePost = createPost({
        uri: "at://did:plc:otheruser1/app.bsky.feed.post/post2",
        text: "This post should be visible",
        authorHandle: otherUser.handle,
        authorDisplayName: otherUser.displayName,
        loggedOut: true,
      });

      // Give the restricted post's author the !no-unauthenticated label
      restrictedPost.author.labels = [
        {
          val: "!no-unauthenticated",
          src: "did:plc:private1",
          uri: "at://did:plc:private1/app.bsky.actor.profile/self",
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      mockServer.addAuthorFeedPosts(otherUser.did, "posts_and_author_threads", [
        restrictedPost,
        visiblePost,
      ]);
      await mockServer.setup(page);

      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(view).toContainText("This post should be visible");
      await expect(view).not.toContainText("This post should be hidden");
    });

    test('should show "Sign-In Required" for profiles that restrict logged-out access', async ({
      page,
    }) => {
      const restrictedUser = {
        ...otherUser,
        labels: [
          {
            src: otherUser.did,
            uri: `at://${otherUser.did}/app.bsky.actor.profile/self`,
            val: "!no-unauthenticated",
            cts: "2025-01-01T00:00:00.000Z",
          },
        ],
      };

      const mockServer = new MockServer();
      mockServer.addProfile(restrictedUser);
      await mockServer.setup(page);

      await page.goto(`/profile/${restrictedUser.did}`);

      const view = page.locator("#profile-view");
      await expect(view.locator(".error-state h1")).toContainText(
        "Sign-In Required",
        { timeout: 10000 },
      );
      await expect(view.locator(".error-state p")).toContainText(
        "This account has requested that users sign in to view their profile.",
      );
    });
  });

  test.describe("Feeds tab", () => {
    const userWithFeeds = createProfile({
      did: "did:plc:feedcreator1",
      handle: "feedcreator.bsky.social",
      displayName: "Feed Creator",
      followersCount: 200,
      followsCount: 50,
      postsCount: 100,
      associated: { feedgens: 2 },
    });

    const feed1 = createFeedGenerator({
      uri: "at://did:plc:feedcreator1/app.bsky.feed.generator/trending",
      displayName: "Trending Topics",
      creatorHandle: "feedcreator.bsky.social",
    });

    const feed2 = createFeedGenerator({
      uri: "at://did:plc:feedcreator1/app.bsky.feed.generator/science",
      displayName: "Science Feed",
      creatorHandle: "feedcreator.bsky.social",
    });

    test("should show Feeds tab when profile has feed generators", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userWithFeeds);
      mockServer.addActorFeeds(userWithFeeds.did, [feed1, feed2]);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userWithFeeds.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).toBeVisible({ timeout: 10000 });
    });

    test("should not show Feeds tab when profile has no feed generators", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(otherUser);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${otherUser.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(tabBar.locator(".tab-bar-button").first()).toBeVisible({
        timeout: 10000,
      });
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).not.toBeVisible();
    });

    test("should display feed generators when Feeds tab is clicked", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userWithFeeds);
      mockServer.addActorFeeds(userWithFeeds.did, [feed1, feed2]);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userWithFeeds.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).toBeVisible({ timeout: 10000 });

      await tabBar.locator(".tab-bar-button", { hasText: "Feeds" }).click();
      await expect(tabBar.locator(".tab-bar-button.active")).toContainText(
        "Feeds",
      );

      const feedsList = view.locator(".feeds-list");
      await expect(feedsList.locator(".feeds-list-item")).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(feedsList).toContainText("Trending Topics");
      await expect(feedsList).toContainText("Science Feed");
      await expect(feedsList).toContainText("by @feedcreator.bsky.social");
    });

    test("should navigate to feed detail when clicking a feed generator", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userWithFeeds);
      mockServer.addActorFeeds(userWithFeeds.did, [feed1]);
      mockServer.addFeedGenerators([feed1]);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userWithFeeds.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).toBeVisible({ timeout: 10000 });

      await tabBar.locator(".tab-bar-button", { hasText: "Feeds" }).click();

      const feedsList = view.locator(".feeds-list");
      await expect(feedsList.locator(".feeds-list-item")).toHaveCount(1, {
        timeout: 10000,
      });

      await feedsList
        .locator(".feeds-list-item", { hasText: "Trending Topics" })
        .click();

      await expect(page).toHaveURL(
        "/profile/feedcreator.bsky.social/feed/trending",
        { timeout: 10000 },
      );

      const detailView = page.locator("#feed-detail-view");
      await expect(
        detailView.locator('[data-testid="header-title"]'),
      ).toContainText("Trending Topics", { timeout: 10000 });
    });

    test("should show Feeds tab on own profile when user has feed generators", async ({
      page,
    }) => {
      const currentUserWithFeeds = {
        ...userProfile,
        associated: { feedgens: 1 },
      };
      const userFeed = createFeedGenerator({
        uri: `at://${userProfile.did}/app.bsky.feed.generator/myfeed`,
        displayName: "My Custom Feed",
        creatorHandle: userProfile.handle,
      });

      const mockServer = new MockServer();
      mockServer.addProfile(currentUserWithFeeds);
      mockServer.addActorFeeds(userProfile.did, [userFeed]);
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userProfile.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).toBeVisible({ timeout: 10000 });
    });

    test("should not show Feeds tab on own profile when user has no feed generators", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto(`/profile/${userProfile.did}`);

      const view = page.locator("#profile-view");
      const tabBar = view.locator(".tab-bar");
      await expect(tabBar.locator(".tab-bar-button").first()).toBeVisible({
        timeout: 10000,
      });
      await expect(
        tabBar.locator(".tab-bar-button", { hasText: "Feeds" }),
      ).not.toBeVisible();
    });
  });
});
