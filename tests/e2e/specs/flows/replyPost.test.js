import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

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
    await expect(composer.locator("dialog.post-composer")).toBeVisible({
      timeout: 10000,
    });
    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("My reply to the thread");

    // Click the Reply button to send
    await composer.locator('[data-testid="composer-submit-button"]').click();

    // The composer should close and the reply should appear in the thread
    await expect(composer.locator("dialog.post-composer")).not.toBeVisible({
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
    await page.goto("/profile/author1.bsky.social/post/post2");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });

    // Click the reply prompt to open the composer
    await view.locator(".post-thread-reply-prompt").click();

    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog.post-composer")).toBeVisible({
      timeout: 10000,
    });
    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("Another reply");

    await composer.locator('[data-testid="composer-submit-button"]').click();

    await expect(composer.locator("dialog.post-composer")).not.toBeVisible({
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

  test("should open the composer from a feed post's reply button without leaving the feed", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const rootPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/root1",
      text: "Thread root",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const feedPost = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/reply1",
      text: "A reply in the feed",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
      reply: {
        root: { uri: rootPost.uri, cid: rootPost.cid },
        parent: { uri: rootPost.uri, cid: rootPost.cid },
      },
    });
    mockServer.addPosts([rootPost, feedPost]);
    mockServer.addTimelinePosts([feedPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    const feedItem = view.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="reply-button"]').click();

    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog.post-composer")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL("/");
    await expect(composer).toContainText("A reply in the feed");

    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("Replying from the feed");
    await composer.locator('[data-testid="composer-submit-button"]').click();

    await expect(composer.locator("dialog.post-composer")).not.toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL("/");

    const createdPost = mockServer.applyWritesCalls
      .flat()
      .find((write) => write.collection === "app.bsky.feed.post");
    expect(createdPost.value.text).toBe("Replying from the feed");
    expect(createdPost.value.reply).toEqual({
      root: { uri: rootPost.uri, cid: rootPost.cid },
      parent: { uri: feedPost.uri, cid: feedPost.cid },
    });
  });
});
