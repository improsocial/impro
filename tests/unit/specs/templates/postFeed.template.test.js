import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { post, feed } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";
import { noop } from "/js/utils.js";

const t = new TestSuite("postFeedTemplate");

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
};

const postInteractionHandler = {
  isAuthenticated: true,
  handleLike: noop,
  handleRepost: noop,
  handleDelete: noop,
  handleShare: noop,
};

t.describe("postFeedTemplate - loading state", (it) => {
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

t.describe("postFeedTemplate - empty state", (it) => {
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

  it("should show default empty message", () => {
    const result = postFeedTemplate({
      feed: { feed: [], cursor: null },
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const message = container.querySelector("[data-testid='feed-end-message']");
    assert(message.textContent.includes("Feed is empty"));
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

t.describe("postFeedTemplate - feed with posts", (it) => {
  it("should render feed items", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItems = container.querySelectorAll("[data-testid='feed-item']");
    assertEquals(feedItems.length, 2);
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

  it("should set data-feed-context attribute on feed items", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 1), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const feedItem = container.querySelector("[data-testid='feed-item']");
    assert(feedItem.hasAttribute("data-feed-context"));
  });
});

t.describe("postFeedTemplate - pagination", (it) => {
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

  it("should show end of feed message when hasMore is false", () => {
    const result = postFeedTemplate({
      feed: { feed: feed.slice(0, 2), cursor: null },
      currentUser: mockUser,
      postInteractionHandler,
    });
    const container = document.createElement("div");
    render(result, container);
    const endMessage = container.querySelector(
      "[data-testid='feed-end-message']",
    );
    assert(endMessage !== null);
    assert(endMessage.textContent.includes("End of feed"));
  });
});

t.describe("postFeedTemplate - hidden posts", (it) => {
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
    assert(message.textContent.includes("feedback has been sent"));
  });
});

t.describe("postFeedTemplate - feed generator", (it) => {
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
    assertEquals(
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
    assertEquals(feedItem.getAttribute("data-feed-generator-uri"), "");
  });
});

await t.run();
