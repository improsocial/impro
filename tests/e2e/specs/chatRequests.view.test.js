import { test, expect } from "../base.js";
import { login } from "../helpers.js";
import { MockServer } from "../mockServer.js";
import { createConvo, createMessage, createProfile } from "../factories.js";

test.describe("Chat requests view", () => {
  test("should display Chat requests header and request items", async ({
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
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    await expect(
      requestsView.locator('[data-testid="header-title"]'),
    ).toContainText("Chat requests", { timeout: 10000 });

    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(requestsView).toContainText("Requester One");
    await expect(requestsView).toContainText("@requester.bsky.social");
    await expect(requestsView).toContainText("Hey, can we chat?");

    // Should show accept and reject buttons
    await expect(
      requestsView.locator(".chat-request-button.accept"),
    ).toContainText("Accept");
    await expect(
      requestsView.locator(".chat-request-button.reject"),
    ).toContainText("Reject");
  });

  test("should show empty state when there are no chat requests", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    await expect(
      requestsView.locator('[data-testid="header-title"]'),
    ).toContainText("Chat requests", { timeout: 10000 });
    await expect(requestsView.locator(".feed-end-message")).toContainText(
      "No chat requests",
      { timeout: 10000 },
    );
  });
});
