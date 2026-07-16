import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createList } from "../../../shared/factories.js";

test.describe("Feeds view", () => {
  test("should display header and pinned feeds", async ({ page }) => {
    const mockServer = new MockServer();
    const feed1 = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    const feed2 = createFeedGenerator({
      uri: "at://did:plc:creator2/app.bsky.feed.generator/science",
      displayName: "Science",
      creatorHandle: "creator2.bsky.social",
    });
    mockServer.addFeedGenerators([feed1, feed2]);
    mockServer.setPinnedFeeds([feed1.uri, feed2.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(
      feedsView.locator('[data-testid="header-title"]'),
    ).toContainText("Feeds", { timeout: 10000 });

    await expect(feedsView.locator(".feeds-list-header")).toContainText(
      "Pinned Feeds",
    );

    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(feedsView).toContainText("Following");
    await expect(feedsView).toContainText("Trending");
    await expect(feedsView).toContainText("by @creator1.bsky.social");
    await expect(feedsView).toContainText("Science");
    await expect(feedsView).toContainText("by @creator2.bsky.social");
  });

  test("should navigate to feed detail when clicking a feed", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.setPinnedFeeds([feed.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });

    await feedsView
      .locator(".feeds-list-item", { hasText: "Trending" })
      .click();

    await expect(page).toHaveURL(
      "/profile/creator1.bsky.social/feed/trending",
      { timeout: 10000 },
    );
  });

  test("should display only the Following feed when there are no other pinned feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(
      feedsView.locator('[data-testid="header-title"]'),
    ).toContainText("Feeds", { timeout: 10000 });

    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await expect(feedsView).toContainText("Following");
  });

  test("should display pinned lists alongside pinned feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
      displayName: "Trending",
      creatorHandle: "creator1.bsky.social",
    });
    const list = createList({
      uri: "at://did:plc:creator2/app.bsky.graph.list/mylist",
      name: "My Curated List",
      creatorHandle: "creator2.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    mockServer.addLists([list]);
    mockServer.setPinnedFeeds([feed.uri]);
    mockServer.setPinnedLists([list.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
      timeout: 10000,
    });

    await expect(feedsView).toContainText("Following");
    await expect(feedsView).toContainText("Trending");
    await expect(feedsView).toContainText("My Curated List");
    await expect(feedsView).toContainText("by @creator2.bsky.social");
  });

  test.describe("Reorder pinned items", () => {
    async function dragRow(page, fromRow, toRow, { above = false } = {}) {
      const handle = fromRow.locator(
        '[data-testid="feeds-list-item-drag-handle"]',
      );
      const handleBox = await handle.boundingBox();
      const targetBox = await toRow.boundingBox();
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      const endX = startX;
      const endY = above
        ? targetBox.y + targetBox.height * 0.25
        : targetBox.y + targetBox.height * 0.75;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Multi-step move so pointermove fires and siblings shift.
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
          startX + ((endX - startX) * i) / steps,
          startY + ((endY - startY) * i) / steps,
        );
      }
      await page.mouse.up();
    }

    test("gear button is disabled when there is only one pinned item", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeDisabled();
    });

    test("drag handles are hidden until entering edit mode via the gear", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feed = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      mockServer.addFeedGenerators([feed]);
      mockServer.setPinnedFeeds([feed.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
        timeout: 10000,
      });
      await expect(
        feedsView.locator('[data-testid="feeds-list-item-drag-handle"]'),
      ).toHaveCount(0);
      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      await expect(
        feedsView.locator('[data-testid="feeds-save-button"]'),
      ).toHaveCount(0);

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();
      await expect(
        feedsView.locator('[data-testid="feeds-save-button"]'),
      ).toBeVisible();
      await expect(
        feedsView.locator('[data-testid="feeds-list-item-drag-handle"]'),
      ).toHaveCount(2);
    });

    test("dragging in edit mode + Save persists and reverts to gear", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const followingRow = feedsView.locator(
        '[data-testid="feeds-list-item-following"]',
      );
      const feedBRow = feedsView.locator(`[data-pinned-value="${feedB.uri}"]`);
      await dragRow(page, followingRow, feedBRow);

      await expect(
        feedsView.locator(".feeds-list-item").first(),
      ).toHaveAttribute("data-pinned-value", feedA.uri);
      const titlesAfterDrag = await feedsView
        .locator(".feeds-list-item-title")
        .allTextContents();
      expect(titlesAfterDrag).toEqual(["Feed A", "Feed B", "Following"]);

      const putRequest = page.waitForRequest(
        (req) =>
          req.url().includes("/xrpc/app.bsky.actor.putPreferences") &&
          req.method() === "POST",
      );
      await feedsView.locator('[data-testid="feeds-save-button"]').click();
      const request = await putRequest;
      const body = request.postDataJSON();
      const savedFeedsPref = body.preferences.find(
        (p) => p.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
      );
      const pinnedValues = savedFeedsPref.items
        .filter((it) => it.pinned)
        .map((it) => it.value);
      expect(pinnedValues).toEqual([feedA.uri, feedB.uri, "following"]);

      // After saving, the header reverts to the gear button.
      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      await expect(
        feedsView.locator('[data-testid="feeds-save-button"]'),
      ).toHaveCount(0);
      await expect(
        feedsView.locator('[data-testid="feeds-list-item-drag-handle"]'),
      ).toHaveCount(0);
    });

    test("Save with no changes exits edit mode without a request", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      mockServer.addFeedGenerators([feedA]);
      mockServer.setPinnedFeeds([feedA.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2, {
        timeout: 10000,
      });

      let sawPut = false;
      page.on("request", (req) => {
        if (req.url().includes("/xrpc/app.bsky.actor.putPreferences")) {
          sawPut = true;
        }
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();
      await feedsView.locator('[data-testid="feeds-save-button"]').click();

      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      expect(sawPut).toBe(false);
    });

    test("Cancel discards the unsaved draft order and exits edit mode", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      let sawPut = false;
      page.on("request", (req) => {
        if (req.url().includes("/xrpc/app.bsky.actor.putPreferences")) {
          sawPut = true;
        }
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const followingRow = feedsView.locator(
        '[data-testid="feeds-list-item-following"]',
      );
      const feedBRow = feedsView.locator(`[data-pinned-value="${feedB.uri}"]`);
      await dragRow(page, followingRow, feedBRow);

      await feedsView.locator('[data-testid="feeds-cancel-button"]').click();

      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      await expect(
        feedsView.locator('[data-testid="feeds-save-button"]'),
      ).toHaveCount(0);
      await expect(
        feedsView.locator('[data-testid="feeds-cancel-button"]'),
      ).toHaveCount(0);

      const titlesAfterCancel = await feedsView
        .locator(".feeds-list-item-title")
        .allTextContents();
      expect(titlesAfterCancel).toEqual(["Following", "Feed A", "Feed B"]);
      expect(sawPut).toBe(false);
    });

    test("unpin buttons are hidden until entering edit mode", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });
      await expect(
        feedsView.locator('[data-testid="feeds-list-item-unpin-button"]'),
      ).toHaveCount(0);

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();
      await expect(
        feedsView.locator('[data-testid="feeds-list-item-unpin-button"]'),
      ).toHaveCount(3);
    });

    test("clicking a row's unpin button hides it visually without a request", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      let sawPut = false;
      page.on("request", (req) => {
        if (req.url().includes("/xrpc/app.bsky.actor.putPreferences")) {
          sawPut = true;
        }
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const feedARow = feedsView.locator(`[data-pinned-value="${feedA.uri}"]`);
      await feedARow
        .locator('[data-testid="feeds-list-item-unpin-button"]')
        .click();

      const titlesAfterUnpin = await feedsView
        .locator(".feeds-list-item-title")
        .allTextContents();
      expect(titlesAfterUnpin).toEqual(["Following", "Feed B"]);
      expect(sawPut).toBe(false);
    });

    test("unpin + Save persists via putPreferences and exits edit mode", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const feedARow = feedsView.locator(`[data-pinned-value="${feedA.uri}"]`);
      await feedARow
        .locator('[data-testid="feeds-list-item-unpin-button"]')
        .click();

      const putRequest = page.waitForRequest(
        (req) =>
          req.url().includes("/xrpc/app.bsky.actor.putPreferences") &&
          req.method() === "POST",
      );
      await feedsView.locator('[data-testid="feeds-save-button"]').click();
      const request = await putRequest;
      const body = request.postDataJSON();
      const savedFeedsPref = body.preferences.find(
        (p) => p.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
      );
      const pinnedValues = savedFeedsPref.items
        .filter((it) => it.pinned)
        .map((it) => it.value);
      expect(pinnedValues).toEqual(["following", feedB.uri]);

      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      await expect(
        feedsView.locator('[data-testid="feeds-save-button"]'),
      ).toHaveCount(0);
    });

    test("Cancel discards the unsaved unpin and restores the row", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      let sawPut = false;
      page.on("request", (req) => {
        if (req.url().includes("/xrpc/app.bsky.actor.putPreferences")) {
          sawPut = true;
        }
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const feedARow = feedsView.locator(`[data-pinned-value="${feedA.uri}"]`);
      await feedARow
        .locator('[data-testid="feeds-list-item-unpin-button"]')
        .click();

      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(2);

      await feedsView.locator('[data-testid="feeds-cancel-button"]').click();

      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
      const titlesAfterCancel = await feedsView
        .locator(".feeds-list-item-title")
        .allTextContents();
      expect(titlesAfterCancel).toEqual(["Following", "Feed A", "Feed B"]);
      expect(sawPut).toBe(false);
    });

    test("unpin + drag reorder + Save persists the combined change", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const feedARow = feedsView.locator(`[data-pinned-value="${feedA.uri}"]`);
      await feedARow
        .locator('[data-testid="feeds-list-item-unpin-button"]')
        .click();

      const followingRow = feedsView.locator(
        '[data-testid="feeds-list-item-following"]',
      );
      const feedBRow = feedsView.locator(`[data-pinned-value="${feedB.uri}"]`);
      await dragRow(page, followingRow, feedBRow);

      const putRequests = [];
      page.on("request", (req) => {
        if (
          req.url().includes("/xrpc/app.bsky.actor.putPreferences") &&
          req.method() === "POST"
        ) {
          putRequests.push(req);
        }
      });

      await feedsView.locator('[data-testid="feeds-save-button"]').click();
      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();

      expect(putRequests.length).toBeGreaterThanOrEqual(1);
      const lastBody = putRequests[putRequests.length - 1].postDataJSON();
      const savedFeedsPref = lastBody.preferences.find(
        (p) => p.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
      );
      const pinnedValues = savedFeedsPref.items
        .filter((it) => it.pinned)
        .map((it) => it.value);
      expect(pinnedValues).toEqual([feedB.uri, "following"]);
    });

    test("navigating away discards the unsaved draft order", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const feedA = createFeedGenerator({
        uri: "at://did:plc:a/app.bsky.feed.generator/a",
        displayName: "Feed A",
        creatorHandle: "creator-a.bsky.social",
      });
      const feedB = createFeedGenerator({
        uri: "at://did:plc:b/app.bsky.feed.generator/b",
        displayName: "Feed B",
        creatorHandle: "creator-b.bsky.social",
      });
      mockServer.addFeedGenerators([feedA, feedB]);
      mockServer.setPinnedFeeds([feedA.uri, feedB.uri]);
      await mockServer.setup(page);
      await login(page);
      await page.goto("/feeds");

      const feedsView = page.locator("#feeds-view");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });

      await feedsView.locator('[data-testid="feeds-edit-button"]').click();

      const followingRow = feedsView.locator(
        '[data-testid="feeds-list-item-following"]',
      );
      const feedBRow = feedsView.locator(`[data-pinned-value="${feedB.uri}"]`);
      await dragRow(page, followingRow, feedBRow);

      await page.goto("/settings");
      await page.goto("/feeds");
      await expect(feedsView.locator(".feeds-list-item")).toHaveCount(3, {
        timeout: 10000,
      });
      const titlesAfterReturn = await feedsView
        .locator(".feeds-list-item-title")
        .allTextContents();
      expect(titlesAfterReturn).toEqual(["Following", "Feed A", "Feed B"]);
      await expect(
        feedsView.locator('[data-testid="feeds-edit-button"]'),
      ).toBeVisible();
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/feeds");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
