import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createPost,
  createProfile,
  createFeedGenerator,
} from "../../factories.js";

test.describe("Search view", () => {
  test("should display search placeholder when no query is entered", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search");

    const view = page.locator("#search-view");
    await expect(view.locator(".search-input")).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".search-placeholder")).toBeVisible();
    await expect(view.locator(".search-placeholder-text")).toContainText(
      "Start typing to search for users, posts, and feeds.",
    );
  });

  test("should display profile search results", async ({ page }) => {
    const mockServer = new MockServer();
    const profile1 = createProfile({
      did: "did:plc:profile1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const profile2 = createProfile({
      did: "did:plc:profile2",
      handle: "alicia.bsky.social",
      displayName: "Alicia",
    });
    mockServer.addSearchProfiles([profile1, profile2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=ali");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Alice");
    await expect(view).toContainText("@alice.bsky.social");
    await expect(view).toContainText("Alicia");
    await expect(view).toContainText("@alicia.bsky.social");
  });

  test("should display post search results when switching to Posts tab", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Hello world from search",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/post2",
      text: "Another search result",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addSearchPosts([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=hello");

    const view = page.locator("#search-view");
    // Click the Posts tab
    await view.locator('[data-testid="tab-posts"]').click();

    await expect(view.locator("[data-post-uri]")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Hello world from search");
    await expect(view).toContainText("Another search result");
  });

  test("should show Profiles tab as active by default", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=alice");

    const view = page.locator("#search-view");
    await expect(
      view.locator('[data-testid="tab-profiles"].active'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show empty state when no profiles match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentuser");

    const view = page.locator("#search-view");
    const profilesPanel = view.locator(
      ".search-tab-panel:not([hidden]) .search-results-panel",
    );
    await expect(
      profilesPanel.locator('[data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show empty state when no posts match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentpost&tab=posts");

    const view = page.locator("#search-view");
    await expect(
      view.locator('.search-post-results [data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should switch between Profiles, Posts, and Feeds tabs", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "A matching post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    mockServer.addSearchFeedGenerators([
      createFeedGenerator({
        uri: "at://did:plc:feedcreator1/app.bsky.feed.generator/myfeed",
        displayName: "My Custom Feed",
        creatorHandle: "feedcreator1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test");

    const view = page.locator("#search-view");

    // Profiles tab is active by default
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Switch to Posts tab
    await view.locator('[data-testid="tab-posts"]').click();
    await expect(
      view.locator('[data-testid="tab-posts"].active'),
    ).toBeVisible();
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("A matching post");

    // Switch to Feeds tab
    await view.locator('[data-testid="tab-feeds"]').click();
    await expect(
      view.locator('[data-testid="tab-feeds"].active'),
    ).toBeVisible();
    await expect(view.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("My Custom Feed");

    // Switch back to Profiles tab
    await view.locator('[data-testid="tab-profiles"]').click();
    await expect(
      view.locator('[data-testid="tab-profiles"].active'),
    ).toBeVisible();
    await expect(view.locator(".profile-list-item")).toHaveCount(1);
  });

  test("should display clear button when search has text and clear on click", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=hello");

    const view = page.locator("#search-view");
    await expect(view.locator(".search-clear-button")).toBeVisible({
      timeout: 10000,
    });

    // Click the clear button
    await view.locator(".search-clear-button").click();

    // Should return to placeholder state
    await expect(view.locator(".search-placeholder")).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".search-clear-button")).not.toBeVisible();
  });

  test("should load results from query parameter on page load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "bob.bsky.social",
        displayName: "Bob",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=bob");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("@bob.bsky.social");
  });

  test("should navigate to profile when clicking a profile result", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=alice");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator(".profile-list-item").click();

    await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social/, {
      timeout: 10000,
    });
  });

  test("should load tab from query parameter", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "Post from tab param",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test&tab=posts");

    const view = page.locator("#search-view");
    await expect(view.locator('[data-testid="tab-posts"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("Post from tab param");
  });

  test("should navigate to post thread view when clicking a post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/clickme1",
      text: "Click this post to see thread",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addSearchPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=click&tab=posts");

    const view = page.locator("#search-view");
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator("[data-post-uri]").click();

    const threadView = page.locator("#post-detail-view");
    await expect(threadView).toBeVisible({ timeout: 10000 });
    await expect(threadView).toContainText("Click this post to see thread");
    await expect(page).toHaveURL(
      /\/profile\/author1\.bsky\.social\/post\/clickme1/,
    );
  });

  test("should display feed search results when switching to Feeds tab", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed1 = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/science",
      displayName: "Science Feed",
      creatorHandle: "creator1.bsky.social",
      description: "The latest science news and discoveries",
    });
    const feed2 = createFeedGenerator({
      uri: "at://did:plc:creator2/app.bsky.feed.generator/tech",
      displayName: "Tech Feed",
      creatorHandle: "creator2.bsky.social",
      description: "All things technology",
    });
    mockServer.addSearchFeedGenerators([feed1, feed2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=feed");

    const view = page.locator("#search-view");
    await view.locator('[data-testid="tab-feeds"]').click();

    await expect(view.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Science Feed");
    await expect(view).toContainText("by @creator1.bsky.social");
    await expect(view).toContainText("Tech Feed");
    await expect(view).toContainText("by @creator2.bsky.social");
    await expect(view).toContainText("The latest science news and discoveries");
    await expect(view).toContainText("All things technology");
  });

  test("should show empty state when no feeds match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentfeed&tab=feeds");

    const view = page.locator("#search-view");
    const feedsPanel = view.locator(
      ".search-tab-panel:not([hidden]) .search-results-panel",
    );
    await expect(feedsPanel.locator('[data-testid="empty-state"]')).toBeVisible(
      { timeout: 10000 },
    );
  });

  test("should navigate to feed detail when clicking a feed result", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:feedauthor1/app.bsky.feed.generator/coolstuff",
      displayName: "Cool Stuff",
      creatorHandle: "feedauthor1.bsky.social",
    });
    mockServer.addSearchFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=cool&tab=feeds");

    const view = page.locator("#search-view");
    await expect(view.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator(".feeds-list-item").click();

    await expect(page).toHaveURL(
      /\/profile\/feedauthor1\.bsky\.social\/feed\/coolstuff/,
      { timeout: 10000 },
    );
  });

  test("should load Feeds tab from query parameter", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchFeedGenerators([
      createFeedGenerator({
        uri: "at://did:plc:creator1/app.bsky.feed.generator/myfeed",
        displayName: "My Feed",
        creatorHandle: "creator1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test&tab=feeds");

    const view = page.locator("#search-view");
    await expect(view.locator('[data-testid="tab-feeds"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("My Feed");
  });

  test("should display pin buttons on feed search results with correct pin state", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed1 = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/science",
      displayName: "Science Feed",
      creatorHandle: "creator1.bsky.social",
    });
    const feed2 = createFeedGenerator({
      uri: "at://did:plc:creator2/app.bsky.feed.generator/tech",
      displayName: "Tech Feed",
      creatorHandle: "creator2.bsky.social",
    });
    mockServer.addSearchFeedGenerators([feed1, feed2]);
    mockServer.setPinnedFeeds([feed1.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=feed&tab=feeds");

    const view = page.locator("#search-view");
    await expect(view.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });

    const firstItem = view.locator(".feeds-list-item").nth(0);
    const secondItem = view.locator(".feeds-list-item").nth(1);

    // First feed is pinned — should show "Unpin" with pinned class
    await expect(firstItem.locator(".pin-feed-button.pinned")).toBeVisible();
    await expect(firstItem.locator(".pin-feed-button")).toContainText(
      "Unpin feed",
    );

    // Second feed is not pinned — should show "Pin feed" with primary class
    await expect(
      secondItem.locator(".pin-feed-button.rounded-button-primary"),
    ).toBeVisible();
    await expect(secondItem.locator(".pin-feed-button")).toContainText(
      "Pin feed",
    );
  });

  test("should not navigate to feed detail when clicking pin button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/science",
      displayName: "Science Feed",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addSearchFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=science&tab=feeds");

    const view = page.locator("#search-view");
    await expect(view.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator(".pin-feed-button").click();

    // Should stay on search page
    await expect(page).toHaveURL(/\/search/);
  });

  test("should render bio, follows-you, and follow-state per profile result", async ({
    page,
  }) => {
    const followsBack = createProfile({
      did: "did:plc:followsback1",
      handle: "followsback.bsky.social",
      displayName: "Follows Back",
      description: "I follow you and have a bio.",
      viewer: { followedBy: "at://did:plc:followsback1/follow/1" },
    });
    const alreadyFollowing = createProfile({
      did: "did:plc:already1",
      handle: "already.bsky.social",
      displayName: "Already Following",
      description: "",
      viewer: { following: "at://did:plc:viewer/follow/abc" },
    });
    const stranger = createProfile({
      did: "did:plc:stranger1",
      handle: "stranger.bsky.social",
      displayName: "Stranger",
      description: "A stranger with a description.",
    });

    const mockServer = new MockServer();
    mockServer.addSearchProfiles([followsBack, alreadyFollowing, stranger]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test");

    const view = page.locator("#search-view");
    const followsBackRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Follows Back" });
    const alreadyRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Already Following" });
    const strangerRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Stranger" });

    await expect(
      followsBackRow.locator('[data-testid="follows-you-badge"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      alreadyRow.locator('[data-testid="follows-you-badge"]'),
    ).toHaveCount(0);
    await expect(
      strangerRow.locator('[data-testid="follows-you-badge"]'),
    ).toHaveCount(0);

    await expect(
      followsBackRow.locator('[data-testid="profile-list-item-description"]'),
    ).toContainText("I follow you and have a bio.");
    await expect(
      alreadyRow.locator('[data-testid="profile-list-item-description"]'),
    ).toHaveCount(0);

    await expect(
      followsBackRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "follow-back");
    await expect(
      alreadyRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "following");
    await expect(
      strangerRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "follow");
  });

  test("clicking the follow button on a profile result toggles to following", async ({
    page,
  }) => {
    const target = createProfile({
      did: "did:plc:target1",
      handle: "target.bsky.social",
      displayName: "Target User",
    });

    const mockServer = new MockServer();
    mockServer.addSearchProfiles([target]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=target");

    const view = page.locator("#search-view");
    const targetRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Target User" });

    const followButton = targetRow.locator('[data-testid="follow-button"]');
    await expect(followButton).toHaveAttribute("data-teststate", "follow", {
      timeout: 10000,
    });
    await followButton.click();
    await expect(followButton).toHaveAttribute("data-teststate", "following", {
      timeout: 10000,
    });
  });

  test.describe("Pagination", () => {
    test("should paginate profile results", async ({ page }) => {
      const mockServer = new MockServer();
      const profiles = [];
      for (let i = 0; i < 30; i++) {
        profiles.push(
          createProfile({
            did: `did:plc:profile${i}`,
            handle: `user${i}.bsky.social`,
            displayName: `User ${i}`,
          }),
        );
      }
      mockServer.addSearchProfiles(profiles);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=user");

      const view = page.locator("#search-view");
      // All 30 profiles should load across multiple pages
      await expect(view.locator(".profile-list-item")).toHaveCount(30, {
        timeout: 10000,
      });
      await expect(view).toContainText("User 0");
      await expect(view).toContainText("User 29");
    });

    test("should paginate post results", async ({ page }) => {
      const mockServer = new MockServer();
      const posts = [];
      for (let i = 0; i < 30; i++) {
        posts.push(
          createPost({
            uri: `at://did:plc:author${i}/app.bsky.feed.post/post${i}`,
            text: `Search result post ${i}`,
            authorHandle: `author${i}.bsky.social`,
            authorDisplayName: `Author ${i}`,
          }),
        );
      }
      mockServer.addSearchPosts(posts);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=result&tab=posts");

      const view = page.locator("#search-view");
      // All 30 posts should load across multiple pages
      await expect(view.locator("[data-post-uri]")).toHaveCount(30, {
        timeout: 10000,
      });
      await expect(view).toContainText("Search result post 0");
      await expect(view).toContainText("Search result post 29");
    });

    test("should paginate feed results", async ({ page }) => {
      const mockServer = new MockServer();
      const feeds = [];
      for (let i = 0; i < 20; i++) {
        feeds.push(
          createFeedGenerator({
            uri: `at://did:plc:creator${i}/app.bsky.feed.generator/feed${i}`,
            displayName: `Feed ${i}`,
            creatorHandle: `creator${i}.bsky.social`,
          }),
        );
      }
      mockServer.addSearchFeedGenerators(feeds);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=feed&tab=feeds");

      const view = page.locator("#search-view");
      // All 20 feeds should load across multiple pages
      await expect(view.locator(".feeds-list-item")).toHaveCount(20, {
        timeout: 10000,
      });
      await expect(view).toContainText("Feed 0");
      await expect(view).toContainText("Feed 19");
    });

    test("should not show loading spinner when there are no more results", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const profiles = [];
      for (let i = 0; i < 3; i++) {
        profiles.push(
          createProfile({
            did: `did:plc:profile${i}`,
            handle: `user${i}.bsky.social`,
            displayName: `User ${i}`,
          }),
        );
      }
      mockServer.addSearchProfiles(profiles);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=user");

      const view = page.locator("#search-view");
      await expect(view.locator(".profile-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      await expect(view.locator(".feed-loading-indicator")).not.toBeVisible();
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should allow searching profiles and posts without authentication", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const profile1 = createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const profile2 = createProfile({
        did: "did:plc:profile2",
        handle: "alicia.bsky.social",
        displayName: "Alicia",
      });
      mockServer.addSearchProfiles([profile1, profile2]);
      await mockServer.setup(page);

      await page.goto("/search?q=ali");

      const view = page.locator("#search-view");
      await expect(view.locator(".profile-list-item")).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(view).toContainText("Alice");
      await expect(view).toContainText("Alicia");

      // Posts and Feeds tabs should be hidden for logged-out users
      await expect(view.locator('[data-testid="tab-posts"]')).not.toBeVisible();
      await expect(view.locator('[data-testid="tab-feeds"]')).not.toBeVisible();

      // Follow buttons should be hidden for logged-out users
      await expect(view.locator('[data-testid="follow-button"]')).toHaveCount(
        0,
      );
    });
  });
});
