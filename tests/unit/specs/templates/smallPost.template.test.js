import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const noop = () => {};
const currentUser = { did: "did:plc:test" };
const postInteractionHandler = {
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

const baseProps = {
  currentUser,
  isAuthenticated: true,
  postInteractionHandler,
};

const t = new TestSuite("smallPostTemplate");

t.describe("smallPostTemplate", (it) => {
  it("should render the post container", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='small-post']") !== null);
  });

  it("should render post with avatar", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render post with author name", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
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
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("Hello small world!"));
  });

  it("should render post action bar", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
  });
});

t.describe("smallPostTemplate - rich text", (it) => {
  it("should truncate long URLs in post text", () => {
    const url = "https://example.com/very/long/path/to/some/page";
    const text = "See " + url;
    const postWithLongUrl = {
      ...post,
      record: {
        ...post.record,
        text,
        facets: [
          {
            index: { byteStart: 4, byteEnd: 4 + url.length },
            features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
          },
        ],
      },
    };
    const result = smallPostTemplate({
      post: postWithLongUrl,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a[href='" + url + "']");
    assert(link !== null);
    assert(link.textContent.endsWith("..."));
    assert(link.textContent.length < url.length);
  });
});

t.describe("smallPostTemplate - pinned posts", (it) => {
  it("should show pinned label when isPinned is true", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      isPinned: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='pinned-label']") !== null);
  });

  it("should not show pinned label when isPinned is false", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
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
      ...baseProps,
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

  it("should show 'Reposted by you' when repostAuthor is the current user", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      repostAuthor: {
        did: "did:plc:test",
        displayName: "Reposter Name",
        handle: "reposter.bsky.social",
      },
    });
    const container = document.createElement("div");
    render(result, container);
    const repostLabel = container.querySelector("[data-testid='repost-label']");
    assert(repostLabel !== null);
    const text = repostLabel.textContent.replace(/\s+/g, " ").trim();
    assert(
      text.includes("Reposted by you"),
      `expected "Reposted by you" in "${text}"`,
    );
    assert(
      !text.includes("Reposter Name"),
      `did not expect display name in "${text}"`,
    );
  });

  it("should not show repost label when no repostAuthor", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
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
      ...baseProps,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should render reply context line-out when replyContext is root", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      replyContext: "root",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-out") !== null);
  });

  it("should render both lines when replyContext is parent", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
    assert(container.querySelector(".reply-context-line-out") !== null);
  });
});

t.describe("smallPostTemplate - reply-to label", (it) => {
  it("should not render reply-to-author label when showReplyToLabel is false", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      showReplyToLabel: false,
      replyToAuthor: { displayName: "Alice", handle: "alice.bsky.social" },
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".reply-to-author"), null);
  });

  it("should render 'Replied to [display name]' when replyToAuthor is provided", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      showReplyToLabel: true,
      replyToAuthor: { displayName: "Alice", handle: "alice.bsky.social" },
    });
    const container = document.createElement("div");
    render(result, container);
    const label = container.querySelector(".reply-to-author");
    assert(label !== null);
    const text = label.textContent.replace(/\s+/g, " ").trim();
    assert(
      text.includes("Replied to Alice"),
      `expected "Replied to Alice" in "${text}"`,
    );
  });

  it("should fall back to handle when replyToAuthor has no displayName", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      showReplyToLabel: true,
      replyToAuthor: { handle: "alice.bsky.social" },
    });
    const container = document.createElement("div");
    render(result, container);
    const label = container.querySelector(".reply-to-author");
    assert(label !== null);
    const text = label.textContent.replace(/\s+/g, " ").trim();
    assert(
      text.includes("Replied to alice.bsky.social"),
      `expected "Replied to alice.bsky.social" in "${text}"`,
    );
  });

  it("should render 'Replied to user' when replyToAuthor is missing", () => {
    const result = smallPostTemplate({
      post: post,
      ...baseProps,
      showReplyToLabel: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const label = container.querySelector(".reply-to-author");
    assert(label !== null);
    const text = label.textContent.replace(/\s+/g, " ").trim();
    assertEquals(text, "⤷ Replied to user");
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
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("Blocked"));
  });

  it("should render not found post template for not found post", () => {
    const notFoundPost = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: "not-found-uri",
      notFound: true,
    };
    const result = smallPostTemplate({
      post: notFoundPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("not found"));
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
      ...baseProps,
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
      ...baseProps,
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
      ...baseProps,
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
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("muted-reply-toggle"), null);
  });
  it("should show author info and lock message for !no-unauthenticated posts when logged out", () => {
    const restrictedPost = {
      ...post,
      author: {
        ...post.author,
        labels: [{ val: "!no-unauthenticated", src: post.author.did }],
      },
    };
    const result = smallPostTemplate({
      post: restrictedPost,
      ...baseProps,
      isAuthenticated: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='avatar']") !== null,
      "should show avatar",
    );
    assert(
      container.querySelector("[data-testid='post-author-name']") !== null,
      "should show author name",
    );
    const messageEl = container.querySelector(
      ".missing-post-indicator.no-unauthenticated",
    );
    assert(messageEl !== null, "should have message element");
    assert(
      messageEl.textContent.includes("Sign-in required"),
      "should show lock message",
    );
    assert(!container.querySelector(".post-text"), "should not show post text");
  });

  it("should render !no-unauthenticated posts normally when logged in", () => {
    const restrictedPost = {
      ...post,
      author: {
        ...post.author,
        labels: [{ val: "!no-unauthenticated", src: post.author.did }],
      },
    };
    const result = smallPostTemplate({
      post: restrictedPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='small-post']") !== null,
      "should render normal post",
    );
    assert(
      !container.textContent.includes(
        "This author has chosen to make their posts visible only to people who are signed in.",
      ),
      "should not show lock message",
    );
  });
});

await t.run();
