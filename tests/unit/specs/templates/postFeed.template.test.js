import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { post, feed } from "../../testData.js";
import { createPost, createFeedItem } from "../../../shared/factories.js";
import { render } from "/js/lib/lit-html.js";
import { noop } from "/js/utils.js";

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
};

const postInteractionHandler = {
  handleLike: noop,
  handleRepost: noop,
  handleDelete: noop,
  handleShare: noop,
};

describe("postFeedTemplate - loading state", () => {
  it("should render skeleton when feed is null", () => {
    const result = postFeedTemplate({
      feed: null,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-skeleton']") !== null);
  });

  it("should render multiple skeleton posts when loading", () => {
    const result = postFeedTemplate({
      feed: null,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const skeletons = container.querySelectorAll(
      "[data-testid='post-skeleton']",
    );
    assert(skeletons.length > 1);
  });
});

describe("postFeedTemplate - empty state", () => {
  it("should render empty message when feed is empty", () => {
    const result = postFeedTemplate({
      feed: { feed: [], cursor: null },
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='feed-end-message']") !== null,
    );
  });

  it("should show custom empty message when provided", () => {
    const result = postFeedTemplate({
      feed: { feed: [], cursor: null },
      currentUser: mockUser,
      emptyMessage: "No posts yet!",
    });
    const container = document.createElement("div");
    render(result, container);
    const message = container.querySelector("[data-testid='feed-end-message']");
    assert(message.textContent.includes("No posts yet!"));
  });
});

describe("postFeedTemplate - feed with posts", () => {
  it("should render feed items", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItems = container.querySelectorAll("[data-testid='feed-item']");
    assert.deepEqual(feedItems.length, 2);
  });

  it("should render infinite scroll container", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("infinite-scroll-container") !== null);
  });

  it("should set data-post-uri attribute on feed items", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 1), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItem = container.querySelector("[data-testid='feed-item']");
    assert(feedItem.getAttribute("data-post-uri") !== null);
  });
});

describe("postFeedTemplate - reply context", () => {
  const rootUri = "at://did:plc:rootauthor/app.bsky.feed.post/root1";
  const parentUri = "at://did:plc:parentauthor/app.bsky.feed.post/parent1";

  function createReplyPost() {
    return createPost({
      uri: "at://did:plc:replyauthor/app.bsky.feed.post/reply1",
      text: "reply post",
      authorHandle: "replyauthor.bsky.social",
      authorDisplayName: "Reply Author",
      reply: {
        root: { uri: rootUri, cid: "cid-root" },
        parent: { uri: parentUri, cid: "cid-parent" },
      },
    });
  }

  function renderFeedItem(feedItem) {
    const result = postFeedTemplate({
      feed: { feed: [feedItem], cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    return container;
  }

  it("should render the parent without a root post when reply.root is null", () => {
    const parentPost = createPost({
      uri: parentUri,
      text: "parent post",
      authorHandle: "parent.bsky.social",
      authorDisplayName: "Parent Author",
    });
    const container = renderFeedItem(
      createFeedItem({
        post: createReplyPost(),
        reply: { root: null, parent: parentPost },
      }),
    );
    const smallPosts = container.querySelectorAll("[data-testid='small-post']");
    assert.deepEqual(smallPosts.length, 2);
    assert(
      container.querySelector("[data-testid='post-tombstone-not-found']") ===
        null,
    );
  });

  it("should show a reply-to label instead of reply context when the parent is blocked", () => {
    const container = renderFeedItem(
      createFeedItem({
        post: createReplyPost(),
        reply: {
          root: {
            $type: "app.bsky.feed.defs#notFoundPost",
            uri: rootUri,
            notFound: true,
          },
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: parentUri,
            blocked: true,
            author: { did: "did:plc:parentauthor", viewer: {} },
          },
        },
      }),
    );
    const smallPosts = container.querySelectorAll("[data-testid='small-post']");
    assert.deepEqual(smallPosts.length, 1);
    assert(
      container.querySelector("[data-testid='post-tombstone-blocked']") ===
        null,
    );
    const label = container.querySelector("[data-testid='reply-to-label']");
    const labelText = label.textContent.replace(/\s+/g, " ");
    assert(labelText.includes("Replied to a blocked post"));
  });

  it("should show a reply-to label instead of reply context when the parent is not found", () => {
    const container = renderFeedItem(
      createFeedItem({
        post: createReplyPost(),
        reply: {
          root: {
            $type: "app.bsky.feed.defs#notFoundPost",
            uri: rootUri,
            notFound: true,
          },
          parent: {
            $type: "app.bsky.feed.defs#notFoundPost",
            uri: parentUri,
            notFound: true,
          },
        },
      }),
    );
    assert(
      container.querySelector("[data-testid='post-tombstone-not-found']") ===
        null,
    );
    const label = container.querySelector("[data-testid='reply-to-label']");
    const labelText = label.textContent.replace(/\s+/g, " ");
    assert(labelText.includes("Replied to a post"));
    assert(!labelText.includes("blocked"));
  });

  it("should label the parent when the root it replies to is blocked", () => {
    const parentPost = createPost({
      uri: parentUri,
      text: "parent post",
      authorHandle: "parent.bsky.social",
      authorDisplayName: "Parent Author",
      reply: {
        root: { uri: rootUri, cid: "cid-root" },
        parent: { uri: rootUri, cid: "cid-root" },
      },
    });
    const container = renderFeedItem(
      createFeedItem({
        post: createReplyPost(),
        reply: {
          root: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: rootUri,
            blocked: true,
            author: { did: "did:plc:rootauthor", viewer: {} },
          },
          parent: parentPost,
        },
      }),
    );
    const smallPosts = container.querySelectorAll("[data-testid='small-post']");
    assert.deepEqual(smallPosts.length, 2);
    assert(
      container.querySelector("[data-testid='post-tombstone-blocked']") ===
        null,
    );
    assert(container.querySelector(".load-more-link") === null);
    const label = container.querySelector("[data-testid='reply-to-label']");
    const labelText = label.textContent.replace(/\s+/g, " ");
    assert(labelText.includes("Replied to a blocked post"));
    // the parent is the topmost rendered post, so only the reply below it
    // should draw an incoming reply line
    assert.deepEqual(
      container.querySelectorAll(".reply-context-line-in").length,
      1,
    );
    assert.deepEqual(
      container.querySelectorAll(".reply-context-line-out").length,
      1,
    );
  });
});

describe("postFeedTemplate - pagination", () => {
  it("should show loading indicator when hasMore is true", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: "next-cursor" },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='feed-loading-indicator']") !==
        null,
    );
  });

  it("should show end of feed message when hasMore is false and showEndMessage is true", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
      showEndMessage: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const endMessage = container.querySelector(
      "[data-testid='feed-end-message']",
    );
    assert(endMessage !== null);
    assert(endMessage.textContent.includes("End of feed"));
  });

  it("should not show end of feed message by default when hasMore is false", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='feed-end-message']"),
      null,
    );
  });
});

describe("postFeedTemplate - hidden posts", () => {
  it("should show feedback message for hidden posts", () => {
    const feedWithPost = feed.slice(0, 1);
    const hiddenUri = feedWithPost[0].post.uri;
    const result = postFeedTemplate({
      feed: { feed: feedWithPost, cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
      hiddenPostUris: [hiddenUri],
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='feed-feedback-message']") !== null,
    );
  });

  it("should show feedback message text", () => {
    const feedWithPost = feed.slice(0, 1);
    const hiddenUri = feedWithPost[0].post.uri;
    const result = postFeedTemplate({
      feed: { feed: feedWithPost, cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
      hiddenPostUris: [hiddenUri],
    });
    const container = document.createElement("div");
    render(result, container);
    const message = container.querySelector(
      "[data-testid='feed-feedback-message']",
    );
    assert(!!message);
  });
});

describe("postFeedTemplate - feed generator", () => {
  it("should set data-feed-generator-uri when feedGenerator provided", () => {
    const mockFeedGenerator = {
      uri: "at://did:plc:test/app.bsky.feed.generator/test-feed",
    };
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 1), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
      feedGenerator: mockFeedGenerator,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItem = container.querySelector("[data-testid='feed-item']");
    assert.deepEqual(
      feedItem.getAttribute("data-feed-generator-uri"),
      mockFeedGenerator.uri,
    );
  });

  it("should have empty data-feed-generator-uri when no feedGenerator", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 1), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItem = container.querySelector("[data-testid='feed-item']");
    assert.deepEqual(feedItem.getAttribute("data-feed-generator-uri"), "");
  });
});
