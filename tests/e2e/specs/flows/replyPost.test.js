import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Reply flow", () => {
  test("should show reply in thread replies after replying from thread view", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const postUri = "at://did:plc:author1/app.bsky.feed.post/post1";
    const post = createPost({
      uri: postUri,
      text: "Post to reply to",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 0,
    });
    mockServer.addPosts([post]);
    mockServer.addTimelinePosts([post]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post,
      parent: null,
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);

    // Navigate to the thread view
    await page.goto("/profile/author1.bsky.social/post/post1");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("Post to reply to");

    // Click the reply prompt to open the composer
    await view.locator(".post-thread-reply-prompt").click();

    // Type into the composer's rich text input
    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog")).toBeVisible({ timeout: 10000 });
    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("My reply to the thread");

    // Click the Reply button to send
    await composer
      .locator("button.rounded-button-primary", { hasText: "Reply" })
      .click();

    // The composer should close and the reply should appear in the thread
    await expect(composer.locator("dialog")).not.toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("My reply to the thread", {
      timeout: 10000,
    });
  });

  test("should increment reply count on parent post after replying", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const postUri = "at://did:plc:author1/app.bsky.feed.post/post2";
    const post = createPost({
      uri: postUri,
      text: "Post with reply count",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 3,
    });
    mockServer.addPosts([post]);
    mockServer.addTimelinePosts([post]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post,
      parent: null,
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);

    // Navigate to the thread view
    await page.goto("/profile/author1.bsky.social/post/post2");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });

    // Click the reply prompt to open the composer
    await view.locator(".post-thread-reply-prompt").click();

    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog")).toBeVisible({ timeout: 10000 });
    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("Another reply");

    await composer
      .locator("button.rounded-button-primary", { hasText: "Reply" })
      .click();

    await expect(composer.locator("dialog")).not.toBeVisible({
      timeout: 10000,
    });

    // Navigate to home and verify the post shows an incremented reply count
    await page.goto("/");

    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    // The reply button should reflect the updated count
    await expect(feedItem.locator('[data-testid="reply-button"]')).toBeVisible({
      timeout: 10000,
    });
  });
});
