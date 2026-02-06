import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const noop = () => {};
const postInteractionHandler = {
  isAuthenticated: true,
  handleLike: noop,
  handleRepost: noop,
  handleQuotePost: noop,
  handleBookmark: noop,
  handleMuteAuthor: noop,
  handleBlockAuthor: noop,
  handleDeletePost: noop,
  handleReport: noop,
};

const t = new TestSuite("largePostTemplate");

t.describe("largePostTemplate", (it) => {
  it("should render the post container", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='large-post']") !== null);
  });

  it("should render post with avatar", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render post with author name", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-author-name']") !== null,
    );
  });

  it("should render post text content", () => {
    const postWithText = {
      ...post,
      record: { ...post.record, text: "Hello world!" },
    };
    const result = largePostTemplate({
      post: postWithText,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("Hello world!"));
  });

  it("should render post action bar", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
  });

  it("should render with reply context line when replyContext is parent", () => {
    const result = largePostTemplate({
      post,
      postInteractionHandler,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should render with reply context line when replyContext is reply", () => {
    const result = largePostTemplate({
      post,
      postInteractionHandler,
      replyContext: "reply",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should not render reply context line when no replyContext", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".reply-context-line-in"), null);
  });
});

t.describe("largePostTemplate - blocked/unavailable posts", (it) => {
  it("should render blocked post template for blocked post", () => {
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blocked-uri",
      blocked: true,
    };
    const result = largePostTemplate({
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
    const result = largePostTemplate({
      post: notFoundPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("deleted"));
  });
});

t.describe("largePostTemplate - moderation", (it) => {
  it("should show moderation warning for post with muted word", () => {
    const mutedPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: true },
    };
    const result = largePostTemplate({
      post: mutedPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("moderation-warning") !== null);
  });

  it("should show moderation warning for hidden post", () => {
    const hiddenPost = {
      ...post,
      viewer: { ...post.viewer, isHidden: true },
    };
    const result = largePostTemplate({
      post: hiddenPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("moderation-warning") !== null);
  });

  it("should not show moderation warning for normal post", () => {
    const normalPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: false, isHidden: false },
    };
    const result = largePostTemplate({
      post: normalPost,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("moderation-warning"), null);
  });
});

await t.run();
