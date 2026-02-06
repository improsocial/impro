import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createConvo, createMessage, createProfile } from "../../factories.js";

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

  test("should accept a chat request and navigate to the conversation", async ({
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
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await requestsView.locator(".chat-request-button.accept").click();

    // Should navigate to the chat detail view
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Requester One", { timeout: 10000 });
  });

  test("should reject a chat request and remove it from the list", async ({
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
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await requestsView.locator(".chat-request-button.reject").click();

    // Request should be removed and empty state shown
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(requestsView.locator(".feed-end-message")).toContainText(
      "No chat requests",
    );
  });

  test("should navigate back to chat list when clicking back", async ({
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
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".chat-requests-banner")).toBeVisible({
      timeout: 10000,
    });
    await chatView.locator(".chat-requests-banner").click();

    const requestsView = page.locator("#chat-requests-view");
    await expect(
      requestsView.locator('[data-testid="header-title"]'),
    ).toContainText("Chat requests", { timeout: 10000 });

    await requestsView.locator('[data-testid="back-button"]').click();

    await expect(
      page.locator('#chat-view [data-testid="header-title"]'),
    ).toContainText("Chats", { timeout: 10000 });
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

  test("should display error state when chat requests fail to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // Override listConvos to return error
    await page.route("**/xrpc/chat.bsky.convo.listConvos*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    await expect(requestsView.locator(".error-state")).toContainText(
      "There was an error loading chat requests.",
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/messages/inbox");

      await expect(page).toHaveURL("/login", { timeout: 10000 });
    });
  });
});
