import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { createBlockedPost } from "/js/dataHelpers.js";
import { render } from "/js/lib/lit-html.js";

function renderTombstone(post) {
  const container = document.createElement("div");
  render(blockedPostTemplate({ post }), container);
  return container.querySelector("[data-testid='post-tombstone-blocked']");
}

describe("blockedPostTemplate", () => {
  it("should render the blocked tombstone", () => {
    const tombstone = renderTombstone(
      createBlockedPost({
        uri: "at://did:plc:other/app.bsky.feed.post/1",
        author: { did: "did:plc:other", viewer: { blockedBy: true } },
      }),
    );
    assert(tombstone !== null);
    assert.equal(tombstone.dataset.teststate, "blocked");
  });

  it("should render the blocking state when the viewer blocks the author", () => {
    const tombstone = renderTombstone(
      createBlockedPost({
        uri: "at://did:plc:other/app.bsky.feed.post/1",
        author: {
          did: "did:plc:other",
          viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/1" },
        },
      }),
    );
    assert.equal(tombstone.dataset.teststate, "blocking");
  });
});
