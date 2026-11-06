import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { render } from "/js/lib/lit-html.js";

function renderSkeleton(index) {
  const container = document.createElement("div");
  render(postSkeletonTemplate({ index }), container);
  return container;
}

function bodyLineCount(container) {
  return container.querySelectorAll(".skeleton-body .skeleton-text").length;
}

describe("postSkeletonTemplate", () => {
  it("should render skeleton", () => {
    const container = renderSkeleton(0);
    assert(container.querySelector("[data-testid='post-skeleton']") !== null);
  });

  it("should render skeleton avatar", () => {
    const container = renderSkeleton(0);
    assert(container.querySelector(".skeleton-avatar") !== null);
  });

  it("should render name and handle placeholders in the header", () => {
    const container = renderSkeleton(0);
    assert.equal(
      container.querySelectorAll(".skeleton-header .skeleton-text").length,
      2,
    );
  });

  it("should vary the number of body lines between rows", () => {
    const counts = [0, 1, 2, 3, 4].map((index) =>
      bodyLineCount(renderSkeleton(index)),
    );
    assert.deepEqual(counts, [3, 1, 2, 4, 2]);
  });

  it("should render an image placeholder only for the image variant", () => {
    const withImage = [0, 1, 2, 3, 4].map(
      (index) =>
        renderSkeleton(index).querySelector(
          "[data-testid='post-skeleton-image']",
        ) !== null,
    );
    assert.deepEqual(withImage, [false, false, true, false, false]);
  });

  it("should cycle variants past the variant count", () => {
    assert.equal(bodyLineCount(renderSkeleton(5)), 3);
    assert(
      renderSkeleton(7).querySelector("[data-testid='post-skeleton-image']") !==
        null,
    );
  });

  it("should render primary and secondary control placeholders", () => {
    const container = renderSkeleton(0);
    assert.equal(
      container.querySelectorAll(".post-actions-primary .post-action").length,
      3,
    );
    assert.equal(
      container.querySelectorAll(".post-actions-secondary .post-action").length,
      3,
    );
  });
});
