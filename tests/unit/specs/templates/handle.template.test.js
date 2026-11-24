import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, html } from "/js/lib/lit-html.js";
import { handleTemplate } from "/js/templates/handle.template.js";

describe("handleTemplate", () => {
  afterEach(() => {
    document
      .querySelectorAll('[data-testid="alert-modal"]')
      .forEach((dialog) => dialog.remove());
  });

  function renderHandle(handle) {
    const container = document.createElement("div");
    render(html`${handleTemplate(handle)}`, container);
    return container;
  }

  it("renders a valid handle with an @ prefix", () => {
    const container = renderHandle("alice.test");
    assert.equal(container.textContent, "@alice.test");
    assert.equal(
      container.querySelector('[data-testid="invalid-handle-badge"]'),
      null,
    );
  });

  it("renders a warning badge instead of handle.invalid", () => {
    const container = renderHandle("handle.invalid");
    assert(container.querySelector('[data-testid="invalid-handle-badge"]'));
    assert(!container.textContent.includes("handle.invalid"));
  });

  it("opens an explanation modal without following an enclosing link", () => {
    const container = document.createElement("div");
    render(
      html`<a href="/profile/did:plc:test"
        >${handleTemplate("handle.invalid")}</a
      >`,
      container,
    );
    document.body.append(container);
    const link = container.querySelector("a");
    const linkClicks = [];
    link.addEventListener("click", (event) => linkClicks.push(event));

    const clickEvent = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    container
      .querySelector('[data-testid="invalid-handle-badge"]')
      .dispatchEvent(clickEvent);

    assert(clickEvent.defaultPrevented);
    assert.equal(linkClicks.length, 0);
    assert(document.querySelector('[data-testid="alert-modal"]'));
    container.remove();
  });
});
