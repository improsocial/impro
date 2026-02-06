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

    await expect(view.locator(".search-status-message")).toContainText(
      "No followers yet.",
      { timeout: 10000 },
    );
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

    // Scroll to bottom to trigger infinite scroll
    await items.last().scrollIntoViewIfNeeded();

    // Verify more followers loaded
    await expect(items).toHaveCount(60, { timeout: 10000 });
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

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/profile/someone.bsky.social/followers");

      await expect(page).toHaveURL("/login", { timeout: 10000 });
    });
  });
});
