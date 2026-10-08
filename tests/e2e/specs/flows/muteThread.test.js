import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createThreadViewPost } from "../../../shared/factories.js";

const rootUri = "at://did:plc:author1/app.bsky.feed.post/root1";

// The mock server updates post viewer state in place, so each test builds
// its own posts.
function createRootPost() {
  return createPost({
    uri: rootUri,
    text: "Root post",
    authorHandle: "author1.bsky.social",
    authorDisplayName: "Author One",
    replyCount: 2,
  });
}

function createReply(rootPost, rkey, text) {
  return createPost({
    uri: `at://did:plc:replier1/app.bsky.feed.post/${rkey}`,
    text,
    authorHandle: "replier1.bsky.social",
    authorDisplayName: "Replier One",
    reply: {
      parent: { uri: rootPost.uri, cid: rootPost.cid },
      root: { uri: rootPost.uri, cid: rootPost.cid },
    },
  });
}

function setupThread(mockServer) {
  const rootPost = createRootPost();
  const firstReply = createReply(rootPost, "reply1", "First reply");
  const secondReply = createReply(rootPost, "reply2", "Second reply");
  mockServer.addPosts([rootPost, firstReply, secondReply]);
  mockServer.setPostThread(
    rootPost.uri,
    createThreadViewPost({
      post: rootPost,
      replies: [
        createThreadViewPost({ post: firstReply, replies: [] }),
        createThreadViewPost({ post: secondReply, replies: [] }),
      ],
    }),
  );
}

const muteThreadItem = '[data-testid="menu-action-post-mute-thread"]';

test.describe("Mute thread flow", () => {
  test("should mute a thread from a reply and reflect it on sibling replies", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupThread(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/root1");

    const view = page.locator("#post-detail-view");
    const replies = view.locator('[data-testid="small-post"]');
    await expect(replies).toHaveCount(2, { timeout: 10000 });

    await replies.nth(0).locator('[data-testid="post-action-more"]').click();
    await page.locator(`${muteThreadItem}[data-teststate="unmuted"]`).click();
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    expect(mockServer.threadMuteRequests).toEqual([
      { root: rootUri, threadMuted: true },
    ]);

    await replies.nth(1).locator('[data-testid="post-action-more"]').click();
    await page.locator(`${muteThreadItem}[data-teststate="muted"]`).click();
    await expect.poll(() => mockServer.threadMuteRequests.length).toBe(2);
    expect(mockServer.threadMuteRequests[1]).toEqual({
      root: rootUri,
      threadMuted: false,
    });

    await view
      .locator('[data-testid="large-post"] [data-testid="post-action-more"]')
      .click();
    await expect(
      page.locator(`${muteThreadItem}[data-teststate="unmuted"]`),
    ).toBeVisible();
  });

  test("should roll back and show an error toast when muting fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupThread(mockServer);
    mockServer.setThreadMuteError("InternalServerError");
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/root1");

    const view = page.locator("#post-detail-view");
    const replies = view.locator('[data-testid="small-post"]');
    await expect(replies).toHaveCount(2, { timeout: 10000 });

    await replies.nth(0).locator('[data-testid="post-action-more"]').click();
    await page.locator(muteThreadItem).click();
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect.poll(() => mockServer.threadMuteRequests.length).toBe(1);

    await replies.nth(1).locator('[data-testid="post-action-more"]').click();
    await expect(
      page.locator(`${muteThreadItem}[data-teststate="unmuted"]`),
    ).toBeVisible();
  });

  test("should keep a muted thread in the home feed until it reloads", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherPost = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/other1",
      text: "Unrelated post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addTimelinePosts([createRootPost(), otherPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    const feedItems = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItems).toHaveCount(2, { timeout: 10000 });

    await feedItems
      .filter({ hasText: "Root post" })
      .locator('[data-testid="post-action-more"]')
      .click();
    await page.locator(muteThreadItem).click();
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    expect(mockServer.threadMuteRequests).toEqual([
      { root: rootUri, threadMuted: true },
    ]);
    await expect(feedItems).toHaveCount(2);

    await page.reload();
    await expect(feedItems).toHaveCount(1, { timeout: 10000 });
    await expect(feedItems).toContainText("Unrelated post");
  });
});
