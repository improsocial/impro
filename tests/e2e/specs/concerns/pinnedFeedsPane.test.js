import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createPost } from "../../../shared/factories.js";

test.describe("Pinned feeds pane", () => {
  let mockServer;
  const feed = createFeedGenerator({
    uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
    displayName: "Trending",
    creatorHandle: "creator1.bsky.social",
  });

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    mockServer.addFeedItems(feed.uri, [
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/feedpost1",
        text: "Post from the pinned feed",
        authorHandle: "author1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);
    await login(page);
  });

  test("lists pinned feeds with a More feeds link in the right column", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const pane = page.locator('[data-testid="pinned-feeds-pane"]');
    await expect(pane).toBeVisible();
    const items = pane.locator('[data-testid="pinned-feeds-item"]');
    await expect(items).toHaveCount(2, { timeout: 10000 });
    await expect(items.nth(0)).toContainText("Following");
    await expect(items.nth(1)).toContainText("Trending");
    await expect(
      pane.locator('[data-testid="pinned-feeds-more"]'),
    ).toBeVisible();
  });

  test("switches the home feed when a pinned feed is clicked", async ({
    page,
  }) => {
    await page.goto("/");
    const view = page.locator("#home-view");
    await expect(view.locator(".tab-bar-button.active")).toContainText(
      "Following",
      { timeout: 10000 },
    );

    const items = page.locator('[data-testid="pinned-feeds-item"]');
    await expect(items).toHaveCount(2, { timeout: 10000 });
    await items.nth(1).click();

    await expect(view.locator(".tab-bar-button.active")).toContainText(
      "Trending",
    );
    await expect(items.nth(1)).toHaveClass(/active/);
    await expect(view).toContainText("Post from the pinned feed", {
      timeout: 10000,
    });
  });

  test("navigates home and selects the feed when clicked from another page", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });

    const items = page.locator('[data-testid="pinned-feeds-item"]');
    await expect(items).toHaveCount(2, { timeout: 10000 });
    await items.nth(1).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.locator("#home-view .tab-bar-button.active"),
    ).toContainText("Trending", { timeout: 10000 });
  });

  test("navigates to the feeds view from the More feeds link", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="pinned-feeds-more"]').click();

    await expect(page).toHaveURL("/feeds");
    await expect(page.locator("#feeds-view")).toBeVisible({ timeout: 10000 });
  });
});
