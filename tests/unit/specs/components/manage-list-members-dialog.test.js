import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer } from "../../testHelpers.js";
import "/js/components/manage-list-members-dialog.js";

describe("manage-list-members-dialog", () => {
  const originalSetTimeout = globalThis.setTimeout;

  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  async function nextFrame() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  const LIST = {
    uri: "at://did:plc:me/app.bsky.graph.list/rk1",
    cid: "cid1",
    name: "My List",
    purpose: "app.bsky.graph.defs#curatelist",
    creator: { did: "did:plc:me", handle: "me.test" },
  };

  function createProfile({ did, handle, displayName } = {}) {
    return {
      did,
      handle,
      displayName: displayName ?? handle,
      avatar: "",
      labels: [],
      viewer: {},
    };
  }

  function makeDataLayer({
    members = [],
    searchResults = null,
    follows = null,
    addFailure = null,
    removeFailure = null,
    membersPages = null,
  } = {}) {
    const dataLayer = makeTestDataLayer();
    const currentUser = { did: "did:plc:me", handle: "me.test" };
    dataLayer.dataStore.$currentUser.set(currentUser);

    if (members.length && !membersPages) {
      dataLayer.dataStore.setProfiles(members);
      dataLayer.dataStore.$listMembers.set(LIST.uri, {
        items: members.map((profile, i) => ({
          uri: `at://did:plc:me/app.bsky.graph.listitem/li${i}`,
          subject: profile,
        })),
        cursor: null,
      });
    }
    if (follows) {
      dataLayer.dataStore.setProfiles(follows);
      dataLayer.dataStore.$profileFollows.set("did:plc:me", {
        follows,
        cursor: null,
      });
    }
    if (searchResults) {
      dataLayer.dataStore.setProfiles(searchResults);
      dataLayer.dataStore.$chatRecipientSearchResults.set({
        actors: searchResults,
        cursor: null,
      });
    }

    let loadMembersCallIndex = 0;
    const loadMembersSpy = mock.method(
      dataLayer.requests,
      "loadListMembers",
      async (uri, { reload = false } = {}) => {
        if (!membersPages) return;
        const idx = loadMembersCallIndex++;
        const page = membersPages[idx];
        if (!page) return;
        for (const item of page.items) {
          dataLayer.dataStore.setProfiles([item.subject]);
        }
        const existing = dataLayer.dataStore.$listMembers.get(uri);
        const items = [
          ...(existing && !reload ? existing.items : []),
          ...page.items,
        ];
        dataLayer.dataStore.$listMembers.set(uri, {
          items,
          cursor: page.cursor,
        });
      },
    );

    mock.method(dataLayer.requests, "loadChatRecipientSearch", (query) => {
      if (!query) {
        dataLayer.dataStore.$chatRecipientSearchResults.set(null);
      }
      return Promise.resolve();
    });

    const addSpy = mock.method(
      dataLayer.mutations,
      "addProfileToList",
      async (profile, list) => {
        if (addFailure) throw addFailure;
        const existing = dataLayer.dataStore.$listMembers.get(list.uri) ?? {
          items: [],
          cursor: null,
        };
        dataLayer.dataStore.setProfiles([profile]);
        dataLayer.dataStore.$listMembers.set(list.uri, {
          ...existing,
          items: [
            {
              uri: `at://did:plc:me/app.bsky.graph.listitem/new-${profile.did}`,
              subject: profile,
            },
            ...existing.items,
          ],
        });
      },
    );

    const removeSpy = mock.method(
      dataLayer.mutations,
      "removeProfileFromList",
      async (profile, list, _membershipUri) => {
        if (removeFailure) throw removeFailure;
        const existing = dataLayer.dataStore.$listMembers.get(list.uri);
        if (existing) {
          dataLayer.dataStore.$listMembers.set(list.uri, {
            ...existing,
            items: existing.items.filter(
              (item) => item.subject.did !== profile.did,
            ),
          });
        }
      },
    );

    return {
      dataLayer,
      loadMembersSpy,
      addSpy,
      removeSpy,
    };
  }

  function createDialog(dataLayer, list = LIST) {
    const element = document.createElement("manage-list-members-dialog");
    element.dataLayer = dataLayer;
    element.list = list;
    document.body.appendChild(element);
    return element;
  }

  async function typeQuery(element, value) {
    const input = element.querySelector(
      '[data-testid="manage-list-members-search-input"]',
    );
    input.value = value;
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await nextFrame();
    await nextFrame();
  }

  it("renders the dialog title and search input", () => {
    const { dataLayer } = makeDataLayer();
    const element = createDialog(dataLayer);
    const dialog = element.querySelector("dialog.manage-list-members-dialog");
    assert(dialog !== null);
    assert(dialog.classList.contains("bottom-sheet"));
    assert(element.textContent.includes("Add people to list"));
    assert(
      element.querySelector(
        '[data-testid="manage-list-members-search-input"]',
      ) !== null,
    );
  });

  it("loads all list members on connect (paginating up to the cap)", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const bob = createProfile({ did: "did:plc:bob", handle: "bob.test" });
    const { dataLayer, loadMembersSpy } = makeDataLayer({
      membersPages: [
        { items: [{ uri: "at://li1", subject: alice }], cursor: "next" },
        { items: [{ uri: "at://li2", subject: bob }], cursor: null },
      ],
    });
    createDialog(dataLayer);
    await flushMicrotasks();
    assert.deepEqual(loadMembersSpy.mock.callCount(), 2);
    assert.deepEqual(loadMembersSpy.mock.calls[0].arguments[1].reload, true);
    assert.deepEqual(
      loadMembersSpy.mock.calls[1].arguments[1]?.reload ?? false,
      false,
    );
  });

  it("shows Add for a suggested profile that is not a member", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const { dataLayer } = makeDataLayer({
      follows: [alice],
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await nextFrame();
    const buttons = element.querySelectorAll(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert.deepEqual(buttons.length, 1);
    assert.deepEqual(buttons[0].dataset.teststate, "not-member");
    assert.equal(buttons[0].textContent.trim(), "Add");
  });

  it("shows Remove for a search result that is already a member", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const { dataLayer } = makeDataLayer({
      members: [alice],
      searchResults: [alice],
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await typeQuery(element, "alice");
    const buttons = element.querySelectorAll(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert.deepEqual(buttons.length, 1);
    assert.deepEqual(buttons[0].dataset.teststate, "member");
    assert.equal(buttons[0].textContent.trim(), "Remove");
  });

  it("adds a profile when Add is clicked and flips the button to Remove", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const { dataLayer, addSpy } = makeDataLayer({
      follows: [alice],
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await nextFrame();
    element.querySelector('[data-testid="manage-list-members-toggle"]').click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(addSpy.mock.callCount(), 1);
    assert.deepEqual(addSpy.mock.calls[0].arguments[0].did, "did:plc:alice");
    const button = element.querySelector(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert.deepEqual(button.dataset.teststate, "member");
    assert.equal(button.textContent.trim(), "Remove");
  });

  it("removes a profile when Remove is clicked and flips the button to Add", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const { dataLayer, removeSpy } = makeDataLayer({
      members: [alice],
      follows: [alice],
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await nextFrame();
    element.querySelector('[data-testid="manage-list-members-toggle"]').click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(removeSpy.mock.callCount(), 1);
    assert.deepEqual(removeSpy.mock.calls[0].arguments[0].did, "did:plc:alice");
    assert.match(removeSpy.mock.calls[0].arguments[2], /listitem\/li0$/);
    const button = element.querySelector(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert.deepEqual(button.dataset.teststate, "not-member");
    assert.equal(button.textContent.trim(), "Add");
  });

  it("shows a spinner and disables the button while a toggle is pending", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    let releaseAdd;
    const gate = new Promise((resolve) => (releaseAdd = resolve));
    const { dataLayer } = makeDataLayer({
      follows: [alice],
    });
    mock.method(dataLayer.mutations, "addProfileToList", async () => {
      await gate;
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await nextFrame();
    element.querySelector('[data-testid="manage-list-members-toggle"]').click();
    await nextFrame();
    const pendingButton = element.querySelector(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert(pendingButton.disabled);
    assert(
      pendingButton.querySelector('[data-testid="loading-spinner"]') !== null,
    );
    releaseAdd();
    await flushMicrotasks();
    await nextFrame();
    const finalButton = element.querySelector(
      '[data-testid="manage-list-members-toggle"]',
    );
    assert.equal(finalButton.disabled, false);
    assert.equal(
      finalButton.querySelector('[data-testid="loading-spinner"]'),
      null,
    );
  });

  it("switches from suggestions to search results when a query is typed", async () => {
    const alice = createProfile({ did: "did:plc:alice", handle: "alice.test" });
    const dan = createProfile({ did: "did:plc:dan", handle: "dan.test" });
    const { dataLayer } = makeDataLayer({
      follows: [alice],
    });
    const element = createDialog(dataLayer);
    await flushMicrotasks();
    await nextFrame();
    assert(
      element.querySelector(
        '[data-testid="manage-list-members-suggested-header"]',
      ) !== null,
    );
    dataLayer.dataStore.setProfiles([dan]);
    dataLayer.dataStore.$chatRecipientSearchResults.set({
      actors: [dan],
      cursor: null,
    });
    await typeQuery(element, "dan");
    assert.equal(
      element.querySelector(
        '[data-testid="manage-list-members-suggested-header"]',
      ),
      null,
    );
    const rows = element.querySelectorAll(
      '[data-testid="profile-list-item-body"]',
    );
    assert.deepEqual(rows.length, 1);
    assert(rows[0].textContent.includes("@dan.test"));
  });

  it("shows the empty state when the search returns nothing", async () => {
    const { dataLayer } = makeDataLayer();
    const element = createDialog(dataLayer);
    dataLayer.dataStore.$chatRecipientSearchResults.set({
      actors: [],
      cursor: null,
    });
    await typeQuery(element, "zzz");
    const emptyMessage = element.querySelector(
      '[data-testid="feed-end-message"]',
    );
    assert(emptyMessage !== null);
    assert.equal(emptyMessage.textContent.trim(), "No results");
  });

  it("closes on the close button", async () => {
    const { dataLayer } = makeDataLayer();
    const element = createDialog(dataLayer);
    let closed = false;
    element.addEventListener("dialog-closed", () => {
      closed = true;
    });
    element.open();
    element.querySelector('[data-testid="manage-list-members-close"]').click();
    await flushMicrotasks();
    assert(closed);
  });
});
