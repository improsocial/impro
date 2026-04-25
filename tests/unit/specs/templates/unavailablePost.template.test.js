import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { unavailablePostTemplate } from "/js/templates/unavailablePost.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("unavailablePostTemplate");

t.describe("unavailablePostTemplate", (it) => {
  it("should display 'Post unavailable' text", () => {
    const result = unavailablePostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator !== null);
    assert(indicator.textContent.includes("Post unavailable"));
  });

  it("should render an info icon", () => {
    const result = unavailablePostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator.querySelector(".info-icon") !== null);
  });
});

await t.run();
