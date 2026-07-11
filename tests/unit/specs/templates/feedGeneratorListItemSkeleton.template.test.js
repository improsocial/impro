import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { feedGeneratorListItemSkeletonTemplate } from "/js/templates/feedGeneratorListItemSkeleton.template.js";
import { render } from "/js/lib/lit-html.js";

describe("feedGeneratorListItemSkeletonTemplate", () => {
  it("should render the skeleton element", () => {
    const container = document.createElement("div");
    render(feedGeneratorListItemSkeletonTemplate(), container);
    assert(
      container.querySelector(
        "[data-testid='feed-generator-list-item-skeleton']",
      ) !== null,
    );
  });

  it("should render the avatar placeholder", () => {
    const container = document.createElement("div");
    render(feedGeneratorListItemSkeletonTemplate(), container);
    assert(
      container.querySelector(".feeds-list-item-skeleton-avatar") !== null,
    );
  });

  it("should render the title placeholder", () => {
    const container = document.createElement("div");
    render(feedGeneratorListItemSkeletonTemplate(), container);
    assert(container.querySelector(".feeds-list-item-skeleton-title") !== null);
  });

  it("should render the creator placeholder", () => {
    const container = document.createElement("div");
    render(feedGeneratorListItemSkeletonTemplate(), container);
    assert(
      container.querySelector(".feeds-list-item-skeleton-creator") !== null,
    );
  });
});
