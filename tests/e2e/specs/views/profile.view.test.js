import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import {
  createPost,
  createProfile,
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
    await expect(menu.locator("context-menu-item")).toHaveCount(2, {
      timeout: 5000,
    });
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
});
