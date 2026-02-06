import { test, expect } from "../base.js";
import { login } from "../helpers.js";
import { MockServer } from "../mockServer.js";
import { createPost } from "../factories.js";

test.describe("Bookmarks view", () => {
  test("should display saved posts header and bookmarked posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/abc123",
      text: "First bookmarked post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/def456",
      text: "Second bookmarked post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addBookmarks([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/bookmarks");

    const bookmarksView = page.locator("#bookmarks-view");
    await expect(
      bookmarksView.locator('[data-testid="header-title"]'),
    ).toContainText("Saved Posts", { timeout: 10000 });

    await expect(
      bookmarksView.locator('[data-testid="feed-item"]'),
    ).toHaveCount(2, { timeout: 10000 });

    await expect(bookmarksView).toContainText("First bookmarked post");
    await expect(bookmarksView).toContainText("Second bookmarked post");
  });

  test("should remove a bookmark when clicking the bookmark button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/abc123",
      text: "Post to unbookmark",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    post.viewer.bookmarked = true;
    mockServer.addBookmarks([post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/app.bsky.bookmark.deleteBookmark*", (route) =>
      route.fulfill({ status: 200 }),
    );

    await login(page);
    await page.goto("/bookmarks");

    const bookmarksView = page.locator("#bookmarks-view");
    await expect(
      bookmarksView.locator('[data-testid="feed-item"]'),
    ).toHaveCount(1, { timeout: 10000 });

    await bookmarksView.locator('[data-testid="bookmark-button"]').click();

    await expect(
      bookmarksView.locator('[data-testid="feed-end-message"]'),
    ).toContainText("No saved posts yet!", { timeout: 10000 });
  });

  test("should display empty state when there are no bookmarks", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/bookmarks");

    const bookmarksView = page.locator("#bookmarks-view");
    await expect(
      bookmarksView.locator('[data-testid="header-title"]'),
    ).toContainText("Saved Posts", { timeout: 10000 });

    await expect(
      bookmarksView.locator('[data-testid="feed-end-message"]'),
    ).toContainText("No saved posts yet!", { timeout: 10000 });
  });
});
