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

  test("should display 'Post not found' for 404 errors", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([mainPost]);
    await mockServer.setup(page);

    // Override getPostThread to return 400 NotFound
    await page.route("**/xrpc/app.bsky.feed.getPostThread*", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "NotFound", message: "Post not found" }),
      }),
    );

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".error-state")).toContainText("Post not found", {
      timeout: 10000,
    });
  });

  test("should display 'Error loading thread' for server errors", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([mainPost]);
    await mockServer.setup(page);

    // Override getPostThread to return 500
    await page.route("**/xrpc/app.bsky.feed.getPostThread*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123");

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error loading thread",
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should render thread and replies publicly", async ({ page }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "This is a public post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 1,
      });

      const reply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "A public reply",
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

      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view).toContainText("This is a public post");
      await expect(view).toContainText("A public reply", { timeout: 10000 });
    });

    test("should hide reply composer and interaction buttons", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([mainPost]);
      await mockServer.setup(page);

      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });

      // Reply composer should be hidden for logged-out users
      await expect(view.locator(".post-thread-reply-prompt")).not.toBeVisible();
    });
  });

  test.describe("Hidden replies section", () => {
    test("should place muted account replies in the hidden section", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with muted reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const mutedReply = createPost({
        uri: "at://did:plc:muted1/app.bsky.feed.post/mutedreply",
        text: "Reply from muted user",
        authorHandle: "muted1.bsky.social",
        authorDisplayName: "Muted User",
      });
      mutedReply.author.viewer.muted = true;

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, mutedReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: mutedReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      // Muted reply should not be in the main reply chains
      const replyChains = view.locator(".post-thread-reply-chains");
      await expect(replyChains).not.toContainText("Reply from muted user");

      // Hidden section should be present with the toggle button
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection).toBeVisible();
      await expect(
        hiddenSection.locator(".hidden-replies-button"),
      ).toContainText("Show more replies");
    });

    test("should place content-labeled replies in the hidden section", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with labeled reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const labeledReply = createPost({
        uri: "at://did:plc:labeled1/app.bsky.feed.post/labeledreply",
        text: "Labeled reply content",
        authorHandle: "labeled1.bsky.social",
        authorDisplayName: "Labeled User",
        labels: [
          {
            val: "!warn",
            src: "did:plc:ar7c4by46qjdydhdevvrndac",
            uri: "at://did:plc:labeled1/app.bsky.feed.post/labeledreply",
            cts: "2025-01-01T00:00:00.000Z",
          },
        ],
      });

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, labeledReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: labeledReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      // Labeled reply should not be in the main reply chains
      const replyChains = view.locator(".post-thread-reply-chains");
      await expect(replyChains).not.toContainText("Labeled reply content");

      // Hidden section should be present
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection).toBeVisible();
    });

    test("should place blocked replies in the hidden section", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with blocked reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const blockedReply = createPost({
        uri: "at://did:plc:blocked1/app.bsky.feed.post/blockedreply",
        text: "Reply from blocked user",
        authorHandle: "blocked1.bsky.social",
        authorDisplayName: "Blocked User",
      });
      blockedReply.isBlockedReply = true;

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, blockedReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: blockedReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      // Blocked reply should not be in the main reply chains
      const replyChains = view.locator(".post-thread-reply-chains");
      await expect(replyChains).not.toContainText("Reply from blocked user");

      // Hidden section should be present
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection).toBeVisible();
    });

    test("should reveal hidden replies when clicking 'Show more replies'", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with hidden replies",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const mutedReply = createPost({
        uri: "at://did:plc:muted1/app.bsky.feed.post/mutedreply",
        text: "Reply from muted user",
        authorHandle: "muted1.bsky.social",
        authorDisplayName: "Muted User",
      });
      mutedReply.author.viewer.muted = true;

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, mutedReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: mutedReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection.locator(".hidden-replies-button")).toBeVisible(
        { timeout: 10000 },
      );

      // Hidden content should not be visible initially
      await expect(hiddenSection.locator(".toggle-content")).not.toBeVisible();

      // Click to expand
      await hiddenSection.locator(".hidden-replies-button").click();

      // The toggle content should now be visible with the muted reply
      await expect(hiddenSection.locator(".toggle-content")).toBeVisible();
      await expect(hiddenSection).toContainText("Reply from muted user");

      // The button should be hidden after expanding
      await expect(
        hiddenSection.locator(".hidden-replies-button"),
      ).not.toBeVisible();
    });

    test("should not show hidden section when all replies are normal", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with normal replies only",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 1,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      // Hidden section should not exist
      await expect(view.locator("hidden-replies-section")).not.toBeAttached();
    });

    test("should place muted word replies in the hidden section (via getPreferences)", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with muted word reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const mutedWordReply = createPost({
        uri: "at://did:plc:replier2/app.bsky.feed.post/mutedwordreply",
        text: "This contains spoilers for the movie",
        authorHandle: "replier2.bsky.social",
        authorDisplayName: "Replier Two",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, mutedWordReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: mutedWordReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);

      // Override preferences to include muted words
      await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [
              {
                $type: "app.bsky.actor.defs#savedFeedsPrefV2",
                items: [],
              },
              {
                $type: "app.bsky.actor.defs#mutedWordsPref",
                items: [
                  {
                    value: "spoilers",
                    targets: ["content"],
                    actorTarget: "all",
                  },
                ],
              },
            ],
          }),
        }),
      );

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      // Muted word reply should not be in the main reply chains
      const replyChains = view.locator(".post-thread-reply-chains");
      await expect(replyChains).not.toContainText("spoilers");

      // Hidden section should be present
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection).toBeVisible();
    });
  });

  test.describe("Muted parents", () => {
    test("should expand muted parent when clicking the toggle", async ({
      page,
    }) => {
      const parentPost = createPost({
        uri: "at://did:plc:mutedparent/app.bsky.feed.post/parent1",
        text: "This is a muted parent post",
        authorHandle: "mutedparent.bsky.social",
        authorDisplayName: "Muted Parent",
      });
      parentPost.author.viewer.muted = true;

      const childPost = createPost({
        uri: postUri,
        text: "Reply to muted parent",
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
      const toggle = view.locator("muted-reply-toggle");
      await expect(toggle).toBeVisible({ timeout: 10000 });

      // Content should be hidden initially
      await expect(toggle.locator(".toggle-content")).toBeHidden();

      // Click to expand
      await toggle.locator(".muted-reply-toggle-button").click();
      await expect(toggle.locator(".toggle-content")).toBeVisible();
      await expect(toggle).toContainText("This is a muted parent post");
    });

    test("should show 'Hidden by muted word' label for parent with viewer.hasMutedWord", async ({
      page,
    }) => {
      const parentPost = createPost({
        uri: "at://did:plc:mutedwordparent/app.bsky.feed.post/parent1",
        text: "Parent with muted word",
        authorHandle: "mutedwordparent.bsky.social",
        authorDisplayName: "Muted Word Parent",
        viewer: { hasMutedWord: true },
      });

      const childPost = createPost({
        uri: postUri,
        text: "Reply to muted word parent",
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
      const toggle = view.locator("muted-reply-toggle");
      await expect(toggle).toBeVisible({ timeout: 10000 });
      await expect(toggle).toContainText("Hidden by muted word");
    });

    test("should show 'Post hidden by you' label for parent with viewer.isHidden", async ({
      page,
    }) => {
      const parentPost = createPost({
        uri: "at://did:plc:hiddenparent/app.bsky.feed.post/parent1",
        text: "Parent hidden by user",
        authorHandle: "hiddenparent.bsky.social",
        authorDisplayName: "Hidden Parent",
        viewer: { isHidden: true },
      });

      const childPost = createPost({
        uri: postUri,
        text: "Reply to hidden parent",
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
      const toggle = view.locator("muted-reply-toggle");
      await expect(toggle).toBeVisible({ timeout: 10000 });
      await expect(toggle).toContainText("Post hidden by you");
    });
  });

  test.describe("Blocked posts in thread", () => {
    test("should show blocked state when the thread root is blocked", async ({
      page,
    }) => {
      const blockedRoot = {
        $type: "app.bsky.feed.defs#blockedPost",
        uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
        blocked: true,
        author: {
          did: "did:plc:blockedroot",
          viewer: { blocking: true },
        },
      };

      const childPost = createPost({
        uri: postUri,
        text: "Reply to blocked root",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        reply: {
          parent: {
            uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
            cid: "bafyreitestroot1",
          },
          root: {
            uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
            cid: "bafyreitestroot1",
          },
        },
      });

      const mockServer = new MockServer();
      mockServer.addPosts([childPost]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: childPost,
        parent: {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: blockedRoot,
          parent: null,
          replies: [],
        },
        replies: [],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view.locator(".missing-post-indicator")).toContainText(
        "Post unavailable",
      );
    });
  });

  test.describe("Moderation actions", () => {
    test("should show 'Hide post for me' in context menu for non-user posts", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([mainPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      // Open context menu
      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Hide post for me" }),
      ).toBeVisible();
    });

    test("should show 'Mute account' for non-muted authors", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([mainPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Mute account" }),
      ).toBeVisible();
    });

    test("should show 'Unmute account' for muted authors", async ({ page }) => {
      const mutedPost = createPost({
        uri: postUri,
        text: "Post by muted author",
        authorHandle: "mutedauthor.bsky.social",
        authorDisplayName: "Muted Author",
      });
      mutedPost.author.viewer.muted = true;

      const mockServer = new MockServer();
      mockServer.addPosts([mutedPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/mutedauthor.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Unmute account" }),
      ).toBeVisible();
    });

    test("should show 'Block account' for non-blocked authors", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([mainPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Block account" }),
      ).toBeVisible();
    });

    test("should show 'Unblock account' for blocked authors", async ({
      page,
    }) => {
      const blockedPost = createPost({
        uri: postUri,
        text: "Post by blocked author",
        authorHandle: "blockedauthor.bsky.social",
        authorDisplayName: "Blocked Author",
      });
      blockedPost.author.viewer.blocking =
        "at://did:plc:testuser123/app.bsky.graph.block/existing-block";

      const mockServer = new MockServer();
      mockServer.addPosts([blockedPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/blockedauthor.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Unblock account" }),
      ).toBeVisible();
    });

    test("should show 'Report post' in context menu", async ({ page }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([mainPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();
      await expect(
        page.locator("context-menu-item", { hasText: "Report post" }),
      ).toBeVisible();
    });

    test("should not show moderation actions on current user's own posts", async ({
      page,
    }) => {
      const ownPost = createPost({
        uri: "at://did:plc:testuser123/app.bsky.feed.post/abc123",
        text: "My own post",
        authorHandle: "testuser.bsky.social",
        authorDisplayName: "Test User",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([ownPost]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/testuser.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const largePost = view.locator('[data-testid="large-post"]');
      await expect(largePost).toBeVisible({ timeout: 10000 });

      await largePost
        .locator(".post-action-button", { hasText: "..." })
        .click();

      // Moderation actions should not be present on own post
      await expect(
        page.locator("context-menu-item", { hasText: "Mute account" }),
      ).not.toBeAttached();
      await expect(
        page.locator("context-menu-item", { hasText: "Block account" }),
      ).not.toBeAttached();
      await expect(
        page.locator("context-menu-item", { hasText: "Report post" }),
      ).not.toBeAttached();

      // Delete post should be available on own post
      await expect(
        page.locator("context-menu-item", { hasText: "Delete post" }),
      ).toBeVisible();
    });
  });
});
