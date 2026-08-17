import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const { installIOSFixedLayerResync } =
  await import("/js/iosFixedLayerResync.js?fresh-for-test");

describe("iOS fixed layer resync", () => {
  let originalNavigatorDescriptors;
  let originalVisualViewportDescriptor;
  let originalScrollTo;
  let originalScrollYDescriptor;
  let originalScrollHeightDescriptor;
  let originalInnerHeightDescriptor;
  let originalRequestAnimationFrame;
  let dispose;

  beforeEach(() => {
    originalNavigatorDescriptors = {
      userAgent: Object.getOwnPropertyDescriptor(navigator, "userAgent"),
      platform: Object.getOwnPropertyDescriptor(navigator, "platform"),
      maxTouchPoints: Object.getOwnPropertyDescriptor(
        navigator,
        "maxTouchPoints",
      ),
    };
    originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "visualViewport",
    );
    originalScrollTo = window.scrollTo;
    originalScrollYDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "scrollY",
    );
    originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "scrollHeight",
    );
    originalInnerHeightDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "innerHeight",
    );
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;

    Object.defineProperties(navigator, {
      userAgent: { configurable: true, value: "Mozilla/5.0 (iPhone)" },
      platform: { configurable: true, value: "iPhone" },
      maxTouchPoints: { configurable: true, value: 5 },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: new window.EventTarget(),
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 500,
    });
    globalThis.requestAnimationFrame = (callback) => callback();
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    window.scrollTo = originalScrollTo;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;

    const restoreProperty = (object, property, descriptor) => {
      if (descriptor) Object.defineProperty(object, property, descriptor);
      else delete object[property];
    };
    restoreProperty(
      navigator,
      "userAgent",
      originalNavigatorDescriptors.userAgent,
    );
    restoreProperty(
      navigator,
      "platform",
      originalNavigatorDescriptors.platform,
    );
    restoreProperty(
      navigator,
      "maxTouchPoints",
      originalNavigatorDescriptors.maxTouchPoints,
    );
    restoreProperty(window, "visualViewport", originalVisualViewportDescriptor);
    restoreProperty(window, "scrollY", originalScrollYDescriptor);
    restoreProperty(
      document.documentElement,
      "scrollHeight",
      originalScrollHeightDescriptor,
    );
    restoreProperty(window, "innerHeight", originalInnerHeightDescriptor);
  });

  it("resyncs after visual viewport activity in regular Safari", async () => {
    const scrollCalls = [];
    window.scrollTo = (...args) => {
      scrollCalls.push(args);
      // A programmatic repair can produce scrollend itself; it must not
      // schedule another repair indefinitely.
      window.dispatchEvent(new Event("scrollend"));
    };
    dispose = installIOSFixedLayerResync();

    window.visualViewport.dispatchEvent(new Event("resize"));
    window.visualViewport.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 175));

    assert.deepEqual(scrollCalls, [
      [0, 101],
      [0, 100],
    ]);
  });

  it("does not resync after its listeners are removed", async () => {
    const scrollCalls = [];
    window.scrollTo = (...args) => scrollCalls.push(args);
    dispose = installIOSFixedLayerResync();
    dispose();
    dispose = null;

    window.dispatchEvent(new Event("scrollend"));
    window.dispatchEvent(new Event("pageshow"));
    await new Promise((resolve) => setTimeout(resolve, 175));

    assert.deepEqual(scrollCalls, []);
  });
});
