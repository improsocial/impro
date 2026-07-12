import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mutedParentToggleTemplate } from "/js/templates/mutedParentToggle.template.js";
import { render, html } from "/js/lib/lit-html.js";

const basePost = {
  uri: "at://did:plc:author/app.bsky.feed.post/abc",
  author: { did: "did:plc:author", viewer: {} },
  viewer: {},
};

const children = html`<div class="parent-content">Parent post</div>`;

describe("mutedParentToggleTemplate - muted account", () => {
  it("should wrap in muted-parent-toggle with 'Muted account' label", () => {
    const post = {
      ...basePost,
      author: { ...basePost.author, viewer: { muted: true } },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assert.deepEqual(toggle.getAttribute("label"), "Muted account");
    assert(toggle.querySelector(".parent-content") !== null);
  });
});

describe("mutedParentToggleTemplate - muted word", () => {
  it("should wrap in muted-parent-toggle with 'Hidden by muted word' label", () => {
    const post = {
      ...basePost,
      viewer: { hasMutedWord: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assert.deepEqual(toggle.getAttribute("label"), "Hidden by muted word");
  });
});

describe("mutedParentToggleTemplate - hidden post", () => {
  it("should wrap in muted-parent-toggle with 'Post hidden by you' label", () => {
    const post = {
      ...basePost,
      viewer: { isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assert.deepEqual(toggle.getAttribute("label"), "Post hidden by you");
  });
});

describe("mutedParentToggleTemplate - normal post", () => {
  it("should render children directly without wrapping", () => {
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post: basePost, children }), container);
    assert.deepEqual(container.querySelector("muted-parent-toggle"), null);
    assert(container.querySelector(".parent-content") !== null);
  });
});

describe("mutedParentToggleTemplate - precedence", () => {
  it("should prefer muted account over muted word and hidden", () => {
    const post = {
      ...basePost,
      author: { ...basePost.author, viewer: { muted: true } },
      viewer: { hasMutedWord: true, isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert.deepEqual(toggle.getAttribute("label"), "Muted account");
  });

  it("should prefer muted word over hidden", () => {
    const post = {
      ...basePost,
      viewer: { hasMutedWord: true, isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert.deepEqual(toggle.getAttribute("label"), "Hidden by muted word");
  });
});
