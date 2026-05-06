import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { mutedParentToggleTemplate } from "/js/templates/mutedParentToggle.template.js";
import { render, html } from "/js/lib/lit-html.js";

const t = new TestSuite("mutedParentToggleTemplate");

const basePost = {
  uri: "at://did:plc:author/app.bsky.feed.post/abc",
  author: { did: "did:plc:author", viewer: {} },
  viewer: {},
};

const children = html`<div class="parent-content">Parent post</div>`;

t.describe("mutedParentToggleTemplate - muted account", (it) => {
  it("should wrap in muted-parent-toggle with 'Muted account' label", () => {
    const post = {
      ...basePost,
      author: { ...basePost.author, viewer: { muted: true } },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assertEquals(toggle.getAttribute("label"), "Muted account");
    assert(toggle.querySelector(".parent-content") !== null);
  });
});

t.describe("mutedParentToggleTemplate - muted word", (it) => {
  it("should wrap in muted-parent-toggle with 'Hidden by muted word' label", () => {
    const post = {
      ...basePost,
      viewer: { hasMutedWord: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assertEquals(toggle.getAttribute("label"), "Hidden by muted word");
  });
});

t.describe("mutedParentToggleTemplate - hidden post", (it) => {
  it("should wrap in muted-parent-toggle with 'Post hidden by you' label", () => {
    const post = {
      ...basePost,
      viewer: { isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assert(toggle !== null);
    assertEquals(toggle.getAttribute("label"), "Post hidden by you");
  });
});

t.describe("mutedParentToggleTemplate - normal post", (it) => {
  it("should render children directly without wrapping", () => {
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post: basePost, children }), container);
    assertEquals(container.querySelector("muted-parent-toggle"), null);
    assert(container.querySelector(".parent-content") !== null);
  });
});

t.describe("mutedParentToggleTemplate - precedence", (it) => {
  it("should prefer muted account over muted word and hidden", () => {
    const post = {
      ...basePost,
      author: { ...basePost.author, viewer: { muted: true } },
      viewer: { hasMutedWord: true, isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assertEquals(toggle.getAttribute("label"), "Muted account");
  });

  it("should prefer muted word over hidden", () => {
    const post = {
      ...basePost,
      viewer: { hasMutedWord: true, isHidden: true },
    };
    const container = document.createElement("div");
    render(mutedParentToggleTemplate({ post, children }), container);
    const toggle = container.querySelector("muted-parent-toggle");
    assertEquals(toggle.getAttribute("label"), "Hidden by muted word");
  });
});

await t.run();
