import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

test.describe("Hidden reply authoring flow", () => {
  const ownPostUri = `at://${userProfile.did}/app.bsky.feed.post/own1`;
  const replyUri = "at://did:plc:replier/app.bsky.feed.post/reply1";
  const allow = [{ $type: "app.bsky.feed.threadgate#mentionRule" }];

  function makeOwnPost(threadgateRecord) {
    return createPost({
      uri: ownPostUri,
      text: "My own post",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
      replyCount: 1,
      threadgate: {
        uri: `at://${userProfile.did}/app.bsky.feed.threadgate/own1`,
        cid: "bafypriorgate",
        record: threadgateRecord,
        lists: [],
      },
    });
  }
  const ownPost = makeOwnPost(null);
  const reply = createPost({
    uri: replyUri,
    text: "A reply to hide",
    authorHandle: "replier.bsky.social",
    authorDisplayName: "Replier",
    reply: {
      root: { uri: ownPost.uri, cid: ownPost.cid },
      parent: { uri: ownPost.uri, cid: ownPost.cid },
    },
  });

  function setupThread(mockServer, threadgateRecord, { serverHidden }) {
    const rootPost = makeOwnPost(threadgateRecord);
    mockServer.threadgateRecords.set("own1", {
      cid: "bafypriorgate",
      value: threadgateRecord,
    });
    mockServer.addPosts([rootPost, reply]);
    mockServer.setPostThread(ownPostUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: rootPost,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: reply,
          replies: [],
        },
      ],
    });
    mockServer.setPostThreadOther(
      ownPostUri,
      serverHidden
        ? [{ uri: replyUri, value: { hiddenByThreadgate: true } }]
        : [],
    );
  }

  test("hides a reply for everyone, preserving allow", async ({ page }) => {
    const mockServer = new MockServer();
    const priorHiddenUri = "at://did:plc:other/app.bsky.feed.post/old";
    setupThread(
      mockServer,
      {
        $type: "app.bsky.feed.threadgate",
        post: ownPostUri,
        allow,
        hiddenReplies: [priorHiddenUri],
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      { serverHidden: false },
    );
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const view = page.locator("#post-detail-view");
    const replyPost = view
      .locator('[data-testid="small-post"]')
      .filter({ hasText: "A reply to hide" });
    await expect(replyPost).toBeVisible({ timeout: 10000 });
    await expect(view.locator("hidden-replies-section")).not.toBeAttached();

    await replyPost.locator('[data-testid="post-action-more"]').click();
    const menuItem = page.locator(
      '[data-testid="menu-action-post-toggle-reply-hidden"]',
    );
    await expect(menuItem).toHaveAttribute("data-teststate", "shown");
    await menuItem.click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    const hiddenSection = view.locator("hidden-replies-section");
    await expect(hiddenSection).toBeAttached();
    await expect(
      view.locator(".post-thread-reply-chains [data-testid='small-post']"),
    ).toHaveCount(0);

    await expect.poll(() => mockServer.putThreadgateCalls.length).toBe(1);
    const body = mockServer.putThreadgateCalls[0];
    expect(body.rkey).toBe("own1");
    expect(body.swapRecord).toBe("bafypriorgate");
    expect(body.record.allow).toEqual(allow);
    expect(body.record.hiddenReplies).toEqual([priorHiddenUri, replyUri]);

    await hiddenSection
      .locator('[data-testid="hidden-replies-button"]')
      .click();
    await expect(
      hiddenSection.locator('[data-testid="hidden-reply-label"]'),
    ).toBeVisible();
  });

  test("shows a hidden reply for everyone", async ({ page }) => {
    const mockServer = new MockServer();
    setupThread(
      mockServer,
      {
        $type: "app.bsky.feed.threadgate",
        post: ownPostUri,
        allow,
        hiddenReplies: [replyUri],
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      { serverHidden: true },
    );
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const view = page.locator("#post-detail-view");
    const hiddenSection = view.locator("hidden-replies-section");
    await expect(hiddenSection).toBeAttached({ timeout: 10000 });
    await hiddenSection
      .locator('[data-testid="hidden-replies-button"]')
      .click();

    const replyPost = hiddenSection
      .locator('[data-testid="small-post"]')
      .filter({ hasText: "A reply to hide" });
    await replyPost.locator('[data-testid="post-action-more"]').click();
    const menuItem = page.locator(
      '[data-testid="menu-action-post-toggle-reply-hidden"]',
    );
    await expect(menuItem).toHaveAttribute("data-teststate", "hidden");
    await menuItem.click();

    await expect(hiddenSection).not.toBeAttached();
    await expect(
      view.locator(".post-thread-reply-chains [data-testid='small-post']"),
    ).toHaveCount(1);

    await expect.poll(() => mockServer.putThreadgateCalls.length).toBe(1);
    const body = mockServer.putThreadgateCalls[0];
    expect(body.swapRecord).toBe("bafypriorgate");
    expect(body.record.allow).toEqual(allow);
    expect(body.record.hiddenReplies).toEqual([]);
  });
});
