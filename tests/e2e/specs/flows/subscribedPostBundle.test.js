import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createNotification,
  createPost,
  createProfile,
} from "../../../shared/factories.js";

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
});

test.describe("Subscribed post bundle flow", () => {
  test("should open the bundled posts from a notification and navigate back", async ({
    page,
  }) => {
    const posts = ["p3", "p2", "p1"].map((rkey) =>
      createPost({
        uri: `at://${alice.did}/app.bsky.feed.post/${rkey}`,
        text: `Post ${rkey}`,
        authorHandle: alice.handle,
        authorDisplayName: alice.displayName,
      }),
    );
    const mockServer = new MockServer();
    mockServer.addPosts(posts);
    mockServer.addNotifications(
      posts.map((post, index) =>
        createNotification({
          reason: "subscribed-post",
          author: alice,
          uri: post.uri,
          indexedAt: new Date(Date.now() - index * 60 * 1000).toISOString(),
        }),
      ),
    );
    await mockServer.setup(page);

    await login(page);
    await page.goto("/notifications");

    const notificationsView = page.locator("#notifications-view");
    const item = notificationsView.locator(".notification-item");
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await item.locator(".notification-preview-text").click();

    await expect(page).toHaveURL(/\/notifications\/activity\?posts=/);
    const activityView = page.locator("#notification-activity-view");
    const feedItems = activityView.locator('[data-testid="feed-item"]');
    await expect(feedItems).toHaveCount(3, { timeout: 10000 });
    for (const [index, post] of posts.entries()) {
      await expect(feedItems.nth(index)).toHaveAttribute(
        "data-post-uri",
        post.uri,
      );
    }

    await activityView.locator('[data-testid="back-button"]').click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(notificationsView.locator(".notification-item")).toHaveCount(
      1,
    );
  });
});
