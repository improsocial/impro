import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

test.describe("Follow/Unfollow flow", () => {
  test("should increment follower count and show user in Following list after following", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 120,
      followsCount: 45,
      postsCount: 87,
    });
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);

    await login(page);

    // Navigate to the other user's profile
    await page.goto(`/profile/${otherUser.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toContainText("+ Follow", { timeout: 10000 });
    await expect(
      profileView.locator('[data-testid="profile-stats"]'),
    ).toContainText("120 followers");

    // Click the follow button
    await profileView.locator('[data-testid="follow-button"]').click();

    // Verify the button changes to "Following"
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toContainText("Following", { timeout: 10000 });

    // Verify the follower count incremented
    await expect(
      profileView.locator('[data-testid="profile-stats"]'),
    ).toContainText("121 followers");

    // Navigate to own profile's Following list
    await page.goto(`/profile/${userProfile.did}/following`);

    const followingView = page.locator("#profile-following-view");
    await expect(followingView.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(followingView).toContainText("Other User");
  });

  test("should decrement follower count and remove user from Following list after unfollowing", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 121,
      followsCount: 45,
      postsCount: 87,
    });
    otherUser.viewer = {
      ...otherUser.viewer,
      following: "at://did:plc:testuser123/app.bsky.graph.follow/follow1",
    };
    mockServer.addProfile(otherUser);
    mockServer.addProfileFollows(userProfile.did, [otherUser]);
    await mockServer.setup(page);

    await login(page);

    // Verify the user is in the Following list initially
    await page.goto(`/profile/${userProfile.did}/following`);

    const followingView = page.locator("#profile-following-view");
    await expect(followingView.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(followingView).toContainText("Other User");

    // Navigate to the other user's profile
    await page.goto(`/profile/${otherUser.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toContainText("Following", { timeout: 10000 });

    // Click the follow button to unfollow
    await profileView.locator('[data-testid="follow-button"]').click();

    // Verify the button changes to "+ Follow"
    await expect(
      profileView.locator('[data-testid="follow-button"]'),
    ).toContainText("+ Follow", { timeout: 10000 });

    // Verify the follower count decremented
    await expect(
      profileView.locator('[data-testid="profile-stats"]'),
    ).toContainText("120 followers");

    // Navigate back to own Following list
    await page.goto(`/profile/${userProfile.did}/following`);

    await expect(followingView.locator(".search-status-message")).toContainText(
      "Not following anyone yet.",
      { timeout: 10000 },
    );
  });
});
