import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/pinned-feeds-pane.js";
import { makeTestDataLayer } from "../../testHelpers.js";
import { createFeedGenerator, createList } from "../../../shared/factories.js";

describe("pinned-feeds-pane", () => {
  const feedGenerator = createFeedGenerator({
    uri: "at://did:plc:creator1/app.bsky.feed.generator/trending",
    displayName: "Trending",
    creatorHandle: "creator1.bsky.social",
  });
  const list = createList({
    uri: "at://did:plc:creator1/app.bsky.graph.list/mylist",
    name: "My Curated List",
    creatorHandle: "creator1.bsky.social",
  });
  const pinnedItems = [
    {
      type: "timeline",
      data: { uri: "following", displayName: "Following" },
    },
    { type: "feed", data: feedGenerator },
    { type: "list", data: list },
  ];

  let dataLayer;
  let element;
  let routerGo;
  let previousRouter;

  function mount({ showSelected = true, moreFeedsActive = false } = {}) {
    element = document.createElement("pinned-feeds-pane");
    element.dataLayer = dataLayer;
    if (showSelected) {
      element.setAttribute("show-selected", "");
    }
    if (moreFeedsActive) {
      element.setAttribute("more-feeds-active", "");
    }
    document.body.appendChild(element);
    return element;
  }

  async function flushMicrotasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function itemLabels() {
    return [
      ...element.querySelectorAll("[data-testid='pinned-feeds-item']"),
    ].map((item) => item.querySelector(".pinned-feeds-item-label").textContent);
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    dataLayer = makeTestDataLayer();
    routerGo = mock.fn(async () => {});
    previousRouter = window.router;
    window.router = { go: routerGo };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.router = previousRouter;
    window.history.replaceState(null, "", "/");
  });

  it("renders skeleton rows while pinned items are loading", () => {
    mount();
    assert.deepEqual(
      element.querySelectorAll("[data-testid='pinned-feeds-skeleton']").length,
      5,
    );
  });

  it("renders a row per pinned item plus the More feeds link", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    mount();
    await flushMicrotasks();

    assert.deepEqual(itemLabels(), [
      "Following",
      "Trending",
      "My Curated List",
    ]);
    const moreLink = element.querySelector("[data-testid='pinned-feeds-more']");
    assert.deepEqual(moreLink.getAttribute("href"), "/feeds");
  });

  it("renders an icon for the timeline item and avatars for feeds and lists", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    mount();
    await flushMicrotasks();

    const items = element.querySelectorAll("[data-testid='pinned-feeds-item']");
    assert(items[0].querySelector(".pinned-feeds-timeline-icon") !== null);
    assert.deepEqual(
      items[1].querySelector(".pinned-feeds-item-avatar").getAttribute("src"),
      "/img/feed-avatar-fallback.svg",
    );
    assert.deepEqual(
      items[2].querySelector(".pinned-feeds-item-avatar").getAttribute("src"),
      "/img/list-avatar-fallback.svg",
    );
  });

  it("highlights the selected feed while on the home route", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    dataLayer.sessionState.$selectedFeedUri.set(feedGenerator.uri);
    mount();
    await flushMicrotasks();

    const active = element.querySelectorAll(".pinned-feeds-item.active");
    assert.deepEqual(active.length, 1);
    assert.deepEqual(
      active[0].querySelector(".pinned-feeds-item-label").textContent,
      "Trending",
    );
  });

  it("moves the highlight when the selected feed changes", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    dataLayer.sessionState.$selectedFeedUri.set(feedGenerator.uri);
    mount();
    await flushMicrotasks();

    dataLayer.sessionState.$selectedFeedUri.set(list.uri);
    await flushMicrotasks();

    const active = element.querySelectorAll(".pinned-feeds-item.active");
    assert.deepEqual(active.length, 1);
    assert.deepEqual(
      active[0].querySelector(".pinned-feeds-item-label").textContent,
      "My Curated List",
    );
  });

  it("does not highlight any feed when show-selected is absent", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    dataLayer.sessionState.$selectedFeedUri.set(feedGenerator.uri);
    mount({ showSelected: false });
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelectorAll(".pinned-feeds-item.active").length,
      0,
    );
  });

  it("re-renders the highlight when the show-selected attribute changes", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    dataLayer.sessionState.$selectedFeedUri.set(feedGenerator.uri);
    mount();
    await flushMicrotasks();
    assert.deepEqual(
      element.querySelectorAll(".pinned-feeds-item.active").length,
      1,
    );

    element.removeAttribute("show-selected");
    assert.deepEqual(
      element.querySelectorAll(".pinned-feeds-item.active").length,
      0,
    );

    element.setAttribute("show-selected", "");
    assert.deepEqual(
      element.querySelectorAll(".pinned-feeds-item.active").length,
      1,
    );
  });

  it("highlights the More feeds link when more-feeds-active is set", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    mount({ showSelected: false, moreFeedsActive: true });
    await flushMicrotasks();

    const moreLink = element.querySelector("[data-testid='pinned-feeds-more']");
    assert(moreLink.classList.contains("active"));
  });

  it("dispatches home-feed-select without navigating when already on home", async () => {
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    mount();
    await flushMicrotasks();
    const selected = [];
    const listener = (event) => selected.push(event.detail);
    window.addEventListener("home-feed-select", listener);

    element.querySelectorAll("[data-testid='pinned-feeds-item']")[1].click();
    await flushMicrotasks();
    window.removeEventListener("home-feed-select", listener);

    assert.deepEqual(routerGo.mock.callCount(), 0);
    assert.deepEqual(selected, [feedGenerator.uri]);
  });

  it("sets the selection before navigating home from another route", async () => {
    window.history.replaceState(null, "", "/notifications");
    dataLayer.dataStore.$pinnedItems.set(pinnedItems);
    mount({ showSelected: false });
    await flushMicrotasks();
    const selected = [];
    const listener = (event) => selected.push(event.detail);
    window.addEventListener("home-feed-select", listener);
    let selectedFeedUriAtNavigation = null;
    routerGo.mock.mockImplementation(async () => {
      selectedFeedUriAtNavigation =
        dataLayer.sessionState.$selectedFeedUri.get();
    });

    element.querySelectorAll("[data-testid='pinned-feeds-item']")[0].click();
    await flushMicrotasks();
    window.removeEventListener("home-feed-select", listener);

    assert.deepEqual(routerGo.mock.callCount(), 1);
    assert.deepEqual(routerGo.mock.calls[0].arguments, ["/"]);
    assert.deepEqual(selectedFeedUriAtNavigation, "following");
    // The home view applies the pre-set selection itself; no event is needed
    assert.deepEqual(selected, []);
  });

  it("renders nothing when loading pinned items fails", async () => {
    // makeTestDataLayer has no loaded preferences, so ensurePinnedItems rejects
    mount();
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='pinned-feeds-pane']"),
      null,
    );
  });
});
