import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createList } from "../../../shared/factories.js";

test.describe("Lists view", () => {
  test("should display header and the current user's lists", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const list1 = createList({
      uri: `at://${userProfile.did}/app.bsky.graph.list/list1`,
      name: "My Curated List",
      creatorHandle: userProfile.handle,
    });
    const list2 = createList({
      uri: `at://${userProfile.did}/app.bsky.graph.list/list2`,
      name: "Other List",
      creatorHandle: userProfile.handle,
    });
    mockServer.addLists([list1, list2]);
    mockServer.addActorLists(userProfile.did, [list1, list2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/lists");

    const listsView = page.locator("#lists-view");
    await expect(
      listsView.locator('[data-testid="header-title"]'),
    ).toContainText("Lists", { timeout: 10000 });

    await expect(
      listsView.locator('[data-testid="feeds-list-item-list"]'),
    ).toHaveCount(2, { timeout: 10000 });

    await expect(listsView).toContainText("My Curated List");
    await expect(listsView).toContainText("Other List");
  });

  test("should show an empty state when the user has no lists", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/lists");

    const listsView = page.locator("#lists-view");
    await expect(
      listsView.locator('[data-testid="header-title"]'),
    ).toContainText("Lists", { timeout: 10000 });
    await expect(listsView).toContainText("No lists.", { timeout: 10000 });
  });

  test("should navigate to list detail when clicking a list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const list = createList({
      uri: `at://${userProfile.did}/app.bsky.graph.list/mylist`,
      name: "My Curated List",
      creatorHandle: userProfile.handle,
    });
    mockServer.addLists([list]);
    mockServer.addActorLists(userProfile.did, [list]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/lists");

    const listsView = page.locator("#lists-view");
    await expect(
      listsView.locator('[data-testid="feeds-list-item-list"]'),
    ).toHaveCount(1, { timeout: 10000 });

    await listsView.locator('[data-testid="feeds-list-item-list"]').click();

    await expect(page).toHaveURL(
      `/profile/${userProfile.handle}/lists/mylist`,
      { timeout: 10000 },
    );
  });

  test("should create a new list and navigate to its detail page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/lists");

    const listsView = page.locator("#lists-view");
    const newButton = listsView.locator('[data-testid="new-list-button"]');
    await expect(newButton).toBeVisible({ timeout: 10000 });
    await newButton.click();

    const dialog = page.locator("create-list-dialog");
    await expect(
      dialog.locator('[data-testid="create-list-purpose"]'),
    ).toBeVisible();

    await dialog
      .locator('[data-testid="create-list-name"]')
      .fill("My New List");
    await dialog.locator('[data-testid="create-list-save-button"]').click();

    await expect(page).toHaveURL(
      new RegExp(`/profile/${userProfile.handle}/lists/rkey-\\d+$`),
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      const loggedOutMockServer = new MockServer();
      await loggedOutMockServer.setup(page);

      await page.goto("/lists");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
