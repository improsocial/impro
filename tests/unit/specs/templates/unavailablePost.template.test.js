import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unavailablePostTemplate } from "/js/templates/unavailablePost.template.js";
import { render } from "/js/lib/lit-html.js";

describe("unavailablePostTemplate", () => {
  it("should render the unavailable tombstone", () => {
    const result = unavailablePostTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-tombstone-unavailable']") !==
        null,
    );
  });

  it("should render an info icon", () => {
    const result = unavailablePostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(
      indicator.querySelector("app-icon[icon='info-circle-line']") !== null,
    );
  });
});
