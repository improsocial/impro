import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

const profileUser = createProfile({
  did: "did:plc:profileuser1",
  handle: "profileuser.bsky.social",
  displayName: "Profile User",
  followersCount: 3,
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

test.describe("Profile followers view", () => {
  test("should display header and follower profiles", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    mockServer.addProfileFollowers(profileUser.did, [alice, bob, charlie]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "3 followers",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("Charlie");
  });

  test("should navigate to the profile when clicking a follower row", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    mockServer.addProfile(alice);
    mockServer.addProfileFollowers(profileUser.did, [alice]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator(".profile-list-item").first().click();

    await expect(page).toHaveURL(`/profile/${alice.handle}`, {
      timeout: 10000,
    });
  });

  test("should display singular 'follower' for count of 1", async ({
    page,
  }) => {
    const singleFollowerProfile = createProfile({
      did: "did:plc:profileuser1",
      handle: "profileuser.bsky.social",
      displayName: "Profile User",
      followersCount: 1,
    });

    const mockServer = new MockServer();
    mockServer.addProfile(singleFollowerProfile);
    mockServer.addProfileFollowers(singleFollowerProfile.did, [alice]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${singleFollowerProfile.did}/followers`);

    const view = page.locator("#profile-followers-view");
    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "1 follower",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("should display empty state when there are no followers", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should load more followers when scrolling to the bottom", async ({
    page,
  }) => {
    const followers = [];
    for (let i = 1; i <= 60; i++) {
      followers.push(
        createProfile({
          did: `did:plc:follower${i}`,
          handle: `follower${i}.bsky.social`,
          displayName: `Follower ${i}`,
        }),
      );
    }

    const manyFollowersProfile = createProfile({
      did: "did:plc:profileuser1",
      handle: "profileuser.bsky.social",
      displayName: "Profile User",
      followersCount: 60,
    });

    const mockServer = new MockServer();
    mockServer.addProfile(manyFollowersProfile);
    mockServer.addProfileFollowers(manyFollowersProfile.did, followers);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${manyFollowersProfile.did}/followers`);

    const view = page.locator("#profile-followers-view");
    const items = view.locator(".profile-list-item");

    // Wait for initial batch to load
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await items.count();
    expect(initialCount).toBeLessThan(60);

    // Scroll the window to the bottom to trigger infinite scroll. Loop
    // because a single fetch may not yield the full set in one batch.
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
          return await items.count();
        },
        { timeout: 10000, intervals: [200] },
      )
      .toBe(60);
    await expect(view).toContainText("Follower 60");
  });

  test("should display error state when followers fail to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    // Override getFollowers to return error
    await page.route("**/xrpc/app.bsky.graph.getFollowers*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error loading followers",
      { timeout: 10000 },
    );
  });

  test("should render bio, follows-you, and follow-state per follower", async ({
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
    mockServer.addProfile(profileUser);
    mockServer.addProfileFollowers(profileUser.did, [
      followsBack,
      alreadyFollowing,
      stranger,
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
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
    mockServer.addProfile(profileUser);
    mockServer.addProfileFollowers(profileUser.did, [target]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/followers`);

    const view = page.locator("#profile-followers-view");
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
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/profile/someone.bsky.social/followers");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
