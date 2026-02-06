import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";
import { userProfile } from "../../fixtures.js";

test.describe("Chat reaction persistence flow", () => {
  test("should add a reaction in chat detail, navigate away, return, and verify it persists", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
      lastMessage: createMessage({
        id: "msg-1",
        text: "Hey there!",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    });
    const messages = [
      createMessage({
        id: "msg-1",
        text: "Hey there!",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    ];
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", messages);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const messageBubble = chatDetailView.locator(".message-bubble");
    await expect(messageBubble).toHaveCount(1, { timeout: 10000 });

    // Long-press to open reaction palette
    const messageEl = chatDetailView.locator(".message").first();
    const box = await messageEl.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    // Reaction palette should appear
    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });

    // Click the thumbs up emoji
    await chatDetailView.locator(".reaction-palette-button").first().click();

    // Reaction bubble should appear
    await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(chatDetailView.locator(".reaction-emoji")).toContainText("👍");

    // Navigate away to the chat list
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Navigate back to the conversation
    await chatView.locator(".convo-item").first().click();

    // Wait for the chat detail to load
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });

    // Verify the reaction persists
    await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(chatDetailView.locator(".reaction-emoji")).toContainText("👍");
  });
});
