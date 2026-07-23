import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listFeedTemplate } from "/js/templates/listFeed.template.js";
import { render } from "/js/lib/lit-html.js";

function renderList(props) {
  const container = document.createElement("div");
  render(listFeedTemplate(props), container);
  return container;
}

function makeList(overrides = {}) {
  return {
    uri: "at://did:plc:alice/app.bsky.graph.list/abc",
    cid: "cid1",
    name: "Cool people",
    purpose: "app.bsky.graph.defs#curatelist",
    creator: { did: "did:plc:alice", handle: "alice.test" },
    ...overrides,
  };
}

describe("listFeedTemplate", () => {
  it("renders skeletons while loading", () => {
    const container = renderList({ lists: null });
    assert(
      container.querySelectorAll("[data-testid='feeds-list-item-skeleton']")
        .length > 0,
    );
  });

  it("renders the empty message when there are no lists", () => {
    const container = renderList({ lists: [] });
    assert.equal(
      container.querySelector(".feed-end-message").textContent.trim(),
      "No lists.",
    );
  });

  it("renders a list item per list", () => {
    const container = renderList({
      lists: [makeList({ name: "First" }), makeList({ name: "Second" })],
    });
    const items = container.querySelectorAll(
      "[data-testid='feeds-list-item-list']",
    );
    assert.equal(items.length, 2);
    assert.equal(
      items[0].querySelector(".feeds-list-item-title").textContent,
      "First",
    );
  });

  it("labels moderation lists differently from curate lists", () => {
    const container = renderList({
      lists: [
        makeList({ name: "Curate", purpose: "app.bsky.graph.defs#curatelist" }),
        makeList({ name: "Mod", purpose: "app.bsky.graph.defs#modlist" }),
      ],
    });
    const creators = container.querySelectorAll(".feeds-list-item-creator");
    assert.match(creators[0].textContent, /^\s*List by/);
    assert.match(creators[1].textContent, /^\s*Moderation list by/);
  });

  it("shows the load-more spinner when there is a cursor", () => {
    const container = renderList({
      lists: [makeList()],
      cursor: "next",
    });
    assert(container.querySelector(".loading-spinner") !== null);
  });

  it("omits the spinner when there is no cursor", () => {
    const container = renderList({ lists: [makeList()] });
    assert.equal(container.querySelector(".loading-spinner"), null);
  });
});
