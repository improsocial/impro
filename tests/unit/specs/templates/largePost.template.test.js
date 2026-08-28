import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { post } from "../../testData.js";
import { render } from "/js/lib/lit-html.js";
import { makeTestPluginService } from "../../testHelpers.js";

const noop = () => {};
const currentUser = { did: "did:plc:test" };
const isAuthenticated = true;
const postInteractionHandler = {
  handleLike: noop,
  handleRepost: noop,
  handleQuotePost: noop,
  handleBookmark: noop,
  handleMuteAuthor: noop,
  handleBlockAuthor: noop,
  handleDeletePost: noop,
  handleReport: noop,
};

const pluginService = makeTestPluginService();

const baseProps = {
  currentUser,
  isAuthenticated,
  postInteractionHandler,
  pluginService,
};

describe("largePostTemplate", () => {
  it("should render the post container", () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='large-post']") !== null);
  });

  it("should render post with avatar", () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render post with author name", () => {
    const result = largePostTemplate({ post, ...baseProps });
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
      ...baseProps,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    assert(container.textContent.includes("Hello world!"));
    container.remove();
  });

  it("should render post action bar", () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
    container.remove();
  });

  it("should omit actions when rendering a prefill", () => {
    const result = largePostTemplate({
      post,
      ...baseProps,
      showActions: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".post-action-counts"), null);
    assert.deepEqual(container.querySelector(".post-actions"), null);
  });

  it("should render with reply context line when replyContext is parent", () => {
    const result = largePostTemplate({
      post,
      ...baseProps,
      replyContext: "parent",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should render with reply context line when replyContext is reply", () => {
    const result = largePostTemplate({
      post,
      ...baseProps,
      replyContext: "reply",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".reply-context-line-in") !== null);
  });

  it("should not render reply context line when no replyContext", () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".reply-context-line-in"), null);
  });
});

describe("largePostTemplate - follow button", () => {
  function postWithAuthorViewer(viewer) {
    return { ...post, author: { ...post.author, viewer } };
  }

  it("should not render a follow button by default", () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='follow-button']"),
      null,
    );
  });

  it("should render a follow button when showFollowButton is set", () => {
    const result = largePostTemplate({
      post: postWithAuthorViewer({}),
      ...baseProps,
      showFollowButton: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='follow-button']");
    assert(button !== null);
    assert.deepEqual(button.getAttribute("data-teststate"), "follow");
    assert(!button.disabled);
  });

  it("should show follow-back state when the author follows the user", () => {
    const result = largePostTemplate({
      post: postWithAuthorViewer({ followedBy: "at://follow-back-uri" }),
      ...baseProps,
      showFollowButton: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='follow-button']");
    assert.deepEqual(button.getAttribute("data-teststate"), "follow-back");
  });

  it("should show following state when the user follows the author", () => {
    const result = largePostTemplate({
      post: postWithAuthorViewer({ following: "at://follow-uri" }),
      ...baseProps,
      showFollowButton: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='follow-button']");
    assert.deepEqual(button.getAttribute("data-teststate"), "following");
  });

  it("should call onClickFollow with the author and the toggled follow state", () => {
    const followablePost = postWithAuthorViewer({});
    const calls = [];
    const result = largePostTemplate({
      post: followablePost,
      ...baseProps,
      showFollowButton: true,
      onClickFollow: (profile, doFollow) => calls.push([profile, doFollow]),
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='follow-button']").click();
    assert.deepEqual(calls, [[followablePost.author, true]]);
  });

  it("should call onClickFollow with false when already following", () => {
    const followingPost = postWithAuthorViewer({
      following: "at://follow-uri",
    });
    const calls = [];
    const result = largePostTemplate({
      post: followingPost,
      ...baseProps,
      showFollowButton: true,
      onClickFollow: (profile, doFollow) => calls.push([profile, doFollow]),
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='follow-button']").click();
    assert.deepEqual(calls, [[followingPost.author, false]]);
  });

  it("should disable the follow button while a follow is pending", () => {
    const result = largePostTemplate({
      post: postWithAuthorViewer({}),
      ...baseProps,
      showFollowButton: true,
      isFollowPending: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='follow-button']");
    assert(button.disabled);
  });
});

describe("largePostTemplate - rich text", () => {
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
    const result = largePostTemplate({
      post: postWithLongUrl,
      ...baseProps,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const link = container.querySelector("a[href='" + url + "']");
    assert(link !== null);
    assert(link.textContent.endsWith("..."));
    assert(link.textContent.length < url.length);
    container.remove();
  });
});

describe("largePostTemplate - blocked/unavailable posts", () => {
  it("should render blocked post template for blocked post", () => {
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blocked-uri",
      blocked: true,
    };
    const result = largePostTemplate({
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
    const result = largePostTemplate({
      post: notFoundPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("not found"));
  });
});

describe("largePostTemplate - moderation", () => {
  it("should show moderation warning for post with muted word", () => {
    const mutedPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: true },
    };
    const result = largePostTemplate({
      post: mutedPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should show moderation warning for hidden post", () => {
    const hiddenPost = {
      ...post,
      viewer: { ...post.viewer, isHidden: true },
    };
    const result = largePostTemplate({
      post: hiddenPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should not show moderation warning for normal post", () => {
    const normalPost = {
      ...post,
      viewer: { ...post.viewer, hasMutedWord: false, isHidden: false },
    };
    const result = largePostTemplate({
      post: normalPost,
      ...baseProps,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector("moderation-warning"), null);
  });
});

describe("largePostTemplate - plugin context menu items", () => {
  afterEach(() => {
    document.body
      .querySelectorAll("context-menu")
      .forEach((menu) => menu.remove());
  });

  async function flushMicrotasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function ensurePageVisible() {
    if (!document.querySelector(".page-visible")) {
      const pageVisible = document.createElement("div");
      pageVisible.classList.add("page-visible");
      document.body.appendChild(pageVisible);
    }
  }

  async function openPostContextMenu(container) {
    ensurePageVisible();
    const moreButton = container.querySelector(
      '[data-testid="post-action-more"]',
    );
    moreButton.click();
    await flushMicrotasks();
    return document.body.querySelector("context-menu.post-context-menu");
  }

  it("should render plugin-provided context menu items in the action bar", async () => {
    const customPluginService = {
      ...pluginService,
      getPostContextMenuItems: async () => [
        { title: "Custom plugin item", invoke: () => {} },
        { title: "Save to Notion", invoke: () => {} },
      ],
    };
    const result = largePostTemplate({
      post,
      ...baseProps,
      pluginService: customPluginService,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const postContextMenu = await openPostContextMenu(container);
    const items = Array.from(
      postContextMenu.querySelectorAll("context-menu-item"),
    );
    const itemTexts = items.map((el) => el.textContent.trim());
    assert(
      itemTexts.includes("Custom plugin item"),
      `expected "Custom plugin item" in ${JSON.stringify(itemTexts)}`,
    );
    assert(
      itemTexts.includes("Save to Notion"),
      `expected "Save to Notion" in ${JSON.stringify(itemTexts)}`,
    );
    container.remove();
  });

  it("should invoke the plugin item callback when clicked", async () => {
    let invoked = false;
    const customPluginService = {
      ...pluginService,
      getPostContextMenuItems: async () => [
        {
          title: "Custom plugin item",
          invoke: () => {
            invoked = true;
          },
        },
      ],
    };
    const result = largePostTemplate({
      post,
      ...baseProps,
      pluginService: customPluginService,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const postContextMenu = await openPostContextMenu(container);
    const items = Array.from(
      postContextMenu.querySelectorAll("context-menu-item"),
    );
    const target = items.find(
      (el) => el.textContent.trim() === "Custom plugin item",
    );
    assert(target !== null && target !== undefined);
    target.click();
    assert.deepEqual(invoked, true);
    container.remove();
  });

  it("should not render any plugin items when the registry is empty", async () => {
    const result = largePostTemplate({ post, ...baseProps });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const postContextMenu = await openPostContextMenu(container);
    const items = Array.from(
      postContextMenu.querySelectorAll("context-menu-item"),
    );
    const itemTexts = items.map((el) => el.textContent.trim());
    assert(
      !itemTexts.includes("Custom plugin item"),
      "plugin item should not render",
    );
    container.remove();
  });
});
