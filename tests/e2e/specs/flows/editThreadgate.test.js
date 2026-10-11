import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

test.describe("Edit threadgate flow", () => {
  const ownPostUri = `at://${userProfile.did}/app.bsky.feed.post/own1`;

  function makeOwnPost(overrides = {}) {
    return createPost({
      uri: ownPostUri,
      text: "My own post",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
      ...overrides,
    });
  }

  test("edits the gate to Nobody from the post menu, preserving hiddenReplies", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([makeOwnPost()]);
    // A prior record written elsewhere (with hidden replies) that the edit
    // must carry forward
    const hiddenReplies = [`at://${userProfile.did}/app.bsky.feed.post/reply1`];
    mockServer.threadgateRecords.set("own1", {
      cid: "bafypriorgate",
      value: {
        $type: "app.bsky.feed.threadgate",
        post: ownPostUri,
        hiddenReplies,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const largePost = page.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });
    const badge = page.locator('[data-testid="who-can-reply-badge"]');
    await expect(badge).toHaveAttribute("data-teststate", "everybody");

    await largePost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-testid="interaction-settings-reply-anyone"]'),
    ).toBeChecked();

    await dialog
      .locator('[data-testid="interaction-settings-reply-nobody"]')
      .click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveAttribute("data-teststate", "nobody");

    expect(mockServer.putThreadgateCalls.length).toBe(1);
    const body = mockServer.putThreadgateCalls[0];
    expect(body.collection).toBe("app.bsky.feed.threadgate");
    expect(body.rkey).toBe("own1");
    expect(body.swapRecord).toBe("bafypriorgate");
    expect(body.record.allow).toEqual([]);
    expect(body.record.hiddenReplies).toEqual(hiddenReplies);
  });

  test("edits back to Anyone omitting the allow key, from the badge", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([
      makeOwnPost({
        threadgate: {
          uri: ownPostUri.replace("feed.post", "feed.threadgate"),
          cid: "bafypriorgate",
          record: {
            $type: "app.bsky.feed.threadgate",
            post: ownPostUri,
            allow: [],
          },
          lists: [],
        },
      }),
    ]);
    mockServer.threadgateRecords.set("own1", {
      cid: "bafypriorgate",
      value: {
        $type: "app.bsky.feed.threadgate",
        post: ownPostUri,
        allow: [],
      },
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const badge = page.locator('[data-testid="who-can-reply-badge"]');
    await expect(badge).toHaveAttribute("data-teststate", "nobody", {
      timeout: 10000,
    });
    await expect(badge).toHaveClass(/who-can-reply-badge-link/);

    await badge.click();
    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-testid="interaction-settings-reply-nobody"]'),
    ).toBeChecked();

    await dialog
      .locator('[data-testid="interaction-settings-reply-anyone"]')
      .click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveAttribute("data-teststate", "everybody");

    expect(mockServer.putThreadgateCalls.length).toBe(1);
    const body = mockServer.putThreadgateCalls[0];
    expect("allow" in body.record).toBe(false);
  });

  test("disables quote posts from the dialog without touching the threadgate", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([makeOwnPost()]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const largePost = page.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });
    await largePost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    const quoteToggle = dialog.locator(
      '[data-testid="interaction-settings-quote-posts"]',
    );
    await expect(quoteToggle).toHaveAttribute("checked", "");
    await quoteToggle.click();
    await expect(quoteToggle).not.toHaveAttribute("checked", "");
    await dialog.locator('[data-testid="interaction-settings-save"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    expect(mockServer.putThreadgateCalls.length).toBe(0);
    expect(mockServer.putPostgateCalls.length).toBe(1);
    const body = mockServer.putPostgateCalls[0];
    expect(body.collection).toBe("app.bsky.feed.postgate");
    expect(body.rkey).toBe("own1");
    expect(body.record.embeddingRules).toEqual([
      { $type: "app.bsky.feed.postgate#disableRule" },
    ]);

    // Reopening the dialog reflects the optimistic viewer state
    await largePost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();
    await expect(
      dialog.locator('[data-testid="interaction-settings-quote-posts"]'),
    ).not.toHaveAttribute("checked", "");
  });

  test("does not offer editing on another user's post", async ({ page }) => {
    const otherDid = "did:plc:other";
    const otherPost = createPost({
      uri: `at://${otherDid}/app.bsky.feed.post/notmine`,
      text: "Not my post",
      authorHandle: "other.test",
      authorDisplayName: "Other User",
    });
    const mockServer = new MockServer();
    mockServer.addPosts([otherPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/other.test/post/notmine");

    const largePost = page.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });

    const badge = page.locator('[data-testid="who-can-reply-badge"]');
    await expect(badge).not.toHaveClass(/who-can-reply-badge-link/);
    await badge.click();
    await expect(
      page.locator('[data-testid="who-can-reply-modal"]'),
    ).toBeVisible();
    await page.locator('[data-testid="modal-primary-button"]').click();

    await largePost.locator('[data-testid="post-action-more"]').click();
    await expect(
      page.locator('[data-testid="menu-action-interaction-settings"]'),
    ).not.toBeAttached();
  });

  test("edits quote settings on an own reply in another user's thread", async ({
    page,
  }) => {
    const otherDid = "did:plc:other";
    const rootUri = `at://${otherDid}/app.bsky.feed.post/root1`;
    const allow = [{ $type: "app.bsky.feed.threadgate#mentionRule" }];
    const rootPost = createPost({
      uri: rootUri,
      text: "Someone else's thread",
      authorHandle: "other.test",
      authorDisplayName: "Other User",
      replyCount: 1,
      threadgate: {
        uri: `at://${otherDid}/app.bsky.feed.threadgate/root1`,
        cid: "bafyothergate",
        record: { $type: "app.bsky.feed.threadgate", post: rootUri, allow },
        lists: [],
      },
    });
    const ownReply = makeOwnPost({
      text: "My reply",
      reply: {
        root: { uri: rootUri, cid: rootPost.cid },
        parent: { uri: rootUri, cid: rootPost.cid },
      },
    });
    const mockServer = new MockServer();
    mockServer.addPosts([rootPost, ownReply]);
    mockServer.setPostThread(rootUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: rootPost,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: ownReply,
          replies: [],
        },
      ],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/other.test/post/root1");

    const replyPost = page
      .locator("#post-detail-view [data-testid='small-post']")
      .filter({ hasText: "My reply" });
    await expect(replyPost).toBeVisible({ timeout: 10000 });
    await replyPost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator(
        '[data-testid="interaction-settings-reply-disabled-notice"]',
      ),
    ).toHaveAttribute("data-teststate", "readonly");
    await expect(
      dialog.locator('[data-testid="interaction-settings-mention"]'),
    ).toBeChecked();
    await expect(
      dialog.locator('[data-testid="interaction-settings-reply-nobody"]'),
    ).toBeDisabled();

    await dialog
      .locator('[data-testid="interaction-settings-quote-posts"]')
      .click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    expect(mockServer.putThreadgateCalls.length).toBe(0);
    expect(mockServer.putPostgateCalls.length).toBe(1);
    const body = mockServer.putPostgateCalls[0];
    expect(body.rkey).toBe("own1");
    expect(body.record.post).toBe(ownPostUri);
    expect(body.record.embeddingRules).toEqual([
      { $type: "app.bsky.feed.postgate#disableRule" },
    ]);
  });

  test("still edits quote settings on an own reply whose thread root can't load", async ({
    page,
  }) => {
    const rootUri = "at://did:plc:other/app.bsky.feed.post/deleted1";
    const ownReply = makeOwnPost({
      text: "My reply",
      reply: {
        root: { uri: rootUri, cid: "bafydeletedroot" },
        parent: { uri: rootUri, cid: "bafydeletedroot" },
      },
    });
    const mockServer = new MockServer();
    mockServer.addPosts([ownReply]);
    mockServer.setPostThread(ownPostUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: ownReply,
      parent: { $type: "app.bsky.feed.defs#notFoundPost", uri: rootUri },
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/own1`);

    const largePost = page.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });
    await largePost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator(
        '[data-testid="interaction-settings-reply-disabled-notice"]',
      ),
    ).toHaveAttribute("data-teststate", "unavailable");
    await expect(
      dialog.locator('[data-testid="interaction-settings-reply-anyone"]'),
    ).not.toBeChecked();
    await expect(
      dialog.locator('[data-testid="interaction-settings-reply-anyone"]'),
    ).toBeDisabled();

    await dialog
      .locator('[data-testid="interaction-settings-quote-posts"]')
      .click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    expect(mockServer.putThreadgateCalls.length).toBe(0);
    expect(mockServer.putPostgateCalls.length).toBe(1);
    expect(mockServer.putPostgateCalls[0].rkey).toBe("own1");
  });

  test("edits the thread root's gate from an own reply in an own thread", async ({
    page,
  }) => {
    const rootUri = `at://${userProfile.did}/app.bsky.feed.post/root1`;
    const rootPost = createPost({
      uri: rootUri,
      text: "My thread",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
      replyCount: 1,
    });
    const ownReply = makeOwnPost({
      text: "My reply",
      reply: {
        root: { uri: rootUri, cid: rootPost.cid },
        parent: { uri: rootUri, cid: rootPost.cid },
      },
    });
    const mockServer = new MockServer();
    mockServer.addPosts([rootPost, ownReply]);
    mockServer.setPostThread(rootUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: rootPost,
      parent: null,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: ownReply,
          replies: [],
        },
      ],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}/post/root1`);

    const replyPost = page
      .locator("#post-detail-view [data-testid='small-post']")
      .filter({ hasText: "My reply" });
    await expect(replyPost).toBeVisible({ timeout: 10000 });
    await replyPost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator('[data-testid="menu-action-interaction-settings"]')
      .click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    const nobody = dialog.locator(
      '[data-testid="interaction-settings-reply-nobody"]',
    );
    await expect(nobody).toBeEnabled();
    await expect(
      dialog.locator(
        '[data-testid="interaction-settings-reply-disabled-notice"]',
      ),
    ).not.toBeAttached();

    await nobody.click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    expect(mockServer.putPostgateCalls.length).toBe(0);
    expect(mockServer.putThreadgateCalls.length).toBe(1);
    const body = mockServer.putThreadgateCalls[0];
    expect(body.rkey).toBe("root1");
    expect(body.record.post).toBe(rootUri);
    expect(body.record.allow).toEqual([]);
  });

  test("composes a post with a threadgate written in the same batch", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const control = composer.locator(
      '[data-testid="composer-interaction-settings"]',
    );
    await expect(control).toHaveAttribute("data-teststate", "open");
    await control.click();

    const dialog = page.locator(
      '[data-testid="post-interaction-settings-dialog"]',
    );
    await expect(dialog).toBeVisible();
    await dialog
      .locator('[data-testid="interaction-settings-mention"]')
      .click();
    await dialog
      .locator('[data-testid="interaction-settings-following"]')
      .click();
    await dialog
      .locator('[data-testid="interaction-settings-quote-posts"]')
      .click();
    await dialog.locator('[data-testid="interaction-settings-save"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(control).toHaveAttribute("data-teststate", "limited");

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("A gated post");
    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    expect(mockServer.applyWritesCalls.length).toBe(1);
    const writes = mockServer.applyWritesCalls[0];
    expect(writes.map((write) => write.collection)).toEqual([
      "app.bsky.feed.post",
      "app.bsky.feed.threadgate",
      "app.bsky.feed.postgate",
    ]);
    expect(writes[1].rkey).toBe(writes[0].rkey);
    expect(writes[1].value.allow).toEqual([
      { $type: "app.bsky.feed.threadgate#mentionRule" },
      { $type: "app.bsky.feed.threadgate#followingRule" },
    ]);
    expect(writes[2].rkey).toBe(writes[0].rkey);
    expect(writes[2].value.embeddingRules).toEqual([
      { $type: "app.bsky.feed.postgate#disableRule" },
    ]);
  });
});
