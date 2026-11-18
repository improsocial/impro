import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/suggested-feeds-pane.js";
import { ApiError } from "/js/api.js";
import {
  installFakeIntersectionObserver,
  makeTestDataLayer,
  respondToConfirm,
} from "../../testHelpers.js";
import { createFeedGenerator } from "../../../shared/factories.js";

describe("suggested-feeds-pane", () => {
  function createFeed(name, options = {}) {
    return createFeedGenerator({
      uri: `at://did:plc:creator/app.bsky.feed.generator/${name}`,
      displayName: name,
      creatorHandle: "creator.test",
      ...options,
    });
  }

  // Appview requests wait on preferences, so they're always loaded by the
  // time suggested feeds arrive
  async function makeDataLayer(getSuggestedFeeds, { savedFeedUris = [] } = {}) {
    const dataLayer = makeTestDataLayer({
      api: {
        isAuthenticated: true,
        session: { did: "did:plc:viewer" },
        getSuggestedFeeds,
        getPreferences: async () => [
          {
            $type: "app.bsky.actor.defs#savedFeedsPrefV2",
            items: savedFeedUris.map((uri, index) => ({
              id: `saved-${index}`,
              type: "feed",
              value: uri,
              pinned: false,
            })),
          },
        ],
      },
    });
    await dataLayer.preferencesProvider.requirePreferences();
    return dataLayer;
  }

  function mount(dataLayer, { feedInteractionHandler = null } = {}) {
    const element = document.createElement("suggested-feeds-pane");
    element.dataLayer = dataLayer;
    element.feedInteractionHandler = feedInteractionHandler;
    document.body.appendChild(element);
    return element;
  }

  async function flushMicrotasks() {
    // Two ticks: the first flushes the load promise, the second lets the
    // rAF-scheduled effect render run before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function rowTitles(element) {
    return [
      ...element.querySelectorAll("[data-testid='suggested-feed-title']"),
    ].map((title) => title.textContent.trim());
  }

  let fakeIntersectionObserver;

  beforeEach(() => {
    document.body.innerHTML = "";
    fakeIntersectionObserver = installFakeIntersectionObserver({
      isIntersecting: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    fakeIntersectionObserver.restore();
  });

  it("renders three skeleton rows before feeds resolve", async () => {
    const element = mount(await makeDataLayer(() => new Promise(() => {})));
    assert.deepEqual(
      element.querySelectorAll("[data-testid='suggested-feed-skeleton']")
        .length,
      3,
    );
  });

  it("renders at most three rows linking to each feed", async () => {
    const dataLayer = await makeDataLayer(async () => ({
      feeds: ["one", "two", "three", "four", "five"].map((name) =>
        createFeed(name),
      ),
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(rowTitles(element), ["one", "two", "three"]);
    assert.deepEqual(
      [...element.querySelectorAll("[data-testid='suggested-feed-row']")].map(
        (row) => row.getAttribute("href"),
      ),
      [
        "/profile/creator.test/feed/one",
        "/profile/creator.test/feed/two",
        "/profile/creator.test/feed/three",
      ],
    );
  });

  it("shows the creator handle and like count", async () => {
    const feed = createFeed("cats");
    feed.likeCount = 1234;
    const dataLayer = await makeDataLayer(async () => ({ feeds: [feed] }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element
        .querySelector("[data-testid='suggested-feed-creator']")
        .textContent.trim(),
      "@creator.test",
    );
    assert.deepEqual(
      element
        .querySelector("[data-testid='feed-like-count']")
        .textContent.trim(),
      "1.2K",
    );
  });

  it("pins the feed from the pin button without navigating", async () => {
    const feed = createFeed("cats");
    const dataLayer = await makeDataLayer(async () => ({ feeds: [feed] }));
    const feedInteractionHandler = { handlePinFeed: mock.fn() };
    const element = mount(dataLayer, { feedInteractionHandler });
    await flushMicrotasks();

    const click = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    element
      .querySelector("[data-testid='suggested-feed-pin-button']")
      .dispatchEvent(click);

    assert(click.defaultPrevented);
    assert.deepEqual(
      feedInteractionHandler.handlePinFeed.mock.calls.map(
        (call) => call.arguments,
      ),
      [[feed.uri, true]],
    );
  });

  it("keeps a feed pinned from the pane listed, with a filled pin that unpins it", async () => {
    const feed = createFeed("cats");
    const dataLayer = await makeDataLayer(async () => ({ feeds: [feed] }));
    const feedInteractionHandler = {
      handlePinFeed: mock.fn((uri, doPin) =>
        doPin
          ? dataLayer.mutations.pinFeed(uri)
          : dataLayer.mutations.unpinFeed(uri),
      ),
    };
    const element = mount(dataLayer, { feedInteractionHandler });
    await flushMicrotasks();

    const pinButton = () =>
      element.querySelector("[data-testid='suggested-feed-pin-button']");
    assert.deepEqual(pinButton().dataset.teststate, "not-pinned");

    pinButton().click();
    await flushMicrotasks();

    assert.deepEqual(rowTitles(element), ["cats"]);
    assert.deepEqual(pinButton().dataset.teststate, "pinned");

    pinButton().click();
    await flushMicrotasks();

    assert.deepEqual(rowTitles(element), ["cats"]);
    assert.deepEqual(pinButton().dataset.teststate, "not-pinned");
    assert.deepEqual(
      feedInteractionHandler.handlePinFeed.mock.calls.map(
        (call) => call.arguments,
      ),
      [
        [feed.uri, true],
        [feed.uri, false],
      ],
    );
  });

  it("skips feeds the user has already saved", async () => {
    const savedFeed = createFeed("saved");
    const dataLayer = await makeDataLayer(
      async () => ({
        feeds: [savedFeed, createFeed("new")],
      }),
      { savedFeedUris: [savedFeed.uri] },
    );
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(rowTitles(element), ["new"]);
  });

  it("renders nothing when there are no suggestions", async () => {
    const element = mount(await makeDataLayer(async () => ({ feeds: [] })));
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='suggested-feeds-pane']"),
      null,
    );
  });

  it("renders nothing when the request fails", async () => {
    const dataLayer = await makeDataLayer(async () => {
      throw new ApiError({ status: 500, statusText: "Server Error", data: {} });
    });
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='suggested-feeds-pane']"),
      null,
    );
  });

  it("hides the pane after confirming the hide prompt", async () => {
    const dataLayer = await makeDataLayer(async () => ({
      feeds: [createFeed("cats")],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    element
      .querySelector("[data-testid='suggested-feeds-dismiss-button']")
      .click();
    await respondToConfirm(true);
    await flushMicrotasks();

    assert(dataLayer.derived.$suggestedFeedsHidden.get());
    assert.deepEqual(
      element.querySelector("[data-testid='suggested-feeds-pane']"),
      null,
    );
  });
});
