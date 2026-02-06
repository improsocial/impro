import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

test.describe("Leave conversation flow", () => {
  test("should reject a chat request and verify removal from chat list", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const requester = createProfile({
      did: "did:plc:requester1",
      handle: "requester.bsky.social",
      displayName: "Requester One",
    });

    // One accepted convo and one request
    const aliceConvo = createConvo({
      id: "convo-alice",
      otherMember: alice,
      lastMessage: createMessage({
        id: "msg-alice",
        text: "Hello from Alice",
        senderDid: alice.did,
      }),
    });
    const requestConvo = createConvo({
      id: "convo-req-1",
      otherMember: requester,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-1",
        text: "Hey, can we chat?",
        senderDid: requester.did,
      }),
    });

    mockServer.addConvos([aliceConvo, requestConvo]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to chat list — should see Alice's convo and the requests banner
    await page.goto("/messages");
    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-name")).toContainText("Alice");
    await expect(chatView.locator(".chat-requests-banner")).toBeVisible();

    // Navigate to chat requests
    await chatView.locator(".chat-requests-banner").click();

    const requestsView = page.locator("#chat-requests-view");
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Reject the request (which calls leaveConvo under the hood)
    await requestsView.locator(".chat-request-button.reject").click();

    // Verify request is removed
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(0, {
      timeout: 10000,
    });

    // Navigate back to chat list
    await page.goto("/messages");

    // Verify only Alice's accepted convo remains — no requests banner
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-name")).toContainText("Alice");
    await expect(chatView.locator(".chat-requests-banner")).toHaveCount(0);
  });
});
