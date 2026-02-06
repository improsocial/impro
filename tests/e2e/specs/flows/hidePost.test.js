import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

test.describe("Hide post flow", () => {
  test("should hide a post from the feed and persist after refresh", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post I want to hide",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is visible on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });
    await expect(homeView).toContainText("Post I want to hide");

    // Open the post's context menu and click "Hide post for me"
    await feedItem.locator(".text-button").click();
    await page
      .locator("context-menu-item", { hasText: "Hide post for me" })
      .click();

    // Confirm the hide action in the dialog
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // The post should immediately be hidden from the feed
    await expect(page.locator(".toast")).toContainText("Post hidden", {
      timeout: 5000,
    });
    await expect(feedItem).toHaveCount(0, { timeout: 10000 });

    // Refreshing the feed should still show the post as hidden
    await page.goto("/");
    await expect(feedItem).toHaveCount(0, { timeout: 10000 });
  });

  test("should hide a reply in thread view and reveal it by expanding", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const mainPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/thread1",
      text: "Main thread post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 1,
    });

    const reply = createPost({
      uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
      text: "Reply to hide in thread",
      authorHandle: "replier1.bsky.social",
      authorDisplayName: "Replier One",
      reply: {
        parent: { uri: mainPost.uri, cid: mainPost.cid },
        root: { uri: mainPost.uri, cid: mainPost.cid },
      },
    });

    mockServer.addPosts([mainPost, reply]);
    mockServer.setPostThread(mainPost.uri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: mainPost,
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

    // Navigate to the thread view
    await page.goto("/profile/author1.bsky.social/post/thread1");

    const view = page.locator("#post-detail-view");
    await expect(view).toContainText("Reply to hide in thread", {
      timeout: 10000,
    });

    // Open the reply's context menu and click "Hide reply for me"
    const replyPost = view.locator('[data-testid="small-post"]');
    await replyPost.locator(".text-button").click();
    await page
      .locator("context-menu-item", { hasText: "Hide reply for me" })
      .click();

    // Confirm the hide action in the dialog
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // The reply should show "Post hidden by you" wrapper
    const mutedToggle = view.locator("muted-reply-toggle");
    await expect(mutedToggle).toBeVisible({ timeout: 10000 });
    await expect(mutedToggle).toContainText("Post hidden by you");

    // Expanding the wrapper should reveal the content
    await mutedToggle.locator(".muted-reply-toggle-button").click();
    await expect(mutedToggle.locator(".toggle-content")).toBeVisible({
      timeout: 5000,
    });
    await expect(mutedToggle).toContainText("Reply to hide in thread");
  });
});
