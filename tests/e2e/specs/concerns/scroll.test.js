import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createFeedGenerator, createPost } from "../../../shared/factories.js";

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

test.describe("StickyFixer home header", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
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
    await expect(
      page.locator('#home-view [data-testid="feed-item"]'),
    ).toHaveCount(41, { timeout: 10000 });
  });

  test("should sit flush against the first feed item", async ({ page }) => {
    const view = page.locator("#home-view");
    const header = view.locator('[data-testid="header"]');
    await expect(header).toHaveCSS("position", "fixed");
    const headerBox = await header.boundingBox();
    const firstItemBox = await view
      .locator('[data-testid="feed-item"]')
      .first()
      .boundingBox();
    const headerBottom = headerBox.y + headerBox.height;
    expect(Math.abs(firstItemBox.y - headerBottom)).toBeLessThanOrEqual(1);
  });

  test("should keep content in place while the sidebar locks scrolling", async ({
    page,
  }) => {
    const view = page.locator("#home-view");
    const targetPost = view
      .locator('[data-testid="feed-item"]')
      .filter({ hasText: "Timeline post 30" });
    await targetPost.scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    const { y: initialY } = await targetPost.boundingBox();

    await view.locator('[data-testid="menu-button"]').click();
    await expect(page.locator("dialog.sidebar")).toBeVisible();
    const { y: lockedY } = await targetPost.boundingBox();
    expect(Math.abs(lockedY - initialY)).toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.sidebar")).not.toHaveAttribute("open");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
  });
});

test.describe("StickyFixer search header", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts(
      Array.from({ length: 30 }, (_, index) =>
        createPost({
          uri: `at://did:plc:author${index + 1}/app.bsky.feed.post/post${index + 1}`,
          text: `Search result #${index + 1}.`,
          authorHandle: `author${index + 1}.bsky.social`,
          authorDisplayName: `Author ${index + 1}`,
        }),
      ),
    );
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test&tab=top");
    await expect(
      page.locator("#search-view .search-post-results-top [data-post-uri]"),
    ).toHaveCount(30, { timeout: 10000 });
  });

  test("should sit flush against the first result", async ({ page }) => {
    const view = page.locator("#search-view");
    const header = view.locator('[data-testid="header"]');
    await expect(header).toHaveCSS("position", "fixed");
    const headerBox = await header.boundingBox();
    const firstResultBox = await view
      .locator(".search-post-results-top [data-post-uri]")
      .first()
      .boundingBox();
    const headerBottom = headerBox.y + headerBox.height;
    expect(Math.abs(firstResultBox.y - headerBottom)).toBeLessThanOrEqual(1);
  });

  test("should keep content in place while the sidebar locks scrolling", async ({
    page,
  }) => {
    const view = page.locator("#search-view");
    const targetResult = view
      .locator(".search-post-results-top [data-post-uri]")
      .filter({ hasText: "Search result #15." });
    await targetResult.scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    const { y: initialY } = await targetResult.boundingBox();

    await view.locator('[data-testid="menu-button"]').click();
    await expect(page.locator("dialog.sidebar")).toBeVisible();
    const { y: lockedY } = await targetResult.boundingBox();
    expect(Math.abs(lockedY - initialY)).toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.sidebar")).not.toHaveAttribute("open");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
    const headerBox = await view
      .locator('[data-testid="header"]')
      .boundingBox();
    expect(headerBox.y).toBeCloseTo(0, 0);
  });
});

test.describe("Tab bar scroll position", () => {
  test.use({ viewport: { width: 320, height: 667 } });

  const getScrollLeft = (tabBar) => tabBar.evaluate((el) => el.scrollLeft);

  test("should survive navigating away from home and back", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feeds = Array.from({ length: 8 }, (_, index) =>
      createFeedGenerator({
        uri: `at://did:plc:creator1/app.bsky.feed.generator/feed${index}`,
        displayName: `Long Feed Name ${index}`,
        creatorHandle: "creator1.bsky.social",
      }),
    );
    mockServer.addFeedGenerators(feeds);
    mockServer.setPinnedFeeds(feeds.map((feed) => feed.uri));
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");

    const tabBar = page.locator("#home-view tab-bar");
    await expect(tabBar.locator(".tab-bar-button")).toHaveCount(9, {
      timeout: 10000,
    });
    await tabBar.evaluate((el) => {
      el.scrollLeft = 200;
    });

    await page.locator('[data-testid="footer-nav-notifications"]').click();
    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
    await page.goBack();
    await expect(page.locator('#home-view [data-testid="header"]')).toHaveCSS(
      "position",
      "fixed",
    );

    expect(await getScrollLeft(tabBar)).toBe(200);
  });

  test("should survive the profile tab bar sticking and unsticking", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile({
      ...userProfile,
      associated: { feedgens: 1, lists: 1, starterPacks: 1 },
    });
    mockServer.addAuthorFeedPosts(
      userProfile.did,
      "posts_and_author_threads",
      Array.from({ length: 30 }, (_, index) =>
        createPost({
          uri: `at://${userProfile.did}/app.bsky.feed.post/post${index}`,
          text: `Profile post ${index}`,
          authorHandle: userProfile.handle,
        }),
      ),
    );
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const stickyTabBar = page.locator("#profile-view .profile-tab-bar");
    const tabBar = stickyTabBar.locator("tab-bar");
    await expect(
      page.locator('#profile-view [data-testid="feed-item"]').first(),
    ).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(stickyTabBar).toHaveCSS("position", "fixed");
    await tabBar.evaluate((el) => {
      el.scrollLeft = 100;
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(stickyTabBar).toHaveCSS("position", "sticky");
    expect(await getScrollLeft(tabBar)).toBe(100);

    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(stickyTabBar).toHaveCSS("position", "fixed");
    expect(await getScrollLeft(tabBar)).toBe(100);
  });
});
