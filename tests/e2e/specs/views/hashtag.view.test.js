import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

test.describe("Hashtag view", () => {
  test("should display hashtag header and posts", async ({ page }) => {
    const mockServer = new MockServer();
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/abc123",
      text: "Hello world #javascript",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/def456",
      text: "Learning #javascript today",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addSearchPosts([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/javascript");

    const hashtagView = page.locator("#hashtag-view");
    await expect(
      hashtagView.locator('[data-testid="header-title"]'),
    ).toContainText("#javascript", { timeout: 10000 });

    await expect(hashtagView.locator('[data-testid="feed-item"]')).toHaveCount(
      2,
      { timeout: 10000 },
    );

    await expect(hashtagView).toContainText("Hello world #javascript");
    await expect(hashtagView).toContainText("Learning #javascript today");
  });

  test("should display Top and Latest tab buttons", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/art");

    const hashtagView = page.locator("#hashtag-view");
    await expect(
      hashtagView.locator('[data-testid="header-title"]'),
    ).toContainText("#art", { timeout: 10000 });

    const tabs = hashtagView.locator(".tab-bar-button");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText("Top");
    await expect(tabs.nth(1)).toContainText("Latest");
  });

  test("should have Top tab active by default", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/art");

    const hashtagView = page.locator("#hashtag-view");
    await expect(
      hashtagView.locator('[data-testid="header-title"]'),
    ).toContainText("#art", { timeout: 10000 });

    const topTab = hashtagView.locator(".tab-bar-button").nth(0);
    await expect(topTab).toHaveClass(/active/);

    const latestTab = hashtagView.locator(".tab-bar-button").nth(1);
    await expect(latestTab).not.toHaveClass(/active/);
  });

  test("should switch to Latest tab when clicked", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/art");

    const hashtagView = page.locator("#hashtag-view");
    await expect(
      hashtagView.locator('[data-testid="header-title"]'),
    ).toContainText("#art", { timeout: 10000 });

    await hashtagView.locator(".tab-bar-button").nth(1).click();

    const topTab = hashtagView.locator(".tab-bar-button").nth(0);
    await expect(topTab).not.toHaveClass(/active/);

    const latestTab = hashtagView.locator(".tab-bar-button").nth(1);
    await expect(latestTab).toHaveClass(/active/);
  });

  test("should display empty state when no posts match hashtag", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/nonexistent");

    const hashtagView = page.locator("#hashtag-view");
    await expect(
      hashtagView.locator('[data-testid="header-title"]'),
    ).toContainText("#nonexistent", { timeout: 10000 });

    await expect(hashtagView.locator('[data-testid="feed-item"]')).toHaveCount(
      0,
      { timeout: 10000 },
    );

    await expect(
      hashtagView.locator('[data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      const loggedOutMockServer = new MockServer();
      await loggedOutMockServer.setup(page);

      await page.goto("/hashtag/test");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });

  test("should restore each tab's scroll position", async ({ page }) => {
    const createPosts = (sort) =>
      Array.from({ length: 25 }, (_, index) =>
        createPost({
          uri: `at://did:plc:author${index + 1}/app.bsky.feed.post/${sort}${index + 1}`,
          text: `${sort} #javascript post #${index + 1}.`,
          authorHandle: `author${index + 1}.bsky.social`,
          authorDisplayName: `Author ${index + 1}`,
        }),
      );
    const mockServer = new MockServer();
    mockServer.addSearchPosts(createPosts("top"), { sort: "top" });
    mockServer.addSearchPosts(createPosts("latest"), { sort: "latest" });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/hashtag/javascript");

    const view = page.locator("#hashtag-view");
    const activeFeed = view.locator(".feed-container:not([hidden])");
    const getScrollY = () => page.evaluate(() => window.scrollY);
    await expect(activeFeed.locator('[data-testid="feed-item"]')).toHaveCount(
      25,
      { timeout: 10000 },
    );
    await expect(view.locator('[data-testid="header"]')).toHaveCSS(
      "position",
      "fixed",
    );

    await activeFeed
      .locator('[data-testid="feed-item"]')
      .filter({ hasText: "top #javascript post #15." })
      .scrollIntoViewIfNeeded();
    const topScrollY = await getScrollY();

    await view.locator('[data-testid="tab-latest"]').click();
    await expect(activeFeed.locator('[data-testid="feed-item"]')).toHaveCount(
      25,
      { timeout: 10000 },
    );
    await expect.poll(getScrollY).toBe(0);

    await view.locator('[data-testid="tab-top"]').click();
    await expect.poll(getScrollY).toBe(topScrollY);
  });
});
