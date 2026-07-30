import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createPost,
  createProfile,
  createFeedGenerator,
} from "../../../shared/factories.js";

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
    await page.goto("/search?q=ali&tab=profiles");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Alice");
    await expect(view).toContainText("@alice.bsky.social");
    await expect(view).toContainText("Alicia");
    await expect(view).toContainText("@alicia.bsky.social");
  });

  test("should display post search results when switching to Top tab", async ({
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
    // Click the Top tab
    await view.locator('[data-testid="tab-top"]').click();

    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(2, { timeout: 10000 });
    await expect(view).toContainText("Hello world from search");
    await expect(view).toContainText("Another search result");
  });

  test("should show Top tab as active by default", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "A matching post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=alice");

    const view = page.locator("#search-view");
    await expect(view.locator('[data-testid="tab-top"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(1, { timeout: 10000 });
  });

  test("should show empty state when no profiles match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentuser&tab=profiles");

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
    await page.goto("/search?q=nonexistentpost&tab=top");

    const view = page.locator("#search-view");
    await expect(
      view.locator('.search-post-results-top [data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should switch between Top, Latest, People, and Feeds tabs", async ({
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

    // Top tab is active by default
    await expect(view.locator('[data-testid="tab-top"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(view).toContainText("A matching post");

    // Switch to Latest tab
    await view.locator('[data-testid="tab-latest"]').click();
    await expect(
      view.locator('[data-testid="tab-latest"].active'),
    ).toBeVisible();
    await expect(
      view.locator(".search-post-results-latest [data-post-uri]"),
    ).toHaveCount(1, { timeout: 10000 });

    // Switch to People tab
    await view.locator('[data-testid="tab-profiles"]').click();
    await expect(
      view.locator('[data-testid="tab-profiles"].active'),
    ).toBeVisible();
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Switch to Feeds tab
    await view.locator('[data-testid="tab-feeds"]').click();
    await expect(
      view.locator('[data-testid="tab-feeds"].active'),
    ).toBeVisible();
    await expect(view.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("My Custom Feed");

    // Switch back to Top tab
    await view.locator('[data-testid="tab-top"]').click();
    await expect(view.locator('[data-testid="tab-top"].active')).toBeVisible();
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(1);
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
    await page.goto("/search?q=bob&tab=profiles");

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
    await page.goto("/search?q=alice&tab=profiles");

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
    await page.goto("/search?q=test&tab=top");

    const view = page.locator("#search-view");
    await expect(view.locator('[data-testid="tab-top"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(view).toContainText("Post from tab param");
  });

  test("should map legacy tab=posts query parameter to the Top tab", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "Post from legacy tab param",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test&tab=posts");

    const view = page.locator("#search-view");
    await expect(view.locator('[data-testid="tab-top"].active')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(view).toContainText("Post from legacy tab param");
  });

  test("should show separate results for Top and Latest tabs", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts(
      [
        createPost({
          uri: "at://did:plc:author1/app.bsky.feed.post/toppost",
          text: "A top ranked post",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
        }),
      ],
      { sort: "top" },
    );
    mockServer.addSearchPosts(
      [
        createPost({
          uri: "at://did:plc:author2/app.bsky.feed.post/latestpost",
          text: "A very recent post",
          authorHandle: "author2.bsky.social",
          authorDisplayName: "Author Two",
        }),
      ],
      { sort: "latest" },
    );
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=post&tab=top");

    const view = page.locator("#search-view");
    const topPanel = view.locator(".search-post-results-top");
    const latestPanel = view.locator(".search-post-results-latest");

    await expect(topPanel.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(topPanel).toContainText("A top ranked post");

    await view.locator('[data-testid="tab-latest"]').click();
    await expect(latestPanel.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(latestPanel).toContainText("A very recent post");
    await expect(latestPanel).not.toContainText("A top ranked post");

    // Returning to Top keeps its cached results
    await view.locator('[data-testid="tab-top"]').click();
    await expect(topPanel.locator("[data-post-uri]")).toHaveCount(1);
    await expect(topPanel).toContainText("A top ranked post");
  });

  test("should render tabs in order: Top, Latest, People, Feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test");

    const view = page.locator("#search-view");
    const tabs = view.locator("tab-bar [data-testid^='tab-']");
    await expect(tabs).toHaveCount(4, { timeout: 10000 });
    await expect(tabs.nth(0)).toHaveAttribute("data-testid", "tab-top");
    await expect(tabs.nth(1)).toHaveAttribute("data-testid", "tab-latest");
    await expect(tabs.nth(2)).toHaveAttribute("data-testid", "tab-profiles");
    await expect(tabs.nth(3)).toHaveAttribute("data-testid", "tab-feeds");
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
    await page.goto("/search?q=click&tab=top");

    const view = page.locator("#search-view");
    const topPanel = view.locator(".search-post-results-top");
    await expect(topPanel.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });

    await topPanel.locator("[data-post-uri]").click();

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
    await page.goto("/search?q=test&tab=profiles");

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
    await page.goto("/search?q=target&tab=profiles");

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

  test.describe("Typeahead", () => {
    test("should show typeahead results while typing without searching", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
        createProfile({
          did: "did:plc:profile2",
          handle: "alicia.bsky.social",
          displayName: "Alicia",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view.locator(".search-input").fill("ali");

      await expect(
        view.locator('[data-testid="search-typeahead-search-row"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        view.locator('[data-testid="search-typeahead-result"]'),
      ).toHaveCount(2, { timeout: 10000 });
      await expect(view).toContainText("@alice.bsky.social");

      // No full search fired and no query committed to the URL
      expect(mockServer.searchRequestCounts.profiles).toBe(0);
      await expect(page).not.toHaveURL(/[?&]q=/);
      await expect(view.locator("tab-bar")).toBeHidden();
    });

    test("should show a loading spinner until typeahead results arrive", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      ]);
      mockServer.typeaheadDelayMs = 1000;
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view.locator(".search-input").fill("ali");

      await expect(
        view.locator(".search-typeahead-loading .loading-spinner"),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        view.locator('[data-testid="search-typeahead-result"]'),
      ).toHaveCount(1, { timeout: 10000 });
      await expect(view.locator(".search-typeahead-loading")).not.toBeVisible();
    });

    test("should commit the search on Enter", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      ]);
      mockServer.addSearchPosts([
        createPost({
          uri: "at://did:plc:author1/app.bsky.feed.post/post1",
          text: "A post about ali",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const input = view.locator(".search-input");
      await input.fill("ali");
      await expect(
        view.locator('[data-testid="search-typeahead-search-row"]'),
      ).toBeVisible({ timeout: 10000 });
      await input.press("Enter");

      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });
      await expect(view.locator("tab-bar")).toBeVisible();
      await expect(page).toHaveURL(/[?&]q=ali/);
      await expect(
        view.locator('[data-testid="search-typeahead-search-row"]'),
      ).toHaveCount(0);
    });

    test("should commit the search when clicking the search row", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addSearchPosts([
        createPost({
          uri: "at://did:plc:author1/app.bsky.feed.post/post1",
          text: "A post about ali",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view.locator(".search-input").fill("ali");
      await view.locator('[data-testid="search-typeahead-search-row"]').click();

      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });
      await expect(page).toHaveURL(/[?&]q=ali/);
    });

    test("should navigate to the profile when clicking a typeahead result", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view.locator(".search-input").fill("ali");
      await expect(
        view.locator('[data-testid="search-typeahead-result"]'),
      ).toHaveCount(1, { timeout: 10000 });

      await view.locator('[data-testid="search-typeahead-result"]').click();

      await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social/, {
        timeout: 10000,
      });
    });

    test("should return to typeahead mode when editing a committed search", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alicia.bsky.social",
          displayName: "Alicia",
        }),
      ]);
      mockServer.addSearchPosts([
        createPost({
          uri: "at://did:plc:author1/app.bsky.feed.post/post1",
          text: "A post about alicia",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=alice");

      const view = page.locator("#search-view");
      await expect(view.locator("tab-bar")).toBeVisible({ timeout: 10000 });

      const input = view.locator(".search-input");
      await input.fill("alicia");

      await expect(
        view.locator('[data-testid="search-typeahead-search-row"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(view.locator("tab-bar")).toBeHidden();
      // The committed query only changes on the next commit
      await expect(page).toHaveURL(/[?&]q=alice/);

      await input.press("Enter");
      await expect(page).toHaveURL(/[?&]q=alicia/);
      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });
    });

    test("should show the placeholder when the input is cleared", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=alice");

      const view = page.locator("#search-view");
      const input = view.locator(".search-input");
      await expect(input).toHaveValue("alice", { timeout: 10000 });

      await input.fill("");

      await expect(view.locator(".search-placeholder")).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Lazy tab loading", () => {
    test("should only load a tab's results when it is first activated", async ({
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
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search?q=test");

      const view = page.locator("#search-view");
      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });

      // Only the active (Top) tab has loaded
      expect(mockServer.searchRequestCounts.top).toBe(1);
      expect(mockServer.searchRequestCounts.profiles).toBe(0);
      expect(mockServer.searchRequestCounts.latest).toBe(0);
      expect(mockServer.searchRequestCounts.feeds).toBe(0);

      await view.locator('[data-testid="tab-profiles"]').click();
      await expect(view.locator(".profile-list-item")).toHaveCount(1, {
        timeout: 10000,
      });
      expect(mockServer.searchRequestCounts.profiles).toBe(1);

      // Switching back and forth doesn't refetch
      await view.locator('[data-testid="tab-top"]').click();
      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });
      await view.locator('[data-testid="tab-profiles"]').click();
      await expect(view.locator(".profile-list-item")).toHaveCount(1, {
        timeout: 10000,
      });
      expect(mockServer.searchRequestCounts.profiles).toBe(1);
      expect(mockServer.searchRequestCounts.top).toBe(1);
    });
  });

  test("should scroll to top when clicking the active tab", async ({
    page,
  }) => {
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
    await page.goto("/search?q=result");

    const view = page.locator("#search-view");
    await expect(
      view.locator(".search-post-results-top [data-post-uri]"),
    ).toHaveCount(30, { timeout: 10000 });

    await page.evaluate(() => window.scrollTo(0, 1000));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);

    await view.locator('[data-testid="tab-top"]').click();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
      await page.goto("/search?q=user&tab=profiles");

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
      await page.goto("/search?q=result&tab=top");

      const view = page.locator("#search-view");
      // All 30 posts should load across multiple pages
      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(30, { timeout: 10000 });
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
      await page.goto("/search?q=user&tab=profiles");

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

      // Post and Feeds tabs should be hidden for logged-out users
      await expect(view.locator('[data-testid="tab-top"]')).not.toBeVisible();
      await expect(
        view.locator('[data-testid="tab-latest"]'),
      ).not.toBeVisible();
      await expect(view.locator('[data-testid="tab-feeds"]')).not.toBeVisible();

      // Follow buttons should be hidden for logged-out users
      await expect(view.locator('[data-testid="follow-button"]')).toHaveCount(
        0,
      );
    });

    test("should show typeahead and commit profile search when logged out", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTypeaheadProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      ]);
      mockServer.addSearchProfiles([
        createProfile({
          did: "did:plc:profile1",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      ]);
      await mockServer.setup(page);

      await page.goto("/search");

      const view = page.locator("#search-view");
      const input = view.locator(".search-input");
      await input.fill("ali");

      await expect(
        view.locator('[data-testid="search-typeahead-result"]'),
      ).toHaveCount(1, { timeout: 10000 });

      await input.press("Enter");

      await expect(view.locator(".profile-list-item")).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(view.locator("tab-bar")).toBeHidden();
      expect(mockServer.searchRequestCounts.top).toBe(0);
    });

    test("should hide the tab bar entirely when logged out", async ({
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

      await page.goto("/search?q=ali");

      const view = page.locator("#search-view");
      await expect(view.locator(".profile-list-item")).toHaveCount(1, {
        timeout: 10000,
      });

      await expect(view.locator("tab-bar")).toBeHidden();
    });
  });

  test.describe("Recent searches", () => {
    test("shows recent searches instead of the placeholder when history exists", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({
        searches: [
          { q: "dogs", ts: 2 },
          { q: "cats", ts: 1 },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await expect(view.locator('[data-testid="search-recent"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view.locator(".search-placeholder")).not.toBeVisible();
      const rows = view.locator('[data-testid="search-recent-row"]');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText("dogs");
      await expect(rows.nth(1)).toContainText("cats");
      // Rendering recents must not fire any search requests
      expect(mockServer.searchRequestCounts.profiles).toBe(0);
      expect(mockServer.searchRequestCounts.top).toBe(0);
      expect(mockServer.searchRequestCounts.latest).toBe(0);
      expect(mockServer.searchRequestCounts.feeds).toBe(0);
      expect(mockServer.searchRequestCounts.typeahead).toBe(0);
    });

    test("records a committed search and shows it after clearing the input", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const input = view.locator(".search-input");
      await expect(view.locator(".search-placeholder")).toBeVisible({
        timeout: 10000,
      });
      await input.fill("kittens");
      await input.press("Enter");

      await expect
        .poll(() => mockServer.searchHistory?.searches?.[0]?.q, {
          timeout: 10000,
        })
        .toBe("kittens");

      await view.locator(".search-clear-button").click();
      const rows = view.locator('[data-testid="search-recent-row"]');
      await expect(rows).toHaveCount(1, { timeout: 10000 });
      await expect(rows.nth(0)).toContainText("kittens");
    });

    test("re-running an existing search moves it to the front without duplicating", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({
        searches: [
          { q: "cats", ts: 2 },
          { q: "dogs", ts: 1 },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const input = view.locator(".search-input");
      await expect(view.locator('[data-testid="search-recent"]')).toBeVisible({
        timeout: 10000,
      });
      await input.fill("dogs");
      await input.press("Enter");

      await expect
        .poll(
          () => mockServer.searchHistory?.searches?.map((entry) => entry.q),
          { timeout: 10000 },
        )
        .toEqual(["dogs", "cats"]);
    });

    test("clicking a recent row fills the input and runs the search", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({ searches: [{ q: "hello", ts: 1 }] });
      mockServer.addSearchPosts([
        createPost({
          uri: "at://did:plc:author1/app.bsky.feed.post/post1",
          text: "Hello world from search",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view
        .locator('[data-testid="search-recent-row-button"]')
        .first()
        .click();

      await expect(page).toHaveURL(/[?&]q=hello/);
      await expect(view.locator(".search-input")).toHaveValue("hello");
      await expect(
        view.locator(".search-post-results-top [data-post-uri]"),
      ).toHaveCount(1, { timeout: 10000 });
    });

    test("removing a middle entry keeps the others and does not navigate", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({
        searches: [
          { q: "alpha", ts: 3 },
          { q: "beta", ts: 2 },
          { q: "gamma", ts: 1 },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const rows = view.locator('[data-testid="search-recent-row"]');
      await expect(rows).toHaveCount(3, { timeout: 10000 });

      await rows
        .nth(1)
        .locator('[data-testid="search-recent-remove-button"]')
        .click();

      await expect(rows).toHaveCount(2, { timeout: 10000 });
      await expect(rows.nth(0)).toContainText("alpha");
      await expect(rows.nth(1)).toContainText("gamma");
      await expect(page).toHaveURL(/\/search$/);
      await expect
        .poll(
          () => mockServer.searchHistory?.searches?.map((entry) => entry.q),
          { timeout: 10000 },
        )
        .toEqual(["alpha", "gamma"]);
    });

    test("removes a recent search optimistically before the write settles", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({
        searches: [
          { q: "cats", ts: 2 },
          { q: "dogs", ts: 1 },
        ],
      });
      mockServer.putPreferencesDelayMs = 2000;
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const rows = view.locator('[data-testid="search-recent-row"]');
      await expect(rows).toHaveCount(2, { timeout: 10000 });

      await rows
        .nth(0)
        .locator('[data-testid="search-recent-remove-button"]')
        .click();

      // The row disappears immediately, long before the delayed
      // putPreferences settles
      await expect(rows).toHaveCount(1, { timeout: 500 });
      await expect(rows.nth(0)).toContainText("dogs");
      expect(mockServer.searchHistory.searches.length).toBe(2);

      await expect
        .poll(
          () => mockServer.searchHistory?.searches?.map((entry) => entry.q),
          { timeout: 10000 },
        )
        .toEqual(["dogs"]);
      await expect(rows).toHaveCount(1);
    });

    test("shows the placeholder again after removing the last entry", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.setSearchHistory({ searches: [{ q: "cats", ts: 1 }] });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      await view
        .locator('[data-testid="search-recent-remove-button"]')
        .first()
        .click();

      await expect(view.locator(".search-placeholder")).toBeVisible({
        timeout: 10000,
      });
      await expect(
        view.locator('[data-testid="search-recent"]'),
      ).not.toBeVisible();
    });

    test("logged out shows the placeholder and never writes history", async ({
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

      await page.goto("/search");

      const view = page.locator("#search-view");
      await expect(view.locator(".search-placeholder")).toBeVisible({
        timeout: 10000,
      });

      const input = view.locator(".search-input");
      await input.fill("alice");
      await input.press("Enter");
      await expect(view.locator(".profile-list-item")).toHaveCount(1, {
        timeout: 10000,
      });
      expect(mockServer.searchHistory).toBe(null);
    });

    test("renders recent profiles in stored order and navigates on tap", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const profile1 = createProfile({
        did: "did:plc:recent1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const profile2 = createProfile({
        did: "did:plc:recent2",
        handle: "bob.bsky.social",
        displayName: "Bob",
      });
      mockServer.addProfile(profile1);
      mockServer.addProfile(profile2);
      mockServer.setSearchHistory({
        profiles: [profile2.did, profile1.did],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const tiles = view.locator('[data-testid="search-recent-profile"]');
      await expect(tiles).toHaveCount(2, { timeout: 10000 });
      await expect(tiles.nth(0)).toContainText("Bob");
      await expect(tiles.nth(1)).toContainText("Alice");

      await tiles.nth(0).click();
      await expect(page).toHaveURL(/\/profile\//, { timeout: 10000 });
    });

    test("shows skeleton tiles while recent profiles load, matching loaded height", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const profile1 = createProfile({
        did: "did:plc:recent1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const profile2 = createProfile({
        did: "did:plc:recent2",
        handle: "bob.bsky.social",
        displayName: "Bob",
      });
      mockServer.addProfile(profile1);
      mockServer.addProfile(profile2);
      mockServer.setSearchHistory({
        profiles: [profile2.did, profile1.did],
      });
      mockServer.getProfilesDelayMs = 1500;
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const skeletons = view.locator(
        '[data-testid="search-recent-profile-skeleton"]',
      );
      await expect(skeletons).toHaveCount(2, { timeout: 10000 });
      const skeletonBox = await skeletons.first().boundingBox();

      const tiles = view.locator('[data-testid="search-recent-profile"]');
      await expect(tiles).toHaveCount(2, { timeout: 10000 });
      await expect(skeletons).toHaveCount(0);
      const tileBox = await tiles.first().boundingBox();
      expect(tileBox.height).toBe(skeletonBox.height);
      expect(tileBox.width).toBe(skeletonBox.width);
    });

    test("removing a recent profile does not navigate", async ({ page }) => {
      const mockServer = new MockServer();
      const profile1 = createProfile({
        did: "did:plc:recent1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const profile2 = createProfile({
        did: "did:plc:recent2",
        handle: "bob.bsky.social",
        displayName: "Bob",
      });
      mockServer.addProfile(profile1);
      mockServer.addProfile(profile2);
      mockServer.setSearchHistory({
        profiles: [profile2.did, profile1.did],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/search");

      const view = page.locator("#search-view");
      const tiles = view.locator('[data-testid="search-recent-profile"]');
      await expect(tiles).toHaveCount(2, { timeout: 10000 });

      await tiles
        .nth(0)
        .locator('[data-testid="search-recent-profile-remove"]')
        .click();

      await expect(tiles).toHaveCount(1, { timeout: 10000 });
      await expect(tiles.nth(0)).toContainText("Alice");
      await expect(page).toHaveURL(/\/search$/);
      await expect
        .poll(() => mockServer.searchHistory?.profiles, { timeout: 10000 })
        .toEqual(["did:plc:recent1"]);
    });
  });
});
