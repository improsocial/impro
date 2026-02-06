import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

test.describe("New chat from profile flow", () => {
  test("should start a new conversation from a profile, send a message, and verify it appears in chat list", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    mockServer.addProfile({ ...alice, canChat: true });
    await mockServer.setup(page);

    await login(page);

    // Navigate to Alice's profile
    await page.goto(`/profile/${alice.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Alice", { timeout: 10000 });

    // Wait for chat button to become enabled (after getConvoAvailability loads)
    const chatButton = profileView.locator('[data-testid="chat-button"]');
    await expect(chatButton).toBeVisible({ timeout: 10000 });
    await expect(chatButton).toBeEnabled({ timeout: 10000 });

    // Click the chat button to start a conversation
    await chatButton.click();

    // Should navigate to the chat detail view
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });

    // Send a message
    await chatDetailView.locator(".message-input-field").fill("Hi Alice!");
    await chatDetailView.locator(".message-input-send-button").click();

    // Wait for the sent message to appear
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Hi Alice!",
      { timeout: 10000 },
    );

    // Navigate to the chat list
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Verify the conversation with Alice appears
    await expect(chatView.locator(".convo-name")).toContainText("Alice");
  });
});
