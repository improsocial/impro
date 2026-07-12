import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostSeenObserver } from "/js/postSeenObserver.js";

function createObserver() {
  const api = { sendInteractions: async () => {} };
  const observer = new PostSeenObserver(api, "did:web:example.com#bsky_fg");
  let scrollHandlerCalls = 0;
  observer.handleScroll = () => {
    scrollHandlerCalls++;
  };
  return { observer, getScrollHandlerCalls: () => scrollHandlerCalls };
}

describe("PostSeenObserver - scroll listener lifecycle", () => {
  it("should handle scroll events after construction", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    window.dispatchEvent(new window.Event("scroll"));
    assert.deepEqual(getScrollHandlerCalls(), 1);
    observer.disconnect();
  });

  it("should stop handling scroll events after disconnect", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    observer.disconnect();
    window.dispatchEvent(new window.Event("scroll"));
    assert.deepEqual(getScrollHandlerCalls(), 0);
  });

  it("should resume handling scroll events after reconnect", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    observer.disconnect();
    observer.connect();
    window.dispatchEvent(new window.Event("scroll"));
    assert.deepEqual(getScrollHandlerCalls(), 1);
    observer.disconnect();
  });

  it("should tolerate repeated connect and disconnect calls", () => {
    const { observer } = createObserver();
    observer.connect();
    observer.connect();
    assert(observer.connected);
    observer.disconnect();
    observer.disconnect();
    assert(!observer.connected);
    window.dispatchEvent(new window.Event("scroll"));
    assert(!observer.connected);
  });
});
