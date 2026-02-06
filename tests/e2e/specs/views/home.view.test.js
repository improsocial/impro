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
});
