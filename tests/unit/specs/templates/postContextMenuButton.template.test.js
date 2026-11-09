import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { postContextMenuButtonTemplate } from "/js/templates/postContextMenuButton.template.js";
import { post } from "../../testData.js";
import { render } from "/js/lib/lit-html.js";
import { mockWindowLocation, restoreWindow } from "../../testHelpers.js";

describe("postContextMenuButtonTemplate - plugin context menu items", () => {
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
    const moreButton = container.querySelector(
      '[data-testid="post-context-menu-button"]',
    );
    moreButton.click();
    await flushMicrotasks();
    return document.body.querySelector("context-menu.post-context-menu");
  }

  it("should pass the post and feed meta to getPostContextMenuItems", async () => {
    const menuCalls = [];
    const pluginService = {
      getPostContextMenuItems: async (...args) => {
        menuCalls.push(args);
        return [];
      },
    };
    const feedGenerator = {
      uri: "at://did:plc:feedgen/app.bsky.feed.generator/cool",
      did: "did:web:feed.example",
    };
    const result = postContextMenuButtonTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      feedContext: "ctx",
      feedGenerator,
      pluginService,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    await openPostContextMenu(container);
    assert.deepEqual(menuCalls, [
      [
        post,
        {
          feedGenerator,
          feedContext: "ctx",
          feedProxyUrl: "did:web:feed.example#bsky_fg",
        },
      ],
    ]);
    container.remove();
  });

  async function renderAndOpenMenu(props) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(
      postContextMenuButtonTemplate({
        currentUser: { did: "did:plc:test" },
        pluginService: { getPostContextMenuItems: async () => [] },
        ...props,
      }),
      container,
    );
    const menu = await openPostContextMenu(container);
    container.remove();
    return menu;
  }

  it("should not render the share items in the more menu", async () => {
    const menu = await renderAndOpenMenu({ post, isAuthenticated: true });
    assert(
      menu.querySelector('[data-testid="menu-action-post-open-in-bsky"]') ===
        null,
    );
    assert(
      menu.querySelector('[data-testid="menu-action-post-copy-link"]') === null,
    );
    assert(
      menu.querySelector('[data-testid="menu-action-post-copy-text"]') !== null,
    );
  });

  it("should show mute thread on others' posts", async () => {
    const menu = await renderAndOpenMenu({ post, isAuthenticated: true });
    const item = menu.querySelector(
      '[data-testid="menu-action-post-mute-thread"]',
    );
    assert.equal(item.dataset.teststate, "unmuted");
  });

  it("should show mute thread on the user's own posts", async () => {
    const menu = await renderAndOpenMenu({
      post,
      isAuthenticated: true,
      isUserPost: true,
    });
    assert(
      menu.querySelector('[data-testid="menu-action-post-mute-thread"]') !==
        null,
    );
  });

  it("should hide mute thread when logged out", async () => {
    const menu = await renderAndOpenMenu({ post, isAuthenticated: false });
    assert(
      menu.querySelector('[data-testid="menu-action-post-mute-thread"]') ===
        null,
    );
  });

  it("should call onClickMuteThread with the toggled value", async () => {
    const onClickMuteThread = mock.fn();
    const mutedPost = {
      ...post,
      viewer: { ...post.viewer, threadMuted: true },
    };
    const menu = await renderAndOpenMenu({
      post: mutedPost,
      isAuthenticated: true,
      onClickMuteThread,
    });
    const item = menu.querySelector(
      '[data-testid="menu-action-post-mute-thread"]',
    );
    assert.equal(item.dataset.teststate, "muted");
    item.click();
    assert.deepEqual(onClickMuteThread.mock.calls[0].arguments, [
      mutedPost,
      false,
    ]);
  });

  function replyToThreadOf(rootDid, overrides = {}) {
    const rootUri = `at://${rootDid}/app.bsky.feed.post/root`;
    return {
      ...post,
      record: {
        ...post.record,
        reply: {
          root: { uri: rootUri, cid: "cid-root" },
          parent: { uri: rootUri, cid: "cid-root" },
        },
      },
      isHiddenByThreadgate: false,
      ...overrides,
    };
  }

  it("should offer hiding a reply for everyone in the viewer's own thread", async () => {
    const onClickToggleReplyHiddenForEveryone = mock.fn();
    const reply = replyToThreadOf("did:plc:test");
    const menu = await renderAndOpenMenu({
      post: reply,
      isAuthenticated: true,
      onClickToggleReplyHiddenForEveryone,
    });
    const item = menu.querySelector(
      '[data-testid="menu-action-post-toggle-reply-hidden"]',
    );
    assert.equal(item.dataset.teststate, "shown");
    item.click();
    assert.deepEqual(
      onClickToggleReplyHiddenForEveryone.mock.calls[0].arguments,
      [reply, true],
    );
  });

  it("should offer showing a reply hidden by the threadgate", async () => {
    const onClickToggleReplyHiddenForEveryone = mock.fn();
    const reply = replyToThreadOf("did:plc:test", {
      isHiddenByThreadgate: true,
    });
    const menu = await renderAndOpenMenu({
      post: reply,
      isAuthenticated: true,
      onClickToggleReplyHiddenForEveryone,
    });
    const item = menu.querySelector(
      '[data-testid="menu-action-post-toggle-reply-hidden"]',
    );
    assert.equal(item.dataset.teststate, "hidden");
    item.click();
    assert.deepEqual(
      onClickToggleReplyHiddenForEveryone.mock.calls[0].arguments,
      [reply, false],
    );
  });

  it("should not offer hiding a reply for everyone in someone else's thread", async () => {
    const menu = await renderAndOpenMenu({
      post: replyToThreadOf("did:plc:someone-else"),
      isAuthenticated: true,
    });
    assert.equal(
      menu.querySelector(
        '[data-testid="menu-action-post-toggle-reply-hidden"]',
      ),
      null,
    );
  });

  it("should not offer hiding a reply for everyone outside a thread", async () => {
    const menu = await renderAndOpenMenu({
      post: replyToThreadOf("did:plc:test", {
        isHiddenByThreadgate: undefined,
      }),
      isAuthenticated: true,
    });
    assert.equal(
      menu.querySelector(
        '[data-testid="menu-action-post-toggle-reply-hidden"]',
      ),
      null,
    );
  });

  it("should not offer hiding the viewer's own reply for everyone", async () => {
    const menu = await renderAndOpenMenu({
      post: replyToThreadOf("did:plc:test"),
      isAuthenticated: true,
      isUserPost: true,
    });
    assert.equal(
      menu.querySelector(
        '[data-testid="menu-action-post-toggle-reply-hidden"]',
      ),
      null,
    );
  });

  it("should pass null feed meta when the post is not in a feed", async () => {
    const menuCalls = [];
    const pluginService = {
      getPostContextMenuItems: async (...args) => {
        menuCalls.push(args);
        return [];
      },
    };
    const result = postContextMenuButtonTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      pluginService,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    await openPostContextMenu(container);
    assert.deepEqual(menuCalls, [
      [post, { feedGenerator: null, feedContext: null, feedProxyUrl: null }],
    ]);
    container.remove();
  });

  it("should render one context-menu-item-group per plugin", async () => {
    const pluginService = makePluginService([
      { pluginId: "plugin-a", title: "A1", invoke: () => {} },
      { pluginId: "plugin-a", title: "A2", invoke: () => {} },
      { pluginId: "plugin-b", title: "B1", invoke: () => {} },
    ]);
    const result = postContextMenuButtonTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      pluginService,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    const postContextMenu = await openPostContextMenu(container);
    const groups = postContextMenu.querySelectorAll("context-menu-item-group");
    const pluginGroups = Array.from(groups).filter((group) =>
      Array.from(group.querySelectorAll("context-menu-item")).some((item) =>
        ["A1", "A2", "B1"].includes(item.textContent.trim()),
      ),
    );
    assert.deepEqual(pluginGroups.length, 2);
    assert.deepEqual(
      Array.from(pluginGroups[0].querySelectorAll("context-menu-item")).map(
        (item) => item.textContent.trim(),
      ),
      ["A1", "A2"],
    );
    assert.deepEqual(
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
    const result = postContextMenuButtonTemplate({
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
    assert.deepEqual(pluginGroups.length, 2);
    assert.deepEqual(
      Array.from(pluginGroups[0].querySelectorAll("context-menu-item")).map(
        (item) => item.textContent.trim(),
      ),
      ["A1", "A2"],
    );
    assert.deepEqual(
      Array.from(pluginGroups[1].querySelectorAll("context-menu-item")).map(
        (item) => item.textContent.trim(),
      ),
      ["B1"],
    );
    container.remove();
  });

  it("should not render any plugin group when no plugin items", async () => {
    const pluginService = makePluginService([]);
    const result = postContextMenuButtonTemplate({
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
    const result = postContextMenuButtonTemplate({
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
    assert.deepEqual(invoked, true);
    container.remove();
  });
});

describe("postContextMenuButtonTemplate - translate menu action", () => {
  const androidChromeUserAgent =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const androidFirefoxUserAgent =
    "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0";
  const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    "userAgent",
  );
  const originalOpen = window.open;
  let openMock;
  let capturedHrefs;

  beforeEach(() => {
    openMock = mock.fn();
    window.open = openMock;
    capturedHrefs = mockWindowLocation();
  });

  afterEach(() => {
    restoreWindow();
    window.open = originalOpen;
    if (originalUserAgentDescriptor) {
      Object.defineProperty(
        window.navigator,
        "userAgent",
        originalUserAgentDescriptor,
      );
    } else {
      delete window.navigator.userAgent;
    }
    document.body
      .querySelectorAll("context-menu")
      .forEach((menu) => menu.remove());
  });

  function setUserAgent(value) {
    Object.defineProperty(window.navigator, "userAgent", {
      value,
      configurable: true,
    });
  }

  function ensurePageVisible() {
    if (!document.querySelector(".page-visible")) {
      const pageVisible = document.createElement("div");
      pageVisible.classList.add("page-visible");
      document.body.appendChild(pageVisible);
    }
  }

  async function clickTranslateMenuItem() {
    const result = postContextMenuButtonTemplate({
      post,
      isAuthenticated: true,
      currentUser: { did: "did:plc:test" },
      pluginService: { getPostContextMenuItems: async () => [] },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    render(result, container);
    ensurePageVisible();
    const moreButton = container.querySelector(
      '[data-testid="post-context-menu-button"]',
    );
    moreButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const item = document.body.querySelector(
      "[data-testid='menu-action-post-translate']",
    );
    assert(item !== null);
    item.click();
    container.remove();
  }

  it("should open the Google Translate web URL with the post text", async () => {
    await clickTranslateMenuItem();
    assert.deepEqual(openMock.mock.callCount(), 1);
    const [url, target] = openMock.mock.calls[0].arguments;
    assert.deepEqual(target, "_blank");
    const parsedUrl = new URL(url);
    assert.deepEqual(parsedUrl.origin, "https://translate.google.com");
    assert.deepEqual(parsedUrl.searchParams.get("sl"), "auto");
    assert(parsedUrl.searchParams.get("tl"));
    assert.deepEqual(parsedUrl.searchParams.get("text"), post.record.text);
    assert.deepEqual(capturedHrefs, []);
  });

  it("should launch a PROCESS_TEXT intent on Android", async () => {
    setUserAgent(androidChromeUserAgent);
    await clickTranslateMenuItem();
    assert.deepEqual(openMock.mock.callCount(), 0);
    assert.deepEqual(capturedHrefs.length, 1);
    const intentUrl = capturedHrefs[0];
    assert(
      intentUrl.startsWith(
        "intent:#Intent;action=android.intent.action.PROCESS_TEXT;type=text/plain;",
      ),
    );
    assert(
      intentUrl.includes(
        `S.android.intent.extra.PROCESS_TEXT=${encodeURIComponent(post.record.text)};`,
      ),
    );
    const fallbackMatch = intentUrl.match(/S\.browser_fallback_url=([^;]+);/);
    assert(fallbackMatch !== null);
    const fallbackUrl = new URL(decodeURIComponent(fallbackMatch[1]));
    assert.deepEqual(fallbackUrl.origin, "https://translate.google.com");
    assert.deepEqual(fallbackUrl.searchParams.get("text"), post.record.text);
  });

  it("should keep the web URL on Firefox for Android", async () => {
    setUserAgent(androidFirefoxUserAgent);
    await clickTranslateMenuItem();
    assert.deepEqual(openMock.mock.callCount(), 1);
    const parsedUrl = new URL(openMock.mock.calls[0].arguments[0]);
    assert.deepEqual(parsedUrl.origin, "https://translate.google.com");
    assert.deepEqual(parsedUrl.searchParams.get("text"), post.record.text);
    assert.deepEqual(capturedHrefs, []);
  });
});
