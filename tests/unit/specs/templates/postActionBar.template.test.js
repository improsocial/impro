import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postActionBarTemplate");

t.describe("postActionBarTemplate", (it) => {
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
    assertEquals(replyCount.textContent.trim(), "5");
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
    assertEquals(container.querySelector("[data-testid='reply-count']"), null);
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
    assertEquals(repostCount.textContent.trim(), "10");
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
    assertEquals(repostCount.textContent.trim(), "8");
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
    assertEquals(container.querySelector("[data-testid='repost-count']"), null);
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
    const quoteItem = Array.from(
      container.querySelectorAll("context-menu-item"),
    ).find((item) => item.textContent.trim().startsWith("Quote"));
    assert(quoteItem !== undefined);
    assertEquals(quoteItem.textContent.trim(), "Quote post");
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
    const quoteItem = Array.from(
      container.querySelectorAll("context-menu-item"),
    ).find((item) => item.textContent.trim().startsWith("Quote"));
    assert(quoteItem !== undefined);
    assertEquals(quoteItem.textContent.trim(), "Quote posts disabled");
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
    const quoteItem = Array.from(
      container.querySelectorAll("context-menu-item"),
    ).find((item) => item.textContent.trim().startsWith("Quote"));
    assert(quoteItem !== undefined);
    assertEquals(quoteItem.textContent.trim(), "Quote post");
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

t.describe("postActionBarTemplate - callbacks", (it) => {
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
    assertEquals(callArgs.doBookmark, true);
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
    assertEquals(callArgs.doBookmark, false);
    container.remove();
  });
});

t.describe(
  "postActionBarTemplate - plugin context menu items",
  (it, { afterEach }) => {
    afterEach(() => {
      document.body
        .querySelectorAll("context-menu")
        .forEach((menu) => menu.remove());
    });

    function makePluginService(items) {
      return { getPostContextMenuItems: async () => items };
    }

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
      const moreButton = Array.from(
        container.querySelectorAll(".post-action-button.text-button"),
      ).find((button) => button.textContent.trim() === "...");
      moreButton.click();
      await flushMicrotasks();
      return document.body.querySelector("context-menu.post-context-menu");
    }

    it("should render one context-menu-item-group per plugin", async () => {
      const pluginService = makePluginService([
        { pluginId: "plugin-a", title: "A1", invoke: () => {} },
        { pluginId: "plugin-a", title: "A2", invoke: () => {} },
        { pluginId: "plugin-b", title: "B1", invoke: () => {} },
      ]);
      const result = postActionBarTemplate({
        post,
        isAuthenticated: true,
        currentUser: { did: "did:plc:test" },
        pluginService,
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(result, container);
      const postContextMenu = await openPostContextMenu(container);
      const groups = postContextMenu.querySelectorAll(
        "context-menu-item-group",
      );
      const pluginGroups = Array.from(groups).filter((group) =>
        Array.from(group.querySelectorAll("context-menu-item")).some((item) =>
          ["A1", "A2", "B1"].includes(item.textContent.trim()),
        ),
      );
      assertEquals(pluginGroups.length, 2);
      assertEquals(
        Array.from(pluginGroups[0].querySelectorAll("context-menu-item")).map(
          (item) => item.textContent.trim(),
        ),
        ["A1", "A2"],
      );
      assertEquals(
        Array.from(pluginGroups[1].querySelectorAll("context-menu-item")).map(
          (item) => item.textContent.trim(),
        ),
        ["B1"],
      );
      container.remove();
    });

    it("should group non-contiguous items from the same plugin together", async () => {
      const pluginService = makePluginService([
        { pluginId: "plugin-a", title: "A1", invoke: () => {} },
        { pluginId: "plugin-b", title: "B1", invoke: () => {} },
        { pluginId: "plugin-a", title: "A2", invoke: () => {} },
      ]);
      const result = postActionBarTemplate({
        post,
        isAuthenticated: true,
        currentUser: { did: "did:plc:test" },
        pluginService,
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(result, container);
      const postContextMenu = await openPostContextMenu(container);
      const pluginGroups = Array.from(
        postContextMenu.querySelectorAll("context-menu-item-group"),
      ).filter((group) =>
        Array.from(group.querySelectorAll("context-menu-item")).some((item) =>
          ["A1", "A2", "B1"].includes(item.textContent.trim()),
        ),
      );
      assertEquals(pluginGroups.length, 2);
      assertEquals(
        Array.from(pluginGroups[0].querySelectorAll("context-menu-item")).map(
          (item) => item.textContent.trim(),
        ),
        ["A1", "A2"],
      );
      assertEquals(
        Array.from(pluginGroups[1].querySelectorAll("context-menu-item")).map(
          (item) => item.textContent.trim(),
        ),
        ["B1"],
      );
      container.remove();
    });

    it("should not render any plugin group when no plugin items", async () => {
      const pluginService = makePluginService([]);
      const result = postActionBarTemplate({
        post,
        isAuthenticated: true,
        currentUser: { did: "did:plc:test" },
        pluginService,
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(result, container);
      const postContextMenu = await openPostContextMenu(container);
      const allItems = Array.from(
        postContextMenu.querySelectorAll("context-menu-item"),
      );
      assert(
        !allItems.some((item) =>
          ["A1", "A2", "B1"].includes(item.textContent.trim()),
        ),
      );
      container.remove();
    });

    it("should invoke plugin handler when clicked", async () => {
      let invoked = false;
      const pluginService = makePluginService([
        {
          pluginId: "plugin-a",
          title: "Do thing",
          invoke: () => {
            invoked = true;
          },
        },
      ]);
      const result = postActionBarTemplate({
        post,
        isAuthenticated: true,
        currentUser: { did: "did:plc:test" },
        pluginService,
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(result, container);
      const postContextMenu = await openPostContextMenu(container);
      const item = Array.from(
        postContextMenu.querySelectorAll("context-menu-item"),
      ).find((node) => node.textContent.trim() === "Do thing");
      assert(item !== undefined);
      item.click();
      assertEquals(invoked, true);
      container.remove();
    });
  },
);

await t.run();
