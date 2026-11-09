import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { post } from "../../testData.js";
import { render } from "/js/lib/lit-html.js";

describe("postActionBarTemplate", () => {
  afterEach(() => {
    document.body
      .querySelectorAll("context-menu")
      .forEach((menu) => menu.remove());
  });

  function openRepostMenu(container) {
    container.querySelector("[data-testid='repost-button']").click();
    return document.body.querySelector("context-menu");
  }

  it("should render action bar with reply button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
  });

  it("should render action bar with repost button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
  });

  it("should render action bar with bookmark button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
    container.remove();
  });

  it("should show reply count when post has replies", () => {
    const postWithReplies = {
      ...post,
      replyCount: 5,
    };
    const result = postActionBarTemplate({
      post: postWithReplies,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const replyCount = container.querySelector("[data-testid='reply-count']");
    assert(replyCount !== null);
    assert.deepEqual(replyCount.textContent.trim(), "5");
  });

  it("should pass the like count and liked state to the like count", () => {
    const result = postActionBarTemplate({
      post: {
        ...post,
        likeCount: 7,
        viewer: { ...post.viewer, like: "at://did:plc:test/like/1" },
      },
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const likeCount = container.querySelector("[data-testid='like-count']");
    assert.deepEqual(likeCount.getAttribute("count"), "7");
    assert(likeCount.hasAttribute("is-active"));
  });

  it("should not show reply count when post has no replies", () => {
    const postWithNoReplies = {
      ...post,
      replyCount: 0,
    };
    const result = postActionBarTemplate({
      post: postWithNoReplies,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='reply-count']"),
      null,
    );
  });

  it("should show repost count when post has reposts", () => {
    const postWithReposts = {
      ...post,
      repostCount: 10,
    };
    const result = postActionBarTemplate({
      post: postWithReposts,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostCount = container.querySelector("[data-testid='repost-count']");
    assert(repostCount !== null);
    assert.deepEqual(repostCount.textContent.trim(), "10");
  });

  it("should include quote posts in repost count", () => {
    const postWithRepostsAndQuotes = {
      ...post,
      repostCount: 5,
      quoteCount: 3,
    };
    const result = postActionBarTemplate({
      post: postWithRepostsAndQuotes,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostCount = container.querySelector("[data-testid='repost-count']");
    assert(repostCount !== null);
    assert.deepEqual(repostCount.textContent.trim(), "8");
  });

  it("should not show repost count when post has no reposts", () => {
    const postWithNoReposts = {
      ...post,
      repostCount: 0,
    };
    const result = postActionBarTemplate({
      post: postWithNoReposts,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='repost-count']"),
      null,
    );
  });

  it("should add reposted class when post is reposted", () => {
    const repostedPost = {
      ...post,
      viewer: { ...post.viewer, repost: "repost-uri" },
    };
    const result = postActionBarTemplate({
      post: repostedPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostButton = container.querySelector(
      "[data-testid='repost-button']",
    );
    assert(repostButton.classList.contains("reposted"));
  });

  it("should not have reposted class when post is not reposted", () => {
    const notRepostedPost = {
      ...post,
      viewer: { ...post.viewer, repost: null },
    };
    const result = postActionBarTemplate({
      post: notRepostedPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostButton = container.querySelector(
      "[data-testid='repost-button']",
    );
    assert(!repostButton.classList.contains("reposted"));
  });

  it("should disable quote post item but keep label when no current user", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: null,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const menu = openRepostMenu(container);
    const quoteItem = menu.querySelector(
      "[data-testid='menu-action-quote-post']",
    );
    assert(quoteItem !== null);
    assert.deepEqual(quoteItem.dataset.teststate, "quotable");
    assert(quoteItem.hasAttribute("disabled"));
  });

  it("should disable quote post item when embedding disabled", () => {
    const embeddingDisabledPost = {
      ...post,
      viewer: { ...post.viewer, embeddingDisabled: true },
    };
    const result = postActionBarTemplate({
      post: embeddingDisabledPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const menu = openRepostMenu(container);
    const quoteItem = menu.querySelector(
      "[data-testid='menu-action-quote-post']",
    );
    assert(quoteItem !== null);
    assert.deepEqual(quoteItem.dataset.teststate, "quotes-disabled");
    assert(quoteItem.hasAttribute("disabled"));
  });

  it("should enable quote post item when current user is set and embedding allowed", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const menu = openRepostMenu(container);
    const quoteItem = menu.querySelector(
      "[data-testid='menu-action-quote-post']",
    );
    assert(quoteItem !== null);
    assert.deepEqual(quoteItem.dataset.teststate, "quotable");
    assert(!quoteItem.hasAttribute("disabled"));
  });

  it("should add active class when post is bookmarked", () => {
    const bookmarkedPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: true },
    };
    const result = postActionBarTemplate({
      post: bookmarkedPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    assert(bookmarkButton.classList.contains("active"));
    container.remove();
  });

  it("should disable reply button when viewer.replyDisabled is true", () => {
    const replyDisabledPost = {
      ...post,
      viewer: { ...post.viewer, replyDisabled: true },
    };
    const result = postActionBarTemplate({
      post: replyDisabledPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const replyButton = container.querySelector("[data-testid='reply-button']");
    assert(replyButton.hasAttribute("disabled"));
  });

  it("should disable reply button for a blocked post", () => {
    const blockedPost = {
      ...post,
      $type: "app.bsky.feed.defs#blockedPost",
    };
    const result = postActionBarTemplate({
      post: blockedPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const replyButton = container.querySelector("[data-testid='reply-button']");
    assert(replyButton.hasAttribute("disabled"));
  });

  it("should not disable reply button for a normal post with a current user", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const replyButton = container.querySelector("[data-testid='reply-button']");
    assert(!replyButton.hasAttribute("disabled"));
  });

  it("should not have active class when post is not bookmarked", () => {
    const notBookmarkedPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: false },
    };
    const result = postActionBarTemplate({
      post: notBookmarkedPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    assert(!bookmarkButton.classList.contains("active"));
    container.remove();
  });
});

describe("postActionBarTemplate - callbacks", () => {
  it("should call onClickBookmark when bookmark button clicked", () => {
    let callArgs = null;
    const testPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: false },
    };
    const onClickBookmark = (p, doBookmark) => {
      callArgs = { post: p, doBookmark };
    };
    const result = postActionBarTemplate({
      post: testPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickBookmark,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    bookmarkButton.click();
    assert(callArgs !== null);
    assert.deepEqual(callArgs.doBookmark, true);
    container.remove();
  });

  it("should call onClickBookmark with false when unbookmarking", () => {
    let callArgs = null;
    const testPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: true },
    };
    const onClickBookmark = (p, doBookmark) => {
      callArgs = { post: p, doBookmark };
    };
    const result = postActionBarTemplate({
      post: testPost,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      onClickBookmark,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    bookmarkButton.click();
    assert(callArgs !== null);
    assert.deepEqual(callArgs.doBookmark, false);
    container.remove();
  });
});

describe("postActionBarTemplate - share menu", () => {
  const originalOpen = window.open;
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    "clipboard",
  );
  let openMock;
  let copiedText;

  beforeEach(() => {
    openMock = mock.fn();
    window.open = openMock;
    copiedText = [];
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: (text) => copiedText.push(text) },
      configurable: true,
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    if (originalClipboardDescriptor) {
      Object.defineProperty(
        window.navigator,
        "clipboard",
        originalClipboardDescriptor,
      );
    } else {
      delete window.navigator.clipboard;
    }
    document.body
      .querySelectorAll("context-menu")
      .forEach((menu) => menu.remove());
    document.body.querySelectorAll(".toast").forEach((toast) => toast.remove());
  });

  function ensurePageVisible() {
    if (!document.querySelector(".page-visible")) {
      const pageVisible = document.createElement("div");
      pageVisible.classList.add("page-visible");
      document.body.appendChild(pageVisible);
    }
  }

  function renderActionBar() {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      pluginService: { getPostContextMenuItems: async () => [] },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    ensurePageVisible();
    return container;
  }

  function openShareMenu(container) {
    container.querySelector('[data-testid="post-action-share"]').click();
    return document.body.querySelector("context-menu");
  }

  it("should render a share button", () => {
    const container = renderActionBar();
    assert(
      container.querySelector('[data-testid="post-action-share"]') !== null,
    );
    container.remove();
  });

  it("should open the bsky.app link from the share menu", () => {
    const container = renderActionBar();
    const menu = openShareMenu(container);
    menu.querySelector('[data-testid="menu-action-post-open-in-bsky"]').click();
    assert.deepEqual(openMock.mock.callCount(), 1);
    assert.deepEqual(openMock.mock.calls[0].arguments, [
      "https://bsky.app/profile/testauthor.bsky.social/post/3testpost2k",
      "_blank",
    ]);
    container.remove();
  });

  it("should copy the post permalink from the share menu", () => {
    const container = renderActionBar();
    const menu = openShareMenu(container);
    menu.querySelector('[data-testid="menu-action-post-copy-link"]').click();
    assert.deepEqual(copiedText, [
      "https://bsky.app/profile/testauthor.bsky.social/post/3testpost2k",
    ]);
    container.remove();
  });

  describe("download video", () => {
    function renderActionBarForPost(targetPost, options = {}) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(
        postActionBarTemplate({
          post: targetPost,
          isAuthenticated: true,
          currentUser: { did: "did:plc:test" },
          pluginService: { getPostContextMenuItems: async () => [] },
          ...options,
        }),
        container,
      );
      ensurePageVisible();
      return container;
    }

    const videoPost = {
      ...post,
      embed: {
        $type: "app.bsky.embed.video#view",
        cid: "bafkreivideo",
        playlist: "https://video.bsky.app/playlist.m3u8",
      },
    };

    it("should not render the download item for posts without a video", () => {
      const container = renderActionBarForPost(post);
      const menu = openShareMenu(container);
      assert(
        menu.querySelector(
          '[data-testid="menu-action-post-download-video"]',
        ) === null,
      );
      container.remove();
    });

    it("should download the video from the share menu", () => {
      const onClickDownloadVideo = mock.fn();
      const container = renderActionBarForPost(videoPost, {
        onClickDownloadVideo,
      });
      const menu = openShareMenu(container);
      menu
        .querySelector('[data-testid="menu-action-post-download-video"]')
        .click();
      assert.deepEqual(onClickDownloadVideo.mock.callCount(), 1);
      assert.deepEqual(onClickDownloadVideo.mock.calls[0].arguments, [
        videoPost,
      ]);
      container.remove();
    });

    it("should label the download as a video for regular videos", () => {
      const container = renderActionBarForPost(videoPost);
      const menu = openShareMenu(container);
      assert.deepEqual(
        menu.querySelector('[data-testid="menu-action-post-download-video"]')
          .dataset.teststate,
        "video",
      );
      container.remove();
    });

    it("should label the download as a GIF for gif-presentation videos", () => {
      const onClickDownloadVideo = mock.fn();
      const gifPost = {
        ...videoPost,
        embed: { ...videoPost.embed, presentation: "gif" },
      };
      const container = renderActionBarForPost(gifPost, {
        onClickDownloadVideo,
      });
      const menu = openShareMenu(container);
      const item = menu.querySelector(
        '[data-testid="menu-action-post-download-video"]',
      );
      assert.deepEqual(item.dataset.teststate, "gif");
      item.click();
      assert.deepEqual(onClickDownloadVideo.mock.calls[0].arguments, [gifPost]);
      container.remove();
    });

    it("should offer the download for a video alongside a quoted record", () => {
      const container = renderActionBarForPost({
        ...post,
        embed: {
          $type: "app.bsky.embed.recordWithMedia#view",
          media: videoPost.embed,
          record: { record: {} },
        },
      });
      const menu = openShareMenu(container);
      assert(
        menu.querySelector(
          '[data-testid="menu-action-post-download-video"]',
        ) !== null,
      );
      container.remove();
    });
  });

  describe("share via", () => {
    let shareCalls;

    beforeEach(() => {
      shareCalls = [];
    });

    afterEach(() => {
      delete window.navigator.share;
    });

    it("should open the share sheet with the post permalink", async () => {
      Object.defineProperty(window.navigator, "share", {
        value: async (data) => shareCalls.push(data),
        configurable: true,
      });
      const container = renderActionBar();
      const menu = openShareMenu(container);
      menu.querySelector('[data-testid="menu-action-post-share-via"]').click();
      assert.deepEqual(shareCalls, [
        {
          url: "https://bsky.app/profile/testauthor.bsky.social/post/3testpost2k",
        },
      ]);
      container.remove();
    });

    it("should not render the share via item when the share sheet is unavailable", () => {
      const container = renderActionBar();
      const menu = openShareMenu(container);
      assert(
        menu.querySelector('[data-testid="menu-action-post-share-via"]') ===
          null,
      );
      assert(
        menu.querySelector('[data-testid="menu-action-post-copy-link"]') !==
          null,
      );
      container.remove();
    });
  });
});

describe("postActionBarTemplate - plugin action bar slots", () => {
  function renderActionBar(options) {
    const container = document.createElement("div");
    render(
      postActionBarTemplate({
        post,
        isAuthenticated: true,
        currentUser: { did: "did:plc:test" },
        ...options,
      }),
      container,
    );
    return container;
  }

  it("should render secondary-start and secondary-end slots in order", () => {
    const container = renderActionBar({ pluginService: {} });
    const names = [...container.querySelectorAll("plugin-slot")].map((slot) =>
      slot.getAttribute("name"),
    );
    assert.deepEqual(names, [
      "post-action-bar:secondary-start",
      "post-action-bar:secondary-end",
    ]);
  });

  it("should place the slots before Bookmark and after Share", () => {
    const container = renderActionBar({ pluginService: {} });
    const secondaryStart = container.querySelector(
      "plugin-slot[name='post-action-bar:secondary-start']",
    );
    const secondaryEnd = container.querySelector(
      "plugin-slot[name='post-action-bar:secondary-end']",
    );
    assert.equal(
      secondaryStart.nextElementSibling,
      container.querySelector(".post-action-bookmark"),
    );
    assert.equal(
      secondaryEnd.previousElementSibling,
      container.querySelector(".post-action-share"),
    );
  });

  it("should pass the post uri and feed uri to every slot", () => {
    const feedGenerator = {
      uri: "at://did:plc:feed/app.bsky.feed.generator/test",
    };
    const container = renderActionBar({ feedGenerator, pluginService: {} });
    for (const slot of container.querySelectorAll("plugin-slot")) {
      assert.deepEqual(slot.getAttribute("context-uri"), post.uri);
      assert.deepEqual(
        slot.getAttribute("context-feed-uri"),
        feedGenerator.uri,
      );
    }
  });

  it("should pass an empty feed uri outside a feed", () => {
    const container = renderActionBar({ pluginService: {} });
    for (const slot of container.querySelectorAll("plugin-slot")) {
      assert.deepEqual(slot.getAttribute("context-feed-uri"), "");
    }
  });

  it("should not render plugin slots without pluginService", () => {
    const container = renderActionBar({});
    assert.deepEqual(container.querySelector("plugin-slot"), null);
  });
});
