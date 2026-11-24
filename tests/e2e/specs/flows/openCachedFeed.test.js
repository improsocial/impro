import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createPost } from "../../../shared/factories.js";

test.describe("Open cached feed flow", () => {
  test("should load a separate copy of a home feed when opening its detail page", async ({
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
    mockServer.addFeedItems(feed.uri, [
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/trendingpost",
        text: "Post from the trending feed",
        authorHandle: "author1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    let getFeedRequests = 0;
    let getFeedGeneratorRequests = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.endsWith("/app.bsky.feed.getFeed") &&
        url.searchParams.get("feed") === feed.uri
      ) {
        getFeedRequests++;
      }
      if (url.pathname.endsWith("/app.bsky.feed.getFeedGenerator")) {
        getFeedGeneratorRequests++;
      }
    });

    await login(page);
    await page.goto("/");
    await expect.poll(() => getFeedRequests, { timeout: 10000 }).toBe(1);

    await page.locator('[data-testid="sidebar-nav-feeds"]').click();
    const feedsView = page.locator("#feeds-view");
    await feedsView.locator('[data-testid="feeds-list-item-feed"]').click();

    const feedDetailView = page.locator("#feed-detail-view");
    await expect(
      feedDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Trending", { timeout: 10000 });
    await expect(
      feedDetailView.locator('[data-testid="feed-item"]'),
    ).toHaveCount(1);

    expect(getFeedRequests).toBe(2);
    expect(getFeedGeneratorRequests).toBe(0);

    await page.goBack();
    await page.goBack();
    await expect(
      page.locator("#home-view [data-testid='feed-item']"),
    ).toHaveCount(1);
    expect(getFeedRequests).toBe(2);
  });
});
