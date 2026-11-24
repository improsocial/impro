import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createList, createPost } from "../../../shared/factories.js";

test.describe("Feeds → List Detail flow", () => {
  test("clicking a pinned list opens its detail view", async ({ page }) => {
    const mockServer = new MockServer();
    const list = createList({
      uri: "at://did:plc:creator1/app.bsky.graph.list/mylist",
      name: "My Curated List",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addLists([list]);
    mockServer.setPinnedLists([list.uri]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    await expect(
      feedsView.locator('[data-testid="feeds-list-item-list"]'),
    ).toBeVisible({ timeout: 10000 });

    await feedsView.locator('[data-testid="feeds-list-item-list"]').click();

    await expect(page).toHaveURL("/profile/creator1.bsky.social/lists/mylist", {
      timeout: 10000,
    });

    const view = page.locator("#list-detail-view");
    await expect(
      view.locator('[data-testid="list-detail-name"]'),
    ).toContainText("My Curated List", { timeout: 10000 });
  });

  test("reopening a list shows its cached feed without refetching", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const list = createList({
      uri: "at://did:plc:creator1/app.bsky.graph.list/mylist",
      name: "My Curated List",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addLists([list]);
    mockServer.setPinnedLists([list.uri]);
    mockServer.addListFeedItems(list.uri, [
      createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/listpost",
        text: "Post from the list",
        authorHandle: "author1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    let getListFeedRequests = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/app.bsky.feed.getListFeed")) {
        getListFeedRequests++;
      }
    });

    await login(page);
    await page.goto("/feeds");

    const feedsView = page.locator("#feeds-view");
    const listItem = feedsView.locator('[data-testid="feeds-list-item-list"]');
    const listView = page.locator("#list-detail-view");

    await listItem.click();
    await expect(listView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    expect(getListFeedRequests).toBe(1);

    await page.goBack();
    await expect(feedsView).toBeVisible();
    await listItem.click();
    await expect(page).toHaveURL("/profile/creator1.bsky.social/lists/mylist");
    await expect(listView.locator('[data-testid="feed-item"]')).toHaveCount(1);
    await page.waitForLoadState("networkidle");
    expect(getListFeedRequests).toBe(1);
  });
});
