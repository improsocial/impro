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

  test("should navigate to conversation detail when clicking a conversation", async ({
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
      lastMessage: createMessage({
        id: "msg-1",
        text: "Hey, how are you?",
        senderDid: alice.did,
      }),
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(1, {
      timeout: 10000,
    });

    await chatView.locator(".convo-item").first().click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
  });

  test("should navigate to chat requests when clicking the header inbox button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    const inboxButton = chatView.locator('[data-testid="inbox-button"]');
    await expect(inboxButton).toBeVisible({ timeout: 10000 });
    await expect(inboxButton).toHaveAttribute("data-teststate", "read");
    await expect(inboxButton.locator('[data-testid="unread-dot"]')).toHaveCount(
      0,
    );

    await inboxButton.click();

    const requestsView = page.locator("#chat-requests-view");
    await expect(
      requestsView.locator('[data-testid="header-title"]'),
    ).toContainText("Chat requests", { timeout: 10000 });
  });

  test("should show an unread dot on the inbox button when unread requests exist", async ({
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
      unreadCount: 1,
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
    const inboxButton = chatView.locator('[data-testid="inbox-button"]');
    await expect(inboxButton).toBeVisible({ timeout: 10000 });
    await expect(inboxButton).toHaveAttribute("data-teststate", "unread", {
      timeout: 10000,
    });
    await expect(
      inboxButton.locator('[data-testid="unread-dot"]'),
    ).toBeVisible();
  });

  test("should keep request conversations out of the main list", async ({
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
    await expect(chatView.locator(".feed-end-message")).toContainText(
      "No conversations yet!",
      { timeout: 10000 },
    );
    await expect(chatView.locator(".convo-item")).toHaveCount(0);
  });

  test.describe("Group conversations", () => {
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

    test("should display a group conversation with name, avatar stack, and sender-prefixed preview", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers: [alice, bob],
        lastMessage: createMessage({
          id: "msg-1",
          text: "Chapter 3 tonight?",
          senderDid: alice.did,
        }),
      });
      mockServer.addConvos([groupConvo]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      const chatView = page.locator("#chat-view");
      const groupItem = chatView.locator('[data-testid="convo-item-group"]');
      await expect(groupItem).toHaveCount(1, { timeout: 10000 });
      await expect(groupItem.locator(".convo-name")).toContainText("Book Club");
      await expect(
        groupItem.locator('[data-testid="avatar-group"]'),
      ).toBeVisible();
      await expect(groupItem.locator(".convo-preview")).toContainText(
        "Alice: Chapter 3 tonight?",
      );
      await expect(groupItem.locator(".convo-handle")).toHaveText("");
    });

    test("should stack at most four member avatars", async ({ page }) => {
      const mockServer = new MockServer();
      const carol = createProfile({
        did: "did:plc:carol1",
        handle: "carol.bsky.social",
        displayName: "Carol",
      });
      const dave = createProfile({
        did: "did:plc:dave1",
        handle: "dave.bsky.social",
        displayName: "Dave",
      });
      const eve = createProfile({
        did: "did:plc:eve1",
        handle: "eve.bsky.social",
        displayName: "Eve",
      });
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers: [alice, bob, carol, dave, eve],
        lastMessage: createMessage({
          id: "msg-1",
          text: "Hello",
          senderDid: alice.did,
        }),
      });
      mockServer.addConvos([groupConvo]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      const stack = page.locator('[data-testid="avatar-group"]');
      await expect(stack).toBeVisible({ timeout: 10000 });
      await expect(stack.locator(".avatar-group-item")).toHaveCount(4);
    });

    test("should display direct and group conversations together", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const directConvo = createConvo({
        id: "convo-1",
        otherMember: alice,
        lastMessage: createMessage({
          id: "msg-1",
          text: "Hello from Alice",
          senderDid: alice.did,
        }),
      });
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers: [alice, bob],
        lastMessage: createMessage({
          id: "msg-2",
          text: "Hello group",
          senderDid: bob.did,
        }),
      });
      mockServer.addConvos([directConvo, groupConvo]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      const chatView = page.locator("#chat-view");
      await expect(
        chatView.locator('[data-testid="convo-item-direct"]'),
      ).toHaveCount(1, { timeout: 10000 });
      await expect(
        chatView.locator('[data-testid="convo-item-group"]'),
      ).toHaveCount(1);
    });

    test("should display a system message preview with the member's name", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers: [alice, bob],
        lastMessage: createSystemMessage({
          id: "sys-1",
          dataType: "systemMessageDataMemberLeave",
          data: { member: { did: bob.did } },
        }),
      });
      mockServer.addConvos([groupConvo]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      const chatView = page.locator("#chat-view");
      const groupItem = chatView.locator('[data-testid="convo-item-group"]');
      await expect(groupItem).toHaveCount(1, { timeout: 10000 });
      await expect(groupItem.locator(".convo-preview")).toContainText(
        "Bob left the group",
      );
    });

    test("should fall back to anonymous system message previews for unknown members", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers: [alice, bob],
        lastMessage: createSystemMessage({
          id: "sys-1",
          dataType: "systemMessageDataMemberLeave",
          data: { member: { did: "did:plc:stranger1" } },
        }),
      });
      mockServer.addConvos([groupConvo]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      const chatView = page.locator("#chat-view");
      const groupItem = chatView.locator('[data-testid="convo-item-group"]');
      await expect(groupItem).toHaveCount(1, { timeout: 10000 });
      await expect(groupItem.locator(".convo-preview")).toContainText(
        "Someone left the group",
      );
    });

    test("should keep group invites out of the main list", async ({ page }) => {
      const mockServer = new MockServer();
      const groupInvite = createGroupConvo({
        id: "group-req-1",
        name: "Book Club",
        otherMembers: [alice, bob],
        status: "request",
        lastMessage: createMessage({
          id: "msg-1",
          text: "Welcome!",
          senderDid: alice.did,
        }),
      });
      mockServer.addConvos([groupInvite]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages");

      // The invite is still a request, so the main list stays empty
      const chatView = page.locator("#chat-view");
      await expect(chatView.locator(".feed-end-message")).toContainText(
        "No conversations yet!",
        { timeout: 10000 },
      );
    });
  });

  test("should display empty state when there are no conversations", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(
      chatView.locator('[data-testid="header-title"]'),
    ).toContainText("Chats", { timeout: 10000 });
    await expect(chatView.locator(".feed-end-message")).toContainText(
      "No conversations yet!",
      { timeout: 10000 },
    );
    await expect(chatView.locator(".convo-item")).toHaveCount(0);
  });

  test("should open the new chat dialog from the header button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    const newChatButton = chatView.locator('[data-testid="new-chat-button"]');
    await expect(newChatButton).toBeVisible({ timeout: 10000 });
    await newChatButton.click();

    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(
      dialog.locator('[data-testid="new-chat-search-input"]'),
    ).toBeVisible();
    await expect(
      dialog.locator('[data-testid="new-chat-empty-prompt"]'),
    ).toBeVisible();

    await dialog.locator('[data-testid="new-chat-dialog-close"]').click();
    await expect(dialog).not.toBeVisible();
  });

  test("should show a FAB instead of the header button on mobile viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(
      chatView.locator('[data-testid="header-title"]'),
    ).toContainText("Chats", { timeout: 10000 });
    await expect(
      chatView.locator('[data-testid="new-chat-button"]'),
    ).toBeHidden();

    const fab = chatView.locator('[data-testid="new-chat-fab"]');
    await expect(fab).toBeVisible();
    await fab.click();

    await expect(page.locator('[data-testid="new-chat-dialog"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should hide the FAB on desktop viewports", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(
      chatView.locator('[data-testid="new-chat-button"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(chatView.locator('[data-testid="new-chat-fab"]')).toBeHidden();
  });

  test("should open the new chat dialog from the empty state button", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    const emptyStateButton = chatView.locator(
      '[data-testid="new-chat-button-empty-state"]',
    );
    await expect(emptyStateButton).toBeVisible({ timeout: 10000 });
    await emptyStateButton.click();

    await expect(page.locator('[data-testid="new-chat-dialog"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display error state when conversations fail to load", async ({
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
    await page.goto("/messages");

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".error-state")).toContainText(
      "There was an error loading conversations.",
      { timeout: 10000 },
    );
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/messages");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
