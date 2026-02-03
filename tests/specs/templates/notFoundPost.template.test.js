import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("notFoundPostTemplate");

t.describe("notFoundPostTemplate", (it) => {
  it("should display 'Post deleted' text", () => {
    const result = notFoundPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator !== null);
    assert(indicator.textContent.includes("Post deleted"));
  });
});

await t.run();
