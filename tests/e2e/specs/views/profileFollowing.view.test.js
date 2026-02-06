import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

const profileUser = createProfile({
  did: "did:plc:profileuser1",
  handle: "profileuser.bsky.social",
  displayName: "Profile User",
  followsCount: 3,
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

test.describe("Profile following view", () => {
  test("should display header and followed profiles", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    mockServer.addProfileFollows(profileUser.did, [alice, bob, charlie]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/following`);

    const view = page.locator("#profile-following-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator('[data-testid="header-subtitle"]')).toContainText(
      "3 following",
      { timeout: 10000 },
    );

    await expect(view.locator(".profile-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("Charlie");
  });

  test("should display empty state when not following anyone", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${profileUser.did}/following`);

    const view = page.locator("#profile-following-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Profile User",
      { timeout: 10000 },
    );

    await expect(view.locator(".search-status-message")).toContainText(
      "Not following anyone yet.",
      { timeout: 10000 },
    );
  });

  test("should load more followed profiles when scrolling to the bottom", async ({
    page,
  }) => {
    const follows = [];
    for (let i = 1; i <= 60; i++) {
      follows.push(
        createProfile({
          did: `did:plc:following${i}`,
          handle: `following${i}.bsky.social`,
          displayName: `Following ${i}`,
        }),
      );
    }

    const manyFollowsProfile = createProfile({
      did: "did:plc:profileuser1",
      handle: "profileuser.bsky.social",
      displayName: "Profile User",
      followsCount: 60,
    });

    const mockServer = new MockServer();
    mockServer.addProfile(manyFollowsProfile);
    mockServer.addProfileFollows(manyFollowsProfile.did, follows);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${manyFollowsProfile.did}/following`);

    const view = page.locator("#profile-following-view");
    const items = view.locator(".profile-list-item");

    // Wait for initial batch to load
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await items.count();
    expect(initialCount).toBeLessThan(60);

    // Scroll to bottom to trigger infinite scroll
    await items.last().scrollIntoViewIfNeeded();

    // Verify more followed profiles loaded
    await expect(items).toHaveCount(60, { timeout: 10000 });
    await expect(view).toContainText("Following 60");
  });

  test("should display error state when following list fails to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(profileUser);
    await mockServer.setup(page);

    // Override getFollows to return error
    await page.route("**/xrpc/app.bsky.graph.getFollows*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto(`/profile/${profileUser.did}/following`);

    const view = page.locator("#profile-following-view");
    await expect(view.locator(".error-state")).toContainText(
      "Error loading following",
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/profile/someone.bsky.social/following");

      await expect(page).toHaveURL("/login", { timeout: 10000 });
    });
  });
});
