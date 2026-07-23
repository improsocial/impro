import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createList } from "../../../shared/factories.js";

test.describe("Profile → List Detail → delete flow", () => {
  test("deleting a list from the list detail view removes it from the profile's Lists tab", async ({
    page,
  }) => {
    const profileWithLists = {
      ...userProfile,
      associated: { lists: 2 },
    };
    const listToDelete = createList({
      uri: `at://${userProfile.did}/app.bsky.graph.list/todelete`,
      name: "Doomed List",
      creatorHandle: userProfile.handle,
    });
    const listToKeep = createList({
      uri: `at://${userProfile.did}/app.bsky.graph.list/tokeep`,
      name: "Kept List",
      creatorHandle: userProfile.handle,
    });

    const mockServer = new MockServer();
    mockServer.addProfile(profileWithLists);
    mockServer.addActorLists(userProfile.did, [listToDelete, listToKeep]);
    mockServer.addLists([listToDelete, listToKeep]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}`);

    const profileView = page.locator("#profile-view");
    const tabBar = profileView.locator("tab-bar");
    await expect(tabBar.locator('[data-testid="tab-lists"]')).toBeVisible({
      timeout: 10000,
    });
    await tabBar.locator('[data-testid="tab-lists"]').click();

    const feedsList = profileView.locator(
      ".feed-container:not([hidden]) .feeds-list",
    );
    await expect(feedsList.locator(".feeds-list-item")).toHaveCount(2, {
      timeout: 10000,
    });

    await feedsList
      .locator(".feeds-list-item", { hasText: "Doomed List" })
      .click();

    await expect(page).toHaveURL(
      `/profile/${userProfile.handle}/lists/todelete`,
      { timeout: 10000 },
    );

    const listView = page.locator("#list-detail-view");
    await expect(
      listView.locator('[data-testid="list-detail-name"]'),
    ).toContainText("Doomed List", { timeout: 10000 });

    await listView.locator(".context-menu-button").click();
    await listView.locator('[data-testid="menu-action-list-delete"]').click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page).toHaveURL(`/profile/${userProfile.handle}`, {
      timeout: 10000,
    });

    const restoredFeedsList = profileView.locator(
      ".feed-container:not([hidden]) .feeds-list",
    );
    await expect(restoredFeedsList.locator(".feeds-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(restoredFeedsList).toContainText("Kept List");
    await expect(restoredFeedsList).not.toContainText("Doomed List");
  });
});
