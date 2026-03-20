import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Scroll position restoration", () => {
  test("should restore scroll position after navigating back from post thread", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const posts = [];
    for (let i = 1; i <= 60; i++) {
      posts.push(
        createPost({
          uri: `at://did:plc:author${i}/app.bsky.feed.post/post${i}`,
          text: `Timeline post ${i}`,
          authorHandle: `author${i}.bsky.social`,
          authorDisplayName: `Author ${i}`,
        }),
      );
    }
    mockServer.addTimelinePosts(posts);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const view = page.locator("#home-view");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(41, {
      timeout: 10000,
    });

    // Scroll to a post that is well down the feed
    const targetPost = view
      .locator('[data-testid="feed-item"]')
      .filter({ hasText: "Timeline post 30" });
    await targetPost.scrollIntoViewIfNeeded();
    await expect(targetPost).toBeVisible();

    // Click the post to navigate to thread view
    await targetPost.locator('[data-testid="small-post"]').click();
    await expect(page.locator("#post-detail-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(
      /\/profile\/author30\.bsky\.social\/post\/post30/,
    );

    // Navigate back
    await page.goBack();

    // Verify we're back on the home view
    await expect(view).toBeVisible({ timeout: 10000 });

    // Verify the post we scrolled to is still visible (scroll position restored)
    await expect(targetPost).toBeVisible({ timeout: 10000 });
  });
});
