import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { whoCanReplyBadgeTemplate } from "/js/templates/whoCanReplyBadge.template.js";
import { render } from "/js/lib/lit-html.js";

function renderBadge(post) {
  const container = document.createElement("div");
  render(whoCanReplyBadgeTemplate({ post }), container);
  return container.querySelector(".who-can-reply-badge");
}

describe("whoCanReplyBadgeTemplate", () => {
  it("shows 'Everybody can reply' when post has no threadgate", () => {
    const badge = renderBadge({});
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Everybody can reply");
    assert(badge.querySelector("app-icon[icon='globe-grid-line']") !== null);
  });

  it("shows 'Everybody can reply' when allow is undefined", () => {
    const post = { threadgate: { record: {} } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Everybody can reply");
    assert(badge.querySelector("app-icon[icon='globe-grid-line']") !== null);
  });

  it("shows 'Replies disabled' when allow is empty", () => {
    const post = { threadgate: { record: { allow: [] } } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Replies disabled");
  });

  it("shows 'Some people can reply' for a mention rule", () => {
    const post = {
      threadgate: {
        record: {
          allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
        },
      },
    };
    const badge = renderBadge(post);
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Some people can reply");
  });

  it("shows 'Some people can reply' for multiple rules including a list", () => {
    const post = {
      threadgate: {
        lists: [
          {
            uri: "at://did:plc:abc/app.bsky.graph.list/123",
            name: "Cool people",
          },
        ],
        record: {
          allow: [
            { $type: "app.bsky.feed.threadgate#followingRule" },
            {
              $type: "app.bsky.feed.threadgate#listRule",
              list: "at://did:plc:abc/app.bsky.graph.list/123",
            },
          ],
        },
      },
    };
    const badge = renderBadge(post);
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Some people can reply");
  });

  it("shows 'Everybody can reply' when only embedding is disabled", () => {
    const post = { viewer: { embeddingDisabled: true } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Everybody can reply");
  });

  it("shows 'Everybody can reply' for everybody + embedding allowed", () => {
    const badge = renderBadge({ viewer: { embeddingDisabled: false } });
    assert(badge !== null);
    assert.deepEqual(badge.textContent.trim(), "Everybody can reply");
  });

  it("exposes a data-testid for e2e tests", () => {
    const post = { threadgate: { record: { allow: [] } } };
    const badge = renderBadge(post);
    assert.deepEqual(badge.getAttribute("data-testid"), "who-can-reply-badge");
  });

  it("renders plain by default and as a link with linkStyle", () => {
    const badge = renderBadge({ author: { handle: "alice.test" } });
    assert.deepEqual(badge.getAttribute("data-teststate"), "plain");

    const container = document.createElement("div");
    render(
      whoCanReplyBadgeTemplate({
        post: { author: { handle: "alice.test" } },
        linkStyle: true,
        onClick: () => {},
      }),
      container,
    );
    const linkBadge = container.querySelector(".who-can-reply-badge");
    assert.deepEqual(linkBadge.getAttribute("data-teststate"), "link");
  });

  it("invokes onClick with the post when clicked", () => {
    const container = document.createElement("div");
    let clickedPost = null;
    const post = { author: { handle: "alice.test" } };
    render(
      whoCanReplyBadgeTemplate({
        post,
        onClick: (targetPost) => {
          clickedPost = targetPost;
        },
      }),
      container,
    );
    container.querySelector(".who-can-reply-badge").click();
    assert.deepEqual(clickedPost, post);
  });
});
