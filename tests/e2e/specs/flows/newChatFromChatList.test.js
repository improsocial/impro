import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

test.describe("New chat from chat list flow", () => {
  function createMessageableProfile() {
    return createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
      associated: { chat: { allowIncoming: "all" } },
    });
  }

  async function openNewChatDialog(page) {
    await page.goto("/messages");
    const newChatButton = page.locator(
      '#chat-view [data-testid="new-chat-button"]',
    );
    await expect(newChatButton).toBeVisible({ timeout: 10000 });
    await newChatButton.click();
    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    return dialog;
  }

  test("should search for a user, start a chat, and land on the conversation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    mockServer.addProfile(alice);
    mockServer.addTypeaheadProfiles([alice]);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openNewChatDialog(page);

    await dialog.locator('[data-testid="new-chat-search-input"]').fill("ali");

    const result = dialog.locator('[data-testid="new-chat-result"]');
    await expect(result).toHaveCount(1, { timeout: 10000 });
    await expect(result).toHaveAttribute("data-teststate", "messageable");
    await expect(result).toContainText("Alice");
    await result.click();

    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/messages\/convo-new-/, {
      timeout: 10000,
    });
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
  });

  test("should show the new conversation in the chat list after navigating back", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    mockServer.addProfile(alice);
    mockServer.addTypeaheadProfiles([alice]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");
    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".feed-end-message")).toContainText(
      "No conversations yet!",
      { timeout: 10000 },
    );
    await expect(chatView.locator(".convo-item")).toHaveCount(0);

    await chatView.locator('[data-testid="new-chat-button"]').click();
    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.locator('[data-testid="new-chat-search-input"]').fill("ali");
    const result = dialog.locator('[data-testid="new-chat-result"]');
    await expect(result).toHaveCount(1, { timeout: 10000 });
    await result.click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });

    // Back-navigation restores the chat list from memory without refetching,
    // so the new conversation must already be in the in-memory convo list
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-name")).toContainText("Alice");
  });

  test("should show suggested follows when the dialog opens and start a chat from one", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    mockServer.addProfile(alice);
    mockServer.addProfileFollows(userProfile.did, [alice]);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openNewChatDialog(page);

    await expect(
      dialog.locator('[data-testid="new-chat-suggested-header"]'),
    ).toBeVisible({ timeout: 10000 });
    const result = dialog.locator('[data-testid="new-chat-result"]');
    await expect(result).toHaveCount(1, { timeout: 10000 });
    await expect(result).toContainText("Alice");
    await result.click();

    await expect(page).toHaveURL(/\/messages\/convo-new-/, {
      timeout: 10000,
    });
  });

  test("should show non-messageable users as disabled rows", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    const bob = createProfile({
      did: "did:plc:bob1",
      handle: "bob.bsky.social",
      displayName: "Bob",
      associated: { chat: { allowIncoming: "none" } },
    });
    mockServer.addTypeaheadProfiles([bob, alice]);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openNewChatDialog(page);

    await dialog.locator('[data-testid="new-chat-search-input"]').fill("b");

    const results = dialog.locator('[data-testid="new-chat-result"]');
    await expect(results).toHaveCount(2, { timeout: 10000 });
    // Messageable profiles sort first
    await expect(results.nth(0)).toHaveAttribute(
      "data-teststate",
      "messageable",
    );
    await expect(results.nth(1)).toHaveAttribute(
      "data-teststate",
      "not-messageable",
    );
    await expect(results.nth(1)).toBeDisabled();
    await expect(results.nth(1)).toContainText(
      "@bob.bsky.social can't be messaged",
    );
  });

  test("should show an error toast and stay on the chat list when the server rejects the chat", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    mockServer.addProfile(alice);
    mockServer.addTypeaheadProfiles([alice]);
    mockServer.setConvoForMembersError("BlockedActor");
    await mockServer.setup(page);

    await login(page);
    const dialog = await openNewChatDialog(page);

    await dialog.locator('[data-testid="new-chat-search-input"]').fill("ali");

    const result = dialog.locator('[data-testid="new-chat-result"]');
    await expect(result).toHaveCount(1, { timeout: 10000 });
    await result.click();

    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toContainText(
      "This user has blocked you and cannot be messaged.",
      { timeout: 10000 },
    );
    await expect(page).toHaveURL(/\/messages$/);
  });
});
