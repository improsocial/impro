import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createProfile, createStarterPack } from "../../../shared/factories.js";

const PACK_URI = `at://${userProfile.did}/app.bsky.graph.starterpack/doomed`;
const LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/doomed`;

test.describe("Starter pack delete flow", () => {
  test("deletes the pack with its list and items, then returns to the profile", async ({
    page,
  }) => {
    const member = createProfile({
      did: "did:plc:member1",
      handle: "member1.bsky.social",
      displayName: "Member One",
    });
    const starterPack = createStarterPack({
      uri: PACK_URI,
      name: "Doomed Pack",
      creatorHandle: userProfile.handle,
      list: true,
    });
    const mockServer = new MockServer();
    mockServer.addProfile({ ...userProfile, associated: { starterPacks: 1 } });
    mockServer.addProfile(member);
    mockServer.addStarterPacks([starterPack]);
    mockServer.addActorStarterPacks(userProfile.did, [starterPack]);
    mockServer.addLists([starterPack.list]);
    mockServer.addListMembers(LIST_URI, [member]);
    mockServer.addCurrentUserListItem({
      uri: `at://${userProfile.did}/app.bsky.graph.listitem/item1`,
      listUri: LIST_URI,
      subjectDid: member.did,
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}`);
    const profileView = page.locator("#profile-view");
    const tab = profileView.locator('[data-testid="tab-starter-packs"]');
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    const packItem = profileView.locator(
      '.feed-container:not([hidden]) [data-testid="starter-pack-list-item"]',
    );
    await expect(packItem).toHaveCount(1, { timeout: 10000 });
    await packItem.click();

    const detail = page.locator("#starter-pack-detail-view");
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("Doomed Pack", { timeout: 10000 });
    await detail.locator(".context-menu-button").click();
    await detail
      .locator('[data-testid="menu-action-starter-pack-delete"]')
      .click();
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page).toHaveURL(`/profile/${userProfile.handle}`, {
      timeout: 10000,
    });
    await expect(
      profileView.locator(
        '.feed-container:not([hidden]) [data-testid="starter-pack-list-item"]',
      ),
    ).toHaveCount(0, { timeout: 10000 });
    await expect(
      profileView.locator(
        '.feed-container:not([hidden]) [data-testid="empty-state"]',
      ),
    ).toBeVisible();

    const writes = mockServer.applyWritesCalls.flat();
    expect(writes.map((write) => [write.collection, write.rkey])).toEqual([
      ["app.bsky.graph.listitem", "item1"],
      ["app.bsky.graph.list", "doomed"],
      ["app.bsky.graph.starterpack", "doomed"],
    ]);
  });
});
