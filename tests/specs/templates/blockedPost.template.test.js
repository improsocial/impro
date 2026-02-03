import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("blockedPostTemplate");

t.describe("blockedPostTemplate", (it) => {
  it("should display 'Post unavailable' text", () => {
    const result = blockedPostTemplate();
    const container = document.createElement("div");
    render(result, container);
    const indicator = container.querySelector(".missing-post-indicator");
    assert(indicator !== null);
    assert(indicator.textContent.includes("Post unavailable"));
  });
});

await t.run();
