import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createList, createProfile } from "../../factories.js";

const otherUser = createProfile({
  did: "did:plc:otheruser1",
  handle: "otheruser.bsky.social",
  displayName: "Other User",
  followersCount: 1,
  followsCount: 1,
  postsCount: 1,
});

const LIST_RKEY = "mylist";
const LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/${LIST_RKEY}`;
const LIST_PATH = `/profile/${userProfile.handle}/lists/${LIST_RKEY}`;

function setupList(mockServer) {
  const list = createList({
    uri: LIST_URI,
    name: "Cool People",
    creatorHandle: userProfile.handle,
  });
  mockServer.addLists([list]);
  mockServer.addActorLists(userProfile.did, [list]);
  return list;
}

async function openAddToListsDialog(page) {
  const profileView = page.locator("#profile-view");
  await expect(
    profileView.locator('[data-testid="profile-name"]'),
  ).toContainText("Other User", { timeout: 10000 });
  await profileView.locator(".ellipsis-button").click();
  await page
    .locator('[data-testid="menu-action-profile-add-to-lists"]')
    .click();
  return page.locator('[data-testid="add-to-lists-dialog"]');
}

test.describe("Add profile to list → List Detail flow", () => {
  test("adding a profile from a profile page updates the cached list detail view", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    setupList(mockServer);
    mockServer.addListMembers(LIST_URI, []);
    await mockServer.setup(page);

    await login(page);

    // Populate the in-memory $listMembers cache for the list.
    await page.goto(LIST_PATH);
    const listView = page.locator("#list-detail-view");
    await expect(
      listView.locator('[data-testid="list-detail-name"]'),
    ).toContainText("Cool People", { timeout: 10000 });
    await listView.locator('[data-testid="tab-people"]').click();
    await expect(
      listView.locator('[data-testid="list-tab-content"]'),
    ).toHaveAttribute("data-teststate", "people");
    await expect(listView.locator(".profile-list-item")).toHaveCount(0, {
      timeout: 10000,
    });

    // Navigate (in-app) to the other user's profile and add them to the list.
    await page.evaluate(
      (path) => window.router.go(path),
      `/profile/${otherUser.did}`,
    );
    const dialog = await openAddToListsDialog(page);
    const toggle = dialog.locator(
      `[data-testid="add-to-lists-row"][data-list-uri="${LIST_URI}"] [data-testid="add-to-lists-toggle"]`,
    );
    await expect(toggle).toHaveAttribute("data-teststate", "not-member", {
      timeout: 5000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-teststate", "member");

    // Returning to the list detail page shows the cached, updated members.
    await page.evaluate((path) => window.router.go(path), LIST_PATH);
    await expect(
      listView.locator('[data-testid="list-detail-name"]'),
    ).toContainText("Cool People", { timeout: 10000 });
    await listView.locator('[data-testid="tab-people"]').click();
    await expect(listView.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(listView).toContainText("Other User");
  });

  test("loads additional list pages as the user scrolls the dialog", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);

    const TOTAL_LISTS = 60;
    const lists = Array.from({ length: TOTAL_LISTS }, (_, index) => {
      const rkey = `mylist${index}`;
      return createList({
        uri: `at://${userProfile.did}/app.bsky.graph.list/${rkey}`,
        name: `List ${index}`,
        creatorHandle: userProfile.handle,
      });
    });
    mockServer.addLists(lists);
    mockServer.addActorLists(userProfile.did, lists);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const dialog = await openAddToListsDialog(page);
    const rows = dialog.locator('[data-testid="add-to-lists-row"]');

    // First page is 50 lists (the default limit).
    await expect(rows).toHaveCount(50, { timeout: 5000 });
    await expect(
      dialog.locator('[data-testid="add-to-lists-loading-more"]'),
    ).toBeVisible();

    // Scrolling the dialog list to the bottom triggers the next page.
    await dialog.locator(".add-to-lists-dialog-rows").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(rows).toHaveCount(TOTAL_LISTS, { timeout: 5000 });
    await expect(
      dialog.locator('[data-testid="add-to-lists-loading-more"]'),
    ).toHaveCount(0);
  });

  test("removing a profile from a list updates the cached list detail view", async ({
    page,
  }) => {
    const existingMembershipUri = `at://${userProfile.did}/app.bsky.graph.listitem/existing`;
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    setupList(mockServer);
    mockServer.addListMembers(LIST_URI, [otherUser]);
    mockServer.addCurrentUserListItem({
      uri: existingMembershipUri,
      listUri: LIST_URI,
      subjectDid: otherUser.did,
    });
    await mockServer.setup(page);

    await login(page);

    // Populate the in-memory $listMembers cache for the list.
    await page.goto(LIST_PATH);
    const listView = page.locator("#list-detail-view");
    await expect(
      listView.locator('[data-testid="list-detail-name"]'),
    ).toContainText("Cool People", { timeout: 10000 });
    await listView.locator('[data-testid="tab-people"]').click();
    await expect(listView.locator(".profile-list-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Navigate to the other user's profile and remove them from the list.
    await page.evaluate(
      (path) => window.router.go(path),
      `/profile/${otherUser.did}`,
    );
    const dialog = await openAddToListsDialog(page);
    const toggle = dialog.locator(
      `[data-testid="add-to-lists-row"][data-list-uri="${LIST_URI}"] [data-testid="add-to-lists-toggle"]`,
    );
    await expect(toggle).toHaveAttribute("data-teststate", "member", {
      timeout: 5000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-teststate", "not-member");

    // Returning to the list detail page shows the cached, updated members.
    await page.evaluate((path) => window.router.go(path), LIST_PATH);
    await expect(
      listView.locator('[data-testid="list-detail-name"]'),
    ).toContainText("Cool People", { timeout: 10000 });
    await listView.locator('[data-testid="tab-people"]').click();
    await expect(listView.locator(".profile-list-item")).toHaveCount(0, {
      timeout: 10000,
    });
  });
});
