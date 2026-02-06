import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";

const post = createPost({
  uri: postUri,
  text: "A viral post",
  authorHandle: "author1.bsky.social",
  authorDisplayName: "Author One",
  repostCount: 3,
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

test.describe("Post reposts view", () => {
  test("should display header and profiles who reposted the post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addPostReposts(postUri, [alice, bob, charlie]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Reposted by",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "3 reposts",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("Charlie");
  });

  test("should display singular 'repost' for count of 1", async ({ page }) => {
    const singleRepostPost = createPost({
      uri: postUri,
      text: "A post with one repost",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      repostCount: 1,
    });

    const mockServer = new MockServer();
    mockServer.addPosts([singleRepostPost]);
    mockServer.addPostReposts(postUri, [alice]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "1 repost",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("should display empty state when there are no reposts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Reposted by",
      { timeout: 10000 },
    );

    await expect(view.locator(".search-status-message")).toContainText(
      "No reposts yet.",
      { timeout: 10000 },
    );
  });
});
