import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

test.describe("Block user flow", () => {
  test("should hide posts from home feed and show blocked state on profile after blocking", async ({
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
      text: "Post from user to block",
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
    await expect(homeView).toContainText("Post from user to block");

    // Navigate to the user's profile and block them
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    await profileView.locator(".ellipsis-button").click();
    await page
      .locator("context-menu-item", { hasText: "Block Account" })
      .click();

    // Wait for the profile to show blocked state
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("User Blocked", { timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="unblock-button"]'),
    ).toContainText("Unblock");

    // Navigate back to home and verify posts are hidden
    await page.goto("/");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show content again after unblocking a user", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const blockedUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    blockedUser.viewer = {
      ...blockedUser.viewer,
      blocking: "at://did:plc:testuser123/app.bsky.graph.block/block1",
    };
    const post = createPost({
      uri: "at://did:plc:otheruser1/app.bsky.feed.post/post1",
      text: "Post from blocked user",
      authorHandle: blockedUser.handle,
      authorDisplayName: blockedUser.displayName,
    });
    mockServer.addProfile(blockedUser);
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);

    // Verify posts are hidden on home initially (user is blocked)
    await page.goto("/");
    const homeView = page.locator("#home-view");
    await expect(
      homeView.locator('[data-testid="feed-end-message"]'),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to blocked user's profile and unblock
    await page.goto(`/profile/${blockedUser.did}`);
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).toContainText("User Blocked", { timeout: 10000 });

    await profileView.locator('[data-testid="unblock-button"]').click();

    // Verify the blocked badge is gone and follow button returns
    await expect(
      profileView.locator('[data-testid="blocked-badge"]'),
    ).not.toBeVisible({ timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toBeVisible();

    // Navigate to home and verify posts reappear
    await page.goto("/");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("Post from blocked user");
  });
});
