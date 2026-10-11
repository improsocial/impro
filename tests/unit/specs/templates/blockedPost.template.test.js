import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { render } from "/js/lib/lit-html.js";

describe("blockedPostTemplate", () => {
  it("should render the blocked tombstone", () => {
    const result = blockedPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-tombstone-blocked']") !==
        null,
    );
  });

  it("should render an info icon", () => {
    const result = blockedPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(
      indicator.querySelector("app-icon[icon='info-circle-line']") !== null,
    );
  });
});
