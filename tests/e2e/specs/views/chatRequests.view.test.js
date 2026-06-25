import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createGroupConvo,
  createMessage,
  createProfile,
  createSystemMessage,
} from "../../factories.js";

function createRequester() {
  return createProfile({
    did: "did:plc:requester1",
    handle: "requester.bsky.social",
    displayName: "Requester One",
  });
}

function createGroupInvite({ requester, lockStatus = "unlocked" }) {
  return createGroupConvo({
    id: "group-req-1",
    name: "Book Club",
    otherMembers: [requester],
    ownerDid: requester.did,
    status: "request",
    lockStatus,
    lastMessage: createSystemMessage({
      id: "sys-req-1",
      dataType: "systemMessageDataAddMember",
      data: { member: { did: "did:plc:testuser123" } },
    }),
  });
}

test.describe("Chat requests view", () => {
  test("should display group chat invites alongside direct requests", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    const directRequest = createConvo({
      id: "convo-req-1",
      otherMember: requester,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-1",
        text: "Hey, can we chat?",
        senderDid: requester.did,
      }),
    });
    const groupInvite = createGroupInvite({ requester });
    mockServer.addConvos([directRequest, groupInvite]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    await expect(requestsView.locator(".chat-request-item")).toHaveCount(2, {
      timeout: 10000,
    });

    const directItem = requestsView.locator(
      '[data-testid="request-item-direct"]',
    );
    await expect(directItem).toContainText("Requester One");

    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem.locator(".convo-name")).toContainText("Book Club");
    await expect(groupItem.locator(".convo-preview")).toContainText(
      "Test User was added to the group",
    );
    await expect(
      groupItem.locator('[data-testid="request-invited-by"]'),
    ).toContainText("Requester One added you");
    await expect(
      groupItem.locator(".chat-request-button.accept"),
    ).toBeVisible();
    await expect(
      groupItem.locator(".chat-request-button.reject"),
    ).toBeVisible();
  });

  test("should omit the inviter line when the group owner has left", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    const groupInvite = createGroupInvite({ requester });
    // No member carries the owner role once the owner has left
    groupInvite.members = groupInvite.members.map((member) => ({
      ...member,
      kind: { ...member.kind, role: "standard" },
    }));
    mockServer.addConvos([groupInvite]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });
    await expect(
      groupItem.locator('[data-testid="request-invited-by"]'),
    ).toHaveCount(0);
  });

  test("should navigate to the conversation when clicking the request header", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    const directRequest = createConvo({
      id: "convo-req-1",
      otherMember: requester,
      status: "request",
      lastMessage: createMessage({
        id: "msg-req-1",
        text: "Hey, can we chat?",
        senderDid: requester.did,
      }),
    });
    mockServer.addConvos([directRequest]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    const directItem = requestsView.locator(
      '[data-testid="request-item-direct"]',
    );
    await expect(directItem).toHaveCount(1, { timeout: 10000 });

    await directItem.locator(".chat-request-header").click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Requester One", { timeout: 10000 });
  });

  test("should accept a group invite and navigate to the group conversation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    mockServer.addConvos([createGroupInvite({ requester })]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });

    await groupItem.locator(".chat-request-button.accept").click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Book Club", { timeout: 10000 });
    await expect(
      chatDetailView.locator('[data-testid="header-subtitle"]'),
    ).toContainText("2 members");
  });

  test("should reject a group invite and remove it from the list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    mockServer.addConvos([createGroupInvite({ requester })]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });

    await groupItem.locator(".chat-request-button.reject").click();

    await expect(requestsView.locator(".chat-request-item")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(requestsView.locator(".feed-end-message")).toContainText(
      "No chat requests",
    );
  });

  test("should not offer accept for a locked group invite", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createRequester();
    mockServer.addConvos([
      createGroupInvite({ requester, lockStatus: "locked" }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/inbox");

    const requestsView = page.locator("#chat-requests-view");
    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });
    await expect(groupItem.locator(".chat-request-button.accept")).toHaveCount(
      0,
    );
    await expect(
      groupItem.locator(".chat-request-button.reject"),
    ).toBeVisible();
  });

  test("should display Chat requests header and request items", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const requester = createProfile({
      did: "did:plc:requester1",
      handle: "requester.bsky.social",
      displayName: "Requester One",
      viewer: {
        knownFollowers: {
          count: 2,
          followers: [
            createProfile({
              did: "did:plc:alice1",
              handle: "alice.bsky.social",
              displayName: "Alice",
            }),
          ],
        },
      },
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
    const followStatus = requestsView.locator(".chat-request-follow-status");
    await expect(
      followStatus.locator('[data-testid="known-followers-summary"]'),
    ).toContainText("Followed by Alice and 1 other");
    await expect(followStatus.locator(".known-followers-avatar")).toHaveCount(
      1,
    );

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

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
