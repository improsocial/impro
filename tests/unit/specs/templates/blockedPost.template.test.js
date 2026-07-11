import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { render } from "/js/lib/lit-html.js";

describe("blockedPostTemplate", () => {
  it("should display 'Blocked' text", () => {
    const result = blockedPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator !== null);
    assert(indicator.textContent.includes("Blocked"));
  });

  it("should render an info icon", () => {
    const result = blockedPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator.querySelector(".info-icon") !== null);
  });
});
