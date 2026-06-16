import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

const profileUser = createProfile({
  did: "did:plc:profileuser1",
  handle: "profileuser.bsky.social",
  displayName: "Profile User",
  followersCount: 100,
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

test.describe("Profile known followers view", () => {
  test("should display header and known follower profiles", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    mockServer.addKnownFollowers(profileUser.did, [alice, bob, charlie]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "Followers you know",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("Charlie");
  });

  test("should display empty state when no known followers", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should load more known followers when scrolling to the bottom", async ({
    page,
  }) => {
    const followers = [];
    for (let i = 1; i <= 60; i++) {
      followers.push(
        createProfile({
          did: `did:plc:kfollower${i}`,
          handle: `kfollower${i}.bsky.social`,
          displayName: `KFollower ${i}`,
        }),
      );
    }

    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    mockServer.addKnownFollowers(profileUser.did, followers);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
    const items = view.locator(".profile-list-item");

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
    await expect(view).toContainText("KFollower 60");
  });

  test("should display error state when known followers fail to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    await page.route("**/xrpc/app.bsky.graph.getKnownFollowers*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error loading followers you know",
      { timeout: 10000 },
    );
  });

  test("should render bio, follows-you, and follow-state per known follower", async ({
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
    mockServer.addKnownFollowers(profileUser.did, [
      followsBack,
      alreadyFollowing,
      stranger,
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
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
    mockServer.addKnownFollowers(profileUser.did, [target]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/known-followers`);

    const view = page.locator("#profile-known-followers-view");
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
      await page.goto("/profile/someone.bsky.social/known-followers");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
