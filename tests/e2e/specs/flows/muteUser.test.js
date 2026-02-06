import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

test.describe("Mute user flow", () => {
  test("should filter posts from feeds and show Unmute option after muting a user", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from user to mute",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is visible on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post from user to mute");

    // Navigate to the user's profile and mute them
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    await profileView.locator(".ellipsis-button").click();
    await page
      .locator("context-menu-item", { hasText: "Mute Account" })
      .click();

    // Verify context menu now shows "Unmute Account"
    await profileView.locator(".ellipsis-button").click();
    await expect(
      page.locator("context-menu-item", { hasText: "Unmute Account" }),
    ).toBeVisible({ timeout: 5000 });
    // Close the menu by pressing Escape
    await page.keyboard.press("Escape");

    // Navigate back to home and verify posts are filtered
    await page.goto("/");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should mute a user from a post context menu and filter their posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from user to mute via menu",
      authorHandle: otherUser.handle,
      authorDisplayName: otherUser.displayName,
    });
    mockServer.addProfile(otherUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify the post is visible on home
    await page.goto("/");
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });
    await expect(homeView).toContainText("Post from user to mute via menu");

    // Open the post's context menu and mute the user
    await feedItem.locator(".text-button").click();
    await page
      .locator("context-menu-item", { hasText: "Mute Account" })
      .click();

    // Verify a toast confirms the mute action
    await expect(page.locator(".toast")).toContainText("Account muted", {
      timeout: 5000,
    });

    // Verify the post is filtered out of the feed
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to the muted user's profile and verify muted state
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    // Verify context menu shows "Unmute Account"
    await profileView.locator(".ellipsis-button").click();
    await expect(
      page.locator("context-menu-item", { hasText: "Unmute Account" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show content again after unmuting a user", async ({ page }) => {
    const mockServer = new MockServer();
    const mutedUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
      viewer: { muted: true },
    });
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from muted user",
      authorHandle: mutedUser.handle,
      authorDisplayName: mutedUser.displayName,
    });
    mockServer.addProfile(mutedUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify posts are filtered on home initially (user is muted)
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to muted user's profile and unmute
    await page.goto(`/profile/${mutedUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    await profileView.locator(".ellipsis-button").click();
    await page
      .locator("context-menu-item", { hasText: "Unmute Account" })
      .click();

    // Navigate to home and verify posts reappear
    await page.goto("/");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post from muted user");
  });
});
