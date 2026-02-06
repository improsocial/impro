import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createPost } from "../../factories.js";

test.describe("Feed Detail view", () => {
  test("should display feed name, creator, and posts", async ({ page }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "First trending post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/post2",
      text: "Second trending post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.addFeedItems(feed.uri, [post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Trending",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "@creator1.bsky.social",
    );

    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });

    await expect(view).toContainText("First trending post");
    await expect(view).toContainText("Second trending post");
  });

  test("should show pin button as unpinned when feed is not pinned", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    await expect(view.locator(".pin-feed-button")).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".pin-feed-button.pinned")).toHaveCount(0);
  });

  test("should show pin button as pinned when feed is pinned", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    await expect(view.locator(".pin-feed-button.pinned")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should pin an unpinned feed when pin button is clicked", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setSavedFeeds([feed.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    const pinButton = view.locator(".pin-feed-button");
    await expect(pinButton).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".pin-feed-button.pinned")).toHaveCount(0);

    await pinButton.click();

    await expect(view.locator(".pin-feed-button.pinned")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".toast")).toContainText("Feed pinned");
  });

  test("should pin a feed that is not already saved", async ({ page }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    const pinButton = view.locator(".pin-feed-button");
    await expect(pinButton).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".pin-feed-button.pinned")).toHaveCount(0);

    await pinButton.click();

    await expect(view.locator(".pin-feed-button.pinned")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".toast")).toContainText("Feed pinned");
  });

  test("should unpin a pinned feed when pin button is clicked", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    const pinButton = view.locator(".pin-feed-button.pinned");
    await expect(pinButton).toBeVisible({ timeout: 10000 });

    await pinButton.click();

    await expect(view.locator(".pin-feed-button.pinned")).toHaveCount(0);
    await expect(page.locator(".toast")).toContainText("Feed unpinned");
  });

  test("should display empty state when feed has no posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/feed/trending");

    const view = page.locator("#feed-detail-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Trending",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });
});
