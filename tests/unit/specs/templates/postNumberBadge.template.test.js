import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postNumberBadgeTemplate } from "/js/templates/postNumberBadge.template.js";
import { render } from "/js/lib/lit-html.js";

function renderBadge(props) {
  const container = document.createElement("div");
  render(postNumberBadgeTemplate(props), container);
  return container;
}

describe("postNumberBadgeTemplate", () => {
  it("renders index/count with an accessible label", () => {
    const container = renderBadge({
      numbering: { index: 3, count: 5 },
      inline: true,
    });
    const badge = container.querySelector('[data-testid="post-number-badge"]');
    assert(badge !== null);
    assert.equal(badge.textContent, "3/5");
    assert.equal(badge.getAttribute("role"), "img");
    assert.equal(badge.getAttribute("aria-label"), "Post 3 of 5");
    assert.equal(badge.getAttribute("data-teststate"), "inline");
  });

  it("marks the standalone placement", () => {
    const container = renderBadge({
      numbering: { index: 1, count: 2 },
      inline: false,
    });
    const badge = container.querySelector('[data-testid="post-number-badge"]');
    assert.equal(badge.getAttribute("data-teststate"), "standalone");
  });
});
