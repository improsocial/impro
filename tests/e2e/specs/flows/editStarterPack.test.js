import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createProfile, createStarterPack } from "../../../shared/factories.js";

const PACK_URI = `at://${userProfile.did}/app.bsky.graph.starterpack/mine`;
const LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/mine`;
const PACK_PATH = `/profile/${userProfile.handle}/starter-pack/mine`;

function makeMembers(count) {
  return Array.from({ length: count }, (_, i) =>
    createProfile({
      did: `did:plc:member${i}`,
      handle: `member${i}.bsky.social`,
      displayName: `Member ${i}`,
    }),
  );
}

test.describe("Starter pack edit flow", () => {
  test("renames the pack, removes a member and rewrites both records", async ({
    page,
  }) => {
    const members = makeMembers(9);
    const starterPack = createStarterPack({
      uri: PACK_URI,
      name: "My Pack",
      creatorHandle: userProfile.handle,
      description: "Before",
      list: true,
    });
    const mockServer = new MockServer();
    mockServer.addProfile(userProfile);
    for (const profile of members) mockServer.addProfile(profile);
    mockServer.addStarterPacks([starterPack]);
    mockServer.addLists([starterPack.list]);
    mockServer.addListMembers(LIST_URI, [userProfile, ...members]);
    mockServer.addCurrentUserListItem({
      uri: `at://${userProfile.did}/app.bsky.graph.listitem/self`,
      listUri: LIST_URI,
      subjectDid: userProfile.did,
    });
    for (const member of members) {
      mockServer.addCurrentUserListItem({
        uri: `at://${userProfile.did}/app.bsky.graph.listitem/${member.did.split(":").pop()}`,
        listUri: LIST_URI,
        subjectDid: member.did,
      });
    }
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);
    const detail = page.locator("#starter-pack-detail-view");
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("My Pack", { timeout: 10000 });

    await detail.locator(".context-menu-button").click();
    await detail
      .locator('[data-testid="menu-action-starter-pack-edit"]')
      .click();

    const wizard = page.locator('[data-testid="starter-pack-wizard"]');
    await expect(wizard).toHaveAttribute("data-teststate", "details", {
      timeout: 10000,
    });
    const nameInput = wizard.locator('[data-testid="starter-pack-name-input"]');
    await expect(nameInput).toHaveValue("My Pack");
    await nameInput.fill("Renamed Pack");
    await wizard.locator('[data-testid="starter-pack-wizard-next"]').click();
    await expect(wizard).toHaveAttribute("data-teststate", "profiles");
    await expect(
      wizard.locator('[data-testid="starter-pack-wizard-count"]'),
    ).toHaveText("10/150");

    await wizard
      .locator('[data-testid="starter-pack-wizard-edit-selection"]')
      .click();
    await expect(wizard).toHaveAttribute("data-teststate", "review");
    const removeButtons = wizard.locator(
      '[data-testid="starter-pack-review-remove"]',
    );
    await expect(removeButtons).toHaveCount(9);
    await removeButtons.first().click();
    await expect(removeButtons).toHaveCount(8);
    await wizard
      .locator('[data-testid="starter-pack-wizard-review-close"]')
      .click();

    const nextButton = wizard.locator(
      '[data-testid="starter-pack-wizard-next"]',
    );
    await nextButton.click();
    await expect(wizard).toHaveAttribute("data-teststate", "feeds");
    await expect(nextButton).toHaveText("Skip");
    await nextButton.click();

    await expect(wizard).toHaveCount(0, { timeout: 10000 });
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("Renamed Pack");

    const deletes = mockServer.applyWritesCalls
      .flat()
      .filter((write) => write.$type === "com.atproto.repo.applyWrites#delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].collection).toBe("app.bsky.graph.listitem");
    expect(
      mockServer.currentUserListItems.some((item) =>
        item.uri.endsWith(`/${deletes[0].rkey}`),
      ),
    ).toBe(false);

    const listPut = mockServer.putRecordCalls.find(
      (call) => call.collection === "app.bsky.graph.list",
    );
    expect(listPut.rkey).toBe("mine");
    expect(listPut.record.name).toBe("Renamed Pack");
    expect(listPut.swapRecord).toBeTruthy();
    const packPut = mockServer.putRecordCalls.find(
      (call) => call.collection === "app.bsky.graph.starterpack",
    );
    expect(packPut.rkey).toBe("mine");
    expect(packPut.record.name).toBe("Renamed Pack");
    expect(packPut.record.description).toBe("Before");
    expect(packPut.record.list).toBe(LIST_URI);
    expect(packPut.swapRecord).toBeTruthy();
  });

  test("does not open the editor when the members can't be loaded", async ({
    page,
  }) => {
    const starterPack = createStarterPack({
      uri: PACK_URI,
      name: "My Pack",
      creatorHandle: userProfile.handle,
      list: true,
    });
    const mockServer = new MockServer();
    mockServer.addProfile(userProfile);
    mockServer.addStarterPacks([starterPack]);
    mockServer.addLists([starterPack.list]);
    mockServer.addListMembers(LIST_URI, [userProfile, ...makeMembers(9)]);
    mockServer.failListMembers({ status: 500 });
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);
    const detail = page.locator("#starter-pack-detail-view");
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("My Pack", { timeout: 10000 });

    await detail.locator(".context-menu-button").click();
    await detail
      .locator('[data-testid="menu-action-starter-pack-edit"]')
      .click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator('[data-testid="starter-pack-wizard"]'),
    ).toHaveCount(0);
    expect(mockServer.applyWritesCalls).toHaveLength(0);
  });
});
