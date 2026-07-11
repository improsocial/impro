import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PostSeenObserver } from "/js/postSeenObserver.js";

const t = new TestSuite("PostSeenObserver");

function createObserver() {
  const api = { sendInteractions: async () => {} };
  const observer = new PostSeenObserver(api, "did:web:example.com#bsky_fg");
  let scrollHandlerCalls = 0;
  observer.handleScroll = () => {
    scrollHandlerCalls++;
  };
  return { observer, getScrollHandlerCalls: () => scrollHandlerCalls };
}

t.describe("PostSeenObserver - scroll listener lifecycle", (it) => {
  it("should handle scroll events after construction", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    window.dispatchEvent(new window.Event("scroll"));
    assertEquals(getScrollHandlerCalls(), 1);
    observer.disconnect();
  });

  it("should stop handling scroll events after disconnect", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    observer.disconnect();
    window.dispatchEvent(new window.Event("scroll"));
    assertEquals(getScrollHandlerCalls(), 0);
  });

  it("should resume handling scroll events after reconnect", () => {
    const { observer, getScrollHandlerCalls } = createObserver();
    observer.disconnect();
    observer.connect();
    window.dispatchEvent(new window.Event("scroll"));
    assertEquals(getScrollHandlerCalls(), 1);
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

await t.run();
