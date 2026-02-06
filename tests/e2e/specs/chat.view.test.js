import { test, expect } from "../base.js";
import { login } from "../helpers.js";
import { MockServer } from "../mockServer.js";
import { createConvo, createMessage, createProfile } from "../factories.js";

test.describe("Chat view", () => {
  test("should display Chats header and conversation list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherMember = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const lastMessage = createMessage({
      id: "msg-1",
      text: "Hey, how are you?",
      senderDid: otherMember.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    const convo = createConvo({
      id: "convo-1",
      otherMember,
      lastMessage,
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(
      chatView.locator('[data-testid="header-title"]'),
    ).toContainText("Chats", { timeout: 10000 });

    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-name")).toContainText("Alice");
    await expect(chatView.locator(".convo-handle")).toContainText(
      "@alice.bsky.social",
    );
    await expect(chatView.locator(".convo-preview")).toContainText(
      "Hey, how are you?",
    );
  });

  test("should display multiple conversations", async ({ page }) => {
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
    const convo1 = createConvo({
      id: "convo-1",
      otherMember: alice,
      lastMessage: createMessage({
        id: "msg-1",
        text: "Hello from Alice",
        senderDid: alice.did,
      }),
    });
    const convo2 = createConvo({
      id: "convo-2",
      otherMember: bob,
      lastMessage: createMessage({
        id: "msg-2",
        text: "Hello from Bob",
        senderDid: bob.did,
      }),
    });
    mockServer.addConvos([convo1, convo2]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(chatView).toContainText("Alice");
    await expect(chatView).toContainText("Bob");
  });

  test("should show chat requests banner when requests exist", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createProfile({
      did: "did:plc:requester1",
      handle: "requester.bsky.social",
      displayName: "Requester",
    });
    const requestConvo = createConvo({
      id: "convo-req-1",
      otherMember: requester,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-1",
        text: "Hi there!",
        senderDid: requester.did,
      }),
    });
    mockServer.addConvos([requestConvo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".chat-requests-banner")).toBeVisible({
      timeout: 10000,
    });
    await expect(chatView.locator(".chat-requests-title")).toContainText(
      "Chat requests",
    );
  });
});
