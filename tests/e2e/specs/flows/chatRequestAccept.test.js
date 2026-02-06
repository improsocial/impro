import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

test.describe("Chat request accept flow", () => {
  test("should accept a request and verify conversation moves from requests to main chat list", async ({
    page,
  }) => {
    const mockServer = new MockServer();

    const requester = createProfile({
      did: "did:plc:requester1",
      handle: "requester.bsky.social",
      displayName: "Requester One",
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
    mockServer.addConvos([requestConvo]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to chat list first and verify the request banner is shown
    await page.goto("/messages");
    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".chat-requests-banner")).toBeVisible({
      timeout: 10000,
    });

    // Verify no accepted conversations in the main list
    await expect(chatView.locator(".convo-item")).toHaveCount(0);

    // Navigate to chat requests
    await chatView.locator(".chat-requests-banner").click();

    const requestsView = page.locator("#chat-requests-view");
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Accept the request
    await requestsView.locator(".chat-request-button.accept").click();

    // Should navigate to the chat detail view
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Requester One", { timeout: 10000 });

    // Navigate back to the chat list
    await page.goto("/messages");

    // Verify the conversation now appears in the main accepted list
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-name")).toContainText(
      "Requester One",
    );
  });
});
