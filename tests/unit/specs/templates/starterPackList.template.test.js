import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "/js/lib/lit-html.js";
import { starterPackListTemplate } from "/js/templates/starterPackList.template.js";

function renderList(props) {
  const container = document.createElement("div");
  render(
    starterPackListTemplate({
      cursor: null,
      currentUser: { did: "did:plc:me" },
      onLoadMore: null,
      ...props,
    }),
    container,
  );
  return container;
}

function makeStarterPack(rkey) {
  return {
    uri: `at://did:plc:me/app.bsky.graph.starterpack/${rkey}`,
    record: { name: `Pack ${rkey}`, description: "" },
    creator: { did: "did:plc:me", handle: "me.test" },
    listItemsSample: [{ subject: { did: "did:plc:a", handle: "a.test" } }],
    listItemCount: 1,
  };
}

describe("starterPackListTemplate", () => {
  it("renders skeleton rows that mirror the member avatar strip", () => {
    const container = renderList({ starterPacks: null });
    const skeletons = container.querySelectorAll(
      "[data-testid='feeds-list-item-skeleton']",
    );
    assert.equal(skeletons.length, 10);
    assert(skeletons[0].classList.contains("starter-pack-list-item"));
    assert(skeletons[0].querySelector(".starter-pack-list-item-members"));
  });

  it("renders rows with the member strip and no create affordances by default", () => {
    const container = renderList({
      starterPacks: [makeStarterPack("a"), makeStarterPack("b")],
    });
    assert.equal(
      container.querySelectorAll("[data-testid='starter-pack-list-item']")
        .length,
      2,
    );
    assert(container.querySelector("[data-testid='starter-pack-members']"));
    assert.equal(
      container.querySelector("[data-testid='starter-pack-create-another']"),
      null,
    );
  });

  it("renders the caller's empty state and footer templates", () => {
    const emptyTemplate = html`<button data-testid="starter-pack-create-button">
      Create
    </button>`;
    const footerTemplate = html`<button
      data-testid="starter-pack-create-another"
    >
      Create another
    </button>`;
    const empty = renderList({
      starterPacks: [],
      emptyTemplate,
      footerTemplate,
    });
    assert(empty.querySelector("[data-testid='starter-pack-create-button']"));
    assert.equal(
      empty.querySelector("[data-testid='starter-pack-create-another']"),
      null,
    );
    const filled = renderList({
      starterPacks: [makeStarterPack("a")],
      emptyTemplate,
      footerTemplate,
    });
    assert(filled.querySelector("[data-testid='starter-pack-create-another']"));
    assert.equal(
      filled.querySelector("[data-testid='starter-pack-create-button']"),
      null,
    );
  });

  it("shows the plain empty message without an empty template", () => {
    const container = renderList({ starterPacks: [] });
    const empty = container.querySelector("[data-testid='empty-state']");
    assert(empty.textContent.includes("No starter packs yet."));
    assert.equal(empty.querySelector("button"), null);
  });
});
