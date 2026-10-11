import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

test.describe("Quote detachment flow", () => {
  const ownPostUri = `at://${userProfile.did}/app.bsky.feed.post/own1`;
  const quotingPostUri = "at://did:plc:quoter/app.bsky.feed.post/quoting1";
  const ownPost = createPost({
    uri: ownPostUri,
    text: "My own post",
    authorHandle: userProfile.handle,
    authorDisplayName: userProfile.displayName,
  });

  function makeQuotingPost(quotedRecord) {
    return createPost({
      uri: quotingPostUri,
      text: "Look at this post",
      authorHandle: "quoter.bsky.social",
      authorDisplayName: "Quoter",
      embed: { $type: "app.bsky.embed.record#view", record: quotedRecord },
    });
  }

  test("detaches a quote of the user's post, preserving embeddingRules", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addTimelinePosts([
      makeQuotingPost({
        $type: "app.bsky.embed.record#viewRecord",
        uri: ownPostUri,
        cid: ownPost.cid,
        author: ownPost.author,
        value: ownPost.record,
        labels: [],
        indexedAt: "2025-01-01T00:00:00.000Z",
        embeds: [],
      }),
    ]);
    const embeddingRules = [{ $type: "app.bsky.feed.postgate#disableRule" }];
    const priorDetachedUri = "at://did:plc:other/app.bsky.feed.post/q0";
    mockServer.postgateRecords.set("own1", {
      cid: "bafypriorpostgate",
      value: {
        $type: "app.bsky.feed.postgate",
        post: ownPostUri,
        embeddingRules,
        detachedEmbeddingUris: [priorDetachedUri],
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const quotingPost = page
      .locator('[data-testid="small-post"]')
      .filter({ hasText: "Look at this post" })
      .first();
    await expect(quotingPost).toBeVisible({ timeout: 10000 });

    await quotingPost.locator('[data-testid="post-action-more"]').click();
    const menuItem = page.locator(
      '[data-testid="menu-action-post-toggle-quote-detachment"]',
    );
    await expect(menuItem).toHaveAttribute("data-teststate", "attached");
    await menuItem.click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(
      quotingPost.locator('[data-testid="removed-quote"]'),
    ).toBeVisible();
    await expect(quotingPost.locator(".quoted-post-link")).toHaveCount(0);

    await expect.poll(() => mockServer.putPostgateCalls.length).toBe(1);
    const body = mockServer.putPostgateCalls[0];
    expect(body.rkey).toBe("own1");
    expect(body.swapRecord).toBe("bafypriorpostgate");
    expect(body.record.embeddingRules).toEqual(embeddingRules);
    expect(body.record.detachedEmbeddingUris).toEqual([
      priorDetachedUri,
      quotingPostUri,
    ]);
  });

  test("re-attaches a detached quote", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([ownPost]);
    mockServer.addTimelinePosts([
      makeQuotingPost({
        $type: "app.bsky.embed.record#viewDetached",
        uri: ownPostUri,
        detached: true,
      }),
    ]);
    mockServer.postgateRecords.set("own1", {
      cid: "bafypriorpostgate",
      value: {
        $type: "app.bsky.feed.postgate",
        post: ownPostUri,
        detachedEmbeddingUris: [quotingPostUri],
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const quotingPost = page
      .locator('[data-testid="small-post"]')
      .filter({ hasText: "Look at this post" })
      .first();
    await expect(quotingPost).toBeVisible({ timeout: 10000 });

    await quotingPost.locator('[data-testid="post-action-more"]').click();
    const menuItem = page.locator(
      '[data-testid="menu-action-post-toggle-quote-detachment"]',
    );
    await expect(menuItem).toHaveAttribute("data-teststate", "detached");
    await menuItem.click();

    await expect(quotingPost.locator(".quoted-post-link")).toBeVisible();
    await expect(
      quotingPost.locator('[data-testid="removed-quote"]'),
    ).toHaveCount(0);

    await expect.poll(() => mockServer.putPostgateCalls.length).toBe(1);
    expect(mockServer.putPostgateCalls[0].record.detachedEmbeddingUris).toEqual(
      [],
    );
  });

  test("doesn't offer detachment on quotes of other users' posts", async ({
    page,
  }) => {
    const otherPost = createPost({
      uri: "at://did:plc:other/app.bsky.feed.post/theirs",
      text: "Someone else's post",
      authorHandle: "other.bsky.social",
      authorDisplayName: "Other",
    });
    const mockServer = new MockServer();
    mockServer.addTimelinePosts([
      makeQuotingPost({
        $type: "app.bsky.embed.record#viewRecord",
        uri: otherPost.uri,
        cid: otherPost.cid,
        author: otherPost.author,
        value: otherPost.record,
        labels: [],
        indexedAt: "2025-01-01T00:00:00.000Z",
        embeds: [],
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const quotingPost = page
      .locator('[data-testid="small-post"]')
      .filter({ hasText: "Look at this post" })
      .first();
    await expect(quotingPost).toBeVisible({ timeout: 10000 });
    await quotingPost.locator('[data-testid="post-action-more"]').click();
    await expect(
      page.locator('[data-testid="menu-action-post-mute-thread"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="menu-action-post-toggle-quote-detachment"]'),
    ).toHaveCount(0);
  });
});
