import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

test.describe("Chat request reject flow", () => {
  test("should reject a request and verify it is removed from requests list", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const requester1 = createProfile({
      did: "did:plc:requester1",
      handle: "requester1.bsky.social",
      displayName: "Requester One",
    });
    const requester2 = createProfile({
      did: "did:plc:requester2",
      handle: "requester2.bsky.social",
      displayName: "Requester Two",
    });
    const requestConvo1 = createConvo({
      id: "convo-req-1",
      otherMember: requester1,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-1",
        text: "Hey there!",
        senderDid: requester1.did,
      }),
    });
    const requestConvo2 = createConvo({
      id: "convo-req-2",
      otherMember: requester2,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-2",
        text: "Can we talk?",
        senderDid: requester2.did,
      }),
    });
    mockServer.addConvos([requestConvo1, requestConvo2]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to chat requests
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(2, {
      timeout: 10000,
    });

    // Reject the first request
    await requestsView
      .locator(".chat-request-item")
      .first()
      .locator(".chat-request-button.reject")
      .click();

    // Verify only one request remains
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(requestsView).toContainText("Requester Two");
    await expect(requestsView).not.toContainText("Requester One");
  });
});
