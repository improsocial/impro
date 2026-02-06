import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";

const post = createPost({
  uri: postUri,
  text: "Original post",
  authorHandle: "author1.bsky.social",
  authorDisplayName: "Author One",
  quoteCount: 2,
});

const quotePost1 = createPost({
  uri: "at://did:plc:quoter1/app.bsky.feed.post/quote1",
  text: "Great take on this topic!",
  authorHandle: "quoter1.bsky.social",
  authorDisplayName: "Quoter One",
});

const quotePost2 = createPost({
  uri: "at://did:plc:quoter2/app.bsky.feed.post/quote2",
  text: "Interesting perspective here",
  authorHandle: "quoter2.bsky.social",
  authorDisplayName: "Quoter Two",
});

test.describe("Post quotes view", () => {
  test("should display header and quote posts", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addPostQuotes(postUri, [quotePost1, quotePost2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/quotes");

    const view = page.locator("#post-quotes-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Quotes",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "2 quotes",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="small-post"]')).toHaveCount(2, {
      timeout: 10000,
    });

    await expect(view).toContainText("Great take on this topic!");
    await expect(view).toContainText("Interesting perspective here");
  });

  test("should display singular 'quote' for count of 1", async ({ page }) => {
    const singleQuotePost = createPost({
      uri: postUri,
      text: "Original post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      quoteCount: 1,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([singleQuotePost]);
    mockServer.addPostQuotes(postUri, [quotePost1]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/quotes");

    const view = page.locator("#post-quotes-view");
    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "1 quote",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="small-post"]')).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("should display empty state when there are no quotes", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/quotes");

    const view = page.locator("#post-quotes-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Quotes",
      { timeout: 10000 },
    );

    await expect(view.locator(".search-status-message")).toContainText(
      "No quotes yet.",
      { timeout: 10000 },
    );
  });
});
