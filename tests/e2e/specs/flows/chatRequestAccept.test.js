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

  test("should accept a group invite and verify the group moves from requests to main chat list", async ({
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
    const groupInvite = createGroupConvo({
      id: "group-req-1",
      name: "Book Club",
      otherMembers: [alice, bob],
      status: "request",
      lastMessage: createSystemMessage({
        id: "sys-req-1",
        dataType: "systemMessageDataAddMember",
        data: { member: { did: "did:plc:testuser123" } },
      }),
    });
    mockServer.addConvos([groupInvite]);
    await mockServer.setup(page);

    await login(page);

    // The invite surfaces in the requests banner, not the main list
    await page.goto("/messages");
    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".chat-requests-banner")).toBeVisible({
      timeout: 10000,
    });
    await expect(chatView.locator(".convo-item")).toHaveCount(0);

    await chatView.locator(".chat-requests-banner").click();

    const requestsView = page.locator("#chat-requests-view");
    const groupItem = requestsView.locator(
      '[data-testid="request-item-group"]',
    );
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });
    await expect(groupItem.locator(".convo-name")).toContainText("Book Club");

    // Accept the invite and land in the group conversation
    await groupItem.locator(".chat-request-button.accept").click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Book Club", { timeout: 10000 });
    await expect(
      chatDetailView.locator('[data-testid="header-subtitle"]'),
    ).toContainText("3 members");

    // Back in the inbox, the group is now an accepted conversation
    await page.goto("/messages");
    await expect(
      chatView.locator('[data-testid="convo-item-group"]'),
    ).toHaveCount(1, { timeout: 10000 });
    await expect(chatView.locator(".convo-name")).toContainText("Book Club");
    await expect(chatView.locator(".chat-requests-banner")).toHaveCount(0);
  });
});
