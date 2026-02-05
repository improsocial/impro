import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postSkeletonTemplate");

t.describe("postSkeletonTemplate", (it) => {
  it("should render skeleton", () => {
    const result = postSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-skeleton']") !== null);
  });

  it("should render skeleton avatar", () => {
    const result = postSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".skeleton-avatar") !== null);
  });

  it("should render skeleton content lines", () => {
    const result = postSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    const lines = container.querySelectorAll(".skeleton-line");
    assert(lines.length === 2);
  });

  it("should render skeleton action icons", () => {
    const result = postSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    const actions = container.querySelectorAll(".skeleton-action");
    assert(actions.length === 3);
  });
});

await t.run();
