import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { render } from "/js/lib/lit-html.js";

describe("notFoundPostTemplate", () => {
  it("should render the not-found tombstone", () => {
    const result = notFoundPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-tombstone-not-found']") !==
        null,
    );
  });

  it("should render a trash can icon", () => {
    const result = notFoundPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(
      indicator.querySelector("app-icon[icon='delete-bin-line']") !== null,
    );
  });
});
