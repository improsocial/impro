import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { render } from "/js/lib/lit-html.js";
import { chatJoinLinkEmbedTemplate } from "/js/templates/chatJoinLinkEmbed.template.js";

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

describe("chatJoinLinkEmbedTemplate", () => {
  it("renders the unavailable card when preview is not available", () => {
    const container = renderEmbed({
      preview: { $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView" },
    });
    assert(
      container.querySelector("[data-testid='join-link-embed-unavailable']") !==
        null,
    );
    assert.deepEqual(
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
    assert.deepEqual(teststate, "copy");
    assert.deepEqual(label, "Copy link");
    assert.deepEqual(disabled, false);
  });

  it("renders the open action when viewer is a member of a different chat", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ convo: { id: "convo123" } }),
      currentConvoId: "other",
    });
    const { teststate, label } = getActionState(container);
    assert.deepEqual(teststate, "open");
    assert.deepEqual(label, "Open chat");
  });

  it("renders the join action when not a member and no approval", () => {
    const container = renderEmbed({ preview: makeJoinLinkPreview() });
    const { teststate, label, disabled } = getActionState(container);
    assert.deepEqual(teststate, "join");
    assert.deepEqual(label, "Join");
    assert.deepEqual(disabled, false);
  });

  it("renders the request action when requireApproval is true", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ requireApproval: true }),
    });
    const { teststate, label } = getActionState(container);
    assert.deepEqual(teststate, "request");
    assert.deepEqual(label, "Request to join");
  });

  it("renders a disabled action when the chat is full", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ memberCount: 50, memberLimit: 50 }),
    });
    const { teststate, disabled } = getActionState(container);
    assert.deepEqual(teststate, "full");
    assert.deepEqual(disabled, true);
  });

  it("renders a disabled follow-required action when joinRule is followedByOwner and not followed", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ joinRule: "followedByOwner" }),
    });
    const { teststate, disabled } = getActionState(container);
    assert.deepEqual(teststate, "follow-required");
    assert.deepEqual(disabled, true);
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
    assert.deepEqual(teststate, "join");
    assert.deepEqual(disabled, false);
  });

  it("renders the requested action when viewer.requestedAt is set and no convoId", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({
        viewer: { requestedAt: "2026-06-26T00:00:00Z" },
      }),
    });
    const { teststate, label } = getActionState(container);
    assert.deepEqual(teststate, "requested");
    assert.deepEqual(label, "Requested");
  });

  it("dispatches a bubbling chat-join-link:click event when the button is clicked", () => {
    const preview = makeJoinLinkPreview();
    const container = renderEmbed({ preview });
    const received = [];
    container.addEventListener("chat-join-link:click", (event) =>
      received.push(event.detail),
    );
    container.querySelector("[data-testid='join-link-embed-action']").click();
    assert.deepEqual(received, [{ actionType: "join", preview }]);
  });

  it("does not dispatch an event when the action is disabled", () => {
    const container = renderEmbed({
      preview: makeJoinLinkPreview({ memberCount: 50, memberLimit: 50 }),
    });
    const received = [];
    container.addEventListener("chat-join-link:click", (event) =>
      received.push(event.detail),
    );
    container.querySelector("[data-testid='join-link-embed-action']").click();
    assert.deepEqual(received, []);
  });
});
