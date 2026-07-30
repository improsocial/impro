import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { OAUTH_SCOPES } from "../../../../src/oauthScopes.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createGroupConvo,
  createLabelerView,
  createMessage,
  createMessageLog,
  createPost,
  createProfile,
  createSystemMessage,
} from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

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

  test("should render emoji-only messages enlarged without a bubble", async ({
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
      text: "Hey there!",
      senderDid: userProfile.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    const messages = [
      createMessage({
        id: "msg-4",
        text: "🎉",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:03:00.000Z",
        replyTo: original,
      }),
      createMessage({
        id: "msg-3",
        text: "😀",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:02:00.000Z",
        facets: [
          {
            index: { byteStart: 0, byteEnd: 4 },
            features: [
              {
                $type: "app.bsky.richtext.facet#link",
                uri: "https://example.com",
              },
            ],
          },
        ],
      }),
      createMessage({
        id: "msg-2",
        text: "😀",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:01:00.000Z",
      }),
      original,
    ];
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", messages);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const emojiMessage = chatDetailView.locator('[data-message-id="msg-2"]');
    const emojiRichText = emojiMessage.locator(".rich-text-emoji-only");
    await expect(emojiRichText).toBeVisible({ timeout: 10000 });
    await expect(emojiRichText).toHaveAttribute("data-teststate", "emoji-only");

    // 3x the normal message text size, asserted as a ratio (not a px literal)
    // so the base font size can change without breaking the test.
    const normalFontSize = await chatDetailView
      .locator('[data-message-id="msg-1"] .rich-text')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    const emojiFontSize = await emojiRichText.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(emojiFontSize / normalFontSize).toBeCloseTo(3, 1);

    const emojiBubble = emojiMessage.locator(".message-bubble");
    await expect(emojiBubble).toHaveClass(/message-bubble-emoji-only/);
    await expect(emojiBubble).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(emojiBubble).toHaveCSS("padding", "0px");

    // Emoji text with a facet keeps its normal size and bubble.
    const facetMessage = chatDetailView.locator('[data-message-id="msg-3"]');
    await expect(facetMessage.locator(".message-bubble")).toBeVisible();
    await expect(facetMessage.locator(".message-bubble")).not.toHaveClass(
      /message-bubble-emoji-only/,
    );
    await expect(facetMessage.locator(".rich-text-emoji-only")).toHaveCount(0);

    // An emoji-only reply drops the in-bubble quote but keeps the reply
    // caption, so the reply context and tap-to-jump affordance survive.
    const replyMessage = chatDetailView.locator('[data-message-id="msg-4"]');
    await expect(replyMessage.locator(".message-bubble")).toHaveClass(
      /message-bubble-emoji-only/,
    );
    await expect(
      replyMessage.locator('[data-testid="message-reply-quote"]'),
    ).toHaveCount(0);
    const caption = chatDetailView.locator(
      '[data-testid="message-reply-caption"]',
    );
    await expect(caption).toHaveCount(1);
    await expect(caption).toContainText("Alice replied to you");
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

  test("should render a reply caption for received replies in 1:1 chats", async ({
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
      senderDid: userProfile.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    const reply = createMessage({
      id: "msg-2",
      text: "Around 7pm",
      senderDid: alice.did,
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
    const caption = chatDetailView.locator(
      '[data-testid="message-reply-caption"]',
    );
    await expect(caption).toHaveCount(1);
    await expect(caption).toContainText("Alice replied to you");
    // The in-bubble quote renders alongside the caption
    await expect(
      chatDetailView.locator('[data-testid="message-reply-quote"]'),
    ).toHaveCount(1);
  });

  test("groups a follow-up message into the preceding reply's group", async ({
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
    const followUp = createMessage({
      id: "msg-3",
      text: "Maybe 7:30 actually",
      senderDid: userProfile.did,
      sentAt: "2025-01-15T12:02:00.000Z",
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [followUp, reply, original]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(3, {
      timeout: 10000,
    });
    // The reply and its follow-up share one group (and one time label);
    // Alice's original is its own group
    const sentGroup = chatDetailView.locator(".message-group-sent");
    await expect(sentGroup).toHaveCount(1);
    await expect(sentGroup.locator(".message-bubble")).toHaveCount(2);
    await expect(chatDetailView.locator(".message-group-time")).toHaveCount(2);
    await expect(
      chatDetailView.locator('[data-testid="message-reply-caption"]'),
    ).toHaveCount(1);
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
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewRecord",
          uri: "at://did:plc:alice1/app.bsky.feed.post/quoted",
          cid: "bafyquoted",
          author: alice,
          value: {
            $type: "app.bsky.feed.post",
            text: "Original post",
            createdAt: "2025-01-15T11:59:00.000Z",
          },
          indexedAt: "2025-01-15T11:59:00.000Z",
        },
      },
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

  test("tapping a reply quote highlights the original message then fades", async ({
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
      id: "msg-original",
      text: "What time are we meeting?",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    const reply = createMessage({
      id: "msg-reply",
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

    const originalWrapper = chatDetailView.locator(
      '.message-wrapper[data-message-id="msg-original"]',
    );
    await expect(originalWrapper).not.toHaveClass(/message-highlighted/);

    await chatDetailView.locator('[data-testid="message-reply-quote"]').click();

    await expect(originalWrapper).toHaveClass(/message-highlighted/);
    await expect(originalWrapper).not.toHaveClass(/message-highlighted/, {
      timeout: 2500,
    });
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

    const messageInput = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(messageInput).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await messageInput.fill("Hey Alice!");
    await chatDetailView.locator(".message-input-send-button").click();

    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(chatDetailView.locator(".message-text")).toContainText(
      "Hey Alice!",
    );
    await expect(chatDetailView.locator(".message-sent")).toHaveCount(1);
  });

  test("should mention a user via typeahead and send with a mention facet", async ({
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
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
    });
    mockServer.addConvos([convo]);
    mockServer.addTypeaheadProfiles([bob]);
    mockServer.addProfile(bob);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const input = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(input).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await input.click();
    await input.pressSequentially("hey @bo");

    const typeahead = page.locator('[data-testid="mention-typeahead"]');
    await expect(typeahead).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="mention-suggestion"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="mention-suggestion-handle"]'),
    ).toContainText("@bob.bsky.social");

    // The chat input is bottom-anchored, so the typeahead must open upward,
    // sitting above the line containing the caret
    const typeaheadBox = await typeahead.boundingBox();
    const caretLineTop = await input.evaluate(() => {
      const selection = window.getSelection();
      return selection.getRangeAt(0).getBoundingClientRect().top;
    });
    expect(typeaheadBox.y + typeaheadBox.height).toBeLessThanOrEqual(
      caretLineTop,
    );

    // Enter selects the mention instead of sending
    await page.keyboard.press("Enter");
    await expect(typeahead).not.toBeVisible({ timeout: 5000 });
    await expect(input).toHaveText("hey @bob.bsky.social ");
    expect(mockServer.sentMessageRequests).toHaveLength(0);

    // The pending mention is highlighted as a facet in the input
    await expect(input.locator('[data-testid="facet"]')).toHaveText(
      "@bob.bsky.social",
    );

    // A second Enter sends the message with the resolved mention facet
    await page.keyboard.press("Enter");
    await expect.poll(() => mockServer.sentMessageRequests.length).toBe(1);
    const sentMessage = mockServer.sentMessageRequests[0].message;
    const mentionFeatures = (sentMessage.facets ?? []).flatMap((facet) =>
      facet.features.filter(
        (feature) => feature.$type === "app.bsky.richtext.facet#mention",
      ),
    );
    expect(mentionFeatures).toHaveLength(1);
    expect(mentionFeatures[0].did).toBe(bob.did);

    await expect(chatDetailView.locator(".message-text")).toContainText(
      "@bob.bsky.social",
    );
  });

  test("should select a mention by clicking a typeahead suggestion", async ({
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
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
    });
    mockServer.addConvos([convo]);
    mockServer.addTypeaheadProfiles([bob]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const input = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(input).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await input.click();
    await input.pressSequentially("hey @bo");

    const typeahead = page.locator('[data-testid="mention-typeahead"]');
    await expect(typeahead).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="mention-suggestion"]').click();

    await expect(typeahead).not.toBeVisible({ timeout: 5000 });
    await expect(input).toHaveText("hey @bob.bsky.social ");
    // The input keeps focus through the click, so Enter still sends
    await page.keyboard.press("Enter");
    await expect.poll(() => mockServer.sentMessageRequests.length).toBe(1);
  });

  test("should show an empty state when no mention suggestions match", async ({
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
    const input = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(input).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await input.click();
    await input.pressSequentially("hey @zz");

    const typeahead = page.locator('[data-testid="mention-typeahead"]');
    await expect(typeahead).toBeVisible({ timeout: 10000 });
    await expect(
      typeahead.locator('[data-testid="empty-state"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="mention-suggestion"]'),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(typeahead).not.toBeVisible();
  });

  test("should close the mention typeahead when the input loses focus", async ({
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
    const convo = createConvo({
      id: "convo-1",
      otherMember: alice,
    });
    mockServer.addConvos([convo]);
    mockServer.addTypeaheadProfiles([bob]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const input = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(input).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await input.click();
    await input.pressSequentially("hey @bo");

    const typeahead = page.locator('[data-testid="mention-typeahead"]');
    await expect(typeahead).toBeVisible({ timeout: 10000 });

    await chatDetailView.locator('[data-testid="header-title"]').click();

    await expect(typeahead).not.toBeVisible({ timeout: 5000 });
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

  test("should navigate to group chat details from the chat menu", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice],
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await chatDetailView.locator('[data-testid="chat-menu-button"]').click();
    await chatDetailView
      .locator('[data-testid="menu-action-group-chat-details"]')
      .click();

    await expect(
      page.locator('#group-chat-details-view [data-testid="group-name"]'),
    ).toContainText("Cool Group", { timeout: 10000 });
  });

  test("should navigate to group chat details when clicking the header title", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice],
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await chatDetailView.locator('[data-testid="header-title"]').click();

    await expect(
      page.locator('#group-chat-details-view [data-testid="group-name"]'),
    ).toContainText("Cool Group", { timeout: 10000 });
  });

  test("should not show group chat details menu item for direct chats", async ({
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
    await chatDetailView.locator('[data-testid="chat-menu-button"]').click();
    await expect(
      chatDetailView.locator('[data-testid="menu-action-chat-open-in-bsky"]'),
    ).toBeVisible();
    await expect(
      chatDetailView.locator('[data-testid="menu-action-group-chat-details"]'),
    ).toHaveCount(0);
  });

  test("should not offer group chat details when the session lacks the members scope", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice],
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    const scopeWithoutMembers = OAUTH_SCOPES.split(" ")
      .filter((scope) => !scope.includes("chat.bsky.convo.getConvoMembers"))
      .join(" ");
    await login(page, { scope: scopeWithoutMembers });
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Cool Group", { timeout: 10000 });
    await expect(chatDetailView.locator(".header-title-link")).toHaveCount(0);

    await chatDetailView.locator('[data-testid="chat-menu-button"]').click();
    await expect(
      chatDetailView.locator('[data-testid="menu-action-chat-open-in-bsky"]'),
    ).toBeVisible();
    await expect(
      chatDetailView.locator('[data-testid="menu-action-group-chat-details"]'),
    ).toHaveCount(0);
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
    await expect(
      chatDetailView.locator('[data-testid="message-reactions"]'),
    ).toHaveAttribute("aria-label", "You reacted 👍");

    // A lone reaction bubble is not clickable
    await expect(chatDetailView.locator("button.reaction-bubble")).toHaveCount(
      0,
    );

    // Remove the reaction via the palette's active emoji button
    await chatDetailView.locator(".message-bubble").first().click();
    await chatDetailView
      .locator('[data-testid="message-emoji-trigger"]')
      .first()
      .click();
    await expect(chatDetailView.locator(".reaction-palette")).toBeVisible({
      timeout: 5000,
    });
    await chatDetailView
      .locator(
        '[data-testid="reaction-palette-button"][data-teststate="active"]',
      )
      .click();

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
    const input = chatDetailView.locator(
      'chat-input [data-testid="rich-text-input"]',
    );
    await expect(input).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await input.fill("hello ");

    await chatDetailView.locator(".message-input-emoji-button").click();

    const picker = page.locator("dialog.emoji-picker-dialog-host emoji-picker");
    await expect(picker).toHaveCount(1, { timeout: 5000 });

    await picker.locator('button.emoji[aria-label*="party popper"]').click();

    await expect(input).toHaveText("hello 🎉");
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

  test("should show the chat-input emoji button on mobile viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

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
      chatDetailView.locator('chat-input [data-testid="rich-text-input"]'),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(
      chatDetailView.locator(".message-input-emoji-button"),
    ).toBeVisible();
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

    test("hides the author name on emoji-only received clusters", async ({
      page,
    }) => {
      const mockServer = setupGroupConvo({
        messages: [
          createMessage({
            id: "msg-2",
            text: "😀",
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
      await expect(chatDetailView.locator(".rich-text-emoji-only")).toBeVisible(
        { timeout: 10000 },
      );
      // Bob's emoji-only cluster gets no author label; Alice's still does
      const authorNames = chatDetailView.locator(
        '[data-testid="message-author-name"]',
      );
      await expect(authorNames).toHaveCount(1);
      await expect(authorNames).toContainText("Alice");
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

    test("opens the reactions dialog from the pill with own reactions listed first", async ({
      page,
    }) => {
      const message = createMessage({
        id: "msg-1",
        text: "Hello group",
        senderDid: alice.did,
      });
      message.reactions = [
        {
          createdAt: "2025-01-15T12:05:00.000Z",
          sender: { did: alice.did },
          value: "❤️",
        },
        {
          createdAt: "2025-01-15T12:06:00.000Z",
          sender: { did: userProfile.did },
          value: "👍",
        },
      ];
      const mockServer = setupGroupConvo({ messages: [message] });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      const reactionPill = chatDetailView.locator(
        '[data-testid="message-reactions"]',
      );
      await expect(reactionPill).toBeVisible({ timeout: 10000 });

      await reactionPill.click();
      const dialog = page.locator('[data-testid="reactions-dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const rows = dialog.locator('[data-testid="reaction-row"]');
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toHaveAttribute("data-teststate", "own");
    });

    test("caps visible reaction emojis at 10 and shows the total count", async ({
      page,
    }) => {
      const message = createMessage({
        id: "msg-1",
        text: "Hello group",
        senderDid: alice.did,
      });
      const emojis = [
        "❤️",
        "👍",
        "😆",
        "👀",
        "😢",
        "🎉",
        "🔥",
        "✨",
        "🙌",
        "💯",
        "🚀",
      ];
      message.reactions = emojis.map((emoji, index) => ({
        createdAt: `2025-01-15T12:${String(index).padStart(2, "0")}:00.000Z`,
        sender: { did: index % 2 === 0 ? alice.did : bob.did },
        value: emoji,
      }));
      const mockServer = setupGroupConvo({ messages: [message] });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(10, {
        timeout: 10000,
      });
      await expect(chatDetailView.locator(".reaction-count")).toHaveText("11");
    });

    test("hides reactions from blocked senders", async ({ page }) => {
      const blockedBob = createProfile({
        did: bob.did,
        handle: bob.handle,
        displayName: bob.displayName,
        viewer: { blocking: "at://did:plc:testuser/app.bsky.graph.block/1" },
      });
      const message = createMessage({
        id: "msg-1",
        text: "Hello group",
        senderDid: alice.did,
      });
      message.reactions = [
        {
          createdAt: "2025-01-15T12:05:00.000Z",
          sender: { did: blockedBob.did },
          value: "❤️",
        },
        {
          createdAt: "2025-01-15T12:06:00.000Z",
          sender: { did: alice.did },
          value: "👍",
        },
      ];
      const mockServer = setupGroupConvo({
        otherMembers: [alice, blockedBob],
        messages: [message],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/group-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(chatDetailView.locator(".reaction-bubble")).toHaveCount(1, {
        timeout: 10000,
      });
      await expect(chatDetailView.locator(".reaction-emoji")).toContainText(
        "👍",
      );
      await expect(
        chatDetailView.locator('[data-testid="message-reactions"]'),
      ).toHaveAttribute(
        "aria-label",
        "Alice reacted 👍. Tap to view reactions",
      );
    });
  });

  test("clicking the message more button opens Reply menu and staging shows the chip", async ({
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
      text: "How are you?",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [original]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const wrapper = chatDetailView.locator(
      '.message-wrapper[data-message-id="msg-1"]',
    );
    await expect(wrapper).toBeVisible({ timeout: 10000 });

    await wrapper
      .locator('[data-testid="message-more-trigger"]')
      .click({ force: true });

    const replyItem = page.locator('[data-testid="message-action-reply"]');
    await expect(replyItem).toBeVisible();
    await replyItem.click();

    const preview = chatDetailView.locator(
      '[data-testid="message-reply-preview"]',
    );
    await expect(preview).toBeVisible();
    await expect(
      preview.locator('[data-testid="reply-preview-sender"]'),
    ).toContainText("Alice");
    await expect(
      preview.locator('[data-testid="reply-preview-text"]'),
    ).toContainText("How are you?");

    // Clearing the reply hides the chip
    await preview.locator('[data-testid="reply-preview-clear"]').click();
    await expect(preview).toHaveCount(0);
  });

  test("message more button is hidden for locked group chats", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const groupConvo = createGroupConvo({
      id: "convo-1",
      name: "Group",
      otherMembers: [alice],
      lockStatus: "locked",
    });
    const message = createMessage({
      id: "msg-1",
      text: "Hi there",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    mockServer.addConvos([groupConvo]);
    mockServer.addConvoMessages("convo-1", [message]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="chat-locked-notice"]'),
    ).toBeVisible({ timeout: 10000 });

    const wrapper = chatDetailView.locator(
      '.message-wrapper[data-message-id="msg-1"]',
    );
    await expect(wrapper).toBeVisible();
    await expect(
      wrapper.locator('[data-testid="message-more-trigger"]'),
    ).toHaveCount(0);
  });

  test("sending with a staged reply includes replyTo and clears the chip", async ({
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
      text: "How are you?",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [original]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const wrapper = chatDetailView.locator(
      '.message-wrapper[data-message-id="msg-1"]',
    );
    await expect(wrapper).toBeVisible({ timeout: 10000 });

    await wrapper
      .locator('[data-testid="message-more-trigger"]')
      .click({ force: true });
    await page.locator('[data-testid="message-action-reply"]').click();

    const preview = chatDetailView.locator(
      '[data-testid="message-reply-preview"]',
    );
    await expect(preview).toBeVisible();

    await chatDetailView
      .locator('chat-input [data-testid="rich-text-input"]')
      .fill("Doing great!");
    await chatDetailView.locator(".message-input-send-button").click();

    await expect(preview).toHaveCount(0);
    await expect(chatDetailView.locator(".message-sent")).toHaveCount(1, {
      timeout: 10000,
    });
    expect(mockServer.sentMessageRequests).toHaveLength(1);
    expect(mockServer.sentMessageRequests[0].message.replyTo).toEqual({
      messageId: "msg-1",
    });
  });

  test("shows block-specific toast and keeps the staged reply when send fails due to a block", async ({
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
      text: "How are you?",
      senderDid: alice.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", [original]);
    mockServer.failSendMessage({
      message: "block between recipient and sender",
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const wrapper = chatDetailView.locator(
      '.message-wrapper[data-message-id="msg-1"]',
    );
    await expect(wrapper).toBeVisible({ timeout: 10000 });

    await wrapper
      .locator('[data-testid="message-more-trigger"]')
      .click({ force: true });
    await page.locator('[data-testid="message-action-reply"]').click();

    const preview = chatDetailView.locator(
      '[data-testid="message-reply-preview"]',
    );
    await expect(preview).toBeVisible();

    await chatDetailView
      .locator('chat-input [data-testid="rich-text-input"]')
      .fill("Doing great!");
    await chatDetailView.locator(".message-input-send-button").click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Can't send: block between you and recipient",
    );
    await expect(preview).toBeVisible();
  });

  test("should show a user card empty state when there are no messages", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
      viewer: {
        followedBy: "at://did:plc:alice1/app.bsky.graph.follow/follow1",
      },
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
    const infoPanel = chatDetailView.locator('[data-testid="chat-info-panel"]');
    await expect(infoPanel).toBeVisible({ timeout: 10000 });
    await expect(infoPanel).toContainText("Alice");
    await expect(infoPanel).toContainText("@alice.bsky.social");
    await expect(
      infoPanel.locator('[data-testid="avatar-image"]'),
    ).toBeVisible();
    await expect(
      infoPanel.locator('[data-testid="follows-you-badge"]'),
    ).toBeVisible();

    await infoPanel
      .locator('[data-testid="chat-info-panel-go-to-profile"]')
      .click();
    await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social/);
  });

  test("should show moderation label pills on the empty state user card", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const labelerDid = "did:plc:customlabeler1";
    const labeler = createLabelerView({
      did: labelerDid,
      handle: "safety.example.com",
      displayName: "Safety Labeler",
      labelDefinitions: [
        {
          identifier: "spam",
          blurs: "none",
          severity: "inform",
          defaultSetting: "warn",
          locales: [
            {
              lang: "en",
              name: "Spam",
              description: "Likely spam content",
            },
          ],
        },
      ],
    });
    mockServer.addLabelerViews([labeler]);
    mockServer.addLabelerSubscription(labelerDid);

    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
      labels: [
        {
          val: "spam",
          src: labelerDid,
          uri: "did:plc:alice1",
          cts: "2025-01-01T00:00:00.000Z",
        },
      ],
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
    const infoPanel = chatDetailView.locator('[data-testid="chat-info-panel"]');
    await expect(infoPanel).toBeVisible({ timeout: 10000 });
    const labelBadge = infoPanel.locator('[data-testid="label-badge"]');
    await expect(labelBadge).toBeVisible();
    await expect(
      labelBadge.locator('[data-testid="label-badge-text"]'),
    ).toContainText("Spam");
  });

  test("should show a group card empty state when a group convo has no messages", async ({
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
    const carol = createProfile({
      did: "did:plc:carol1",
      handle: "carol.bsky.social",
      displayName: "Carol",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob, carol],
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMessages("convo-1", []);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    const infoPanel = chatDetailView.locator('[data-testid="chat-info-panel"]');
    await expect(infoPanel).toBeVisible({ timeout: 10000 });
    await expect(infoPanel).toContainText("Cool Group");
    await expect(infoPanel).toContainText(
      "New chat with Alice, Bob, and 1 more.",
    );
    await expect(
      infoPanel.locator('[data-testid="avatar-group"]'),
    ).toBeVisible();
  });

  test("should show the user card above the first message once all history is loaded", async ({
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
    mockServer.addConvoMessages("convo-1", [
      createMessage({
        id: "msg-1",
        text: "Hey there!",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(chatDetailView).toContainText("Hey there!", {
      timeout: 10000,
    });
    const infoPanel = chatDetailView.locator(
      'infinite-scroll-container [data-testid="chat-info-panel"]',
    );
    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText("Alice");

    const panelBox = await infoPanel.boundingBox();
    const messageBox = await chatDetailView
      .locator('.message-wrapper[data-message-id="msg-1"]')
      .boundingBox();
    expect(panelBox.y).toBeLessThan(messageBox.y);
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

  test.describe("Chat invite (joinLink) embeds", () => {
    function makeJoinLinkEmbed(overrides = {}) {
      return {
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: {
          $type: "chat.bsky.group.defs#joinLinkPreviewView",
          code: "abcd1234",
          name: "Friends of Bsky",
          memberCount: 5,
          memberLimit: 50,
          joinRule: "open",
          requireApproval: false,
          owner: {
            did: "did:plc:owner",
            handle: "owner.bsky.social",
            displayName: "Owner",
            avatar: "",
            viewer: {},
            labels: [],
            createdAt: "2025-01-01T00:00:00.000Z",
          },
          viewer: {},
          ...overrides,
        },
      };
    }

    test("renders an available invite embed with name and join action", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const alice = createProfile({
        did: "did:plc:alice1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const convo = createConvo({ id: "convo-1", otherMember: alice });
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", [
        createMessage({
          id: "msg-1",
          text: "",
          senderDid: alice.did,
          sentAt: "2025-01-15T12:00:00.000Z",
          embed: makeJoinLinkEmbed(),
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const view = page.locator("#chat-detail-view");
      const embed = view.locator('[data-testid="join-link-embed"]');
      await expect(embed).toBeVisible({ timeout: 10000 });
      await expect(
        embed.locator('[data-testid="join-link-embed-name"]'),
      ).toContainText("Friends of Bsky");
      await expect(
        embed.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "join");
    });

    test("renders an unavailable card for disabled previews", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const alice = createProfile({
        did: "did:plc:alice1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const convo = createConvo({ id: "convo-1", otherMember: alice });
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", [
        createMessage({
          id: "msg-1",
          text: "",
          senderDid: alice.did,
          sentAt: "2025-01-15T12:00:00.000Z",
          embed: {
            $type: "chat.bsky.embed.joinLink#view",
            joinLinkPreview: {
              $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView",
            },
          },
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const view = page.locator("#chat-detail-view");
      await expect(
        view.locator('[data-testid="join-link-embed-unavailable"]'),
      ).toBeVisible({ timeout: 10000 });
    });

    test("renders Copy action when invite points at the current chat", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const alice = createProfile({
        did: "did:plc:alice1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const convo = createConvo({ id: "convo-1", otherMember: alice });
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", [
        createMessage({
          id: "msg-1",
          text: "",
          senderDid: alice.did,
          sentAt: "2025-01-15T12:00:00.000Z",
          embed: makeJoinLinkEmbed({ convo: { id: "convo-1" } }),
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const view = page.locator("#chat-detail-view");
      await expect(
        view.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "copy", { timeout: 10000 });
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

  test.describe("Tablet (touch, desktop-width viewport)", () => {
    test.use({
      hasTouch: true,
      viewport: { width: 900, height: 1200 },
    });

    test.beforeEach(async ({ page }) => {
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
      mockServer.addConvoMessages("convo-1", [
        createMessage({
          id: "msg-1",
          text: "Hey there!",
          senderDid: alice.did,
          sentAt: "2025-01-15T12:00:00.000Z",
        }),
      ]);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");
    });

    test("tapping a message reveals the emoji trigger and opens the palette", async ({
      page,
    }) => {
      const chatDetailView = page.locator("#chat-detail-view");
      const wrapper = chatDetailView.locator(
        '.message-wrapper[data-message-id="msg-1"]',
      );
      await expect(wrapper).toBeVisible({ timeout: 10000 });

      await wrapper.locator(".message-bubble").tap();
      await expect(wrapper).toHaveClass(/message-wrapper-active/);

      await wrapper.locator('[data-testid="message-emoji-trigger"]').click();
      await expect(chatDetailView.locator(".reaction-palette")).toBeVisible();
    });

    test("tapping a message reveals the more trigger and opens the context menu", async ({
      page,
    }) => {
      const chatDetailView = page.locator("#chat-detail-view");
      const wrapper = chatDetailView.locator(
        '.message-wrapper[data-message-id="msg-1"]',
      );
      await expect(wrapper).toBeVisible({ timeout: 10000 });

      await wrapper.locator(".message-bubble").tap();
      await expect(wrapper).toHaveClass(/message-wrapper-active/);

      await wrapper.locator('[data-testid="message-more-trigger"]').click();
      await expect(
        page.locator('[data-testid="message-action-reply"]'),
      ).toBeVisible();
    });
  });

  test.describe("Record link embeds in composer", () => {
    const quotedPostUri = "at://did:plc:author2/app.bsky.feed.post/3quoted";
    const quotedPostLink =
      "https://bsky.app/profile/did:plc:author2/post/3quoted";

    async function setupConvoWithQuotablePost(page, { postDelayMs = 0 } = {}) {
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
      const quotablePost = createPost({
        uri: quotedPostUri,
        text: "The quotable post",
        authorHandle: "author2.bsky.social",
        authorDisplayName: "Author Two",
      });
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", [
        createMessage({
          id: "msg-1",
          text: "Hey there!",
          senderDid: alice.did,
          sentAt: "2025-01-15T12:00:00.000Z",
        }),
      ]);
      mockServer.addPosts([quotablePost], { delayMs: postDelayMs });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/messages/convo-1");

      const chatDetailView = page.locator("#chat-detail-view");
      await expect(
        chatDetailView.locator('chat-input [data-testid="rich-text-input"]'),
      ).toHaveAttribute("contenteditable", "true", { timeout: 10000 });
      return { mockServer, chatDetailView, quotablePost };
    }

    test("stages a preview for a pasted post link and removes it via the close button", async ({
      page,
    }) => {
      const { chatDetailView } = await setupConvoWithQuotablePost(page);

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .fill(`check this ${quotedPostLink} `);

      const preview = chatDetailView.locator(
        '[data-testid="message-embed-preview"]',
      );
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("The quotable post");

      await chatDetailView
        .locator('[data-testid="message-embed-preview-remove"]')
        .click();
      await expect(preview).toHaveCount(0);
    });

    test("stages a preview immediately on paste without a trailing space", async ({
      page,
    }) => {
      const { chatDetailView } = await setupConvoWithQuotablePost(page);

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .evaluate((input, link) => {
          input.focus();
          const clipboardData = new DataTransfer();
          clipboardData.setData("text/plain", link);
          input.dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData,
            }),
          );
        }, quotedPostLink);

      await expect(
        chatDetailView.locator('[data-testid="message-embed-preview"]'),
      ).toBeVisible();
    });

    test("sends the message with a record embed and strips the trailing link", async ({
      page,
    }) => {
      const { mockServer, chatDetailView, quotablePost } =
        await setupConvoWithQuotablePost(page);

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .fill(`check this ${quotedPostLink} `);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="ready"]',
        ),
      ).toBeVisible();

      await chatDetailView.locator(".message-input-send-button").click();

      await expect.poll(() => mockServer.sentMessageRequests.length).toBe(1);
      const sentMessage = mockServer.sentMessageRequests[0].message;
      expect(sentMessage.text).toBe("check this");
      expect(sentMessage.embed).toEqual({
        $type: "app.bsky.embed.record",
        record: { uri: quotablePost.uri, cid: quotablePost.cid },
      });
      await expect(
        chatDetailView.locator('[data-testid="message-embed-preview"]'),
      ).toHaveCount(0);
    });

    test("sends an embed-only message when the input contains just the link", async ({
      page,
    }) => {
      const { mockServer, chatDetailView, quotablePost } =
        await setupConvoWithQuotablePost(page);

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .fill(`${quotedPostLink} `);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="ready"]',
        ),
      ).toBeVisible();

      await chatDetailView.locator(".message-input-send-button").click();

      await expect.poll(() => mockServer.sentMessageRequests.length).toBe(1);
      const sentMessage = mockServer.sentMessageRequests[0].message;
      expect(sentMessage.text).toBe("");
      expect(sentMessage.embed.record.uri).toBe(quotablePost.uri);
    });

    test("attaches the embed when sent while the preview is still loading", async ({
      page,
    }) => {
      const { mockServer, chatDetailView, quotablePost } =
        await setupConvoWithQuotablePost(page, { postDelayMs: 1500 });

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .fill(`check this ${quotedPostLink} `);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="loading"]',
        ),
      ).toBeVisible();

      await chatDetailView.locator(".message-input-send-button").click();

      await expect
        .poll(() => mockServer.sentMessageRequests.length, { timeout: 10000 })
        .toBe(1);
      const sentMessage = mockServer.sentMessageRequests[0].message;
      expect(sentMessage.text).toBe("check this");
      expect(sentMessage.embed).toEqual({
        $type: "app.bsky.embed.record",
        record: { uri: quotablePost.uri, cid: quotablePost.cid },
      });
    });

    test("shows an error preview for an unresolvable link and sends the message as plain text", async ({
      page,
    }) => {
      const missingPostLink =
        "https://bsky.app/profile/did:plc:author2/post/3missing";
      const { mockServer, chatDetailView } =
        await setupConvoWithQuotablePost(page);

      await chatDetailView
        .locator('chat-input [data-testid="rich-text-input"]')
        .fill(`look at this ${missingPostLink} `);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="error"]',
        ),
      ).toBeVisible();

      await chatDetailView.locator(".message-input-send-button").click();

      await expect.poll(() => mockServer.sentMessageRequests.length).toBe(1);
      const sentMessage = mockServer.sentMessageRequests[0].message;
      expect(sentMessage.text).toBe(`look at this ${missingPostLink}`);
      expect(sentMessage.embed).toBe(undefined);
      await expect(
        chatDetailView.locator('[data-testid="message-embed-preview"]'),
      ).toHaveCount(0);
    });

    test("does not send an embed-only message when the embed can't be resolved", async ({
      page,
    }) => {
      const missingPostLink =
        "https://bsky.app/profile/did:plc:author2/post/3missing";
      const { mockServer, chatDetailView } =
        await setupConvoWithQuotablePost(page);

      const input = chatDetailView.locator(
        'chat-input [data-testid="rich-text-input"]',
      );
      await input.fill(`${missingPostLink} `);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="error"]',
        ),
      ).toBeVisible();

      await input.fill("");
      await chatDetailView.locator(".message-input-send-button").click();

      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      expect(mockServer.sentMessageRequests.length).toBe(0);
      await expect(
        chatDetailView.locator(
          '[data-testid="message-embed-preview"][data-teststate="error"]',
        ),
      ).toBeVisible();
    });
  });

  test("shows a not-found error when the conversation doesn't exist", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-missing");

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="convo-not-found"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(chatDetailView.locator(".message-bubble")).toHaveCount(0);
  });
});
