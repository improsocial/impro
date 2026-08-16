import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

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

  test.describe("on a settings subpage", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("should restore on back and reset to the top on a forward visit", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.mutedWords = Array.from({ length: 40 }, (_, i) => ({
        value: `mutedword${i + 1}`,
        targets: ["content"],
      }));
      await mockServer.setup(page);

      await login(page);
      await page.goto("/settings");

      const openMutedWords = () =>
        page.locator('[data-testid="settings-nav-muted-words"]').click();
      const view = page.locator("#settings-muted-words-view");

      await openMutedWords();
      await expect(view.locator('[data-testid="muted-word-list"]')).toBeVisible(
        {
          timeout: 10000,
        },
      );

      await view
        .locator('[data-testid="muted-word-item"]')
        .last()
        .scrollIntoViewIfNeeded();
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);

      await page.goBack();
      await expect(page.locator("#settings-view")).toBeVisible({
        timeout: 10000,
      });

      // Forward navigation to the cached page starts at the top
      await openMutedWords();
      await expect(view).toBeVisible({ timeout: 10000 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

      // ...and the position saved for that visit is restored on back
      await view
        .locator('[data-testid="muted-word-item"]')
        .last()
        .scrollIntoViewIfNeeded();
      await page.goBack();
      await expect(page.locator("#settings-view")).toBeVisible({
        timeout: 10000,
      });
      await page.goForward();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(scrollY);
    });
  });
});
