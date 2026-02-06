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
    });
    childPost.record.reply = {
      parent: { uri: parentPost.uri, cid: parentPost.cid },
      root: { uri: parentPost.uri, cid: parentPost.cid },
    };

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
    });
    postWithReplies.replyCount = 2;

    const reply1 = createPost({
      uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
      text: "First reply",
      authorHandle: "replier1.bsky.social",
      authorDisplayName: "Replier One",
    });
    reply1.likeCount = 10;

    const reply2 = createPost({
      uri: "at://did:plc:replier2/app.bsky.feed.post/reply2",
      text: "Second reply",
      authorHandle: "replier2.bsky.social",
      authorDisplayName: "Replier Two",
    });
    reply2.likeCount = 5;

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
    });
    postWithCounts.likeCount = 42;
    postWithCounts.repostCount = 10;
    postWithCounts.quoteCount = 3;

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
});
