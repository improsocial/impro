import { describe, it, beforeEach, afterEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer } from "../../testHelpers.js";
import { Preferences } from "/js/preferences.js";
import { createGif } from "../../../shared/factories.js";
import "/js/components/gif-picker-dialog.js";

describe("gif-picker-dialog", () => {
  const originalSetTimeout = globalThis.setTimeout;

  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  after(() => {
    document.body.innerHTML = "";
  });

  async function nextFrame() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  function makeDialog({
    featured = [createGif({ id: "featured-1" })],
    searchResults = {},
    featuredFailure = null,
    searchFailure = null,
  } = {}) {
    const getFeaturedGifs = mock.fn(async () => {
      if (featuredFailure) throw featuredFailure;
      return { next: "", results: featured };
    });
    const searchGifs = mock.fn(async (query) => {
      if (searchFailure) throw searchFailure;
      return { next: "", results: searchResults[query] ?? [] };
    });
    const dataLayer = makeTestDataLayer({
      api: { getFeaturedGifs, searchGifs },
    });
    const dialog = document.createElement("gif-picker-dialog");
    dialog.dataLayer = dataLayer;
    document.body.appendChild(dialog);
    return { dialog, dataLayer, getFeaturedGifs, searchGifs };
  }

  async function openDialog(dialog) {
    dialog.open();
    await flushMicrotasks();
    await nextFrame();
  }

  function seedRecents(dataLayer, gifs) {
    let preferences = new Preferences([], []);
    for (const gif of gifs) {
      preferences = preferences.addRecentGif(gif);
    }
    dataLayer.preferencesProvider._setPreferences(preferences);
  }

  it("loads the featured feed on open and renders tiles", async () => {
    const { dialog, getFeaturedGifs } = makeDialog({
      featured: [createGif({ id: "g1" }), createGif({ id: "g2" })],
    });
    await openDialog(dialog);
    assert.deepEqual(getFeaturedGifs.mock.callCount(), 1);
    const tiles = dialog.querySelectorAll('[data-testid="gif-picker-tile"]');
    assert.deepEqual(tiles.length, 2);
    // Tiles render through the bsky proxy, never the provider CDN
    assert(tiles[0].querySelector("img").src.includes("k.gifs.bsky.app"));
  });

  it("sends the documented search term for a category pill", async () => {
    const { dialog, searchGifs } = makeDialog({
      searchResults: { cry: [createGif({ id: "sad-1" })] },
    });
    await openDialog(dialog);
    const sadPill = dialog.querySelector('[data-testcategory="sad"]');
    sadPill.click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(searchGifs.mock.callCount(), 1);
    assert.deepEqual(searchGifs.mock.calls[0].arguments[0], "cry");
    assert.deepEqual(
      dialog.querySelectorAll('[data-testid="gif-picker-tile"]').length,
      1,
    );
    assert.deepEqual(
      dialog
        .querySelector('[data-testcategory="sad"]')
        .getAttribute("data-teststate"),
      "selected",
    );
  });

  it("debounces typing to a single request for the final query", async () => {
    const { dialog, searchGifs } = makeDialog({
      searchResults: { cats: [createGif({ id: "cat-1" })] },
    });
    await openDialog(dialog);
    const input = dialog.querySelector('[data-testid="gif-picker-search"]');
    for (const value of ["c", "ca", "cats"]) {
      input.value = value;
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    }
    await nextFrame();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(searchGifs.mock.callCount(), 1);
    assert.deepEqual(searchGifs.mock.calls[0].arguments[0], "cats");
  });

  it("clearing the search restores the active category without a stale query", async () => {
    const { dialog, searchGifs, getFeaturedGifs } = makeDialog({
      searchResults: { cats: [createGif({ id: "cat-1" })] },
    });
    await openDialog(dialog);
    const input = dialog.querySelector('[data-testid="gif-picker-search"]');
    input.value = "cats";
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await nextFrame();
    await flushMicrotasks();
    await nextFrame();
    dialog.querySelector('[data-testid="gif-picker-clear"]').click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(searchGifs.mock.callCount(), 1);
    assert.deepEqual(getFeaturedGifs.mock.callCount(), 2);
    // Pills are visible again once the query is empty
    assert(dialog.querySelector('[data-testid="gif-picker-pills"]'));
  });

  it("hides the pills while a query is typed", async () => {
    const { dialog } = makeDialog();
    await openDialog(dialog);
    const input = dialog.querySelector('[data-testid="gif-picker-search"]');
    input.value = "c";
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await nextFrame();
    assert.deepEqual(
      dialog.querySelector('[data-testid="gif-picker-pills"]'),
      null,
    );
  });

  it("omits the recents pill when there are no recents", async () => {
    const { dialog } = makeDialog();
    await openDialog(dialog);
    assert.deepEqual(
      dialog.querySelector('[data-testcategory="recents"]'),
      null,
    );
  });

  it("recents mode renders stored gifs with no network request", async () => {
    const { dialog, dataLayer, getFeaturedGifs, searchGifs } = makeDialog();
    seedRecents(dataLayer, [createGif({ id: "r1" }), createGif({ id: "r2" })]);
    await openDialog(dialog);
    const recentsPill = dialog.querySelector('[data-testcategory="recents"]');
    assert(recentsPill);
    recentsPill.click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(getFeaturedGifs.mock.callCount(), 1);
    assert.deepEqual(searchGifs.mock.callCount(), 0);
    assert.deepEqual(
      dialog.querySelectorAll('[data-testid="gif-picker-tile"]').length,
      2,
    );
  });

  it("renders the search empty state with the typed query, never a pill term", async () => {
    const { dialog } = makeDialog({ searchResults: {} });
    await openDialog(dialog);
    const input = dialog.querySelector('[data-testid="gif-picker-search"]');
    input.value = "zzz";
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await nextFrame();
    await flushMicrotasks();
    await nextFrame();
    const emptyState = dialog.querySelector('[data-testid="empty-state"]');
    assert(emptyState.textContent.includes('"zzz"'));
  });

  it("renders the category empty state without leaking the search term", async () => {
    const { dialog } = makeDialog({ searchResults: {} });
    await openDialog(dialog);
    dialog.querySelector('[data-testcategory="sad"]').click();
    await flushMicrotasks();
    await nextFrame();
    const emptyState = dialog.querySelector('[data-testid="empty-state"]');
    assert(emptyState);
    assert(!emptyState.textContent.includes("cry"));
  });

  it("renders the first-page error state with a retry that reloads", async () => {
    const failure = new TypeError("network down");
    const options = { featuredFailure: failure };
    const { dialog, getFeaturedGifs } = makeDialog(options);
    await openDialog(dialog);
    assert(dialog.querySelector('[data-testid="gif-picker-error"]'));
    options.featuredFailure = null;
    getFeaturedGifs.mock.mockImplementation(async () => ({
      next: "",
      results: [createGif({ id: "back" })],
    }));
    dialog.querySelector('[data-testid="gif-picker-retry"]').click();
    await flushMicrotasks();
    await nextFrame();
    assert.deepEqual(
      dialog.querySelectorAll('[data-testid="gif-picker-tile"]').length,
      1,
    );
  });

  it("selecting a tile writes recents, closes, and dispatches gif-selected", async () => {
    const gif = createGif({ id: "picked" });
    const { dialog, dataLayer } = makeDialog({ featured: [gif] });
    seedRecents(dataLayer, []);
    const selected = [];
    dialog.addEventListener("gif-selected", (event) => {
      selected.push(event.detail.gif);
    });
    await openDialog(dialog);
    dialog.querySelector('[data-testid="gif-picker-tile"]').click();
    await flushMicrotasks();
    await nextFrame();
    await flushMicrotasks();
    assert.deepEqual(selected, [gif]);
    assert.deepEqual(dialog.querySelector("dialog").open, false);
    assert.deepEqual(
      dataLayer.preferencesProvider
        .requirePreferences()
        .getRecentGifs()
        .map((entry) => entry.id),
      ["picked"],
    );
  });

  it("dedupes repeated ids across pages and ends pagination on an all-duplicate page", async () => {
    const gif = createGif({ id: "dup" });
    const { dataLayer } = makeDialog();
    dataLayer.api.getFeaturedGifs = async ({ cursor }) => ({
      next: cursor ? "60" : "30",
      results: [gif],
    });
    await dataLayer.requests.loadGifs("");
    await dataLayer.requests.loadGifs("", { cursor: "30" });
    assert.deepEqual(
      dataLayer.derived.$gifResults.get().map((entry) => entry.id),
      ["dup"],
    );
    assert.deepEqual(dataLayer.derived.$gifCursor.get(), null);
  });

  it("clears the debounce timer on disconnect", async () => {
    const { dialog, searchGifs } = makeDialog();
    await openDialog(dialog);
    const realSetTimeout = globalThis.setTimeout;
    let scheduled = null;
    globalThis.setTimeout = (fn, delay) => {
      scheduled = fn;
      return realSetTimeout(() => {}, delay);
    };
    const clearSpy = mock.method(globalThis, "clearTimeout");
    try {
      const input = dialog.querySelector('[data-testid="gif-picker-search"]');
      input.value = "cats";
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
      assert(scheduled !== null);
      dialog.remove();
      assert(
        clearSpy.mock.calls.length > 0,
        "disconnect should clear the pending debounce",
      );
    } finally {
      clearSpy.mock.restore();
      globalThis.setTimeout = realSetTimeout;
    }
    assert.deepEqual(searchGifs.mock.callCount(), 0);
  });
});
