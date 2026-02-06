import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Quote post flow", () => {
  test("should render quoted post embed in new post after quoting", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const originalPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Original post to quote",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      quoteCount: 0,
    });
    mockServer.addTimelinePosts([originalPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Click the repost button to open the context menu
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="repost-button"]').click();
    await page.locator("context-menu-item", { hasText: "Quote Post" }).click();

    // Wait for the composer to open with the quoted post
    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type commentary text
    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("My take on this post");

    // Click Post button
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to own profile to see the new quote post
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("My take on this post");
    // The quoted post should be rendered as an embed
    await expect(profileView).toContainText("Original post to quote");
  });

  test("should show quote post in original post's Quotes list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const originalPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post that will be quoted",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      quoteCount: 0,
    });
    mockServer.addTimelinePosts([originalPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Quote the post
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="repost-button"]').click();
    await page.locator("context-menu-item", { hasText: "Quote Post" }).click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("Quoting this great post");

    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to the original post's Quotes page
    await page.goto("/profile/author1.bsky.social/post/post1/quotes");

    const quotesView = page.locator("#post-quotes-view");
    await expect(
      quotesView.locator('[data-testid="header-title"]'),
    ).toContainText("Quotes", { timeout: 10000 });

    await expect(quotesView.locator('[data-testid="small-post"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(quotesView).toContainText("Quoting this great post");
  });
});
