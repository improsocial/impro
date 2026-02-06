import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";
import { userProfile } from "../../fixtures.js";

test.describe("Chat detail view", () => {
  test("should display other user's name in header and their messages", async ({
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
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
    await expect(
      chatDetailView.locator('[data-testid="header-subtitle"]'),
    ).toContainText("@alice.bsky.social");

    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Hey there!",
    );
  });

  test("should display messages from both users", async ({ page }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
    });
    const messages = [
      createMessage({
        id: "msg-2",
        text: "I'm good, thanks!",
        senderDid: userProfile.did,
        sentAt: "2025-01-15T12:01:00.000Z",
      }),
      createMessage({
        id: "msg-1",
        text: "How are you?",
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
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(chatDetailView).toContainText("How are you?");
    await expect(chatDetailView).toContainText("I'm good, thanks!");

    // Check message alignment: Alice's message should be "received", test user's "sent"
    await expect(chatDetailView.locator(".message-received")).toHaveCount(1);
    await expect(chatDetailView.locator(".message-sent")).toHaveCount(1);
  });

  test("should send a message and display it", async ({ page }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });

    await chatDetailView.locator(".message-input-field").fill("Hey Alice!");
    await chatDetailView.locator(".message-input-send-button").click();

    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Hey Alice!",
    );
    await expect(chatDetailView.locator(".message-sent")).toHaveCount(1);
  });

  test("should navigate back to chat list when clicking back", async ({
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
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");
    await page.locator("#chat-view .convo-item").first().click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });

    await chatDetailView.locator('[data-testid="back-button"]').click();

    await expect(
      page.locator('#chat-view [data-testid="header-title"]'),
    ).toContainText("Chats", { timeout: 10000 });
  });

  test("should show empty state when there are no messages", async ({
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
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", []);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
    await expect(chatDetailView.locator(".chat-detail-empty")).toContainText(
      "No messages yet!",
      { timeout: 10000 },
    );
  });
});
