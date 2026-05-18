import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Pin post flow", () => {
  test("should pin a post from the user's profile and show the Pinned label", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: `at://${userProfile.did}/app.bsky.feed.post/pin1`,
      text: "Pin this post",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
    });
    mockServer.addAuthorFeedPosts(userProfile.did, "posts_and_author_threads", [
      post,
    ]);

    await mockServer.setup(page);
    const putRecordPayloads = [];
    await page.route("**/xrpc/com.atproto.repo.putRecord*", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.collection === "app.bsky.actor.profile") {
        putRecordPayloads.push(body);
      }
      await route.fallback();
    });

    await login(page);

    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    const feedItem = profileView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });
    await expect(feedItem.locator('[data-testid="pinned-label"]')).toHaveCount(
      0,
    );

    // Open the post action menu and click the pin item
    await feedItem.locator(".text-button").click();
    await page.locator('[data-testid="menu-action-post-pin"]').click();

    // The pinned label should appear optimistically
    await expect(
      profileView.locator('[data-testid="pinned-label"]'),
    ).toBeVisible({ timeout: 5000 });

    // The profile record was updated with the strong ref
    await expect.poll(() => putRecordPayloads.length).toBeGreaterThan(0);
    const lastPayload = putRecordPayloads[putRecordPayloads.length - 1];
    expect(lastPayload.record.pinnedPost).toEqual({
      uri: post.uri,
      cid: post.cid,
    });

    // Re-opening the menu now shows pinned state
    await profileView
      .locator('[data-testid="feed-item"]')
      .first()
      .locator(".text-button")
      .click();
    await expect(
      page.locator(
        '[data-testid="menu-action-post-pin"][data-teststate="pinned"]',
      ),
    ).toBeVisible();
  });

  test("should not show Pin option on another user's post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherDid = "did:plc:other";
    const otherPost = createPost({
      uri: `at://${otherDid}/app.bsky.feed.post/notmine`,
      text: "Not my post",
      authorHandle: "other.test",
      authorDisplayName: "Other User",
    });
    mockServer.addTimelinePosts([otherPost]);
    await mockServer.setup(page);
    await login(page);

    await page.goto("/");
    const feedItem = page
      .locator("#home-view")
      .locator('[data-testid="feed-item"]')
      .first();
    await expect(feedItem).toBeVisible({ timeout: 10000 });
    await feedItem.locator(".text-button").click();

    await expect(
      page.locator('[data-testid="menu-action-post-pin"]'),
    ).toHaveCount(0);
  });
});
