import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { PostSeenObserver } from "/js/postSeenObserver.js";
import { createPost } from "../../shared/factories.js";

const originalSetTimeout = globalThis.setTimeout;

// Awaits two macrotask turns so the observer's 0-delay-patched dwell and batch
// timers (scheduled earlier, so ahead in the timer queue) have fired.
async function flushTimers() {
  await new Promise((resolve) => originalSetTimeout(resolve, 0));
  await new Promise((resolve) => originalSetTimeout(resolve, 0));
}

function createObserver() {
  const api = { sendInteractions: async () => {} };
  const observer = new PostSeenObserver(api, "did:web:example.com#bsky_fg");
  let scrollHandlerCalls = 0;
  observer.handleScroll = () => {
    scrollHandlerCalls++;
  };
  return { observer, getScrollHandlerCalls: () => scrollHandlerCalls };
}

function createTrackedElement({ top = 0, bottom = 100 } = {}) {
  const element = document.createElement("div");
  const rect = { top, bottom };
  element.getBoundingClientRect = () => ({
    top: rect.top,
    bottom: rect.bottom,
  });
  return { element, rect };
}

const postUriA = createPost({
  uri: "at://did:plc:alice/app.bsky.feed.post/1",
}).uri;
const postUriB = createPost({
  uri: "at://did:plc:bob/app.bsky.feed.post/2",
}).uri;
const postUriC = createPost({
  uri: "at://did:plc:carol/app.bsky.feed.post/3",
}).uri;

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

describe("PostSeenObserver - seen tracking", () => {
  let observer;
  let sendInteractions;
  let warnMock;

  beforeEach(() => {
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
    warnMock = mock.method(console, "warn", () => {});
    sendInteractions = mock.fn(async () => {});
    observer = new PostSeenObserver(
      { sendInteractions },
      "did:web:example.com#bsky_fg",
    );
  });

  afterEach(() => {
    observer.disconnect();
    globalThis.setTimeout = originalSetTimeout;
    warnMock.mock.restore();
  });

  it("marks a visible registered post as seen and sends the interaction", async () => {
    const { element } = createTrackedElement();
    observer.register(element, postUriA, "feed-context-a");
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    assert.deepEqual(sendInteractions.mock.calls[0].arguments, [
      [
        {
          item: postUriA,
          event: "app.bsky.feed.defs#interactionSeen",
          feedContext: "feed-context-a",
        },
      ],
      "did:web:example.com#bsky_fg",
    ]);
    assert(observer.seenPosts.has(postUriA));
  });

  it("omits feedContext from the interaction when it is null", async () => {
    const { element } = createTrackedElement();
    observer.register(element, postUriA, null);
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    assert.deepEqual(sendInteractions.mock.calls[0].arguments[0], [
      { item: postUriA, event: "app.bsky.feed.defs#interactionSeen" },
    ]);
  });

  it("does not send an interaction for an off-screen post", async () => {
    const { element } = createTrackedElement({ top: 2000, bottom: 2100 });
    observer.register(element, postUriA, null);
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 0);
    assert(!observer.seenPosts.has(postUriA));
  });

  it("does not send when the post scrolls away before the dwell recheck", async () => {
    const { element, rect } = createTrackedElement();
    observer.register(element, postUriA, null);
    rect.top = 2000;
    rect.bottom = 2100;
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 0);
    assert(!observer.seenPosts.has(postUriA));
  });

  it("skips checks for posts already marked seen", async () => {
    const { element } = createTrackedElement();
    observer.register(element, postUriA, null);
    await flushTimers();
    observer.checkAllIntersections();
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
  });

  it("refuses to resend an interaction the dispatch already sent", async () => {
    const { element } = createTrackedElement();
    observer.register(element, postUriA, null);
    await flushTimers();
    observer.seenPosts.clear();
    observer.checkAllIntersections();
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    assert.deepEqual(warnMock.mock.callCount(), 1);
    assert(observer.seenPosts.has(postUriA));
  });

  it("does not mark the post seen when sending fails", async () => {
    sendInteractions.mock.mockImplementation(async () => {
      throw new Error("network down");
    });
    const { element } = createTrackedElement();
    observer.register(element, postUriA, null);
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    assert(!observer.seenPosts.has(postUriA));
  });

  it("batches interactions queued in the same burst into one api call", async () => {
    const first = createTrackedElement();
    const second = createTrackedElement();
    observer.register(first.element, postUriA, null);
    observer.register(second.element, postUriB, null);
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    const [interactions] = sendInteractions.mock.calls[0].arguments;
    assert.deepEqual(
      interactions.map((interaction) => interaction.item),
      [postUriA, postUriB],
    );
    assert(observer.seenPosts.has(postUriA));
    assert(observer.seenPosts.has(postUriB));
  });

  it("processes interactions queued while a batch is in flight as a second batch", async () => {
    let releaseFirstBatch;
    sendInteractions.mock.mockImplementationOnce(
      () => new Promise((resolve) => (releaseFirstBatch = resolve)),
    );
    const dispatch = observer.interactionsDispatch;
    const firstPromise = dispatch.sendInteraction({ item: postUriA });
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    const secondPromise = dispatch.sendInteraction({ item: postUriC });
    releaseFirstBatch();
    await Promise.all([firstPromise, secondPromise]);
    assert.deepEqual(sendInteractions.mock.callCount(), 2);
    assert.deepEqual(sendInteractions.mock.calls[1].arguments[0], [
      { item: postUriC },
    ]);
  });

  it("replaces a previous registration for the same post uri", async () => {
    const stale = createTrackedElement({ top: 2000, bottom: 2100 });
    const fresh = createTrackedElement({ top: 2000, bottom: 2100 });
    observer.register(stale.element, postUriA, null);
    observer.register(fresh.element, postUriA, null);
    assert.deepEqual(observer.observedElements.length, 1);
    assert.deepEqual(observer.observedElements[0].el, fresh.element);
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 0);
  });

  it("checks registered posts again on scroll", async () => {
    const { element, rect } = createTrackedElement({ top: 2000, bottom: 2100 });
    observer.register(element, postUriA, "scrolled-context");
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 0);
    rect.top = 0;
    rect.bottom = 100;
    observer.handleScroll();
    await flushTimers();
    assert.deepEqual(sendInteractions.mock.callCount(), 1);
    assert(observer.seenPosts.has(postUriA));
  });

  it("logs verbose debug output when enabled", async () => {
    const debugMock = mock.method(console, "debug", () => {});
    const verboseObserver = new PostSeenObserver(
      { sendInteractions },
      "did:web:example.com#bsky_fg",
      { verbose: true },
    );
    const { element } = createTrackedElement();
    verboseObserver.register(element, postUriB, null);
    await flushTimers();
    assert(debugMock.mock.calls.some((call) => call.arguments[1] === postUriB));
    verboseObserver.disconnect();
    debugMock.mock.restore();
  });
});
