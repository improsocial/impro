import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const noop = () => {};
const postInteractionHandler = {
  isAuthenticated: true,
  handleLike: noop,
  handleRepost: noop,
  handleQuotePost: noop,
  handleBookmark: noop,
  handleHidePost: noop,
  handleMuteAuthor: noop,
  handleBlockAuthor: noop,
  handleDeletePost: noop,
  handleReport: noop,
};

const t = new TestSuite("smallPostTemplate");

t.describe("smallPostTemplate", (it) => {
  it("should render the post container", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='small-post']") !== null);
  });

  it("should render post with avatar", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render post with author name", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-author-name']") !== null,
    );
  });

  it("should render post text content", () => {
    const postWithText = {
      ...post,
      record: { ...post.record, text: "Hello small world!" },
    };
    const result = smallPostTemplate({
      post: postWithText,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("Hello small world!"));
  });

  it("should render post action bar", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
  });
});

t.describe("smallPostTemplate - pinned posts", (it) => {
  it("should show pinned label when isPinned is true", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      isPinned: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='pinned-label']") !== null);
  });

  it("should not show pinned label when isPinned is false", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      isPinned: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='pinned-label']"), null);
  });
});

t.describe("smallPostTemplate - reposts", (it) => {
  it("should show repost label when repostAuthor is provided", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      repostAuthor: {
        displayName: "Reposter Name",
        handle: "reposter.bsky.social",
      },
    });
    const container = document.createElement("div");
    render(result, container);
    const repostLabel = container.querySelector("[data-testid='repost-label']");
    assert(repostLabel !== null);
    assert(repostLabel.textContent.includes("Reposted by"));
  });

  it("should not show repost label when no repostAuthor", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='repost-label']"), null);
  });
});

t.describe("smallPostTemplate - reply context", (it) => {
  it("should render reply context line-in when replyContext is parent", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should render reply context line-out when replyContext is root", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      replyContext: "root",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-out") !== null);
  });

  it("should render both lines when replyContext is parent", () => {
    const result = smallPostTemplate({
      post: post,
      postInteractionHandler,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
    assert(container.querySelector(".reply-context-line-out") !== null);
  });
});

t.describe("smallPostTemplate - blocked/unavailable posts", (it) => {
  it("should render blocked post template for blocked post", () => {
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blocked-uri",
      blocked: true,
    };
    const result = smallPostTemplate({
      post: blockedPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("unavailable"));
  });

  it("should render not found post template for not found post", () => {
    const notFoundPost = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: "not-found-uri",
      notFound: true,
    };
    const result = smallPostTemplate({
      post: notFoundPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("deleted"));
  });
});

t.describe("smallPostTemplate - moderation", (it) => {
  it("should wrap in muted-reply-toggle for muted account when hideMutedAccount is true", () => {
    const mutedAccountPost = {
      ...post,
      author: { ...post.author, viewer: { muted: true } },
    };
    const result = smallPostTemplate({
      post: mutedAccountPost,
      postInteractionHandler,
      hideMutedAccount: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("muted-reply-toggle") !== null);
  });

  it("should wrap in muted-reply-toggle for post with muted word", () => {
    const mutedWordPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: true },
    };
    const result = smallPostTemplate({
      post: mutedWordPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("muted-reply-toggle") !== null);
  });

  it("should wrap in muted-reply-toggle for hidden post", () => {
    const hiddenPost = {
      ...post,
      viewer: { ...post.viewer, isHidden: true },
    };
    const result = smallPostTemplate({
      post: hiddenPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("muted-reply-toggle") !== null);
  });

  it("should not wrap in muted-reply-toggle for normal post", () => {
    const normalPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: false, isHidden: false },
      author: { ...post.author, viewer: { muted: false } },
    };
    const result = smallPostTemplate({
      post: normalPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("muted-reply-toggle"), null);
  });
});

await t.run();
