import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Bookmark post flow", () => {
  test("should show bookmarked post in bookmarks view after bookmarking on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post worth saving",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/app.bsky.bookmark.createBookmark*", (route) => {
      post.viewer.bookmarked = true;
      mockServer.bookmarks.push(post);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await login(page);
    await page.goto("/");

    // Bookmark the post on the home view
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="bookmark-button"]').click();
    await expect(
      feedItem.locator('[data-testid="bookmark-button"].bookmarked'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to bookmarks view and verify the post appears
    await page.goto("/bookmarks");

    const bookmarksView = page.locator("#bookmarks-view");
    await expect(
      bookmarksView.locator('[data-testid="feed-item"]'),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(bookmarksView).toContainText("Post worth saving");
  });

  test("should remove post from bookmarks view after unbookmarking on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to remove",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    post.viewer.bookmarked = true;
    mockServer.addTimelinePosts([post]);
    mockServer.addBookmarks([post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/app.bsky.bookmark.deleteBookmark*", (route) => {
      mockServer.bookmarks.splice(0);
      return route.fulfill({ status: 200 });
    });

    await login(page);

    // Verify the post is in bookmarks initially
    await page.goto("/bookmarks");

    const bookmarksView = page.locator("#bookmarks-view");
    await expect(
      bookmarksView.locator('[data-testid="feed-item"]'),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(bookmarksView).toContainText("Post to remove");

    // Navigate to home and unbookmark the post
    await page.goto("/");

    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem
      .locator('[data-testid="bookmark-button"].bookmarked')
      .click();
    await expect(
      feedItem.locator('[data-testid="bookmark-button"].bookmarked'),
    ).toHaveCount(0, { timeout: 10000 });

    // Navigate back to bookmarks view and verify the post is gone
    await page.goto("/bookmarks");

    await expect(
      bookmarksView.locator('[data-testid="feed-end-message"]'),
    ).toContainText("No saved posts yet!", { timeout: 10000 });
  });
});
