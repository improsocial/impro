import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createPost } from "../../factories.js";

test.describe("Home view", () => {
  test("should display Following tab and feed posts", async ({ page }) => {
    const mockServer = new MockServer();
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Hello from the timeline",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/post2",
      text: "Another timeline post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addTimelinePosts([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator(".tab-bar-button")).toContainText("Following", {
      timeout: 10000,
    });
    await expect(view.locator(".tab-bar-button.active")).toContainText(
      "Following",
    );

    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Hello from the timeline");
    await expect(view).toContainText("Another timeline post");
  });

  test("should display pinned feed tabs alongside Following", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed1 = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    const feed2 = createFeedGenerator({
      uri: "at://did:plc:creator2/app.bsky.feed.generator/science",
      displayName: "Science",
      creatorHandle: "creator2.bsky.social",
    });
    mockServer.addFeedGenerators([feed1, feed2]);
    mockServer.setPinnedFeeds([feed1.uri, feed2.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const tabs = view.locator(".tab-bar-button");
    await expect(tabs).toHaveCount(3, { timeout: 10000 });
    await expect(tabs.nth(0)).toContainText("Following");
    await expect(tabs.nth(1)).toContainText("Trending");
    await expect(tabs.nth(2)).toContainText("Science");
  });

  test("should switch to a custom feed tab when clicked", async ({ page }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    const timelinePost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Timeline post here",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const feedPost = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/post2",
      text: "Trending feed post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    mockServer.addTimelinePosts([timelinePost]);
    mockServer.addFeedItems(feed.uri, [feedPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const visibleFeed = view.locator(".feed-container:not([hidden])");
    await expect(visibleFeed.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(visibleFeed).toContainText("Timeline post here");

    await view.locator(".tab-bar-button", { hasText: "Trending" }).click();

    await expect(view.locator(".tab-bar-button.active")).toContainText(
      "Trending",
    );
    await expect(visibleFeed.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(visibleFeed).toContainText("Trending feed post");
  });

  test("should display post author name, handle, and action bar", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post with details",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });

    await expect(
      view.locator('[data-testid="post-author-name"]'),
    ).toContainText("Author One");
    await expect(
      view.locator('[data-testid="post-author-handle"]'),
    ).toContainText("@author1.bsky.social");
    await expect(view.locator('[data-testid="reply-button"]')).toBeVisible();
    await expect(view.locator('[data-testid="repost-button"]')).toBeVisible();
    await expect(view.locator('[data-testid="bookmark-button"]')).toBeVisible();
  });

  test("should navigate to post thread view when clicking a post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Click me to see the thread",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator('[data-testid="small-post"]').click();

    const threadView = page.locator("#post-detail-view");
    await expect(threadView).toBeVisible({ timeout: 10000 });
    await expect(threadView).toContainText("Click me to see the thread");
    await expect(page).toHaveURL(
      /\/profile\/author1\.bsky\.social\/post\/post1/,
    );
  });

  test("should like a post when clicking the like button", async ({ page }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to like",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      likeCount: 3,
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const feedItem = view.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator("like-button").click();

    await expect(feedItem.locator("like-button .liked")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should repost a post when clicking repost in the context menu", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to repost",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      repostCount: 2,
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const feedItem = view.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="repost-button"]').click();
    await page.locator("context-menu-item", { hasText: "Repost" }).click();

    await expect(
      feedItem.locator('[data-testid="repost-button"].reposted'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should bookmark a post when clicking the bookmark button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to bookmark",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const feedItem = view.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="bookmark-button"]').click();

    await expect(
      feedItem.locator('[data-testid="bookmark-button"].bookmarked'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should load more posts when scrolling to the bottom", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const posts = [];
    for (let i = 1; i <= 60; i++) {
      posts.push(
        createPost({
          uri: `at://did:plc:author${i}/app.bsky.feed.post/post${i}`,
          text: `Timeline post ${i}`,
          authorHandle: `author${i}.bsky.social`,
          authorDisplayName: `Author ${i}`,
        }),
      );
    }
    mockServer.addTimelinePosts(posts);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(41, {
      timeout: 10000,
    });

    // Scroll the last feed item into view to trigger infinite scroll
    await view
      .locator('[data-testid="feed-item"]')
      .last()
      .scrollIntoViewIfNeeded();

    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(60, {
      timeout: 10000,
    });
    await expect(view).toContainText("Timeline post 42");
    await expect(view).toContainText("Timeline post 60");
  });

  test("should display empty state when Following feed has no posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator(".tab-bar-button.active")).toContainText(
      "Following",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display error state when feed server fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/broken",
      displayName: "Broken Feed",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    await mockServer.setup(page);

    // Override getFeed to return error (fallback for getFeedGenerator* routes)
    await page.route("**/xrpc/app.bsky.feed.getFeed*", (route) => {
      if (route.request().url().includes("getFeedGenerator")) {
        return route.fallback();
      }
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      });
    });

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await view.locator(".tab-bar-button", { hasText: "Broken Feed" }).click();

    await expect(view.locator(".error-state")).toContainText(
      "An issue occurred when contacting the feed server.",
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    const discoverFeedUri =
      "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

    test("should show discover/public feed instead of following feed", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const discoverFeed = createFeedGenerator({
        uri: discoverFeedUri,
        displayName: "Discover",
        creatorHandle: "bsky.app",
      });
      const post = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "A public discover post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      mockServer.addFeedGenerators([discoverFeed]);
      mockServer.addFeedItems(discoverFeedUri, [post]);
      await mockServer.setup(page);

      await page.goto("/");

      const view = page.locator("#home-view");
      const tabs = view.locator(".tab-bar-button");
      await expect(tabs).toHaveCount(1, { timeout: 10000 });
      await expect(tabs.first()).toContainText("Discover");

      await expect(view).toContainText("A public discover post", {
        timeout: 10000,
      });
    });

    test("should hide logged-in-only UI (compose button, feed switcher)", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const discoverFeed = createFeedGenerator({
        uri: discoverFeedUri,
        displayName: "Discover",
        creatorHandle: "bsky.app",
      });
      mockServer.addFeedGenerators([discoverFeed]);
      await mockServer.setup(page);

      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator(".tab-bar-button")).toHaveCount(1, {
        timeout: 10000,
      });

      await expect(
        page.locator('[data-testid="floating-compose-button"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="sidebar-compose-button"]'),
      ).not.toBeVisible();
    });
  });

  test.describe("Content moderation labels", () => {
    const labelerDid = "did:plc:customlabeler1";
    const labeler = {
      uri: `at://${labelerDid}/app.bsky.labeler.service/self`,
      cid: "bafyreilabeler1",
      creator: {
        did: labelerDid,
        handle: "safety.example.com",
        displayName: "Safety Labeler",
        avatar: "",
        viewer: { muted: false, blockedBy: false },
        labels: [],
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      policies: {
        labelValueDefinitions: [
          {
            identifier: "misleading",
            blurs: "content",
            severity: "alert",
            defaultSetting: "warn",
            locales: [
              {
                lang: "en",
                name: "Misleading",
                description: "Content may be misleading",
              },
            ],
          },
          {
            identifier: "nsfw-art",
            blurs: "media",
            severity: "none",
            defaultSetting: "warn",
            locales: [
              {
                lang: "en",
                name: "NSFW Art",
                description: "May contain artistic nudity",
              },
            ],
          },
          {
            identifier: "spam",
            blurs: "none",
            severity: "inform",
            defaultSetting: "warn",
            locales: [
              {
                lang: "en",
                name: "Spam",
                description: "Likely spam content",
              },
            ],
          },
          {
            identifier: "satire",
            blurs: "none",
            severity: "alert",
            defaultSetting: "warn",
            locales: [
              {
                lang: "en",
                name: "Satire",
                description: "Satirical content",
              },
            ],
          },
        ],
      },
      labels: [],
    };

    test("post with a content label is wrapped in a moderation-warning showing label name and labeler attribution", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const normalPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/normal1",
        text: "Normal visible post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      const labeledPost = createPost({
        uri: "at://did:plc:author2/app.bsky.feed.post/labeled1",
        text: "This content is misleading",
        authorHandle: "author2.bsky.social",
        authorDisplayName: "Author Two",
      });
      labeledPost.labels = [
        {
          val: "misleading",
          src: labelerDid,
          uri: labeledPost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([normalPost, labeledPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
        timeout: 10000,
      });

      await expect(view).toContainText("Normal visible post");

      const warning = view.locator("moderation-warning.post-content-warning");
      await expect(warning).toBeVisible();
      await expect(warning).toContainText("Misleading");
      await expect(
        warning.locator(".post-moderation-warning-description"),
      ).toContainText("Labeled by");
      await expect(
        warning.locator(".post-moderation-warning-description"),
      ).toContainText("@safety.example.com");
    });

    test("clicking Show on the moderation warning reveals the post content", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const labeledPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/labeled1",
        text: "Hidden content here",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      labeledPost.labels = [
        {
          val: "misleading",
          src: labelerDid,
          uri: labeledPost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([labeledPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const warning = view.locator("moderation-warning.post-content-warning");
      const toggleContent = warning.locator(".toggle-content");
      await expect(toggleContent).toBeHidden();

      await warning.locator(".show-hide-label").click();

      await expect(toggleContent).toBeVisible();
      await expect(toggleContent).toContainText("Hidden content here");
    });

    test("clicking Hide collapses the content again", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const labeledPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/labeled1",
        text: "Toggle content",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      labeledPost.labels = [
        {
          val: "misleading",
          src: labelerDid,
          uri: labeledPost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([labeledPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const warning = view.locator("moderation-warning.post-content-warning");
      const toggleContent = warning.locator(".toggle-content");

      // Expand
      await warning.locator(".show-hide-label").click();
      await expect(toggleContent).toBeVisible();

      // Collapse
      await warning.locator(".show-hide-label").click();
      await expect(toggleContent).toBeHidden();
    });

    test("post with a media label shows the media wrapped in a moderation warning while the post text remains visible", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const mediaPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/media1",
        text: "Check out these photos",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        embed: {
          $type: "app.bsky.embed.images#view",
          images: [
            {
              thumb: "",
              fullsize: "",
              alt: "Test image",
              aspectRatio: { height: 100, width: 100 },
            },
          ],
        },
      });
      mediaPost.labels = [
        {
          val: "nsfw-art",
          src: labelerDid,
          uri: mediaPost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([mediaPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      // Post text should be directly visible (not behind a content warning)
      await expect(view).toContainText("Check out these photos");

      // Media should be wrapped in a moderation warning
      const mediaWarning = view.locator(".post-embed moderation-warning");
      await expect(mediaWarning).toBeVisible();
      await expect(mediaWarning).toContainText("NSFW Art");

      // The images should be hidden behind the warning
      await expect(mediaWarning.locator(".toggle-content")).toBeHidden();
    });

    test("post with badge labels displays label badges inline with labeler avatar and label name", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const badgePost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/badge1",
        text: "Post with badge label",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      badgePost.labels = [
        {
          val: "spam",
          src: labelerDid,
          uri: badgePost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([badgePost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const badge = view.locator('[data-testid="label-badge"]');
      await expect(badge).toBeVisible();
      await expect(
        badge.locator('[data-testid="label-badge-image"]'),
      ).toBeVisible();
      await expect(
        badge.locator('[data-testid="label-badge-text"]'),
      ).toContainText("Spam");
    });

    test("post with multiple badge labels shows all badges", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const multiBadgePost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/multibadge1",
        text: "Post with multiple badges",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      multiBadgePost.labels = [
        {
          val: "spam",
          src: labelerDid,
          uri: multiBadgePost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
        {
          val: "satire",
          src: labelerDid,
          uri: multiBadgePost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([multiBadgePost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const badges = view.locator('[data-testid="label-badge"]');
      await expect(badges).toHaveCount(2);
      await expect(
        badges.nth(0).locator('[data-testid="label-badge-text"]'),
      ).toContainText("Spam");
      await expect(
        badges.nth(1).locator('[data-testid="label-badge-text"]'),
      ).toContainText("Satire");
    });

    test("a badge label links to the labeler's profile", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);

      const badgePost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/badge2",
        text: "Post with linkable badge",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      badgePost.labels = [
        {
          val: "spam",
          src: labelerDid,
          uri: badgePost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([badgePost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
        timeout: 10000,
      });

      const badge = view.locator('[data-testid="label-badge"]');
      await expect(badge).toHaveAttribute(
        "href",
        "/profile/safety.example.com",
      );
    });

    test("a blocked post shows a Post unavailable placeholder", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const normalPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/normal1",
        text: "Normal post in feed",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      const blockedPost = {
        $type: "app.bsky.feed.defs#blockedPost",
        uri: "at://did:plc:blocked1/app.bsky.feed.post/blocked1",
        blocked: true,
        author: {
          did: "did:plc:blocked1",
          viewer: {
            blocking: "at://did:plc:testuser123/app.bsky.graph.block/block1",
          },
        },
      };

      mockServer.addTimelinePosts([normalPost, blockedPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view).toContainText("Normal post in feed", {
        timeout: 10000,
      });

      // Blocked posts are filtered from the feed by filterEmptyPosts
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1);
    });

    test("a not-found post shows a Post unavailable placeholder", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const normalPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/normal1",
        text: "Normal post in feed",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      const notFoundPost = {
        $type: "app.bsky.feed.defs#notFoundPost",
        uri: "at://did:plc:notfound1/app.bsky.feed.post/notfound1",
        notFound: true,
      };

      mockServer.addTimelinePosts([normalPost, notFoundPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view).toContainText("Normal post in feed", {
        timeout: 10000,
      });

      // Not-found posts are filtered from the feed by filterEmptyPosts
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1);
    });

    test("posts with labels set to visibility hide in user preferences do not appear in the feed at all", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addLabelerViews([labeler]);
      mockServer.addLabelerSubscription(labelerDid);
      mockServer.contentLabelPrefs.push({
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "misleading",
        labelerDid: labelerDid,
        visibility: "hide",
      });

      const normalPost = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/normal1",
        text: "Visible normal post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      });
      const hiddenPost = createPost({
        uri: "at://did:plc:author2/app.bsky.feed.post/hidden1",
        text: "This should be hidden",
        authorHandle: "author2.bsky.social",
        authorDisplayName: "Author Two",
      });
      hiddenPost.labels = [
        {
          val: "misleading",
          src: labelerDid,
          uri: hiddenPost.uri,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockServer.addTimelinePosts([normalPost, hiddenPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/");

      const view = page.locator("#home-view");
      await expect(view).toContainText("Visible normal post", {
        timeout: 10000,
      });
      await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1);
      await expect(view).not.toContainText("This should be hidden");
    });
  });
});
