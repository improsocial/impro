import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

test.describe("New chat message flow", () => {
  test("should reorder conversations when a new message is sent", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const bob = createProfile({
      did: "did:plc:bob1",
      handle: "bob.bsky.social",
      displayName: "Bob",
    });

    // Bob has the newer message, so he should appear first initially
    const aliceConvo = createConvo({
      id: "convo-alice",
      otherMember: alice,
      lastMessage: createMessage({
        id: "msg-alice",
        text: "Old message from Alice",
        senderDid: alice.did,
        sentAt: "2025-01-10T12:00:00.000Z",
      }),
    });
    const bobConvo = createConvo({
      id: "convo-bob",
      otherMember: bob,
      lastMessage: createMessage({
        id: "msg-bob",
        text: "Recent message from Bob",
        senderDid: bob.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    });

    mockServer.addConvos([aliceConvo, bobConvo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(2, {
      timeout: 10000,
    });

    // Verify initial order: Bob first (newer message), Alice second
    const convoNames = chatView.locator(".convo-name");
    await expect(convoNames.nth(0)).toContainText("Bob");
    await expect(convoNames.nth(1)).toContainText("Alice");

    // Click on Alice's conversation (second in the list)
    await chatView.locator(".convo-item").nth(1).click();

    // Wait for chat detail to load
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });

    // Type and send a message
    await chatDetailView.locator(".message-input-field").fill("Hello Alice!");
    await chatDetailView.locator(".message-input-send-button").click();

    // Wait for the sent message to appear
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Hello Alice!",
      { timeout: 10000 },
    );

    // Navigate back to chat list
    await page.goto("/messages");

    // Verify new order: Alice first (most recent message), Bob second
    await expect(chatView.locator(".convo-item")).toHaveCount(2, {
      timeout: 10000,
    });
    const updatedNames = chatView.locator(".convo-name");
    await expect(updatedNames.nth(0)).toContainText("Alice");
    await expect(updatedNames.nth(1)).toContainText("Bob");
  });
});
