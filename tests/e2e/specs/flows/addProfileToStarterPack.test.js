import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";
import { createProfile, createStarterPack } from "../../../shared/factories.js";

const otherUser = createProfile({
  did: "did:plc:otheruser1",
  handle: "otheruser.bsky.social",
  displayName: "Other User",
  followersCount: 1,
  followsCount: 1,
  postsCount: 1,
});

const PACK_RKEY = "mypack";
const PACK_URI = `at://${userProfile.did}/app.bsky.graph.starterpack/${PACK_RKEY}`;
const PACK_LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/${PACK_RKEY}`;
const PACK_PATH = `/profile/${userProfile.handle}/starter-pack/${PACK_RKEY}`;

function setupStarterPack(mockServer) {
  const starterPack = createStarterPack({
    uri: PACK_URI,
    name: "Cool Pack",
    creatorHandle: userProfile.handle,
    list: true,
  });
  mockServer.addStarterPacks([starterPack]);
  mockServer.addActorStarterPacks(userProfile.did, [starterPack]);
  return starterPack;
}

async function openAddToStarterPacksDialog(page) {
  const profileView = page.locator("#profile-view");
  await expect(
    profileView.locator('[data-testid="profile-name"]'),
  ).toContainText("Other User", { timeout: 10000 });
  await profileView.locator(".ellipsis-button").click();
  await page
    .locator('[data-testid="menu-action-profile-add-to-starter-packs"]')
    .click();
  return page.locator('[data-testid="add-to-starter-packs-dialog"]');
}

async function expectPackMembers(page, count) {
  const packView = page.locator("#starter-pack-detail-view");
  await expect(
    packView.locator('[data-testid="starter-pack-name"]'),
  ).toBeVisible({ timeout: 10000 });
  await expect(packView.locator(".profile-list-item")).toHaveCount(count, {
    timeout: 10000,
  });
  return packView;
}

async function returnToPack(page, count) {
  await page.evaluate((path) => window.router.go(path), PACK_PATH);
  return expectPackMembers(page, count);
}

test.describe("Add profile to starter pack → Starter Pack Detail flow", () => {
  test("adding a profile writes a list item and updates the cached starter pack members", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    setupStarterPack(mockServer);
    mockServer.addListMembers(PACK_LIST_URI, []);
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);
    await expectPackMembers(page, 0);

    const createRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/xrpc/com.atproto.repo.createRecord")) {
        createRequests.push(request.postDataJSON());
      }
    });

    await page.evaluate(
      (path) => window.router.go(path),
      `/profile/${otherUser.did}`,
    );
    const dialog = await openAddToStarterPacksDialog(page);
    const toggle = dialog.locator(
      `[data-testid="add-to-starter-packs-row"][data-uri="${PACK_URI}"] [data-testid="add-to-starter-packs-toggle"]`,
    );
    await expect(toggle).toHaveAttribute("data-teststate", "not-member", {
      timeout: 5000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-teststate", "member");

    expect(createRequests).toHaveLength(1);
    expect(createRequests[0].collection).toBe("app.bsky.graph.listitem");
    expect(createRequests[0].record.list).toBe(PACK_LIST_URI);
    expect(createRequests[0].record.subject).toBe(otherUser.did);

    const packView = await returnToPack(page, 1);
    await expect(packView).toContainText("Other User");
  });

  test("removing a profile deletes the list item and updates the cached starter pack members", async ({
    page,
  }) => {
    const existingMembershipUri = `at://${userProfile.did}/app.bsky.graph.listitem/existing`;
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    setupStarterPack(mockServer);
    mockServer.addListMembers(PACK_LIST_URI, [otherUser]);
    mockServer.addCurrentUserListItem({
      uri: existingMembershipUri,
      listUri: PACK_LIST_URI,
      subjectDid: otherUser.did,
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);
    await expectPackMembers(page, 1);

    const deleteRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/xrpc/com.atproto.repo.deleteRecord")) {
        deleteRequests.push(request.postDataJSON());
      }
    });

    await page.evaluate(
      (path) => window.router.go(path),
      `/profile/${otherUser.did}`,
    );
    const dialog = await openAddToStarterPacksDialog(page);
    const toggle = dialog.locator(
      `[data-testid="add-to-starter-packs-row"][data-uri="${PACK_URI}"] [data-testid="add-to-starter-packs-toggle"]`,
    );
    await expect(toggle).toHaveAttribute("data-teststate", "member", {
      timeout: 5000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-teststate", "not-member");

    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0].collection).toBe("app.bsky.graph.listitem");
    expect(deleteRequests[0].rkey).toBe("existing");

    await returnToPack(page, 0);
  });

  test("shows an empty state when the viewer has no starter packs", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    const dialog = await openAddToStarterPacksDialog(page);
    await expect(
      dialog.locator('[data-testid="add-to-starter-packs-empty"]'),
    ).toBeVisible({ timeout: 5000 });
  });
});
