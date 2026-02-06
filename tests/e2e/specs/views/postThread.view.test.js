import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";

const mainPost = createPost({
  uri: postUri,
  text: "This is the main post",
  authorHandle: "author1.bsky.social",
  authorDisplayName: "Author One",
});

test.describe("Post thread view", () => {
  test("should display header and the main post", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([mainPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Post",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("This is the main post");
  });

  test("should display parent post in thread context", async ({ page }) => {
    const parentPost = createPost({
      uri: "at://did:plc:parent1/app.bsky.feed.post/parent1",
      text: "This is the parent post",
      authorHandle: "parent1.bsky.social",
      authorDisplayName: "Parent Author",
    });

    const childPost = createPost({
      uri: postUri,
      text: "This is a reply",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      reply: {
        parent: { uri: parentPost.uri, cid: parentPost.cid },
        root: { uri: parentPost.uri, cid: parentPost.cid },
      },
    });

    const mockServer = new MockServer();
    mockServer.addPosts([childPost, parentPost]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: childPost,
      parent: {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: parentPost,
        parent: null,
        replies: [],
      },
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view).toContainText("This is the parent post", {
      timeout: 10000,
    });
    await expect(view).toContainText("This is a reply");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible();
    // Parent shown as small post above the main post
    await expect(view.locator('[data-testid="small-post"]')).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("should display replies", async ({ page }) => {
    const postWithReplies = createPost({
      uri: postUri,
      text: "Post with replies",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 2,
    });

    const reply1 = createPost({
      uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
      text: "First reply",
      authorHandle: "replier1.bsky.social",
      authorDisplayName: "Replier One",
      likeCount: 10,
    });

    const reply2 = createPost({
      uri: "at://did:plc:replier2/app.bsky.feed.post/reply2",
      text: "Second reply",
      authorHandle: "replier2.bsky.social",
      authorDisplayName: "Replier Two",
      likeCount: 5,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([postWithReplies, reply1, reply2]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: postWithReplies,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: reply1,
          replies: [],
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: reply2,
          replies: [],
        },
      ],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("First reply", { timeout: 10000 });
    await expect(view).toContainText("Second reply");
  });

  test("should display reply prompt for authenticated user", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([mainPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".post-thread-reply-prompt")).toContainText(
      "Write your reply",
      { timeout: 10000 },
    );
  });

  test("should display post action counts on the main post", async ({
    page,
  }) => {
    const postWithCounts = createPost({
      uri: postUri,
      text: "Popular post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      likeCount: 42,
      repostCount: 10,
      quoteCount: 3,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([postWithCounts]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    const largePost = view.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });
    await expect(largePost).toContainText("42");
    await expect(largePost).toContainText("likes");
    await expect(largePost).toContainText("10");
    await expect(largePost).toContainText("reposts");
  });

  test("should like the main post when clicking the like button", async ({
    page,
  }) => {
    const post = createPost({
      uri: postUri,
      text: "Post to like",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      likeCount: 3,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    const largePost = view.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    await largePost.locator("like-button").click();

    await expect(largePost.locator("like-button .liked")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should repost the main post when clicking repost in the context menu", async ({
    page,
  }) => {
    const post = createPost({
      uri: postUri,
      text: "Post to repost",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      repostCount: 2,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    const largePost = view.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    await largePost.locator('[data-testid="repost-button"]').click();
    await page.locator("context-menu-item", { hasText: "Repost" }).click();

    await expect(
      largePost.locator('[data-testid="repost-button"].reposted'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should bookmark the main post when clicking the bookmark button", async ({
    page,
  }) => {
    const post = createPost({
      uri: postUri,
      text: "Post to bookmark",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    const largePost = view.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    await largePost.locator('[data-testid="bookmark-button"]').click();

    await expect(
      largePost.locator('[data-testid="bookmark-button"].bookmarked'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to reply thread when clicking a reply", async ({
    page,
  }) => {
    const postWithReplies = createPost({
      uri: postUri,
      text: "Main post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 1,
    });

    const reply = createPost({
      uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
      text: "A reply to click",
      authorHandle: "replier1.bsky.social",
      authorDisplayName: "Replier One",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([postWithReplies, reply]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: postWithReplies,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: reply,
          replies: [],
        },
      ],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view).toContainText("A reply to click", { timeout: 10000 });

    await view.locator('[data-testid="small-post"]').click();

    await expect(page).toHaveURL(
      /\/profile\/replier1\.bsky\.social\/post\/reply1/,
      {
        timeout: 10000,
      },
    );
  });

  test("should post a reply via the reply prompt", async ({ page }) => {
    const post = createPost({
      uri: postUri,
      text: "Post to reply to",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".post-thread-reply-prompt")).toContainText(
      "Write your reply",
      { timeout: 10000 },
    );

    // Click the reply prompt to open the composer
    await view.locator(".post-thread-reply-prompt").click();

    // Type into the composer's rich text input
    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog")).toBeVisible({ timeout: 10000 });
    await composer
      .locator("rich-text-input [contenteditable]")
      .fill("My reply text");

    // Click the Reply button to send
    await composer
      .locator("button.rounded-button-primary", { hasText: "Reply" })
      .click();

    // The composer should close and the reply should appear in the thread
    await expect(composer.locator("dialog")).not.toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("My reply text", { timeout: 10000 });
  });
});
