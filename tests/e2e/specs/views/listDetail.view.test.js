import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createList, createPost, createProfile } from "../../factories.js";

const LIST_URI = "at://did:plc:creator1/app.bsky.graph.list/mylist";

function setupList(mockServer, { description } = {}) {
  const list = createList({
    uri: LIST_URI,
    name: "My Curated List",
    creatorHandle: "creator1.bsky.social",
  });
  if (description !== undefined) {
    list.description = description;
  }
  mockServer.addLists([list]);
  return list;
}

test.describe("List Detail view", () => {
  test("should display list name, creator, and description", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupList(mockServer, { description: "A list of cool people" });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(
      view.locator('[data-testid="list-detail-name"]'),
    ).toContainText("My Curated List", { timeout: 10000 });
    await expect(
      view.locator('[data-testid="list-detail-creator"]'),
    ).toContainText("by @creator1.bsky.social");
    await expect(
      view.locator('[data-testid="list-detail-description"]'),
    ).toContainText("A list of cool people");
  });

  test("should show posts on the Posts tab by default", async ({ page }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    const post1 = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/p1",
      text: "List post one",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    const post2 = createPost({
      uri: "at://did:plc:author2/app.bsky.feed.post/p2",
      text: "List post two",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    });
    mockServer.addListFeedItems(LIST_URI, [post1, post2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(
      view.locator('[data-testid="list-tab-content"]'),
    ).toHaveAttribute("data-teststate", "posts", { timeout: 10000 });
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("List post one");
    await expect(view).toContainText("List post two");
  });

  test("should show members on the People tab", async ({ page }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    const member1 = createProfile({
      did: "did:plc:member1",
      handle: "member1.bsky.social",
      displayName: "Member One",
    });
    const member2 = createProfile({
      did: "did:plc:member2",
      handle: "member2.bsky.social",
      displayName: "Member Two",
    });
    mockServer.addListMembers(LIST_URI, [member1, member2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(view.locator('[data-testid="tab-people"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="tab-people"]').click();

    await expect(
      view.locator('[data-testid="list-tab-content"]'),
    ).toHaveAttribute("data-teststate", "people");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Member One");
    await expect(view).toContainText("Member Two");
  });

  test("should show feed empty state when list has no posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show pin button as unpinned by default", async ({ page }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(view.locator('[data-testid="pin-list-button"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="pin-list-button"]'),
    ).toHaveAttribute("data-teststate", "not-pinned");
  });

  test("should show pin button as pinned when list is pinned", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    mockServer.setPinnedLists([LIST_URI]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(
      view.locator('[data-testid="pin-list-button"]'),
    ).toHaveAttribute("data-teststate", "pinned", { timeout: 10000 });
  });

  test("should pin an unpinned list when pin button is clicked", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    const pinButton = view.locator('[data-testid="pin-list-button"]');
    await expect(pinButton).toHaveAttribute("data-teststate", "not-pinned", {
      timeout: 10000,
    });

    await pinButton.click();

    await expect(pinButton).toHaveAttribute("data-teststate", "pinned", {
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
  });

  test("should open context menu with list actions", async ({ page }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(view.locator(".list-menu-button")).toBeVisible({
      timeout: 10000,
    });

    await view.locator(".list-menu-button").click();

    const menu = view.locator("context-menu");
    await expect(
      menu.locator('[data-testid="menu-action-list-open-in-bsky"]'),
    ).toBeVisible();
    await expect(
      menu.locator('[data-testid="menu-action-list-copy-link"]'),
    ).toBeVisible();
  });

  test("should open bsky.app link when 'Open in bsky.app' is clicked", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupList(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/creator1.bsky.social/lists/mylist");

    const view = page.locator("#list-detail-view");
    await expect(view.locator(".list-menu-button")).toBeVisible({
      timeout: 10000,
    });

    const popupPromise = page.waitForEvent("popup");
    await view.locator(".list-menu-button").click();
    await view.locator('[data-testid="menu-action-list-open-in-bsky"]').click();

    const popup = await popupPromise;
    expect(popup.url()).toBe(
      "https://bsky.app/profile/creator1.bsky.social/lists/mylist",
    );
  });

  test.describe("Moderation list subscription", () => {
    const MOD_LIST_URI = "at://did:plc:creator1/app.bsky.graph.list/modlist";

    function setupModList(mockServer, { viewer = {} } = {}) {
      const list = createList({
        uri: MOD_LIST_URI,
        name: "Spammers",
        creatorHandle: "creator1.bsky.social",
        purpose: "app.bsky.graph.defs#modlist",
      });
      list.viewer = viewer;
      mockServer.addLists([list]);
      return list;
    }

    test("should show Subscribe button on moderation lists", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupModList(mockServer);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/modlist");

      const button = page.locator('[data-testid="subscribe-list-button"]');
      await expect(button).toBeVisible({ timeout: 10000 });
      await expect(button).toHaveAttribute("data-teststate", "not-subscribed");
      await expect(button).toContainText("Subscribe");
    });

    test("should not show Subscribe button on curate lists", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupList(mockServer);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/mylist");

      await expect(page.locator('[data-testid="pin-list-button"]')).toBeVisible(
        { timeout: 10000 },
      );
      await expect(
        page.locator('[data-testid="subscribe-list-button"]'),
      ).toHaveCount(0);
    });

    test("should mute a moderation list via the Subscribe menu", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupModList(mockServer);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/modlist");

      const button = page.locator('[data-testid="subscribe-list-button"]');
      await expect(button).toBeVisible({ timeout: 10000 });
      await button.click();

      await page.locator('[data-testid="menu-action-list-mute"]').click();
      await page.locator('[data-testid="modal-confirm-button"]').click();

      await expect(button).toHaveAttribute("data-teststate", "muted", {
        timeout: 10000,
      });
      await expect(button).toContainText("Unmute list");
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    });

    test("should block a moderation list via the Subscribe menu", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupModList(mockServer);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/modlist");

      const button = page.locator('[data-testid="subscribe-list-button"]');
      await expect(button).toBeVisible({ timeout: 10000 });
      await button.click();

      await page.locator('[data-testid="menu-action-list-block"]').click();
      await page.locator('[data-testid="modal-confirm-button"]').click();

      await expect(button).toHaveAttribute("data-teststate", "blocked", {
        timeout: 10000,
      });
      await expect(button).toContainText("Unblock list");
    });

    test("should unmute a moderation list when already muted", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupModList(mockServer, { viewer: { muted: true } });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/modlist");

      const button = page.locator('[data-testid="subscribe-list-button"]');
      await expect(button).toHaveAttribute("data-teststate", "muted", {
        timeout: 10000,
      });
      await button.click();

      await expect(button).toHaveAttribute("data-teststate", "not-subscribed", {
        timeout: 10000,
      });
      await expect(button).toContainText("Subscribe");
    });

    test("should unblock a moderation list when already blocked", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupModList(mockServer, {
        viewer: {
          blocked: "at://did:plc:test/app.bsky.graph.listblock/abc",
        },
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/creator1.bsky.social/lists/modlist");

      const button = page.locator('[data-testid="subscribe-list-button"]');
      await expect(button).toHaveAttribute("data-teststate", "blocked", {
        timeout: 10000,
      });
      await button.click();

      await expect(button).toHaveAttribute("data-teststate", "not-subscribed", {
        timeout: 10000,
      });
    });

    test("should show Subscribe button on the user's own moderation list", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const list = createList({
        uri: "at://did:plc:testuser123/app.bsky.graph.list/mine",
        name: "My ModList",
        creatorHandle: "testuser.bsky.social",
        purpose: "app.bsky.graph.defs#modlist",
      });
      mockServer.addLists([list]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/testuser.bsky.social/lists/mine");

      await expect(
        page.locator('[data-testid="subscribe-list-button"]'),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/profile/creator1.bsky.social/lists/mylist");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
