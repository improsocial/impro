import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/plugin-posts-feed.js";

const t = new TestSuite("PluginPostsFeed");

function makeDataLayer(ensurePostsImpl, getPostsImpl) {
  return {
    declarative: { ensurePosts: ensurePostsImpl },
    selectors: {
      getCurrentUser: () => null,
      getPosts: getPostsImpl ?? ((uris) => uris.map(() => null)),
    },
  };
}

function makeHandler() {
  return { renderFunc: () => {} };
}

function makeElement({ ensurePosts, getPosts, postInteractionHandler } = {}) {
  const element = document.createElement("plugin-posts-feed");
  element.dataLayer = makeDataLayer(
    ensurePosts ?? (() => new Promise(() => {})),
    getPosts,
  );
  element.isAuthenticated = false;
  element.pluginService = null;
  element.postInteractionHandler = postInteractionHandler ?? makeHandler();
  return element;
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("PluginPostsFeed - loading state", (it) => {
  it("renders the feed skeleton before posts resolve", () => {
    const element = makeElement();
    element.setAttribute("uris", "at://a,at://b,at://c");
    document.body.appendChild(element);
    // feedSkeletonTemplate renders inside <div class="feed">
    assert(element.querySelector(".feed") !== null);
    // No real feed items yet
    assertEquals(
      element.querySelectorAll("[data-testid='feed-item']").length,
      0,
    );
  });
});

t.describe("PluginPostsFeed - empty uris", (it) => {
  it("renders the empty message and does not call ensurePosts", () => {
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
    const endMessage = element.querySelector(
      "[data-testid='feed-end-message']",
    );
    assert(endMessage !== null);
    assert(endMessage.textContent.includes("Nothing here."));
    assertEquals(called, false);
  });
});

t.describe("PluginPostsFeed - missing postInteractionHandler", (it) => {
  it("throws when connected without a postInteractionHandler", () => {
    const element = document.createElement("plugin-posts-feed");
    element.dataLayer = makeDataLayer(() => new Promise(() => {}));
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

t.describe("PluginPostsFeed - refresh", (it) => {
  it("re-renders against the latest selectors state without re-fetching", async () => {
    let postsCall = 0;
    let currentUserCall = 0;
    const element = document.createElement("plugin-posts-feed");
    element.dataLayer = {
      declarative: {
        ensurePosts: () => {
          postsCall++;
          return Promise.resolve([]);
        },
      },
      selectors: {
        getCurrentUser: () => {
          currentUserCall++;
          return null;
        },
        getPosts: (uris) => uris.map(() => null),
      },
    };
    element.isAuthenticated = false;
    element.pluginService = null;
    element.postInteractionHandler = makeHandler();
    element.setAttribute("uris", "");
    document.body.appendChild(element);
    const beforeRefresh = currentUserCall;
    element.refresh();
    // refresh() pulls fresh selectors state without re-issuing ensurePosts.
    assert(currentUserCall > beforeRefresh);
    assertEquals(postsCall, 0);
  });

  it("re-selects posts from the store on each render to pick up updates", async () => {
    const calls = [];
    const element = makeElement({
      ensurePosts: () => Promise.resolve([null]),
      getPosts: (uris) => {
        calls.push(uris);
        return uris.map(() => null);
      },
    });
    element.setAttribute("uris", "at://a");
    document.body.appendChild(element);
    await flushMicrotasks();
    const callsAfterLoad = calls.length;
    assert(callsAfterLoad > 0);
    element.refresh();
    // refresh() re-selects fresh post data from the store rather than reusing
    // a cached snapshot, so updates flow through without a re-fetch.
    assert(calls.length > callsAfterLoad);
    assertEquals(calls[calls.length - 1], ["at://a"]);
  });

  it("is a no-op before connectedCallback runs", () => {
    const element = document.createElement("plugin-posts-feed");
    // Should not throw even though required props aren't set yet.
    element.refresh();
  });
});

await t.run();
