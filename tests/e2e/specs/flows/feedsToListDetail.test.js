import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createList } from "../../factories.js";

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
});
