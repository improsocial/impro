import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "/js/lib/lit-html.js";
import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";

function renderList(props) {
  const container = document.createElement("div");
  render(
    paginatedListTemplate({
      renderItem: (item) => html`<div class="row">${item}</div>`,
      ...props,
    }),
    container,
  );
  return container;
}

describe("paginatedListTemplate", () => {
  it("renders skeleton rows while items are null", () => {
    const container = renderList({ items: null });
    assert(
      container.querySelectorAll("[data-testid='feeds-list-item-skeleton']")
        .length > 0,
    );
    assert.equal(container.querySelector(".row"), null);
  });

  it("uses a caller-supplied skeleton row when given", () => {
    const container = renderList({
      items: null,
      renderSkeletonItem: () => html`<div class="custom-skeleton"></div>`,
    });
    assert.equal(container.querySelectorAll(".custom-skeleton").length, 10);
    assert.equal(
      container.querySelector("[data-testid='feeds-list-item-skeleton']"),
      null,
    );
  });

  it("renders the empty template only when there are no items", () => {
    const emptyTemplate = html`<div class="empty">Nothing</div>`;
    const empty = renderList({ items: [], emptyTemplate });
    assert(empty.querySelector(".empty"));
    const filled = renderList({ items: ["a", "b"], emptyTemplate });
    assert.equal(filled.querySelector(".empty"), null);
    assert.equal(filled.querySelectorAll(".row").length, 2);
  });

  it("renders a plain empty message inside the standard wrapper", () => {
    const container = renderList({ items: [], emptyMessage: "Nothing" });
    const empty = container.querySelector("[data-testid='empty-state']");
    assert(empty.textContent.includes("Nothing"));
    const overridden = renderList({
      items: [],
      emptyMessage: "Nothing",
      emptyTemplate: html`<div class="empty">Custom</div>`,
    });
    assert(overridden.querySelector(".empty"));
    assert.equal(overridden.querySelector("[data-testid='empty-state']"), null);
  });

  it("renders nothing for an empty list without an empty template", () => {
    const container = renderList({ items: [] });
    assert.equal(container.querySelector(".feeds-list").children.length, 0);
  });

  it("shows a spinner instead of the footer while more pages remain", () => {
    const footerTemplate = html`<div class="footer">More</div>`;
    const more = renderList({ items: ["a"], hasMore: true, footerTemplate });
    assert(more.querySelector(".loading-spinner"));
    assert.equal(more.querySelector(".footer"), null);
    const done = renderList({ items: ["a"], hasMore: false, footerTemplate });
    assert.equal(done.querySelector(".loading-spinner"), null);
    assert(done.querySelector(".footer"));
  });

  it("wraps the list in an infinite-scroll container only when onLoadMore is given", () => {
    const plain = renderList({ items: ["a"] });
    assert.equal(plain.querySelector("infinite-scroll-container"), null);
    const scrolling = renderList({ items: ["a"], onLoadMore: async () => {} });
    assert(scrolling.querySelector("infinite-scroll-container .feeds-list"));
  });
});
