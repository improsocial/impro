import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  whoCanReplyBadgeTemplate,
  WhoCanReplyModal,
} from "/js/templates/whoCanReplyBadge.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("whoCanReplyBadgeTemplate");

function renderBadge(post) {
  const container = document.createElement("div");
  render(whoCanReplyBadgeTemplate({ post }), container);
  return container.querySelector(".who-can-reply-badge");
}

t.describe("whoCanReplyBadgeTemplate", (it) => {
  it("shows 'Everybody can reply' when post has no threadgate", () => {
    const badge = renderBadge({});
    assert(badge !== null);
    assertEquals(badge.textContent.trim(), "Everybody can reply");
    assert(badge.querySelector(".globe-icon") !== null);
  });

  it("shows 'Everybody can reply' when allow is undefined", () => {
    const post = { threadgate: { record: {} } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assertEquals(badge.textContent.trim(), "Everybody can reply");
    assert(badge.querySelector(".globe-icon") !== null);
  });

  it("shows 'Replies disabled' when allow is empty", () => {
    const post = { threadgate: { record: { allow: [] } } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assertEquals(badge.textContent.trim(), "Replies disabled");
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
    assertEquals(badge.textContent.trim(), "Some people can reply");
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
    assertEquals(badge.textContent.trim(), "Some people can reply");
  });

  it("shows 'Everybody can reply' when only embedding is disabled", () => {
    const post = { viewer: { embeddingDisabled: true } };
    const badge = renderBadge(post);
    assert(badge !== null);
    assertEquals(badge.textContent.trim(), "Everybody can reply");
  });

  it("shows 'Everybody can reply' for everybody + embedding allowed", () => {
    const badge = renderBadge({ viewer: { embeddingDisabled: false } });
    assert(badge !== null);
    assertEquals(badge.textContent.trim(), "Everybody can reply");
  });

  it("exposes a data-testid for e2e tests", () => {
    const post = { threadgate: { record: { allow: [] } } };
    const badge = renderBadge(post);
    assertEquals(badge.getAttribute("data-testid"), "who-can-reply-badge");
  });
});

t.describe("WhoCanReplyModal", (it, { beforeEach }) => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const everybodyPost = { author: { handle: "alice.test" } };
  const nobodyPost = {
    author: { handle: "alice.test" },
    threadgate: { record: { allow: [] } },
  };
  const followersPost = {
    author: { handle: "alice.test" },
    threadgate: {
      record: {
        allow: [{ $type: "app.bsky.feed.threadgate#followerRule" }],
      },
    },
  };
  const mentionAndFollowingPost = {
    author: { handle: "alice.test" },
    threadgate: {
      record: {
        allow: [
          { $type: "app.bsky.feed.threadgate#mentionRule" },
          { $type: "app.bsky.feed.threadgate#followingRule" },
        ],
      },
    },
  };

  const findDialog = () =>
    document.querySelector('[data-testid="who-can-reply-modal"]');

  it("should create a dialog with the who-can-reply testid", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
  });

  it("should render the title", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const title = document.querySelector('[data-testid="modal-title"]');
    assert(title !== null);
  });

  it("should render everybody message when no threadgate", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Everybody can reply to this post."));
  });

  it("should render nobody message when allow is empty", () => {
    WhoCanReplyModal.open({ post: nobodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Replies to this post are disabled."));
  });

  it("should render followers rule", () => {
    WhoCanReplyModal.open({ post: followersPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Only"));
    assert(body.textContent.includes("users following"));
    assert(body.textContent.includes("@alice.test"));
    assert(body.textContent.includes("can reply."));
  });

  it("should join multiple rules with 'and'", () => {
    WhoCanReplyModal.open({ post: mentionAndFollowingPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("mentioned users"));
    assert(body.textContent.includes(", and "));
    assert(body.textContent.includes("users followed by"));
  });

  it("should not show quote message when embedding is enabled", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(!body.textContent.includes("quote this post"));
  });

  it("should show quote message when embedding is disabled", () => {
    WhoCanReplyModal.open({
      post: { ...everybodyPost, viewer: { embeddingDisabled: true } },
    });
    const body = document.querySelector(".who-can-reply-body");
    assert(
      body.textContent.includes("No one but the author can quote this post."),
    );
  });

  it("should close and remove on primary button click", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const button = document.querySelector(
      '[data-testid="modal-primary-button"]',
    );
    button.click();
    assert(findDialog() === null);
  });

  it("should close and remove on backdrop click", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(findDialog() === null);
  });

  it("should close and remove on cancel event", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(findDialog() === null);
  });
});

await t.run();
