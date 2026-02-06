import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Like post flow", () => {
  test("should show liked post in profile Likes tab after liking on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post worth liking",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    post.likeCount = 3;
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/com.atproto.repo.createRecord*", (route) => {
      post.viewer.like = "at://did:plc:testuser123/app.bsky.feed.like/like1";
      mockServer.authorFeeds.set(`${userProfile.did}-likes`, [post]);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uri: post.viewer.like,
          cid: "bafyreilike1",
        }),
      });
    });

    await login(page);
    await page.goto("/");

    // Like the post on the home view
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator("like-button").click();
    await expect(feedItem.locator("like-button .liked")).toBeVisible({
      timeout: 10000,
    });

    // Navigate to own profile and switch to Likes tab
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    const tabBar = profileView.locator(".tab-bar");
    await expect(
      tabBar.locator(".tab-bar-button", { hasText: "Likes" }),
    ).toBeVisible({ timeout: 10000 });

    await tabBar.locator(".tab-bar-button", { hasText: "Likes" }).click();

    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Post worth liking");
  });

  test("should remove post from profile Likes tab after unliking on home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to unlike",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    post.likeCount = 5;
    post.viewer.like = "at://did:plc:testuser123/app.bsky.feed.like/like1";
    mockServer.addTimelinePosts([post]);
    mockServer.addAuthorFeedPosts(userProfile.did, "likes", [post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/com.atproto.repo.deleteRecord*", (route) => {
      mockServer.authorFeeds.set(`${userProfile.did}-likes`, []);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await login(page);

    // Verify the post is in the Likes tab initially
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    const tabBar = profileView.locator(".tab-bar");
    await expect(
      tabBar.locator(".tab-bar-button", { hasText: "Likes" }),
    ).toBeVisible({ timeout: 10000 });

    await tabBar.locator(".tab-bar-button", { hasText: "Likes" }).click();

    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Post to unlike");

    // Navigate to home and unlike the post
    await page.goto("/");

    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    await feedItem.locator("like-button .liked").click();
    await expect(feedItem.locator("like-button .liked")).toHaveCount(0, {
      timeout: 10000,
    });

    // Navigate back to own profile Likes tab
    await page.goto(`/profile/${userProfile.did}`);

    await expect(
      tabBar.locator(".tab-bar-button", { hasText: "Likes" }),
    ).toBeVisible({ timeout: 10000 });

    await tabBar.locator(".tab-bar-button", { hasText: "Likes" }).click();

    await expect(
      profileView.locator(
        '.feed-container:not([hidden]) [data-testid="feed-end-message"]',
      ),
    ).toBeVisible({ timeout: 10000 });
  });
});
