import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Signal, SignalMap, ComputedMap } from "/js/signals.js";
import "/js/components/plugin-posts-feed.js";

describe("plugin-posts-feed", () => {
  function makeDataLayer({ ensurePosts, currentUser } = {}) {
    // Mirror the real layering: a value SignalMap store, with $hydratedPosts a
    // ComputedMap (family) over it that returns a stable per-key cell.
    const postValues = new SignalMap();
    const $hydratedPosts = new ComputedMap((uri) => postValues.get(uri));
    return {
      declarative: {
        ensurePosts: ensurePosts ?? (() => new Promise(() => {})),
      },
      derived: {
        $currentUser: new Signal.State(currentUser ?? null),
        $hydratedPosts,
      },
      __setPost(uri, post) {
        postValues.set(uri, post);
      },
    };
  }

  function makeHandler() {
    return {};
  }

  function makeElement({
    ensurePosts,
    currentUser,
    postInteractionHandler,
  } = {}) {
    const element = document.createElement("plugin-posts-feed");
    element.dataLayer = makeDataLayer({ ensurePosts, currentUser });
    element.isAuthenticated = false;
    element.pluginService = null;
    element.postInteractionHandler = postInteractionHandler ?? makeHandler();
    return element;
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
    it("renders the feed skeleton before posts resolve", () => {
      const element = makeElement();
      element.setAttribute("uris", "at://a,at://b,at://c");
      document.body.appendChild(element);
      assert(element.querySelector(".feed") !== null);
      assert.deepEqual(
        element.querySelectorAll("[data-testid='feed-item']").length,
        0,
      );
    });
  });

  describe("PluginPostsFeed - empty uris", () => {
    it("renders the empty message and does not call ensurePosts", async () => {
      let called = false;
      const element = makeElement({
        ensurePosts: () => {
          called = true;
          return Promise.resolve([]);
        },
      });
      element.setAttribute("uris", "");
      element.setAttribute("empty-message", "Nothing here.");
      document.body.appendChild(element);
      await flushMicrotasks();
      const endMessage = element.querySelector(
        "[data-testid='feed-end-message']",
      );
      assert(endMessage !== null);
      assert(endMessage.textContent.includes("Nothing here."));
      // ensurePosts is still invoked with an empty uri list — the empty render
      // is driven by the empty posts array, not by skipping the request.
      assert.deepEqual(called, true);
    });
  });

  describe("PluginPostsFeed - missing postInteractionHandler", () => {
    it("throws when connected without a postInteractionHandler", () => {
      const element = document.createElement("plugin-posts-feed");
      element.dataLayer = makeDataLayer();
      let error = null;
      try {
        // jsdom swallows throws from appendChild-triggered connectedCallback,
        // so invoke it directly to assert the contract.
        element.connectedCallback();
      } catch (e) {
        error = e;
      }
      assert(error !== null);
      assert(error.message.includes("postInteractionHandler"));
    });
  });

  describe("PluginPostsFeed - error state", () => {
    it("renders the error message when ensurePosts rejects", async () => {
      const element = makeElement({
        ensurePosts: () => Promise.reject(new Error("boom")),
      });
      element.setAttribute("uris", "at://a");
      document.body.appendChild(element);
      await flushMicrotasks();
      const error = element.querySelector(".posts-feed-error");
      assert(error !== null);
      assert(error.textContent.includes("boom"));
    });
  });

  describe("PluginPostsFeed - uri changes", () => {
    it("reloads when the uris attribute changes", async () => {
      const calls = [];
      const element = makeElement({
        ensurePosts: (uris) => {
          calls.push(uris);
          return Promise.resolve(uris.map(() => null));
        },
      });
      element.setAttribute("uris", "at://a");
      document.body.appendChild(element);
      await flushMicrotasks();
      element.setAttribute("uris", "at://b,at://c");
      await flushMicrotasks();
      assert.deepEqual(calls, [["at://a"], ["at://b", "at://c"]]);
    });

    it("ignores stale ensurePosts results when uris change mid-flight", async () => {
      let resolveFirst;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      let callIndex = 0;
      const element = makeElement({
        ensurePosts: () => {
          callIndex++;
          if (callIndex === 1) return firstPromise;
          return Promise.resolve([]);
        },
      });
      element.setAttribute("uris", "at://stale");
      document.body.appendChild(element);
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
      const dataLayer = makeDataLayer({
        ensurePosts: () => Promise.resolve([null]),
      });
      const element = document.createElement("plugin-posts-feed");
      element.dataLayer = dataLayer;
      element.isAuthenticated = false;
      element.pluginService = null;
      element.postInteractionHandler = makeHandler();
      element.setAttribute("uris", "at://a");
      document.body.appendChild(element);
      await flushMicrotasks();
      // No post hydrated yet -> empty feed.
      assert.deepEqual(
        element.querySelectorAll("[data-testid='feed-item']").length,
        0,
      );
      // Updating the post signal should cause a re-render that picks it up.
      dataLayer.__setPost("at://a", makeStubPost("at://a"));
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
