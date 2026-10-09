import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

const post1 = createPost({
  uri: "at://did:plc:alice1/app.bsky.feed.post/post1",
  text: "Newest post",
  authorHandle: "alice.bsky.social",
  authorDisplayName: "Alice",
});

const post2 = createPost({
  uri: "at://did:plc:alice1/app.bsky.feed.post/post2",
  text: "Older post",
  authorHandle: "alice.bsky.social",
  authorDisplayName: "Alice",
});

function activityPath(postUris) {
  return `/notifications/activity?${new URLSearchParams({
    posts: postUris.join(","),
  })}`;
}

test.describe("Notification activity view", () => {
  test("should display the linked posts in order", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(activityPath([post1.uri, post2.uri]));

    const view = page.locator("#notification-activity-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    const feedItems = view.locator('[data-testid="feed-item"]');
    await expect(feedItems).toHaveCount(2, { timeout: 10000 });
    await expect(feedItems.nth(0)).toHaveAttribute("data-post-uri", post1.uri);
    await expect(feedItems.nth(1)).toHaveAttribute("data-post-uri", post2.uri);
  });

  test("should omit posts that no longer exist", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(activityPath([post1.uri, post2.uri]));

    const view = page.locator("#notification-activity-view");
    const feedItems = view.locator('[data-testid="feed-item"]');
    await expect(feedItems).toHaveCount(1, { timeout: 10000 });
    await expect(feedItems.nth(0)).toHaveAttribute("data-post-uri", post2.uri);
  });

  test("should show the empty state when all posts are gone", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto(activityPath([post1.uri]));

    const view = page.locator("#notification-activity-view");
    await expect(view.locator('[data-testid="empty-state"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show the empty state when the posts param is missing", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications/activity");

    const view = page.locator("#notification-activity-view");
    await expect(view.locator('[data-testid="empty-state"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator('[data-testid="activity-error"]')).toHaveCount(0);
  });

  test("should show an error with retry when loading fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post1]);
    mockServer.failGetPosts();
    await mockServer.setup(page);

    await login(page);
    await page.goto(activityPath([post1.uri]));

    const view = page.locator("#notification-activity-view");
    const error = view.locator('[data-testid="activity-error"]');
    await expect(error).toBeVisible({ timeout: 10000 });

    mockServer.getPostsFailure = null;
    await error.locator(".try-again-button").click();

    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
  });
});
