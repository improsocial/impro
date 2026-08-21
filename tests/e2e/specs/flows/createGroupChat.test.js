import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

test.describe("Create group chat flow", () => {
  function createGroupableProfile({ did, handle, displayName }) {
    return createProfile({
      did,
      handle,
      displayName,
      associated: { chat: { allowIncoming: "all", allowGroupInvites: "all" } },
    });
  }

  function makeMembers() {
    return [
      createGroupableProfile({
        did: "did:plc:alice1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
      createGroupableProfile({
        did: "did:plc:bob1",
        handle: "bob.bsky.social",
        displayName: "Bob",
      }),
    ];
  }

  async function openMemberStep(page) {
    await page.goto("/messages");
    await page.locator('#chat-view [data-testid="new-chat-button"]').click();
    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const groupButton = dialog.locator(
      '[data-testid="new-chat-new-group-button"]',
    );
    await expect(groupButton).toBeVisible({ timeout: 10000 });
    await groupButton.click();
    return dialog;
  }

  async function selectMemberByName(dialog, name) {
    const row = dialog
      .locator('[data-testid="profile-list-item-button"]')
      .filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
  }

  test("should create a named group and land in the new conversation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const [alice, bob] = makeMembers();
    mockServer.addProfile(alice);
    mockServer.addProfile(bob);
    mockServer.addProfileFollows(userProfile.did, [alice, bob]);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openMemberStep(page);

    await selectMemberByName(dialog, "Alice");
    await expect(
      dialog.locator('[data-testid="new-group-member-chip"]'),
    ).toHaveCount(1);
    await selectMemberByName(dialog, "Bob");
    await expect(
      dialog.locator('[data-testid="new-group-member-chip"]'),
    ).toHaveCount(2);

    await dialog.locator('[data-testid="new-group-next-button"]').click();
    await dialog
      .locator('[data-testid="new-group-name-input"]')
      .fill("Trip planning");
    await dialog.locator('[data-testid="new-group-create-button"]').click();

    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/messages\/convo-group-/, {
      timeout: 10000,
    });
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Trip planning", { timeout: 10000 });

    expect(mockServer.createGroupRequests).toEqual([
      { name: "Trip planning", members: ["did:plc:alice1", "did:plc:bob1"] },
    ]);

    // Back-navigation restores the chat list from memory without refetching,
    // so the new group must already be in the in-memory convo list
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(page.locator("#chat-view .convo-name")).toContainText(
      "Trip planning",
      { timeout: 10000 },
    );
  });

  test("should keep the dialog state and show a toast when the create fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const [alice] = makeMembers();
    mockServer.addProfile(alice);
    mockServer.addProfileFollows(userProfile.did, [alice]);
    mockServer.setCreateGroupError("UserForbidsGroups");
    await mockServer.setup(page);

    await login(page);
    const dialog = await openMemberStep(page);

    await selectMemberByName(dialog, "Alice");
    await dialog.locator('[data-testid="new-group-next-button"]').click();
    await dialog.locator('[data-testid="new-group-name-input"]').fill("Trip");
    await dialog.locator('[data-testid="new-group-create-button"]').click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "One of the selected recipients does not allow group chats.",
      { timeout: 10000 },
    );
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-testid="new-group-name-input"]'),
    ).toHaveValue("Trip");
    await expect(page).toHaveURL(/\/messages$/);
  });

  test("should make further selection impossible at the member cap", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const [alice, bob] = makeMembers();
    const carol = createGroupableProfile({
      did: "did:plc:carol1",
      handle: "carol.bsky.social",
      displayName: "Carol",
    });
    mockServer.addProfileFollows(userProfile.did, [alice, bob, carol]);
    mockServer.setChatActorStatus({ groupMemberLimit: 3 });
    await mockServer.setup(page);

    await login(page);
    const dialog = await openMemberStep(page);

    await selectMemberByName(dialog, "Alice");
    await selectMemberByName(dialog, "Bob");

    const carolRow = dialog
      .locator('[data-testid="profile-list-item-button"]')
      .filter({ hasText: "Carol" });
    await expect(carolRow).toHaveAttribute("data-teststate", "disabled");
    await expect(carolRow).toBeDisabled();
    await expect(
      dialog.locator('[data-testid="new-group-member-chip"]'),
    ).toHaveCount(2);
  });

  test("should dim the group row and alert instead of advancing for too-new accounts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.setChatActorStatus({ canCreateGroups: false });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");
    await page.locator('#chat-view [data-testid="new-chat-button"]').click();
    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const groupButton = dialog.locator(
      '[data-testid="new-chat-new-group-button"]',
    );
    await expect(groupButton).toHaveClass(/is-disabled/, { timeout: 10000 });
    await groupButton.click();

    const alertModal = page.locator('[data-testid="alert-modal"]');
    await expect(alertModal).toBeVisible({ timeout: 10000 });
    await expect(
      alertModal.locator('[data-testid="modal-title"]'),
    ).toContainText("Your account is too new");
    await expect(
      dialog.locator('[data-testid="new-group-back-button"]'),
    ).toHaveCount(0);
  });
});
