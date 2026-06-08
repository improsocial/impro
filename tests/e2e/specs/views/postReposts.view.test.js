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

    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display error state when reposts fail to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    // Override getRepostedBy to return error
    await page.route("**/xrpc/app.bsky.feed.getRepostedBy*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error loading reposts",
      { timeout: 10000 },
    );
  });

  test("should render bio, follows-you, and follow-state per reposter", async ({
    page,
  }) => {
    const followsBack = createProfile({
      did: "did:plc:followsback1",
      handle: "followsback.bsky.social",
      displayName: "Follows Back",
      description: "I follow you and have a bio.",
      viewer: { followedBy: "at://did:plc:followsback1/follow/1" },
    });
    const alreadyFollowing = createProfile({
      did: "did:plc:already1",
      handle: "already.bsky.social",
      displayName: "Already Following",
      description: "",
      viewer: { following: "at://did:plc:viewer/follow/abc" },
    });
    const stranger = createProfile({
      did: "did:plc:stranger1",
      handle: "stranger.bsky.social",
      displayName: "Stranger",
      description: "A stranger with a description.",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addPostReposts(postUri, [
      followsBack,
      alreadyFollowing,
      stranger,
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    const followsBackRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Follows Back" });
    const alreadyRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Already Following" });
    const strangerRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Stranger" });

    await expect(
      followsBackRow.locator('[data-testid="follows-you-badge"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      alreadyRow.locator('[data-testid="follows-you-badge"]'),
    ).toHaveCount(0);
    await expect(
      strangerRow.locator('[data-testid="follows-you-badge"]'),
    ).toHaveCount(0);

    await expect(
      followsBackRow.locator('[data-testid="profile-list-item-description"]'),
    ).toContainText("I follow you and have a bio.");
    await expect(
      alreadyRow.locator('[data-testid="profile-list-item-description"]'),
    ).toHaveCount(0);

    await expect(
      followsBackRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "follow-back");
    await expect(
      alreadyRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "following");
    await expect(
      strangerRow.locator('[data-testid="follow-button"]'),
    ).toHaveAttribute("data-teststate", "follow");
  });

  test("clicking the follow button on a row toggles to following", async ({
    page,
  }) => {
    const target = createProfile({
      did: "did:plc:target1",
      handle: "target.bsky.social",
      displayName: "Target User",
    });

    const mockServer = new MockServer();
    mockServer.addPosts([post]);
    mockServer.addPostReposts(postUri, [target]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

    const view = page.locator("#post-reposts-view");
    const targetRow = view
      .locator(".profile-list-item")
      .filter({ hasText: "Target User" });

    const followButton = targetRow.locator('[data-testid="follow-button"]');
    await expect(followButton).toHaveAttribute("data-teststate", "follow", {
      timeout: 10000,
    });
    await followButton.click();
    await expect(followButton).toHaveAttribute("data-teststate", "following", {
      timeout: 10000,
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should display list of users who reposted the post without follow buttons", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addPosts([post]);
      mockServer.addPostReposts(postUri, [alice, bob, charlie]);
      await mockServer.setup(page);

      await page.goto("/profile/author1.bsky.social/post/abc123/reposts");

      const view = page.locator("#post-reposts-view");
      await expect(view.locator('[data-testid="header-title"]')).toContainText(
        "Reposted by",
        { timeout: 10000 },
      );

      await expect(view.locator(".profile-list-item")).toHaveCount(3, {
        timeout: 10000,
      });
      await expect(view).toContainText("Alice");
      await expect(view).toContainText("Bob");
      await expect(view).toContainText("Charlie");

      await expect(view.locator('[data-testid="follow-button"]')).toHaveCount(
        0,
      );
    });
  });
});
