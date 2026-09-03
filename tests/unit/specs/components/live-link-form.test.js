import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/live-link-form.js";

describe("live-link-form", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    mock.timers.reset();
  });

  it("clears the debounce timer on disconnect so _loadLinkMeta never runs", () => {
    const element = document.createElement("live-link-form");
    document.body.appendChild(element);
    const loadSpy = mock.method(element, "_loadLinkMeta", async () => {});
    // Type a URL — arms the 500ms debounce
    element._handleInput({
      target: { value: "https://www.twitch.tv/streamer" },
    });
    assert.notEqual(element._debounceTimer, null);
    // Remove from document before debounce fires
    element.remove();
    mock.timers.tick(1000);
    assert.equal(loadSpy.mock.calls.length, 0);
  });
});
