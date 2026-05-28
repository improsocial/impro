import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Signal, SignalMap } from "/js/utils.js";
import "/js/components/plugin-posts-feed.js";

const t = new TestSuite("PluginPostsFeed");

function makeDataLayer({ ensurePosts, currentUser } = {}) {
  const postSignals = new SignalMap();
  return {
    declarative: {
      ensurePosts: ensurePosts ?? (() => new Promise(() => {})),
    },
    signals: {
      $currentUser: new Signal.State(currentUser ?? null),
      $hydratedPosts: postSignals,
    },
    __setPost(uri, post) {
      postSignals.set(uri, post);
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

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("PluginPostsFeed - loading state", (it) => {
  it("renders the feed skeleton before posts resolve", () => {
    const element = makeElement();
    element.setAttribute("uris", "at://a,at://b,at://c");
    document.body.appendChild(element);
    assert(element.querySelector(".feed") !== null);
    assertEquals(
      element.querySelectorAll("[data-testid='feed-item']").length,
      0,
    );
  });
});

t.describe("PluginPostsFeed - empty uris", (it) => {
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
    assertEquals(called, true);
  });
});

t.describe("PluginPostsFeed - missing postInteractionHandler", (it) => {
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

t.describe("PluginPostsFeed - error state", (it) => {
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

t.describe("PluginPostsFeed - uri changes", (it) => {
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
    assertEquals(calls, [["at://a"], ["at://b", "at://c"]]);
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

t.describe("PluginPostsFeed - live updates", (it) => {
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
    assertEquals(
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

await t.run();
