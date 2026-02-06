import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator } from "../../factories.js";

test.describe("Pin feed flow", () => {
  test("should show feed in feeds index after pinning from feed detail", async ({
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

    // Feeds index should only show Following initially
    await page.goto("/feeds");
    const feedsView = page.locator("#feeds-view");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(feedsView).toContainText("Following");

    // Navigate to the feed detail page and pin it
    await page.goto("/profile/creator1.bsky.social/feed/trending");
    const detailView = page.locator("#feed-detail-view");
    const pinButton = detailView.locator(".pin-feed-button");
    await expect(pinButton).toBeVisible({ timeout: 10000 });

    await pinButton.click();
    await expect(detailView.locator(".pin-feed-button.pinned")).toBeVisible({
      timeout: 10000,
    });

    // Navigate back to feeds index — pinned feed should now appear
    await page.goto("/feeds");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(feedsView).toContainText("Following");
    await expect(feedsView).toContainText("Trending");
    await expect(feedsView).toContainText("by @creator1.bsky.social");

    // Navigate to home — pinned feed should appear as a tab
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const tabs = homeView.locator(".tab-bar-button");
    await expect(tabs).toHaveCount(2, { timeout: 10000 });
    await expect(tabs.nth(0)).toContainText("Following");
    await expect(tabs.nth(1)).toContainText("Trending");
  });

  test("should remove feed from feeds index after unpinning from feed detail", async ({
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

    // Feeds index should show Following + Trending initially
    await page.goto("/feeds");
    const feedsView = page.locator("#feeds-view");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(feedsView).toContainText("Trending");

    // Navigate to the feed detail page and unpin it
    await page.goto("/profile/creator1.bsky.social/feed/trending");
    const detailView = page.locator("#feed-detail-view");
    const pinButton = detailView.locator(".pin-feed-button.pinned");
    await expect(pinButton).toBeVisible({ timeout: 10000 });

    await pinButton.click();
    await expect(detailView.locator(".pin-feed-button.pinned")).toHaveCount(0);

    // Navigate back to feeds index — unpinned feed should be gone
    await page.goto("/feeds");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(feedsView).toContainText("Following");
    await expect(feedsView).not.toContainText("Trending");

    // Navigate to home — unpinned feed should not appear as a tab
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const tabs = homeView.locator(".tab-bar-button");
    await expect(tabs).toHaveCount(1, { timeout: 10000 });
    await expect(tabs.nth(0)).toContainText("Following");
  });
});
