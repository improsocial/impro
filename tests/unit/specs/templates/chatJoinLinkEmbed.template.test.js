import { TestSuite } from "../../testSuite.js";
import { assertEquals, assert } from "../../testHelpers.js";
import { render } from "/js/lib/lit-html.js";
import { chatJoinLinkEmbedTemplate } from "/js/templates/chatJoinLinkEmbed.template.js";

const t = new TestSuite("chatJoinLinkEmbedTemplate");

function makeJoinLinkPreview(overrides = {}) {
  return {
    $type: "chat.bsky.group.defs#joinLinkPreviewView",
    code: "abcdefg",
    name: "Friends of Bsky",
    memberCount: 5,
    memberLimit: 50,
    joinRule: "open",
    requireApproval: false,
    owner: { did: "did:plc:owner", handle: "owner.test", viewer: {} },
    viewer: {},
    ...overrides,
  };
}

function renderEmbed({ preview, currentConvoId = null } = {}) {
  const container = document.createElement("div");
  render(
    chatJoinLinkEmbedTemplate({
      embed: {
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: preview,
      },
      currentConvoId,
      onClick: () => {},
    }),
    container,
  );
  return container;
}

function getActionState(container) {
  const action = container.querySelector(
    "[data-testid='join-link-embed-action']",
  );
  return {
    teststate: action?.getAttribute("data-teststate") ?? null,
    label:
      action?.querySelector(".chat-join-link-action-label")?.textContent ??
      null,
    disabled: action?.hasAttribute("disabled") ?? false,
  };
}

t.describe("chatJoinLinkEmbedTemplate", (it) => {
  it("renders the unavailable card when preview is not available", () => {
    const container = renderEmbed({
      preview: { $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView" },
    });
    assert(
      container.querySelector("[data-testid='join-link-embed-unavailable']") !==
        null,
    );
    assertEquals(
      container.querySelector("[data-testid='join-link-embed']").dataset
        .teststate,
      "unavailable",
    );
  });

  it("renders the copy action when viewer is already in this chat", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ convo: { id: "convo123" } }),
      currentConvoId: "convo123",
    });
    const { teststate, label, disabled } = getActionState(container);
    assertEquals(teststate, "copy");
    assertEquals(label, "Copy link");
    assertEquals(disabled, false);
  });

  it("renders the open action when viewer is a member of a different chat", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ convo: { id: "convo123" } }),
      currentConvoId: "other",
    });
    const { teststate, label } = getActionState(container);
    assertEquals(teststate, "open");
    assertEquals(label, "Open chat");
  });

  it("renders the join action when not a member and no approval", () => {
    const container = renderEmbed({ preview: makeJoinLinkPreview() });
    const { teststate, label, disabled } = getActionState(container);
    assertEquals(teststate, "join");
    assertEquals(label, "Join");
    assertEquals(disabled, false);
  });

  it("renders the request action when requireApproval is true", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ requireApproval: true }),
    });
    const { teststate, label } = getActionState(container);
    assertEquals(teststate, "request");
    assertEquals(label, "Request to join");
  });

  it("renders a disabled action when the chat is full", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ memberCount: 50, memberLimit: 50 }),
    });
    const { teststate, disabled } = getActionState(container);
    assertEquals(teststate, "full");
    assertEquals(disabled, true);
  });

  it("renders a disabled follow-required action when joinRule is followedByOwner and not followed", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ joinRule: "followedByOwner" }),
    });
    const { teststate, disabled } = getActionState(container);
    assertEquals(teststate, "follow-required");
    assertEquals(disabled, true);
  });

  it("renders the join action when followedByOwner but viewer is followed", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({
        joinRule: "followedByOwner",
        owner: {
          did: "did:plc:owner",
          handle: "owner.test",
          viewer: { followedBy: "at://x" },
        },
      }),
    });
    const { teststate, disabled } = getActionState(container);
    assertEquals(teststate, "join");
    assertEquals(disabled, false);
  });

  it("renders the requested action when viewer.requestedAt is set and no convoId", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({
        viewer: { requestedAt: "2026-06-26T00:00:00Z" },
      }),
    });
    const { teststate, label } = getActionState(container);
    assertEquals(teststate, "requested");
    assertEquals(label, "Requested");
  });

  it("invokes onClick with the action type when the button is clicked", () => {
    const container = document.createElement("div");
    const received = [];
    render(
      chatJoinLinkEmbedTemplate({
        embed: {
          $type: "chat.bsky.embed.joinLink#view",
          joinLinkPreview: makeJoinLinkPreview(),
        },
        currentConvoId: null,
        onClick: (actionType) => received.push(actionType),
      }),
      container,
    );
    container.querySelector("[data-testid='join-link-embed-action']").click();
    assertEquals(received, ["join"]);
  });

  it("does not invoke onClick when the action is disabled", () => {
    const container = document.createElement("div");
    const received = [];
    render(
      chatJoinLinkEmbedTemplate({
        embed: {
          $type: "chat.bsky.embed.joinLink#view",
          joinLinkPreview: makeJoinLinkPreview({
            memberCount: 50,
            memberLimit: 50,
          }),
        },
        currentConvoId: null,
        onClick: (actionType) => received.push(actionType),
      }),
      container,
    );
    container.querySelector("[data-testid='join-link-embed-action']").click();
    assertEquals(received, []);
  });
});

await t.run();
