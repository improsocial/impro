import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Delete post flow", () => {
  test("should remove post from home feed after deleting from profile", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: `at://${userProfile.did}/app.bsky.feed.post/mypost1`,
      text: "My post to delete",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
    });
    mockServer.addTimelinePosts([post]);
    mockServer.addAuthorFeedPosts(userProfile.did, "posts_and_author_threads", [
      post,
    ]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is on the home feed
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("My post to delete");

    // Navigate to own profile
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    const feedItem = profileView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    // Open the post action menu and click "Delete post"
    await feedItem.locator(".text-button").click();
    await page.locator("context-menu-item", { hasText: "Delete post" }).click();

    // Confirm deletion if a confirmation dialog appears
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Verify the post is removed from the profile
    await expect(
      profileView.locator(
        '.feed-container:not([hidden]) [data-testid="feed-end-message"]',
      ),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to home and verify the post is gone
    await page.goto("/");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should update thread view after deleting post from thread", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: `at://${userProfile.did}/app.bsky.feed.post/mypost2`,
      text: "My thread post to delete",
      authorHandle: userProfile.handle,
      authorDisplayName: userProfile.displayName,
    });
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to the thread view
    await page.goto(`/profile/${userProfile.handle}/post/mypost2`);

    const view = page.locator("#post-detail-view");
    const largePost = view.locator('[data-testid="large-post"]');
    await expect(largePost).toBeVisible({ timeout: 10000 });
    await expect(view).toContainText("My thread post to delete");

    // Open the post action menu and click "Delete post"
    await largePost.locator(".text-button").click();
    await page.locator("context-menu-item", { hasText: "Delete post" }).click();

    // Confirm deletion if a confirmation dialog appears
    const confirmButton = page.locator("button.confirm-button");
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // After deleting from thread view, the app should navigate away
    // or the post should no longer be visible
    await expect(largePost).not.toBeVisible({ timeout: 10000 });
  });
});
