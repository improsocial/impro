import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/sidebar-search.js";
import { makeTestDataLayer } from "../../testHelpers.js";
import { createProfile } from "../../../shared/factories.js";

describe("sidebar-search", () => {
  const alice = createProfile({
    did: "did:plc:alice",
    handle: "alice.test",
    displayName: "Alice",
  });

  let originalRouter;
  let navigations;

  async function flush() {
    // Two ticks: effect re-renders are scheduled, and the typeahead load
    // resolves a microtask before the render it triggers.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function mount({ actors = [alice], isAuthenticated = false } = {}) {
    const searchProfilesTypeahead = mock.fn(async () => ({ actors }));
    const dataLayer = makeTestDataLayer({ api: { searchProfilesTypeahead } });
    await dataLayer.preferencesProvider.fetchPreferences();
    const element = document.createElement("sidebar-search");
    element.dataLayer = dataLayer;
    element.isAuthenticated = isAuthenticated;
    document.body.appendChild(element);
    return { element, dataLayer, searchProfilesTypeahead };
  }

  function input(element) {
    return element.querySelector("[data-testid='sidebar-search-input']");
  }

  async function type(element, value) {
    const field = input(element);
    field.value = value;
    field.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    await flush();
  }

  function pressKey(element, key) {
    input(element).dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    navigations = [];
    originalRouter = window.router;
    window.router = { go: (href) => navigations.push(href) };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.router = originalRouter;
  });

  it("renders a search input with no typeahead until the user types", async () => {
    const { element } = await mount();

    assert(input(element) !== null);
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
  });

  it("shows typeahead profile results while typing", async () => {
    const { element, searchProfilesTypeahead } = await mount();

    await type(element, "ali");

    assert.deepEqual(searchProfilesTypeahead.mock.calls[0].arguments[0], "ali");
    const typeahead = element.querySelector(
      "[data-testid='sidebar-search-typeahead']",
    );
    assert(typeahead !== null);
    assert.deepEqual(
      typeahead
        .querySelector("[data-testid='sidebar-search-typeahead-search-row']")
        .textContent.trim(),
      "ali",
    );
    const results = typeahead.querySelectorAll(
      "[data-testid='sidebar-search-typeahead-result']",
    );
    assert.deepEqual(results.length, 1);
    assert.deepEqual(results[0].getAttribute("href"), "/profile/alice.test");
  });

  it("keeps its results out of the search view's typeahead store", async () => {
    const { element, dataLayer } = await mount();
    dataLayer.dataStore.$searchTypeaheadResults.set({
      actors: [{ did: "did:plc:searchview" }],
    });

    await type(element, "ali");

    assert.deepEqual(
      dataLayer.dataStore.$sidebarSearchTypeaheadResults.get().actors[0].did,
      "did:plc:alice",
    );
    assert.deepEqual(
      dataLayer.dataStore.$searchTypeaheadResults.get().actors[0].did,
      "did:plc:searchview",
    );
  });

  it("navigates to the search page on Enter", async () => {
    const { element } = await mount();

    await type(element, "  cats and dogs  ");
    pressKey(element, "Enter");

    assert.deepEqual(navigations, ["/search?q=cats+and+dogs"]);
  });

  it("navigates to the search page when the search row is clicked", async () => {
    const { element } = await mount();

    await type(element, "cats");
    element
      .querySelector("[data-testid='sidebar-search-typeahead-search-row']")
      .click();
    await flush();

    assert.deepEqual(navigations, ["/search?q=cats"]);
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
  });

  it("clears and unfocuses the input after committing a search", async () => {
    const { element, dataLayer } = await mount();

    input(element).focus();
    await type(element, "cats");
    pressKey(element, "Enter");
    await flush();

    assert.deepEqual(input(element).value, "");
    assert(document.activeElement !== input(element));
    assert.deepEqual(
      dataLayer.dataStore.$sidebarSearchTypeaheadResults.get(),
      null,
    );
  });

  it("clears and unfocuses the input after selecting a profile", async () => {
    const { element, dataLayer } = await mount();

    input(element).focus();
    await type(element, "ali");
    element
      .querySelector("[data-testid='sidebar-search-typeahead-result']")
      .click();
    await flush();

    assert.deepEqual(input(element).value, "");
    assert(document.activeElement !== input(element));
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
    assert.deepEqual(
      dataLayer.dataStore.$sidebarSearchTypeaheadResults.get(),
      null,
    );
  });

  it("does not navigate when the query is blank", async () => {
    const { element } = await mount();

    await type(element, "   ");
    pressKey(element, "Enter");

    assert.deepEqual(navigations, []);
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
  });

  it("clears the input and typeahead with the clear button", async () => {
    const { element, dataLayer } = await mount();

    await type(element, "cats");
    element
      .querySelector("[data-testid='sidebar-search-clear-button']")
      .click();
    await flush();

    assert.deepEqual(input(element).value, "");
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
    assert.deepEqual(
      dataLayer.dataStore.$sidebarSearchTypeaheadResults.get(),
      null,
    );
  });

  it("clears the input on Escape", async () => {
    const { element } = await mount();

    await type(element, "cats");
    pressKey(element, "Escape");
    await flush();

    assert.deepEqual(input(element).value, "");
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );
  });

  it("hides the typeahead on blur and restores it on focus", async () => {
    const { element } = await mount();

    await type(element, "cats");
    input(element).dispatchEvent(new window.FocusEvent("blur"));
    await flush();
    assert.deepEqual(
      element.querySelector("[data-testid='sidebar-search-typeahead']"),
      null,
    );

    input(element).dispatchEvent(new window.FocusEvent("focus"));
    await flush();
    assert(
      element.querySelector("[data-testid='sidebar-search-typeahead']") !==
        null,
    );
  });

  it("records a recent search when authenticated", async () => {
    const { element, dataLayer } = await mount({ isAuthenticated: true });
    const addRecentSearch = mock.method(
      dataLayer.mutations,
      "addRecentSearch",
      async () => {},
    );

    await type(element, "cats");
    pressKey(element, "Enter");

    assert.deepEqual(addRecentSearch.mock.calls[0].arguments[0], "cats");
  });

  it("does not record a recent search when logged out", async () => {
    const { element, dataLayer } = await mount({ isAuthenticated: false });
    const addRecentSearch = mock.method(
      dataLayer.mutations,
      "addRecentSearch",
      async () => {},
    );

    await type(element, "cats");
    pressKey(element, "Enter");

    assert.deepEqual(addRecentSearch.mock.calls.length, 0);
    assert.deepEqual(navigations, ["/search?q=cats"]);
  });
});
