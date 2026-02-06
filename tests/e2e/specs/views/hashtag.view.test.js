import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

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
      hashtagView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });
  });
});
