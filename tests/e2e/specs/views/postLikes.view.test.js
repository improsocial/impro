import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";

const post = createPost({
  uri: postUri,
  text: "A popular post",
  authorHandle: "author1.bsky.social",
  authorDisplayName: "Author One",
  likeCount: 3,
});

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
});

const bob = createProfile({
  did: "did:plc:bob1",
  handle: "bob.bsky.social",
  displayName: "Bob",
});

const charlie = createProfile({
  did: "did:plc:charlie1",
  handle: "charlie.bsky.social",
  displayName: "Charlie",
});

test.describe("Post likes view", () => {
  test("should display header and profiles who liked the post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addPostLikes(postUri, [
      { actor: alice, createdAt: "2025-01-15T12:00:00.000Z" },
      { actor: bob, createdAt: "2025-01-15T13:00:00.000Z" },
      { actor: charlie, createdAt: "2025-01-15T14:00:00.000Z" },
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/likes");

    const view = page.locator("#post-likes-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Liked by",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "3 likes",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("Charlie");
  });

  test("should display singular 'like' for count of 1", async ({ page }) => {
    const singleLikePost = createPost({
      uri: postUri,
      text: "A post with one like",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      likeCount: 1,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([singleLikePost]);
    mockServer.addPostLikes(postUri, [
      { actor: alice, createdAt: "2025-01-15T12:00:00.000Z" },
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/likes");

    const view = page.locator("#post-likes-view");
    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "1 like",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("should display empty state when there are no likes", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/likes");

    const view = page.locator("#post-likes-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Liked by",
      { timeout: 10000 },
    );

    await expect(view.locator(".search-status-message")).toContainText(
      "No likes yet.",
      { timeout: 10000 },
    );
  });
});
