import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { feedsFeedTemplate } from "/js/templates/feedsFeed.template.js";
import { render } from "/js/lib/lit-html.js";

function renderLoading() {
  const container = document.createElement("div");
  render(feedsFeedTemplate({ items: null, renderItem: () => "" }), container);
  return container;
}

describe("feedsFeedTemplate loading skeleton", () => {
  it("renders skeleton items", () => {
    const container = renderLoading();
    assert(
      container.querySelectorAll("[data-testid='feeds-list-item-skeleton']")
        .length > 0,
    );
  });

  it("renders the avatar placeholder", () => {
    const container = renderLoading();
    assert(
      container.querySelector(".feeds-list-item-skeleton-avatar") !== null,
    );
  });

  it("renders the title placeholder", () => {
    const container = renderLoading();
    assert(container.querySelector(".feeds-list-item-skeleton-title") !== null);
  });

  it("renders the creator placeholder", () => {
    const container = renderLoading();
    assert(
      container.querySelector(".feeds-list-item-skeleton-creator") !== null,
    );
  });
});
