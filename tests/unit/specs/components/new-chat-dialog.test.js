import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer, stubStatusTracked } from "../../testHelpers.js";
import { ApiError } from "/js/api.js";
import {
  chatRecipientSearchQueryKey,
  profileFollowsQueryKey,
} from "/js/dataLayer/queryKeys.js";
import "/js/components/new-chat-dialog.js";

describe("new-chat-dialog", () => {
  const originalSetTimeout = globalThis.setTimeout;
  let originalRouter;

  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
    originalRouter = window.router;
    window.router = { go: mock.fn() };
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    window.router = originalRouter;
  });

  async function nextFrame() {
    // The render effect flushes on requestAnimationFrame (setTimeout(0) in the
    // test env), so one tick applies pending renders.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  function makeDataLayer({
    ensureConvoForProfile,
    searchFailure = null,
    followsFailure = null,
  } = {}) {
    const dataLayer = makeTestDataLayer();
    const currentUser = { did: "did:plc:me", handle: "me.test" };
    dataLayer.dataStore.$currentUser.set(currentUser);
    const failures = { search: searchFailure, follows: followsFailure };

    const searchSpy = stubStatusTracked(
      dataLayer.requests,
      "loadChatRecipientSearch",
      ({ query }) => chatRecipientSearchQueryKey({ query }),
      async () => {
        if (failures.search) throw failures.search;
      },
    );

    const followsSpy = stubStatusTracked(
      dataLayer.requests,
      "loadProfileFollows",
      ({ did }) => profileFollowsQueryKey({ did }),
      async () => {
        if (failures.follows) throw failures.follows;
      },
    );

    const ensureSpy = mock.method(
      dataLayer.declarative,
      "ensureConvoForProfile",
      async (did) => {
        if (ensureConvoForProfile) {
          return ensureConvoForProfile(did);
        }
        return { id: "convo-1" };
      },
    );

    return {
      dataLayer,
      failures,
      searchSpy,
      followsSpy,
      ensureSpy,
    };
  }

  function seedFollows(dataLayer, follows, did = "did:plc:me") {
    dataLayer.dataStore.setProfiles(follows);
    dataLayer.queryStore.set(profileFollowsQueryKey({ did }), {
      pages: [{ items: follows.map((profile) => profile.did), cursor: null }],
    });
  }

  function seedSearchResults(dataLayer, query, actors) {
    dataLayer.dataStore.setProfiles(actors);
    dataLayer.queryStore.set(chatRecipientSearchQueryKey({ query }), {
      pages: [{ items: actors.map((actor) => actor.did), cursor: null }],
    });
  }

  function createDialog(dataLayer) {
    const element = document.createElement("new-chat-dialog");
    element.dataLayer = dataLayer;
    document.body.appendChild(element);
    return element;
  }

  function createApiError(errorName = "InternalError") {
    return new ApiError({
      status: 500,
      statusText: "Internal Server Error",
      data: { error: errorName },
      headers: {},
      url: "",
    });
  }

  function createProfile({
    did,
    handle,
    displayName,
    allowIncoming,
    followedBy,
  } = {}) {
    return {
      did,
      handle,
      displayName: displayName ?? handle,
      avatar: "",
      labels: [],
      viewer: followedBy ? { followedBy: "at://follow" } : {},
      ...(allowIncoming !== undefined
        ? { associated: { chat: { allowIncoming } } }
        : {}),
    };
  }

  async function typeQuery(element, value) {
    const input = element.querySelector(
      '[data-testid="new-chat-search-input"]',
    );
    input.value = value;
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    // One tick for the search promise, one for the re-render.
    await nextFrame();
    await nextFrame();
  }

  describe("NewChatDialog - rendering", () => {
    it("should preserve pre-seeded props through connectedCallback", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      assert.deepEqual(element.dataLayer, dataLayer);
    });

    it("should render a bottom-sheet dialog with search input and close button", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      const dialog = element.querySelector("dialog.new-chat-dialog");
      assert(dialog !== null);
      assert(dialog.classList.contains("bottom-sheet"));
      assert(
        element.querySelector('[data-testid="new-chat-search-input"]') !== null,
      );
      assert(
        element.querySelector('[data-testid="new-chat-dialog-close"]') !== null,
      );
    });

    it("should show the empty prompt when the query is empty and there are no suggestions", () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("Search for someone to message"),
        ),
      );
      assert.deepEqual(
        element.querySelector('[data-testid="profile-list-item-button"]'),
        null,
      );
    });
  });

  describe("NewChatDialog - suggestions", () => {
    it("should load the current user's follows on connect when not cached", async () => {
      const { dataLayer, followsSpy } = makeDataLayer();
      createDialog(dataLayer);
      await flushMicrotasks();
      assert.deepEqual(followsSpy.mock.callCount(), 1);
      assert.deepEqual(followsSpy.mock.calls[0].arguments[0], {
        did: "did:plc:me",
      });
    });

    it("should not reload follows that are already cached", async () => {
      const { dataLayer, followsSpy } = makeDataLayer();
      seedFollows(dataLayer, []);
      createDialog(dataLayer);
      await flushMicrotasks();
      assert.deepEqual(followsSpy.mock.callCount(), 0);
    });

    it("should show skeletons while follows load", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      assert(element.querySelectorAll(".profile-skeleton").length > 0);
    });

    it("should show only messageable follows under a header", async () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:carol",
          handle: "carol.test",
          allowIncoming: "none",
        }),
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      assert(
        element.querySelector('[data-testid="new-chat-suggested-header"]') !==
          null,
      );
      const rows = element.querySelectorAll(
        '[data-testid="profile-list-item-button"]',
      );
      assert.deepEqual(rows.length, 1);
      assert.deepEqual(rows[0].dataset.teststate, "enabled");
      assert(rows[0].textContent.includes("@alice.test"));
    });

    it("should fall back to the prompt when no follows are messageable", () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:carol",
          handle: "carol.test",
          allowIncoming: "none",
        }),
      ]);
      const element = createDialog(dataLayer);
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("Search for someone to message"),
        ),
      );
      assert.deepEqual(
        element.querySelector('[data-testid="profile-list-item-button"]'),
        null,
      );
    });

    it("should fall back to the prompt when follows fail to load", async () => {
      const { dataLayer } = makeDataLayer({
        followsFailure: createApiError(),
      });
      const element = createDialog(dataLayer);
      await flushMicrotasks();
      await nextFrame();
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("Search for someone to message"),
        ),
      );
    });

    it("should fall back to the prompt when the follows request fails at the network level", async () => {
      const { dataLayer } = makeDataLayer({
        followsFailure: new TypeError("Failed to fetch"),
      });
      const element = createDialog(dataLayer);
      await flushMicrotasks();
      await nextFrame();
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("Search for someone to message"),
        ),
      );
      assert.deepEqual(element.querySelectorAll(".profile-skeleton").length, 0);
    });

    it("should hide the suggestions once a query is typed", async () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      seedSearchResults(dataLayer, "dan", [
        createProfile({
          did: "did:plc:dan",
          handle: "dan.test",
          allowIncoming: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await typeQuery(element, "dan");
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-suggested-header"]'),
        null,
      );
      const rows = element.querySelectorAll(
        '[data-testid="profile-list-item-button"]',
      );
      assert.deepEqual(rows.length, 1);
      assert(rows[0].textContent.includes("@dan.test"));
    });
  });

  describe("NewChatDialog - search input", () => {
    it("should render the search icon", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      assert(
        element.querySelector(".search-dialog-input-container .search-icon") !==
          null,
      );
    });

    it("should only show the clear button while there is a query", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-search-clear"]'),
        null,
      );
      await typeQuery(element, "alice");
      assert(
        element.querySelector('[data-testid="new-chat-search-clear"]') !== null,
      );
    });

    it("should clear the query and restore the idle state on clear", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      await typeQuery(element, "alice");
      element.querySelector('[data-testid="new-chat-search-clear"]').click();
      await nextFrame();
      const input = element.querySelector(
        '[data-testid="new-chat-search-input"]',
      );
      assert.deepEqual(input.value, "");
      assert.deepEqual(searchSpy.mock.callCount(), 1);
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("Search for someone to message"),
        ),
      );
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-search-clear"]'),
        null,
      );
    });
  });

  describe("NewChatDialog - searching", () => {
    it("should call the loader with the trimmed query", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      const element = createDialog(dataLayer);
      await typeQuery(element, "  alice ");
      assert.deepEqual(searchSpy.mock.callCount(), 1);
      assert.deepEqual(searchSpy.mock.calls[0].arguments[0], {
        query: "alice",
        limit: 12,
      });
    });

    it("should not call the loader when the query is empty", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      const element = createDialog(dataLayer);
      await typeQuery(element, "");
      assert.deepEqual(searchSpy.mock.callCount(), 0);
    });

    it("should show skeletons while loading with no results yet", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      await typeQuery(element, "alice");
      assert(element.querySelectorAll(".profile-skeleton").length > 0);
    });

    it("should show the empty state when a settled search has no results", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      seedSearchResults(dataLayer, "alice", []);
      await typeQuery(element, "alice");
      assert(
        [...element.querySelectorAll('[data-testid="feed-end-message"]')].some(
          (el) => el.textContent.includes("No results"),
        ),
      );
    });

    it("should show an error row when the search fails with an ApiError", async () => {
      const { dataLayer } = makeDataLayer({
        searchFailure: createApiError(),
      });
      const element = createDialog(dataLayer);
      await typeQuery(element, "alice");
      assert(element.querySelector('[data-testid="new-chat-error"]') !== null);
    });

    it("should show an error row when the search fails at the network level", async () => {
      const { dataLayer } = makeDataLayer({
        searchFailure: new TypeError("Failed to fetch"),
      });
      const element = createDialog(dataLayer);
      await typeQuery(element, "alice");
      await nextFrame();
      assert(element.querySelector('[data-testid="new-chat-error"]') !== null);
    });

    it("should clear the network error once a retried search succeeds", async () => {
      const { dataLayer, failures } = makeDataLayer({
        searchFailure: new TypeError("Failed to fetch"),
      });
      const element = createDialog(dataLayer);
      await typeQuery(element, "alice");
      await nextFrame();
      assert(element.querySelector('[data-testid="new-chat-error"]') !== null);
      failures.search = null;
      await typeQuery(element, "alicia");
      await nextFrame();
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-error"]'),
        null,
      );
    });

    it("should search immediately and stop searching when the query is emptied", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      const element = createDialog(dataLayer);
      const input = element.querySelector(
        '[data-testid="new-chat-search-input"]',
      );
      input.value = "al";
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
      input.value = "";
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
      await nextFrame();
      await nextFrame();
      assert.deepEqual(searchSpy.mock.callCount(), 1);
      assert.deepEqual(searchSpy.mock.calls[0].arguments[0], {
        query: "al",
        limit: 12,
      });
    });
  });

  describe("NewChatDialog - results", () => {
    it("should render results, excluding self and deduping by did", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      const alice = createProfile({
        did: "did:plc:alice",
        handle: "alice.test",
        allowIncoming: "all",
      });
      seedSearchResults(dataLayer, "test", [
        alice,
        alice,
        createProfile({ did: "did:plc:me", handle: "me.test" }),
      ]);
      await typeQuery(element, "test");
      const rows = element.querySelectorAll(
        '[data-testid="profile-list-item-button"]',
      );
      assert.deepEqual(rows.length, 1);
      assert(rows[0].textContent.includes("@alice.test"));
    });

    it("should sort messageable profiles first and disable the rest", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      seedSearchResults(dataLayer, "test", [
        createProfile({
          did: "did:plc:carol",
          handle: "carol.test",
          allowIncoming: "none",
        }),
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      await typeQuery(element, "test");
      const rows = element.querySelectorAll(
        '[data-testid="profile-list-item-button"]',
      );
      assert.deepEqual(rows.length, 2);
      assert.deepEqual(rows[0].dataset.teststate, "enabled");
      assert.deepEqual(rows[0].disabled, false);
      assert.deepEqual(rows[1].dataset.teststate, "disabled");
      assert.deepEqual(rows[1].disabled, true);
      assert(rows[1].textContent.includes("@carol.test"));
      assert(rows[1].textContent.includes("Can't be messaged"));
    });

    it("should treat a missing allowIncoming declaration as following-only", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      seedSearchResults(dataLayer, "test", [
        createProfile({
          did: "did:plc:follower",
          handle: "follower.test",
          followedBy: true,
        }),
        createProfile({ did: "did:plc:stranger", handle: "stranger.test" }),
      ]);
      await typeQuery(element, "test");
      const rows = element.querySelectorAll(
        '[data-testid="profile-list-item-button"]',
      );
      assert.deepEqual(rows[0].dataset.teststate, "enabled");
      assert(rows[0].textContent.includes("@follower.test"));
      assert.deepEqual(rows[1].dataset.teststate, "disabled");
    });
  });

  describe("NewChatDialog - selection", () => {
    it("should close, ensure the convo, and navigate on selecting a user", async () => {
      const { dataLayer, ensureSpy } = makeDataLayer();
      const element = createDialog(dataLayer);
      element.open();
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      seedSearchResults(dataLayer, "alice", [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      await typeQuery(element, "alice");
      element.querySelector('[data-testid="profile-list-item-button"]').click();
      await flushMicrotasks();
      assert(closed, "the dialog closes when a user is selected");
      assert.deepEqual(
        ensureSpy.mock.calls.map((call) => call.arguments[0]),
        ["did:plc:alice"],
      );
      assert.deepEqual(
        window.router.go.mock.calls.map((call) => call.arguments),
        [["/messages/convo-1"]],
      );
    });

    it("should show a typed error toast and stay put when convo creation fails", async () => {
      const blockedError = new Error("400 Bad Request");
      blockedError.data = { error: "BlockedActor" };
      const { dataLayer } = makeDataLayer({
        ensureConvoForProfile: () => Promise.reject(blockedError),
      });
      const element = createDialog(dataLayer);
      element.open();
      seedSearchResults(dataLayer, "alice", [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      await typeQuery(element, "alice");
      element.querySelector('[data-testid="profile-list-item-button"]').click();
      await flushMicrotasks();
      const toast = document.body.querySelector('[data-testid="toast"]');
      assert(toast !== null, "toast should be shown");
      assert(
        toast.textContent.includes(
          "This user has blocked you and cannot be messaged.",
        ),
      );
      assert.deepEqual(window.router.go.mock.callCount(), 0);
    });

    it("should show a network error toast when the request fails to send", async () => {
      const { dataLayer } = makeDataLayer({
        ensureConvoForProfile: () =>
          Promise.reject(new TypeError("Failed to fetch")),
      });
      const element = createDialog(dataLayer);
      element.open();
      seedSearchResults(dataLayer, "alice", [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      await typeQuery(element, "alice");
      element.querySelector('[data-testid="profile-list-item-button"]').click();
      await flushMicrotasks();
      const toast = document.body.querySelector('[data-testid="toast"]');
      assert(toast !== null, "toast should be shown");
      assert(toast.textContent.includes("A network error occurred"));
    });

    it("should show the generic toast for unrecognized errors", async () => {
      const { dataLayer } = makeDataLayer({
        ensureConvoForProfile: () =>
          Promise.reject(new Error("Conversation not found")),
      });
      const element = createDialog(dataLayer);
      element.open();
      seedSearchResults(dataLayer, "alice", [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowIncoming: "all",
        }),
      ]);
      await typeQuery(element, "alice");
      element.querySelector('[data-testid="profile-list-item-button"]').click();
      await flushMicrotasks();
      const toast = document.body.querySelector('[data-testid="toast"]');
      assert(toast !== null, "toast should be shown");
      assert(
        toast.textContent.includes(
          "An issue occurred starting the chat, please try again.",
        ),
      );
    });
  });

  describe("NewChatDialog - autofocus", () => {
    it("should focus the search input without scrolling on open", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      const input = element.querySelector(
        '[data-testid="new-chat-search-input"]',
      );
      const focus = input.focus.bind(input);
      let options;
      input.focus = (nextOptions) => {
        options = nextOptions;
        focus(nextOptions);
      };

      element.open();

      assert.deepEqual(document.activeElement, input);
      assert.deepEqual(options, { preventScroll: true });
      assert(
        element.querySelector(".new-chat-dialog").hasAttribute("autofocus"),
      );
    });

    it("should reset scroll when the search input blurs", () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      element.open();

      const results = element.querySelector(".search-dialog-results");
      const input = element.querySelector(
        '[data-testid="new-chat-search-input"]',
      );
      results.scrollTop = 200;
      window.scrollTo(0, 200);

      input.dispatchEvent(new window.FocusEvent("blur", { bubbles: false }));

      assert.equal(results.scrollTop, 0);
      assert.equal(window.scrollY, 0);
    });
  });

  describe("NewChatDialog - dismissal", () => {
    it("should close on the close button", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      element.open();
      element.querySelector('[data-testid="new-chat-dialog-close"]').click();
      await flushMicrotasks();
      assert(closed);
    });

    it("should close on cancel (Escape)", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      element.open();
      const dialog = element.querySelector("dialog.new-chat-dialog");
      dialog.dispatchEvent(new window.Event("cancel", { bubbles: false }));
      await flushMicrotasks();
      assert(closed);
    });
  });
});
