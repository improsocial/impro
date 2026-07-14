import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { floatingComposeButtonTemplate } from "/js/templates/floatingComposeButton.template.js";
import { render } from "/js/lib/lit-html.js";

describe("floatingComposeButtonTemplate", () => {
  it("renders the button and calls onClick on click", () => {
    const onClick = mock.fn();
    const container = document.createElement("div");
    render(floatingComposeButtonTemplate({ onClick }), container);

    const button = container.querySelector(
      "[data-testid='floating-compose-button']",
    );
    assert(button !== null);
    button.click();

    assert.deepEqual(onClick.mock.callCount(), 1);
  });
});
