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

    await items.last().scrollIntoViewIfNeeded();

    await expect(items).toHaveCount(60, { timeout: 10000 });
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

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/profile/someone.bsky.social/known-followers");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
