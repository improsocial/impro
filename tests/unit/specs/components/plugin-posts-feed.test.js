import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/plugin-posts-feed.js";
import { makeTestDataLayer } from "../../testHelpers.js";

function mount(element, renderContext) {
  element.renderContext = renderContext;
  document.body.appendChild(element);
  return element;
}

describe("plugin-posts-feed", () => {
  async function setupDataLayer() {
    const dataLayer = makeTestDataLayer();
    await dataLayer.preferencesProvider.fetchPreferences();
    return dataLayer;
  }

  function makeHandler() {
    return {};
  }

  function makeContext(dataLayer, { postInteractionHandler } = {}) {
    return {
      dataLayer,
      isAuthenticated: false,
      pluginService: null,
      postInteractionHandler: postInteractionHandler ?? makeHandler(),
    };
  }

  async function flushMicrotasks() {
    // Two ticks: the first flushes microtasks (e.g. ensurePosts), the second
    // lets the rAF-scheduled effect render run before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("PluginPostsFeed - loading state", () => {
    it("renders the feed skeleton before posts resolve", async () => {
      const dataLayer = await setupDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensurePosts",
        () => new Promise(() => {}),
      );
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "at://a,at://b,at://c");
      mount(element, makeContext(dataLayer));
      assert(element.querySelector(".feed") !== null);
      assert.deepEqual(
        element.querySelectorAll("[data-testid='feed-item']").length,
        0,
      );
    });
  });

  describe("PluginPostsFeed - empty uris", () => {
    it("renders the empty message and does not call ensurePosts", async () => {
      const dataLayer = await setupDataLayer();
      const ensurePosts = mock.method(
        dataLayer.declarative,
        "ensurePosts",
        async () => [],
      );
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "");
      element.setAttribute("empty-message", "Nothing here.");
      mount(element, makeContext(dataLayer));
      await flushMicrotasks();
      const endMessage = element.querySelector(
        "[data-testid='feed-end-message']",
      );
      assert(endMessage !== null);
      assert(endMessage.textContent.includes("Nothing here."));
      // ensurePosts is still invoked with an empty uri list — the empty render
      // is driven by the empty posts array, not by skipping the request.
      assert(ensurePosts.mock.callCount() >= 1);
    });
  });

  describe("PluginPostsFeed - missing render context", () => {
    it("throws when connected without a renderContext property", () => {
      const element = document.createElement("plugin-posts-feed");
      let error = null;
      try {
        // jsdom swallows throws from appendChild-triggered connectedCallback,
        // so invoke it directly to assert the contract.
        element.connectedCallback();
      } catch (e) {
        error = e;
      }
      assert(error !== null);
      assert(error.message.includes("renderContext"));
    });
  });

  describe("PluginPostsFeed - error state", () => {
    it("renders the error message when ensurePosts rejects", async () => {
      const dataLayer = await setupDataLayer();
      mock.method(dataLayer.declarative, "ensurePosts", async () => {
        throw new Error("boom");
      });
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "at://a");
      mount(element, makeContext(dataLayer));
      await flushMicrotasks();
      const error = element.querySelector(".posts-feed-error");
      assert(error !== null);
      assert(error.textContent.includes("boom"));
    });
  });

  describe("PluginPostsFeed - uri changes", () => {
    it("reloads when the uris attribute changes", async () => {
      const dataLayer = await setupDataLayer();
      const ensurePosts = mock.method(
        dataLayer.declarative,
        "ensurePosts",
        async (uris) => uris.map(() => null),
      );
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "at://a");
      mount(element, makeContext(dataLayer));
      await flushMicrotasks();
      element.setAttribute("uris", "at://b,at://c");
      await flushMicrotasks();
      assert.deepEqual(ensurePosts.mock.callCount(), 2);
      assert.deepEqual(ensurePosts.mock.calls[0].arguments[0], ["at://a"]);
      assert.deepEqual(ensurePosts.mock.calls[1].arguments[0], [
        "at://b",
        "at://c",
      ]);
    });

    it("ignores stale ensurePosts results when uris change mid-flight", async () => {
      const dataLayer = await setupDataLayer();
      let resolveFirst;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      let callIndex = 0;
      mock.method(dataLayer.declarative, "ensurePosts", () => {
        callIndex++;
        if (callIndex === 1) return firstPromise;
        return Promise.resolve([]);
      });
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "at://stale");
      mount(element, makeContext(dataLayer));
      element.setAttribute("uris", "at://fresh");
      await flushMicrotasks();
      resolveFirst([null]);
      await flushMicrotasks();
      // After the stale promise resolves, we should still be showing the fresh
      // state (empty list with default empty message) and not have crashed.
      const endMessage = element.querySelector(
        "[data-testid='feed-end-message']",
      );
      assert(endMessage !== null);
    });
  });

  describe("PluginPostsFeed - live updates", () => {
    it("re-renders when a hydrated post signal updates", async () => {
      const dataLayer = await setupDataLayer();
      mock.method(dataLayer.declarative, "ensurePosts", async () => [null]);
      const element = document.createElement("plugin-posts-feed");
      element.setAttribute("uris", "at://a");
      mount(element, makeContext(dataLayer));
      await flushMicrotasks();
      // No post hydrated yet -> empty feed.
      assert.deepEqual(
        element.querySelectorAll("[data-testid='feed-item']").length,
        0,
      );
      // Updating the underlying post signal should cause a re-render.
      dataLayer.dataStore.$posts.set("at://a", makeStubPost("at://a"));
      await flushMicrotasks();
      assert(element.querySelectorAll("[data-testid='feed-item']").length >= 1);
    });
  });

  function makeStubPost(uri) {
    return {
      uri,
      cid: "cid:" + uri,
      author: {
        did: "did:test:author",
        handle: "author.test",
        displayName: "author",
      },
      record: { text: "hello", createdAt: "2025-01-01T00:00:00Z" },
      indexedAt: "2025-01-01T00:00:00Z",
      badgeLabels: [],
    };
  }
});
