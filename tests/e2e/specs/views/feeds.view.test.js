import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator } from "../../factories.js";

test.describe("Feeds view", () => {
  test("should display header and pinned feeds", async ({ page }) => {
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
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(
      feedsView.locator('[data-testid="header-title"]'),
    ).toContainText("Feeds", { timeout: 10000 });

    await expect(feedsView.locator(".feeds-list-header")).toContainText(
      "Pinned Feeds",
    );

    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(feedsView).toContainText("Following");
    await expect(feedsView).toContainText("Trending");
    await expect(feedsView).toContainText("by @creator1.bsky.social");
    await expect(feedsView).toContainText("Science");
    await expect(feedsView).toContainText("by @creator2.bsky.social");
  });

  test("should navigate to feed detail when clicking a feed", async ({
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
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });

    await feedsView
      .locator(".feeds-list-item", { hasText: "Trending" })
      .click();

    await expect(page).toHaveURL(
      "/profile/creator1.bsky.social/feed/trending",
      { timeout: 10000 },
    );
  });

  test("should display only the Following feed when there are no other pinned feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(
      feedsView.locator('[data-testid="header-title"]'),
    ).toContainText("Feeds", { timeout: 10000 });

    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await expect(feedsView).toContainText("Following");
  });
});
