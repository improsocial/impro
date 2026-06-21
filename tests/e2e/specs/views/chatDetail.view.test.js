import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createGroupConvo,
  createMessage,
  createMessageLog,
  createProfile,
  createSystemMessage,
} from "../../factories.js";
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

  test("should render an embed-only message without an empty bubble", async ({
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
    const quotedUri = "at://did:plc:author2/app.bsky.feed.post/quoted1";
    const recordEmbed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        uri: quotedUri,
        cid: "bafyreitestquoted",
        author: {
          did: "did:plc:author2",
          handle: "author2.bsky.social",
          displayName: "Quoted Author",
          avatar: "",
          viewer: { muted: false, blockedBy: false },
          labels: [],
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        value: {
          $type: "app.bsky.feed.post",
          text: "The shared post",
          createdAt: "2025-01-01T00:00:00.000Z",
          langs: ["en"],
        },
        labels: [],
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
        indexedAt: "2025-01-01T00:00:00.000Z",
        embeds: [],
      },
    };
    const messages = [
      createMessage({
        id: "msg-2",
        text: "",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:01:00.000Z",
        embed: recordEmbed,
      }),
      createMessage({
        id: "msg-1",
        text: "Check this out",
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
    await expect(chatDetailView.locator(".message-embed")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatDetailView.locator(".message-embed")).toContainText(
      "The shared post",
    );
    // Only the text message gets a bubble; the embed-only message renders none
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1);
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Check this out",
    );
  });

  test("should render a reply with a quote of the original message", async ({
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
    const original = createMessage({
      id: "msg-1",
      text: "What time are we meeting?",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    const reply = createMessage({
      id: "msg-2",
      text: "Around 7pm",
      senderDid: userProfile.did,
      sentAt: "2025-01-15T12:01:00.000Z",
      replyTo: original,
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [reply, original]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(2, {
      timeout: 10000,
    });
    const quote = chatDetailView.locator('[data-testid="message-reply-quote"]');
    await expect(quote).toHaveCount(1);
    await expect(quote.locator('[data-testid="reply-quote-text"]')).toHaveText(
      "What time are we meeting?",
    );
    // User-sent replies in 1:1 convos render a "You replied to X" caption
    const caption = chatDetailView.locator(
      '[data-testid="message-reply-caption"]',
    );
    await expect(caption).toHaveCount(1);
    await expect(caption).toContainText("You replied to Alice");
  });

  test("should render a subtle fallback when the quoted message has no text", async ({
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
    const original = createMessage({
      id: "msg-1",
      text: "",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
      embed: { $type: "app.bsky.embed.record#view" },
    });
    const reply = createMessage({
      id: "msg-2",
      text: "neat",
      senderDid: userProfile.did,
      sentAt: "2025-01-15T12:01:00.000Z",
      replyTo: original,
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [reply, original]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const quote = chatDetailView.locator('[data-testid="message-reply-quote"]');
    await expect(quote).toHaveCount(1, { timeout: 10000 });
    await expect(quote.locator('[data-testid="reply-quote-text"]')).toHaveText(
      "(quoted post)",
    );
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

  test("should open bsky.app link from chat menu", async ({ page }) => {
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
      chatDetailView.locator('[data-testid="chat-menu-button"]'),
    ).toBeVisible({ timeout: 10000 });

    const popupPromise = page.waitForEvent("popup");
    await chatDetailView.locator('[data-testid="chat-menu-button"]').click();
    await chatDetailView
      .locator('[data-testid="menu-action-chat-open-in-bsky"]')
      .click();

    const popup = await popupPromise;
    expect(popup.url()).toBe("https://bsky.app/messages/convo-1");
  });

  test("should add emoji reaction to a message", async ({ page }) => {
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
    const messageBubble = chatDetailView.locator(".message-bubble");
    await expect(messageBubble).toHaveCount(1, { timeout: 10000 });

    // Click the message, then the emoji trigger to open the reaction palette
    await chatDetailView.locator(".message-bubble").first().click();
    await chatDetailView
      .locator('[data-testid="message-emoji-trigger"]')
      .first()
      .click();

    // Reaction palette should appear
    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });

    // Click the heart emoji (first in the palette)
    await chatDetailView.locator(".reaction-palette-button").first().click();

    // Reaction bubble should appear on the message
    await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(chatDetailView.locator(".reaction-emoji")).toContainText("❤️");

    // Palette should close
    await expect(chatDetailView.locator(".reaction-palette")).toHaveCount(0);
  });

  test("should remove own emoji reaction from a message", async ({ page }) => {
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
    // Pre-populate with the current user's reaction
    messages[0].reactions = [
      {
        createdAt: "2025-01-15T12:05:00.000Z",
        sender: { did: userProfile.did },
        value: "👍",
      },
    ];
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", messages);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });

    // Verify the reaction bubble is shown and marked as own
    await expect(chatDetailView.locator(".reaction-bubble-own")).toHaveCount(
      1,
      {
        timeout: 5000,
      },
    );
    await expect(chatDetailView.locator(".reaction-emoji")).toContainText("👍");

    // Click the own reaction bubble to remove it
    await chatDetailView.locator(".reaction-bubble-own").click();

    // Reaction bubble should disappear
    await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test("should open the emoji picker from the reaction palette more button", async ({
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
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });

    await chatDetailView.locator(".message-bubble").first().click();
    await chatDetailView
      .locator('[data-testid="message-emoji-trigger"]')
      .first()
      .click();

    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });

    // No picker mounted before the more button is clicked
    await expect(page.locator("emoji-picker")).toHaveCount(0);

    await chatDetailView.locator(".reaction-palette-button-more").click();

    // Picker is mounted as a top-layer dialog appended to document.body
    await expect(
      page.locator("dialog.emoji-picker-dialog-host emoji-picker"),
    ).toHaveCount(1, { timeout: 5000 });
  });

  test("should add a reaction when an emoji is selected from the picker", async ({
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
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });

    await chatDetailView.locator(".message-bubble").first().click();
    await chatDetailView
      .locator('[data-testid="message-emoji-trigger"]')
      .first()
      .click();

    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });

    await chatDetailView.locator(".reaction-palette-button-more").click();

    const picker = page.locator("dialog.emoji-picker-dialog-host emoji-picker");
    await expect(picker).toHaveCount(1, { timeout: 5000 });

    // Click the emoji from the picker's grid. The data fixture lives in
    // MockServer; Playwright pierces the picker's shadow DOM automatically.
    await picker.locator('button.emoji[aria-label*="party popper"]').click();

    await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(chatDetailView.locator(".reaction-emoji")).toContainText("🎉");
  });

  test("should close the emoji picker when the backdrop is clicked", async ({
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
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });

    await chatDetailView.locator(".message-bubble").first().click();
    await chatDetailView
      .locator('[data-testid="message-emoji-trigger"]')
      .first()
      .click();

    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });

    const moreButton = chatDetailView.locator(".reaction-palette-button-more");
    await moreButton.click();
    await expect(page.locator("emoji-picker")).toHaveCount(1, {
      timeout: 5000,
    });

    // Click outside the picker to close it via the dialog backdrop
    await chatDetailView
      .locator('[data-testid="header-title"]')
      .click({ force: true });
    await expect(page.locator("emoji-picker")).toHaveCount(0);
  });

  test("should insert an emoji into the message input from the emoji button", async ({
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
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const textarea = chatDetailView.locator(".message-input-field");
    await textarea.fill("hello ");

    await chatDetailView.locator(".message-input-emoji-button").click();

    const picker = page.locator("dialog.emoji-picker-dialog-host emoji-picker");
    await expect(picker).toHaveCount(1, { timeout: 5000 });

    await picker.locator('button.emoji[aria-label*="party popper"]').click();

    await expect(textarea).toHaveValue("hello 🎉");
    await expect(page.locator("emoji-picker")).toHaveCount(0);
  });

  test("should close the chat-input emoji picker when clicking outside", async ({
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
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator(".message-input-emoji-button"),
    ).toBeVisible({ timeout: 10000 });

    await chatDetailView.locator(".message-input-emoji-button").click();
    await expect(
      page.locator("dialog.emoji-picker-dialog-host emoji-picker"),
    ).toHaveCount(1, { timeout: 5000 });

    await chatDetailView
      .locator('[data-testid="header-title"]')
      .click({ force: true });

    await expect(page.locator("emoji-picker")).toHaveCount(0);
  });

  test("should hide the chat-input emoji button on mobile viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });

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
    await expect(chatDetailView.locator(".message-input-field")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      chatDetailView.locator(".message-input-emoji-button"),
    ).toBeHidden();
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

    function setupGroupConvo({
      messages,
      lockStatus = "unlocked",
      otherMembers = [alice, bob],
      memberCount,
    } = {}) {
      const mockServer = new MockServer();
      const groupConvo = createGroupConvo({
        id: "group-1",
        name: "Book Club",
        otherMembers,
        lockStatus,
        memberCount,
      });
      mockServer.addConvos([groupConvo]);
      mockServer.addConvoMessages("group-1", messages || []);
      return mockServer;
    }

    test("should display group name and member count in header", async ({
      page,
    }) => {
      const mockServer = setupGroupConvo({
        messages: [
          createMessage({
            id: "msg-1",
            text: "Hello group",
            senderDid: alice.did,
          }),
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(
        chatDetailView.locator('[data-testid="header-title"]'),
      ).toContainText("Book Club", { timeout: 10000 });
      await expect(
        chatDetailView.locator('[data-testid="header-subtitle"]'),
      ).toContainText("3 members");
    });

    test("should display member avatar stack in header", async ({ page }) => {
      const mockServer = setupGroupConvo();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const header = page.locator('#chat-detail-view [data-testid="header"]');
      const avatarGroup = header.locator('[data-testid="avatar-group"]');
      await expect(avatarGroup).toBeVisible({ timeout: 10000 });
      await expect(avatarGroup.locator(".avatar-group-item")).toHaveCount(2);
    });

    test("should show author names and avatars on received message clusters", async ({
      page,
    }) => {
      const mockServer = setupGroupConvo({
        messages: [
          createMessage({
            id: "msg-3",
            text: "My reply",
            senderDid: userProfile.did,
            sentAt: "2025-01-15T12:02:00.000Z",
          }),
          createMessage({
            id: "msg-2",
            text: "Hi from Bob",
            senderDid: bob.did,
            sentAt: "2025-01-15T12:01:00.000Z",
          }),
          createMessage({
            id: "msg-1",
            text: "Hi from Alice",
            senderDid: alice.did,
            sentAt: "2025-01-15T12:00:00.000Z",
          }),
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(3, {
        timeout: 10000,
      });

      const authorNames = chatDetailView.locator(
        '[data-testid="message-author-name"]',
      );
      // Only the two received clusters get author labels, not the sent one
      await expect(authorNames).toHaveCount(2);
      await expect(authorNames.nth(0)).toContainText("Alice");
      await expect(authorNames.nth(1)).toContainText("Bob");
      // Alice's and Bob's clusters each show an avatar
      await expect(
        chatDetailView.locator(".message-received .message-avatar"),
      ).toHaveCount(2);
    });

    test("should render a reply caption above a reply bubble in group chats", async ({
      page,
    }) => {
      const original = createMessage({
        id: "msg-1",
        text: "Who is bringing snacks?",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      });
      const reply = createMessage({
        id: "msg-2",
        text: "I will",
        senderDid: bob.did,
        sentAt: "2025-01-15T12:01:00.000Z",
        replyTo: original,
      });
      const mockServer = setupGroupConvo({ messages: [reply, original] });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(2, {
        timeout: 10000,
      });
      const caption = chatDetailView.locator(
        '[data-testid="message-reply-caption"]',
      );
      await expect(caption).toHaveCount(1);
      await expect(caption).toContainText("Bob");
      await expect(caption).toContainText("Alice");
      // The reply's quote box is still rendered inside the bubble
      await expect(
        chatDetailView.locator('[data-testid="message-reply-quote"]'),
      ).toHaveCount(1);
      // The caption replaces the normal author-name header for the reply cluster
      const authorNames = chatDetailView.locator(
        '[data-testid="message-author-name"]',
      );
      await expect(authorNames).toHaveCount(1);
      await expect(authorNames).toContainText("Alice");
    });

    test("should render system messages", async ({ page }) => {
      const mockServer = setupGroupConvo({
        messages: [
          createMessage({
            id: "msg-1",
            text: "Welcome!",
            senderDid: alice.did,
            sentAt: "2025-01-15T12:01:00.000Z",
          }),
          createSystemMessage({
            id: "sys-1",
            dataType: "systemMessageDataAddMember",
            data: { member: { did: bob.did }, addedBy: { did: alice.did } },
            sentAt: "2025-01-15T12:00:00.000Z",
          }),
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(
        chatDetailView.locator('[data-testid="system-message"]'),
      ).toContainText("Bob was added to the group", { timeout: 10000 });
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1);
    });

    test("should replace the composer with a notice when the chat is locked", async ({
      page,
    }) => {
      const mockServer = setupGroupConvo({
        lockStatus: "locked",
        messages: [
          createMessage({
            id: "msg-1",
            text: "Hello group",
            senderDid: alice.did,
          }),
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(
        chatDetailView.locator('[data-testid="chat-locked-notice"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(chatDetailView.locator("chat-input")).toHaveCount(0);
    });

    test("should enable message pagination when the viewer is the only listed member", async ({
      page,
    }) => {
      const mockServer = setupGroupConvo({
        otherMembers: [],
        memberCount: 1,
        messages: [
          createMessage({
            id: "msg-1",
            text: "Hello group",
            senderDid: alice.did,
          }),
        ],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(
        chatDetailView.locator("infinite-scroll-container"),
      ).not.toHaveAttribute("disabled");
    });
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

  test.describe("Scrolling on new messages", () => {
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });

    function setupOverflowingConvo() {
      const mockServer = new MockServer();
      const convo = createConvo({
        id: "convo-1",
        otherMember: alice,
      });
      const messages = [];
      for (let messageNumber = 30; messageNumber >= 1; messageNumber--) {
        messages.push(
          createMessage({
            id: `msg-${messageNumber}`,
            text: `Message number ${messageNumber}`,
            senderDid: alice.did,
            sentAt: `2025-01-15T12:${String(messageNumber).padStart(2, "0")}:00.000Z`,
          }),
        );
      }
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", messages);
      return mockServer;
    }

    function getScroller(page) {
      return page.locator("#chat-detail-view infinite-scroll-container");
    }

    function getDistanceFromBottom(page) {
      return getScroller(page).evaluate(
        (scroller) =>
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight,
      );
    }

    function queueIncomingMessage(mockServer) {
      mockServer.addChatLogs([
        createMessageLog({
          convoId: "convo-1",
          message: createMessage({
            id: "msg-new",
            text: "Just arrived!",
            senderDid: alice.did,
            sentAt: "2025-01-15T13:00:00.000Z",
          }),
        }),
      ]);
    }

    test("should scroll to the bottom when a new message arrives while at the bottom", async ({
      page,
    }) => {
      const mockServer = setupOverflowingConvo();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(30, {
        timeout: 10000,
      });
      await expect
        .poll(() => getDistanceFromBottom(page))
        .toBeLessThanOrEqual(10);

      queueIncomingMessage(mockServer);

      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(31, {
        timeout: 15000,
      });
      await expect
        .poll(() => getDistanceFromBottom(page))
        .toBeLessThanOrEqual(10);
    });

    test("should keep the scroll position when a new message arrives while scrolled up", async ({
      page,
    }) => {
      const mockServer = setupOverflowingConvo();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(30, {
        timeout: 10000,
      });
      await expect
        .poll(() => getDistanceFromBottom(page))
        .toBeLessThanOrEqual(10);

      await getScroller(page).evaluate((scroller) => {
        scroller.scrollTop = 0;
      });

      queueIncomingMessage(mockServer);

      await expect(chatDetailView.locator(".message-bubble")).toHaveCount(31, {
        timeout: 15000,
      });
      // Give any erroneous scroll-to-bottom a chance to run before asserting
      await page.waitForTimeout(250);
      const scrollTop = await getScroller(page).evaluate(
        (scroller) => scroller.scrollTop,
      );
      expect(scrollTop).toBeLessThanOrEqual(10);
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should redirect to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/messages/some-convo");

      await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    });
  });
});
