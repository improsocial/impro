import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createGroupConvo,
  createMessage,
  createMessageLog,
  createProfile,
  createSystemMessage,
  createSystemMessageLog,
} from "../../factories.js";

test.describe("Group chat participation flow", () => {
  test("should open a group from the inbox, send a message, and receive polled updates", async ({
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
    const groupConvo = createGroupConvo({
      id: "group-1",
      name: "Book Club",
      otherMembers: [alice, bob],
      lastMessage: createMessage({
        id: "msg-1",
        text: "Chapter 3 tonight?",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    });
    mockServer.addConvos([groupConvo]);
    mockServer.addConvoMessages("group-1", [
      createMessage({
        id: "msg-1",
        text: "Chapter 3 tonight?",
        senderDid: alice.did,
        sentAt: "2025-01-15T12:00:00.000Z",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    // Open the group from the inbox
    const chatView = page.locator("#chat-view");
    const groupItem = chatView.locator('[data-testid="convo-item-group"]');
    await expect(groupItem).toHaveCount(1, { timeout: 10000 });
    await groupItem.click();

    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Book Club", { timeout: 10000 });
    await expect(
      chatDetailView.locator('[data-testid="header-subtitle"]'),
    ).toContainText("3 members");
    await expect(
      chatDetailView.locator('[data-testid="message-author-name"]'),
    ).toContainText("Alice");

    // Send a message
    await chatDetailView.locator(".message-input-field").fill("Count me in!");
    await chatDetailView.locator(".message-input-send-button").click();
    await expect(
      chatDetailView.locator(".message-sent .message-text"),
    ).toContainText("Count me in!", { timeout: 10000 });

    // A reply and a member-leave event arrive via the poll
    mockServer.addChatLogs([
      createMessageLog({
        convoId: "group-1",
        message: createMessage({
          id: "msg-bob-1",
          text: "Same here!",
          senderDid: bob.did,
          sentAt: "2025-01-15T12:05:00.000Z",
        }),
      }),
      createSystemMessageLog({
        convoId: "group-1",
        logType: "logMemberLeave",
        message: createSystemMessage({
          id: "sys-1",
          dataType: "systemMessageDataMemberLeave",
          data: { member: { did: alice.did } },
          sentAt: "2025-01-15T12:06:00.000Z",
        }),
        relatedProfiles: [alice],
      }),
    ]);

    await expect(
      chatDetailView.locator(".message-received .message-text"),
    ).toContainText(["Chapter 3 tonight?", "Same here!"], { timeout: 15000 });
    await expect(
      chatDetailView.locator('[data-testid="system-message"]'),
    ).toContainText("Alice left the group", { timeout: 15000 });
    // The member-leave event also updates the member count in the header
    await expect(
      chatDetailView.locator('[data-testid="header-subtitle"]'),
    ).toContainText("2 members");
  });
});
