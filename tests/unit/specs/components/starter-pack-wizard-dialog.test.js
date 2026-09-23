import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer, respondToConfirm } from "../../testHelpers.js";
import "/js/components/starter-pack-wizard-dialog.js";

describe("starter-pack-wizard-dialog", () => {
  const originalSetTimeout = globalThis.setTimeout;

  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    document.body.innerHTML = "";
  });

  async function nextFrame() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const ME = { did: "did:plc:me", handle: "me.test", displayName: "Me" };
  const DISCOVER_FEED_URI =
    "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

  function createProfile(did, extra = {}) {
    return {
      did,
      handle: did.replace("did:plc:", "") + ".test",
      displayName: did.replace("did:plc:", ""),
      avatar: "",
      labels: [],
      viewer: {},
      ...extra,
    };
  }

  function createFeed(uri, displayName) {
    return {
      uri,
      displayName,
      avatar: "",
      creator: { did: "did:plc:feedowner", handle: "feeds.test" },
    };
  }

  function makeFollows(count) {
    return Array.from({ length: count }, (_, i) =>
      createProfile(`did:plc:follow${i}`),
    );
  }

  function makeDataLayer({ follows = [], popularFeeds = [] } = {}) {
    const dataLayer = makeTestDataLayer();
    dataLayer.dataStore.$currentUser.set(ME);
    dataLayer.dataStore.setProfiles(follows);
    dataLayer.dataStore.$profileFollows.set(ME.did, {
      follows,
      cursor: null,
    });
    dataLayer.dataStore.$popularFeeds.set(popularFeeds);
    dataLayer.dataStore.$pinnedItems.set([]);
    mock.method(dataLayer.declarative, "ensureCurrentUser", async () => ME);
    mock.method(dataLayer.declarative, "ensureProfileFollows", async () => ({
      follows,
    }));
    mock.method(dataLayer.declarative, "ensurePinnedItems", async () => []);
    mock.method(dataLayer.requests, "loadPopularFeeds", async () => {});
    mock.method(dataLayer.requests, "loadChatRecipientSearch", async () => {});
    mock.method(dataLayer.requests, "loadFeedSearch", async () => {});
    return dataLayer;
  }

  function createDialog(dataLayer, props = {}) {
    const element = document.createElement("starter-pack-wizard-dialog");
    element.dataLayer = dataLayer;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
  }

  function query(element, testId) {
    return element.querySelector(`[data-testid="${testId}"]`);
  }

  function queryAll(element, testId) {
    return [...element.querySelectorAll(`[data-testid="${testId}"]`)];
  }

  function wizardState(element) {
    return query(element, "starter-pack-wizard").getAttribute("data-teststate");
  }

  function typeInto(element, testId, value) {
    const input = query(element, testId);
    input.value = value;
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
  }

  async function goToProfiles(element) {
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
  }

  async function addProfiles(element, count) {
    const toggles = queryAll(element, "starter-pack-profile-toggle").filter(
      (toggle) => toggle.getAttribute("data-teststate") === "not-included",
    );
    for (const toggle of toggles.slice(0, count)) {
      toggle.click();
    }
    await nextFrame();
  }

  it("starts on the details step with the name input focused", () => {
    const element = createDialog(makeDataLayer());
    element.open();
    assert.equal(wizardState(element), "details");
    assert.equal(
      document.activeElement,
      query(element, "starter-pack-name-input"),
    );
  });

  it("disables Next while the name is over the limit", async () => {
    const element = createDialog(makeDataLayer());
    element.open();
    typeInto(element, "starter-pack-name-input", "x".repeat(51));
    await nextFrame();
    assert.equal(query(element, "starter-pack-wizard-next").disabled, true);
    typeInto(element, "starter-pack-name-input", "Fine");
    await nextFrame();
    assert.equal(query(element, "starter-pack-wizard-next").disabled, false);
  });

  it("requires eight people before moving to the feeds step", async () => {
    const element = createDialog(makeDataLayer({ follows: makeFollows(10) }));
    element.open();
    await goToProfiles(element);
    assert.equal(wizardState(element), "profiles");
    assert.equal(
      query(element, "starter-pack-wizard-hint").textContent.trim(),
      "Add 7 more people to continue",
    );
    assert.equal(query(element, "starter-pack-wizard-next").disabled, true);

    await addProfiles(element, 7);
    assert.equal(query(element, "starter-pack-wizard-hint"), null);
    assert.equal(query(element, "starter-pack-wizard-next").disabled, false);
    assert.equal(query(element, "starter-pack-wizard-count"), null);

    await addProfiles(element, 1);
    assert.equal(
      query(element, "starter-pack-wizard-count").textContent.trim(),
      "9/150",
    );

    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    assert.equal(wizardState(element), "feeds");
  });

  it("keeps the current user locked in the selection", async () => {
    const me = createProfile(ME.did, { displayName: "Me" });
    const element = createDialog(
      makeDataLayer({ follows: [me, ...makeFollows(2)] }),
    );
    element.open();
    await goToProfiles(element);
    const selfToggle = queryAll(element, "starter-pack-profile-toggle")[0];
    assert.equal(selfToggle.getAttribute("data-teststate"), "locked");
    assert.equal(selfToggle.disabled, true);
  });

  it("shows opted-out members as disabled in edit mode", async () => {
    const optedOut = createProfile("did:plc:optedout");
    const member = createProfile("did:plc:member");
    const element = createDialog(
      makeDataLayer({ follows: [optedOut, member] }),
      {
        starterPack: {
          uri: "at://did:plc:me/app.bsky.graph.starterpack/p",
          record: { name: "Pack", description: "Desc" },
          creator: ME,
          list: { uri: "at://did:plc:me/app.bsky.graph.list/p" },
          feeds: [],
        },
        members: [optedOut, member],
        optedOutDids: [optedOut.did],
      },
    );
    element.open();
    assert.equal(query(element, "starter-pack-name-input").value, "Pack");
    assert.equal(
      query(element, "starter-pack-description-input").value,
      "Desc",
    );
    await goToProfiles(element);
    const states = queryAll(element, "starter-pack-profile-toggle").map(
      (toggle) => toggle.getAttribute("data-teststate"),
    );
    assert.deepEqual(states, ["opted-out", "included"]);
  });

  it("caps feeds at three and hides the Discover feed from suggestions", async () => {
    const feeds = [
      createFeed(DISCOVER_FEED_URI, "Discover"),
      createFeed("at://feed/1", "One"),
      createFeed("at://feed/2", "Two"),
      createFeed("at://feed/3", "Three"),
      createFeed("at://feed/4", "Four"),
    ];
    const element = createDialog(
      makeDataLayer({ follows: makeFollows(8), popularFeeds: feeds }),
    );
    element.open();
    await goToProfiles(element);
    await addProfiles(element, 7);
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    assert.equal(wizardState(element), "feeds");
    let toggles = queryAll(element, "starter-pack-feed-toggle");
    assert.equal(toggles.length, 4);
    assert.equal(
      toggles.every(
        (toggle) => toggle.getAttribute("data-teststate") === "not-included",
      ),
      true,
    );
    assert.equal(
      query(element, "starter-pack-wizard-next").textContent.trim(),
      "Skip",
    );

    for (const toggle of toggles.slice(0, 3)) toggle.click();
    await nextFrame();
    toggles = queryAll(element, "starter-pack-feed-toggle");
    assert.equal(toggles[3].getAttribute("data-teststate"), "capped");
    assert.equal(
      query(element, "starter-pack-wizard-count").textContent.trim(),
      "3/3",
    );
    assert.equal(
      query(element, "starter-pack-wizard-next").textContent.trim(),
      "Finish",
    );
  });

  it("shows the Discover feed locked in feed search results", async () => {
    const dataLayer = makeDataLayer({
      follows: makeFollows(8),
      popularFeeds: [createFeed("at://feed/1", "One")],
    });
    const element = createDialog(dataLayer);
    element.open();
    await goToProfiles(element);
    await addProfiles(element, 7);
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    assert.equal(wizardState(element), "feeds");

    typeInto(element, "starter-pack-feed-search", "disc");
    dataLayer.dataStore.$feedSearchResults.set({
      feeds: [createFeed(DISCOVER_FEED_URI, "Discover")],
      cursor: null,
    });
    await nextFrame();
    const toggles = queryAll(element, "starter-pack-feed-toggle");
    assert.equal(toggles.length, 1);
    assert.equal(toggles[0].getAttribute("data-teststate"), "locked");
  });

  it("dispatches starter-pack-create with the selection and closes on success", async () => {
    const feeds = [createFeed("at://feed/1", "One")];
    const element = createDialog(
      makeDataLayer({ follows: makeFollows(8), popularFeeds: feeds }),
    );
    element.open();
    const events = [];
    element.addEventListener("starter-pack-create", (event) => {
      events.push(event.detail);
    });
    let closed = false;
    element.addEventListener("dialog-closed", () => {
      closed = true;
    });
    typeInto(element, "starter-pack-name-input", "My pack");
    typeInto(element, "starter-pack-description-input", "About");
    await goToProfiles(element);
    await addProfiles(element, 7);
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    queryAll(element, "starter-pack-feed-toggle")[0].click();
    await nextFrame();
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();

    assert.equal(events.length, 1);
    const { data, successCallback } = events[0];
    assert.equal(data.name, "My pack");
    assert.equal(data.description, "About");
    assert.equal(data.profiles.length, 8);
    assert.equal(data.profiles[0].did, ME.did);
    assert.deepEqual(
      data.feeds.map((feed) => feed.uri),
      ["at://feed/1"],
    );
    assert.equal(query(element, "starter-pack-wizard-next").disabled, true);

    successCallback();
    await nextFrame();
    await nextFrame();
    assert.equal(closed, true);
  });

  it("dispatches starter-pack-update in edit mode", async () => {
    const follows = makeFollows(10);
    const members = follows.slice(0, 3);
    const element = createDialog(makeDataLayer({ follows }), {
      starterPack: {
        uri: "at://did:plc:me/app.bsky.graph.starterpack/p",
        record: { name: "Pack", description: "" },
        creator: ME,
        list: { uri: "at://did:plc:me/app.bsky.graph.list/p" },
        feeds: [createFeed("at://feed/x", "X")],
      },
      members,
      optedOutDids: [],
    });
    element.open();
    const events = [];
    element.addEventListener("starter-pack-update", (event) => {
      events.push(event.detail);
    });
    typeInto(element, "starter-pack-name-input", "Renamed");
    await goToProfiles(element);
    assert.equal(query(element, "starter-pack-wizard-count"), null);
    assert.equal(query(element, "starter-pack-wizard-next").disabled, true);
    await addProfiles(element, 4);
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    query(element, "starter-pack-wizard-next").click();
    await nextFrame();
    assert.equal(events.length, 1);
    assert.equal(events[0].data.name, "Renamed");
    assert.deepEqual(
      events[0].data.feeds.map((feed) => feed.uri),
      ["at://feed/x"],
    );
  });

  it("removes people from the selection review panel", async () => {
    const element = createDialog(makeDataLayer({ follows: makeFollows(3) }));
    element.open();
    await goToProfiles(element);
    assert.equal(query(element, "starter-pack-wizard-edit-selection"), null);
    await addProfiles(element, 2);
    query(element, "starter-pack-wizard-edit-selection").click();
    await nextFrame();
    assert.equal(wizardState(element), "review");
    const removeButtons = queryAll(element, "starter-pack-review-remove");
    assert.equal(removeButtons.length, 2);
    removeButtons[0].click();
    await nextFrame();
    assert.equal(queryAll(element, "starter-pack-review-remove").length, 1);
    query(element, "starter-pack-wizard-review-close").click();
    await nextFrame();
    assert.equal(wizardState(element), "profiles");
  });

  it("asks before discarding a dirty wizard and closes without prompting when clean", async () => {
    const element = createDialog(makeDataLayer());
    element.open();
    assert.equal(await element.confirmClose(), true);
    typeInto(element, "starter-pack-name-input", "Dirty");
    await nextFrame();
    const pending = element.confirmClose();
    await respondToConfirm(false);
    assert.equal(await pending, false);
    const pendingYes = element.confirmClose();
    await respondToConfirm(true);
    assert.equal(await pendingYes, true);
  });
});
