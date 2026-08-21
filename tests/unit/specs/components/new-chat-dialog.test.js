import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer, stubStatusTracked } from "../../testHelpers.js";
import { ApiError } from "/js/api.js";
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
    createGroupChat,
    searchFailure = null,
    followsFailure = null,
  } = {}) {
    const dataLayer = makeTestDataLayer();
    const currentUser = { did: "did:plc:me", handle: "me.test" };
    dataLayer.dataStore.$currentUser.set(currentUser);
    const failures = { search: searchFailure, follows: followsFailure };

    stubStatusTracked(
      dataLayer.requests,
      "loadChatActorStatus",
      "loadChatActorStatus",
      async () => {},
    );

    const createGroupSpy = mock.method(
      dataLayer.mutations,
      "createGroupChat",
      async (name, memberDids) => {
        if (createGroupChat) {
          return createGroupChat(name, memberDids);
        }
        return { id: "convo-group-1" };
      },
    );

    const searchSpy = stubStatusTracked(
      dataLayer.requests,
      "loadChatRecipientSearch",
      "loadChatRecipientSearch",
      async () => {
        if (failures.search) throw failures.search;
      },
    );

    const followsSpy = stubStatusTracked(
      dataLayer.requests,
      "loadProfileFollows",
      (did) => `loadProfileFollows-${did}`,
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
      createGroupSpy,
    };
  }

  function seedChatActorStatus(dataLayer, overrides = {}) {
    dataLayer.dataStore.$chatActorStatus.set({
      chatDisabled: false,
      canCreateGroups: true,
      groupMemberLimit: 100,
      ...overrides,
    });
  }

  function seedFollows(dataLayer, follows, did = "did:plc:me") {
    dataLayer.dataStore.setProfiles(follows);
    dataLayer.dataStore.$profileFollows.set(did, { follows, cursor: null });
  }

  function seedSearchResults(dataLayer, actors) {
    dataLayer.dataStore.setProfiles(actors);
    dataLayer.dataStore.$chatRecipientSearchResults.set({
      actors,
      cursor: null,
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
    allowGroupInvites,
    followedBy,
  } = {}) {
    const chat = {
      ...(allowIncoming !== undefined ? { allowIncoming } : {}),
      ...(allowGroupInvites !== undefined ? { allowGroupInvites } : {}),
    };
    return {
      did,
      handle,
      displayName: displayName ?? handle,
      avatar: "",
      labels: [],
      viewer: followedBy ? { followedBy: "at://follow" } : {},
      ...(Object.keys(chat).length > 0 ? { associated: { chat } } : {}),
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
      assert.deepEqual(followsSpy.mock.calls[0].arguments[0], "did:plc:me");
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
      seedSearchResults(dataLayer, [
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
      assert.deepEqual(
        searchSpy.mock.calls[searchSpy.mock.calls.length - 1].arguments[0],
        "",
      );
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
      assert.deepEqual(searchSpy.mock.calls[0].arguments[0], "alice");
      assert.deepEqual(searchSpy.mock.calls[0].arguments[1].limit, 12);
    });

    it("should clear results immediately when the query is emptied", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      const element = createDialog(dataLayer);
      await typeQuery(element, "");
      assert.deepEqual(searchSpy.mock.callCount(), 1);
      assert.deepEqual(searchSpy.mock.calls[0].arguments[0], "");
    });

    it("should show skeletons while loading with no results yet", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      dataLayer.requests.statusStore.setLoading(
        "loadChatRecipientSearch",
        true,
      );
      await typeQuery(element, "alice");
      assert(element.querySelectorAll(".profile-skeleton").length > 0);
    });

    it("should show the empty state when a settled search has no results", async () => {
      const { dataLayer } = makeDataLayer();
      const element = createDialog(dataLayer);
      seedSearchResults(dataLayer, []);
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

    it("should search immediately and end with a clearing call when the query is emptied", async () => {
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
      assert.deepEqual(searchSpy.mock.callCount(), 2);
      assert.deepEqual(searchSpy.mock.calls[0].arguments[0], "al");
      assert.deepEqual(searchSpy.mock.calls[1].arguments[0], "");
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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
      seedSearchResults(dataLayer, [
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

  async function goToMemberStep(element) {
    element.querySelector('[data-testid="new-chat-new-group-button"]').click();
    await nextFrame();
  }

  function memberRows(element) {
    return [
      ...element.querySelectorAll('[data-testid="profile-list-item-button"]'),
    ];
  }

  async function toggleRowByHandle(element, handle) {
    const row = memberRows(element).find((rowElement) =>
      rowElement.textContent.includes(`@${handle}`),
    );
    row.click();
    await nextFrame();
  }

  async function setGroupName(element, value) {
    const input = element.querySelector('[data-testid="new-group-name-input"]');
    input.value = value;
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await nextFrame();
  }

  describe("NewChatDialog - group entry", () => {
    it("should show the group row only while the search box is empty", async () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      assert(
        element.querySelector('[data-testid="new-chat-new-group-button"]') !==
          null,
      );
      seedSearchResults(dataLayer, []);
      await typeQuery(element, "alice");
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-new-group-button"]'),
        null,
      );
    });

    it("should hide the group row when group chats are not enabled", () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, []);
      const element = document.createElement("new-chat-dialog");
      element.dataLayer = dataLayer;
      element.groupChatsEnabled = false;
      document.body.appendChild(element);
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-new-group-button"]'),
        null,
      );
    });

    it("should advance to the member-select step when groups are allowed", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      assert(
        element.querySelector('[data-testid="new-group-back-button"]') !== null,
      );
      assert(
        element
          .querySelector(".search-dialog-title")
          .textContent.includes("New group chat"),
      );
    });

    it("should fail open and advance while the actor status has not loaded", async () => {
      const { dataLayer } = makeDataLayer();
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      const row = element.querySelector(
        '[data-testid="new-chat-new-group-button"]',
      );
      assert(!row.classList.contains("is-disabled"));
      await goToMemberStep(element);
      assert(
        element.querySelector('[data-testid="new-group-back-button"]') !== null,
      );
    });

    it("should dim the row and show the too-new alert when canCreateGroups is false", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer, { canCreateGroups: false });
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      await nextFrame();
      const row = element.querySelector(
        '[data-testid="new-chat-new-group-button"]',
      );
      assert(row.classList.contains("is-disabled"));
      row.click();
      await nextFrame();
      const alert = document.body.querySelector('[data-testid="alert-modal"]');
      assert(alert !== null, "alert modal should be shown");
      assert(alert.textContent.includes("Your account is too new"));
      assert.deepEqual(
        element.querySelector('[data-testid="new-group-back-button"]'),
        null,
      );
    });
  });

  describe("NewChatDialog - member select", () => {
    it("should filter ineligible profiles out of the suggested follows", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
        createProfile({
          did: "did:plc:carol",
          handle: "carol.test",
          allowGroupInvites: "none",
          allowIncoming: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      const rows = memberRows(element);
      assert.deepEqual(rows.length, 1);
      assert(rows[0].textContent.includes("@alice.test"));
    });

    it("should apply the eligibility matrix to search results", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      seedSearchResults(dataLayer, [
        createProfile({
          did: "did:plc:all",
          handle: "all.test",
          allowGroupInvites: "all",
        }),
        createProfile({
          did: "did:plc:mutual",
          handle: "mutual.test",
          allowGroupInvites: "following",
          followedBy: true,
        }),
        createProfile({
          did: "did:plc:stranger",
          handle: "stranger.test",
          allowGroupInvites: "following",
        }),
        createProfile({
          did: "did:plc:delegated",
          handle: "delegated.test",
          allowIncoming: "all",
        }),
        createProfile({
          did: "did:plc:unknown",
          handle: "unknown.test",
          allowGroupInvites: "sometimes",
        }),
        createProfile({
          did: "did:plc:closed",
          handle: "closed.test",
          allowGroupInvites: "none",
        }),
      ]);
      await typeQuery(element, "test");
      const rows = memberRows(element);
      assert.deepEqual(rows.length, 6);
      const stateByHandle = Object.fromEntries(
        rows.map((rowElement) => [
          rowElement
            .querySelector('[data-testid="profile-list-item-handle"]')
            .textContent.trim()
            .replace("@", ""),
          rowElement.dataset.teststate,
        ]),
      );
      assert.deepEqual(stateByHandle, {
        "all.test": "enabled",
        "mutual.test": "enabled",
        "delegated.test": "enabled",
        "stranger.test": "disabled",
        "unknown.test": "disabled",
        "closed.test": "disabled",
      });
      const disabledRow = rows.find((rowElement) =>
        rowElement.textContent.includes("@closed.test"),
      );
      assert(
        disabledRow.querySelector('[data-testid="not-addable-hint"]') !== null,
      );
    });

    it("should add a chip and clear the search when a member is selected", async () => {
      const { dataLayer, searchSpy } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, []);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      seedSearchResults(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          displayName: "Alice",
          allowGroupInvites: "all",
        }),
      ]);
      await typeQuery(element, "alice");
      await toggleRowByHandle(element, "alice.test");
      const chips = element.querySelectorAll(
        '[data-testid="new-group-member-chip"]',
      );
      assert.deepEqual(chips.length, 1);
      assert(chips[0].textContent.includes("Alice"));
      const input = element.querySelector(
        '[data-testid="new-chat-search-input"]',
      );
      assert.deepEqual(input.value, "");
      assert.deepEqual(
        searchSpy.mock.calls[searchSpy.mock.calls.length - 1].arguments[0],
        "",
      );
    });

    it("should keep the search text when a chip is removed", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      await toggleRowByHandle(element, "alice.test");
      seedSearchResults(dataLayer, []);
      await typeQuery(element, "bob");
      element
        .querySelector('[data-testid="new-group-member-chip-remove"]')
        .click();
      await nextFrame();
      assert.deepEqual(
        element.querySelectorAll('[data-testid="new-group-member-chip"]')
          .length,
        0,
      );
      assert.deepEqual(
        element.querySelector('[data-testid="new-chat-search-input"]').value,
        "bob",
      );
    });

    it("should unselect a selected member on a second row toggle", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      await toggleRowByHandle(element, "alice.test");
      assert.deepEqual(
        element
          .querySelector('[data-testid="new-group-member-toggle"]')
          .getAttribute("data-teststate"),
        "selected",
      );
      await toggleRowByHandle(element, "alice.test");
      assert.deepEqual(
        element.querySelectorAll('[data-testid="new-group-member-chip"]')
          .length,
        0,
      );
      assert.deepEqual(
        element
          .querySelector('[data-testid="new-group-member-toggle"]')
          .getAttribute("data-teststate"),
        "unselected",
      );
    });

    it("should disable unselected rows once the member cap is reached", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer, { groupMemberLimit: 3 });
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
        createProfile({
          did: "did:plc:bob",
          handle: "bob.test",
          allowGroupInvites: "all",
        }),
        createProfile({
          did: "did:plc:carol",
          handle: "carol.test",
          allowGroupInvites: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      await toggleRowByHandle(element, "alice.test");
      await toggleRowByHandle(element, "bob.test");
      const carolRow = memberRows(element).find((rowElement) =>
        rowElement.textContent.includes("@carol.test"),
      );
      assert.deepEqual(carolRow.dataset.teststate, "disabled");
      assert.deepEqual(carolRow.disabled, true);
      const aliceRow = memberRows(element).find((rowElement) =>
        rowElement.textContent.includes("@alice.test"),
      );
      assert.deepEqual(aliceRow.dataset.teststate, "enabled");
    });

    it("should show the Next button only once a member is selected", async () => {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
      ]);
      const element = createDialog(dataLayer);
      await goToMemberStep(element);
      assert.deepEqual(
        element.querySelector('[data-testid="new-group-next-button"]'),
        null,
      );
      await toggleRowByHandle(element, "alice.test");
      const nextButton = element.querySelector(
        '[data-testid="new-group-next-button"]',
      );
      assert(nextButton !== null);
      nextButton.click();
      await nextFrame();
      assert(
        element.querySelector('[data-testid="new-group-name-input"]') !== null,
      );
    });
  });

  describe("NewChatDialog - back semantics", () => {
    async function goToNameStep(element) {
      await toggleRowByHandle(element, "alice.test");
      element.querySelector('[data-testid="new-group-next-button"]').click();
      await nextFrame();
    }

    function makeGroupDialog() {
      const { dataLayer } = makeDataLayer();
      seedChatActorStatus(dataLayer);
      seedFollows(dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          allowGroupInvites: "all",
        }),
      ]);
      return createDialog(dataLayer);
    }

    it("should keep members and clear the name when backing out of the name step", async () => {
      const element = makeGroupDialog();
      await goToMemberStep(element);
      await goToNameStep(element);
      await setGroupName(element, "Trip");
      element.querySelector('[data-testid="new-group-back-button"]').click();
      await nextFrame();
      assert.deepEqual(
        element.querySelectorAll('[data-testid="new-group-member-chip"]')
          .length,
        1,
      );
      element.querySelector('[data-testid="new-group-next-button"]').click();
      await nextFrame();
      assert.deepEqual(
        element.querySelector('[data-testid="new-group-name-input"]').value,
        "",
      );
    });

    it("should discard everything when backing out of the member step", async () => {
      const element = makeGroupDialog();
      await goToMemberStep(element);
      await toggleRowByHandle(element, "alice.test");
      element.querySelector('[data-testid="new-group-back-button"]').click();
      await nextFrame();
      assert(
        element.querySelector('[data-testid="new-chat-new-group-button"]') !==
          null,
      );
      await goToMemberStep(element);
      assert.deepEqual(
        element.querySelectorAll('[data-testid="new-group-member-chip"]')
          .length,
        0,
      );
    });
  });

  describe("NewChatDialog - group name step", () => {
    async function goToNameStep(element, handles = ["alice.test"]) {
      await goToMemberStep(element);
      for (const handle of handles) {
        await toggleRowByHandle(element, handle);
      }
      element.querySelector('[data-testid="new-group-next-button"]').click();
      await nextFrame();
    }

    function makeGroupDialog(options = {}) {
      const result = makeDataLayer(options);
      seedChatActorStatus(result.dataLayer);
      seedFollows(result.dataLayer, [
        createProfile({
          did: "did:plc:alice",
          handle: "alice.test",
          displayName: "Alice",
          allowGroupInvites: "all",
        }),
        createProfile({
          did: "did:plc:bob",
          handle: "bob.test",
          displayName: "Bob",
          allowGroupInvites: "all",
        }),
      ]);
      return { ...result, element: createDialog(result.dataLayer) };
    }

    it("should list the chosen members under the review header", async () => {
      const { element } = makeGroupDialog();
      await goToNameStep(element, ["alice.test", "bob.test"]);
      assert(
        element.querySelector('[data-testid="new-group-members-header"]') !==
          null,
      );
      const rows = element.querySelectorAll(".profile-list-item");
      assert.deepEqual(rows.length, 2);
      assert(rows[0].textContent.includes("@alice.test"));
      assert(rows[1].textContent.includes("@bob.test"));
    });

    it("should disable Create for empty, whitespace-only, and over-limit names", async () => {
      const { element } = makeGroupDialog();
      await goToNameStep(element);
      const createButton = element.querySelector(
        '[data-testid="new-group-create-button"]',
      );
      assert.deepEqual(createButton.disabled, true);
      await setGroupName(element, "   ");
      assert.deepEqual(createButton.disabled, true);
      await setGroupName(element, "a".repeat(51));
      assert.deepEqual(createButton.disabled, true);
      assert(
        element.querySelector(".form-dialog-char-count.overflow") !== null,
      );
      await setGroupName(element, "a".repeat(50));
      assert.deepEqual(createButton.disabled, false);
    });

    it("should create the group with the trimmed name, close, and navigate", async () => {
      const { element, createGroupSpy } = makeGroupDialog();
      element.open();
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      await goToNameStep(element, ["alice.test", "bob.test"]);
      await setGroupName(element, "  Trip planning  ");
      element.querySelector('[data-testid="new-group-create-button"]').click();
      await flushMicrotasks();
      assert.deepEqual(createGroupSpy.mock.callCount(), 1);
      assert.deepEqual(createGroupSpy.mock.calls[0].arguments, [
        "Trip planning",
        ["did:plc:alice", "did:plc:bob"],
      ]);
      assert(closed, "the dialog closes after a successful create");
      assert.deepEqual(
        window.router.go.mock.calls.map((call) => call.arguments),
        [["/messages/convo-group-1"]],
      );
    });

    it("should submit on Enter in the name field", async () => {
      const { element, createGroupSpy } = makeGroupDialog();
      element.open();
      await goToNameStep(element);
      await setGroupName(element, "Trip");
      const input = element.querySelector(
        '[data-testid="new-group-name-input"]',
      );
      input.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await flushMicrotasks();
      assert.deepEqual(createGroupSpy.mock.callCount(), 1);
    });

    it("should toast and keep the dialog state when the create fails", async () => {
      const failure = createApiError("UserForbidsGroups");
      const { element } = makeGroupDialog({
        createGroupChat: () => Promise.reject(failure),
      });
      element.open();
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      await goToNameStep(element);
      await setGroupName(element, "Trip");
      element.querySelector('[data-testid="new-group-create-button"]').click();
      await flushMicrotasks();
      const toast = document.body.querySelector('[data-testid="toast"]');
      assert(toast !== null, "toast should be shown");
      assert(
        toast.textContent.includes(
          "One of the selected recipients does not allow group chats.",
        ),
      );
      assert(!closed, "the dialog stays open on failure");
      assert.deepEqual(
        element.querySelector('[data-testid="new-group-name-input"]').value,
        "Trip",
      );
      assert.deepEqual(window.router.go.mock.callCount(), 0);
    });

    it("should map group create errors to their toasts", async () => {
      const cases = [
        [
          createApiError("BlockedSubject"),
          "You have blocked one of the selected recipients.",
        ],
        [
          createApiError("NewAccountCannotCreateGroup"),
          "You cannot create a group chat yet.",
        ],
        [
          new TypeError("Failed to fetch"),
          "A network error occurred. Please check your internet connection.",
        ],
        [
          createApiError("SomethingUnexpected"),
          "An issue occurred starting the group chat, please try again.",
        ],
      ];
      for (const [failure, expectedText] of cases) {
        document.body.innerHTML = "";
        const { element } = makeGroupDialog({
          createGroupChat: () => Promise.reject(failure),
        });
        element.open();
        await goToNameStep(element);
        await setGroupName(element, "Trip");
        element
          .querySelector('[data-testid="new-group-create-button"]')
          .click();
        await flushMicrotasks();
        const toast = document.body.querySelector('[data-testid="toast"]');
        assert(toast !== null, "toast should be shown");
        assert(
          toast.textContent.includes(expectedText),
          `expected toast for ${failure?.data?.error ?? failure}`,
        );
      }
    });

    it("should fire exactly one create request on a double submit", async () => {
      let resolveCreate;
      const { element, createGroupSpy } = makeGroupDialog({
        createGroupChat: () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      });
      element.open();
      await goToNameStep(element);
      await setGroupName(element, "Trip");
      const createButton = element.querySelector(
        '[data-testid="new-group-create-button"]',
      );
      createButton.click();
      createButton.click();
      await flushMicrotasks();
      assert.deepEqual(createGroupSpy.mock.callCount(), 1);
      resolveCreate({ id: "convo-group-1" });
      await flushMicrotasks();
      assert.deepEqual(window.router.go.mock.callCount(), 1);
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
