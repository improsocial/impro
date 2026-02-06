import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

test.describe("Search view", () => {
  test("should display search placeholder when no query is entered", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search");

    const view = page.locator("#search-view");
    await expect(view.locator(".search-input")).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".search-placeholder")).toBeVisible();
    await expect(view.locator(".search-placeholder-text")).toContainText(
      "Start typing to search for users and posts.",
    );
  });

  test("should display profile search results", async ({ page }) => {
    const mockServer = new MockServer();
    const profile1 = createProfile({
      did: "did:plc:profile1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const profile2 = createProfile({
      did: "did:plc:profile2",
      handle: "alicia.bsky.social",
      displayName: "Alicia",
    });
    mockServer.addSearchProfiles([profile1, profile2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=ali");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Alice");
    await expect(view).toContainText("@alice.bsky.social");
    await expect(view).toContainText("Alicia");
    await expect(view).toContainText("@alicia.bsky.social");
  });

  test("should display post search results when switching to Posts tab", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Hello world from search",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/post2",
      text: "Another search result",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addSearchPosts([post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=hello");

    const view = page.locator("#search-view");
    // Click the Posts tab
    await view.locator(".tab-bar-button", { hasText: "Posts" }).click();

    await expect(view.locator("[data-post-uri]")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Hello world from search");
    await expect(view).toContainText("Another search result");
  });

  test("should show Profiles tab as active by default", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=alice");

    const view = page.locator("#search-view");
    await expect(
      view.locator(".tab-bar-button.active", { hasText: "Profiles" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show empty state when no profiles match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentuser");

    const view = page.locator("#search-view");
    const profilesPanel = view.locator(
      ".search-tab-panel:not([hidden]) .search-results-panel",
    );
    await expect(profilesPanel.locator(".search-status-message")).toContainText(
      "No profiles found.",
      { timeout: 10000 },
    );
  });

  test("should show empty state when no posts match", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=nonexistentpost&tab=posts");

    const view = page.locator("#search-view");
    await expect(
      view.locator(".search-post-results .search-status-message"),
    ).toContainText("No posts found.", { timeout: 10000 });
  });

  test("should switch between Profiles and Posts tabs", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "A matching post",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test");

    const view = page.locator("#search-view");

    // Profiles tab is active by default
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Switch to Posts tab
    await view.locator(".tab-bar-button", { hasText: "Posts" }).click();
    await expect(
      view.locator(".tab-bar-button.active", { hasText: "Posts" }),
    ).toBeVisible();
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("A matching post");

    // Switch back to Profiles tab
    await view.locator(".tab-bar-button", { hasText: "Profiles" }).click();
    await expect(
      view.locator(".tab-bar-button.active", { hasText: "Profiles" }),
    ).toBeVisible();
    await expect(view.locator(".profile-list-item")).toHaveCount(1);
  });

  test("should display clear button when search has text and clear on click", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=hello");

    const view = page.locator("#search-view");
    await expect(view.locator(".search-clear-button")).toBeVisible({
      timeout: 10000,
    });

    // Click the clear button
    await view.locator(".search-clear-button").click();

    // Should return to placeholder state
    await expect(view.locator(".search-placeholder")).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".search-clear-button")).not.toBeVisible();
  });

  test("should load results from query parameter on page load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "bob.bsky.social",
        displayName: "Bob",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=bob");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("Bob");
    await expect(view).toContainText("@bob.bsky.social");
  });

  test("should navigate to profile when clicking a profile result", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=alice");

    const view = page.locator("#search-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator(".profile-list-item").click();

    await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social/, {
      timeout: 10000,
    });
  });

  test("should load tab from query parameter", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addSearchPosts([
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "Post from tab param",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=test&tab=posts");

    const view = page.locator("#search-view");
    await expect(
      view.locator(".tab-bar-button.active", { hasText: "Posts" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("Post from tab param");
  });

  test("should navigate to post thread view when clicking a post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/clickme1",
      text: "Click this post to see thread",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addSearchPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/search?q=click&tab=posts");

    const view = page.locator("#search-view");
    await expect(view.locator("[data-post-uri]")).toHaveCount(1, {
      timeout: 10000,
    });

    await view.locator("[data-post-uri]").click();

    const threadView = page.locator("#post-detail-view");
    await expect(threadView).toBeVisible({ timeout: 10000 });
    await expect(threadView).toContainText("Click this post to see thread");
    await expect(page).toHaveURL(
      /\/profile\/author1\.bsky\.social\/post\/clickme1/,
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should allow searching profiles and posts without authentication", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const profile1 = createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const profile2 = createProfile({
        did: "did:plc:profile2",
        handle: "alicia.bsky.social",
        displayName: "Alicia",
      });
      mockServer.addSearchProfiles([profile1, profile2]);
      await mockServer.setup(page);

      await page.goto("/search?q=ali");

      const view = page.locator("#search-view");
      await expect(view.locator(".profile-list-item")).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(view).toContainText("Alice");
      await expect(view).toContainText("Alicia");

      // Posts tab should be hidden for logged-out users
      await expect(
        view.locator(".tab-bar-button", { hasText: "Posts" }),
      ).not.toBeVisible();
    });
  });
});
