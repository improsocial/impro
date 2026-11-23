import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { html } from "/js/lib/lit-html.js";
import "/js/components/collapsible-content.js";

describe("collapsible-content", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  after(() => {
    document.body.innerHTML = "";
  });

  function mountWithLayout({
    innerHeight,
    bodyClientHeight,
    bodyScrollHeight,
  }) {
    const element = document.createElement("collapsible-content");
    element.content = html`<span>content</span>`;
    document.body.appendChild(element);
    const body = element.querySelector(".collapsible-content-body");
    const inner = element.querySelector(".collapsible-content-inner");
    Object.defineProperty(inner, "offsetHeight", { value: innerHeight });
    Object.defineProperty(body, "clientHeight", { value: bodyClientHeight });
    Object.defineProperty(body, "scrollHeight", { value: bodyScrollHeight });
    element.measureOverflow();
    return element;
  }

  function getToggle(element) {
    return element.querySelector('[data-testid="collapsible-content-toggle"]');
  }

  it("shows the toggle when the content is taller than the clamp", () => {
    const element = mountWithLayout({
      innerHeight: 800,
      bodyClientHeight: 492,
      bodyScrollHeight: 800,
    });
    assert.equal(getToggle(element).dataset.teststate, "collapsed");
  });

  it("hides the toggle when only glyph ink overflows the line box", () => {
    const element = mountWithLayout({
      innerHeight: 32,
      bodyClientHeight: 32,
      bodyScrollHeight: 38,
    });
    assert.equal(getToggle(element), null);
  });
});
