import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("notFoundPostTemplate");

t.describe("notFoundPostTemplate", (it) => {
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
    assert(indicator.querySelector(".trash-can-icon") !== null);
  });
});

await t.run();
