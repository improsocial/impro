import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Repost flow", () => {
  test("should show reposted post on profile after reposting on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post worth reposting",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      repostCount: 2,
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Repost the post on the home view
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="repost-button"]').click();
    await page.locator("context-menu-item", { hasText: "Repost" }).click();

    await expect(
      feedItem.locator('[data-testid="repost-button"].reposted'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to own profile
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Post worth reposting");
  });

  test("should remove reposted post from profile after undoing repost on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to unrepost",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      repostCount: 3,
      viewer: {
        repost: "at://did:plc:testuser123/app.bsky.feed.repost/repost1",
      },
    });
    mockServer.addTimelinePosts([post]);
    mockServer.addAuthorFeedPosts(userProfile.did, "posts_and_author_threads", [
      post,
    ]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is in the profile initially
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Post to unrepost");

    // Navigate to home and undo repost
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator('[data-testid="repost-button"].reposted').click();
    await page.locator("context-menu-item", { hasText: "Undo repost" }).click();

    await expect(
      feedItem.locator('[data-testid="repost-button"].reposted'),
    ).toHaveCount(0, { timeout: 10000 });

    // Navigate back to profile
    await page.goto(`/profile/${userProfile.did}`);

    await expect(
      profileView.locator(
        '.feed-container:not([hidden]) [data-testid="feed-end-message"]',
      ),
    ).toBeVisible({ timeout: 10000 });
  });
});
