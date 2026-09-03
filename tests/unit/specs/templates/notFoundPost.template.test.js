import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { render } from "/js/lib/lit-html.js";

describe("notFoundPostTemplate", () => {
  it("should display 'Post not found' text", () => {
    const result = notFoundPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator !== null);
    assert(indicator.textContent.includes("Post not found"));
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
