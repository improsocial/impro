import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/tab-bar.js";

describe("tab-bar", () => {
  function waitForAnimationFrame() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  const sampleTabs = [
    { value: "one", label: "One" },
    { value: "two", label: "Two" },
    { value: "three", label: "Three" },
  ];

  function createTabBar({
    tabs = sampleTabs,
    activeTab = null,
    fullWidth = false,
  } = {}) {
    const element = document.createElement("tab-bar");
    element.tabs = tabs;
    if (activeTab !== null) element.setAttribute("active-tab", activeTab);
    if (fullWidth) element.setAttribute("full-width", "");
    return element;
  }

  let originalScrollIntoView;
  let scrollSpy;

  beforeEach(async () => {
    document.body.innerHTML = "";
    // Drain any requestAnimationFrame callbacks queued by previous tests
    // before installing the spy, so we don't capture stale calls.
    await new Promise((resolve) => setTimeout(resolve, 0));
    originalScrollIntoView =
      window.HTMLElement.prototype.scrollIntoView ?? function () {};
    scrollSpy = mock.fn();
    window.HTMLElement.prototype.scrollIntoView = function (options) {
      scrollSpy(this, options);
    };
  });

  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  describe("TabBar - rendering", () => {
    it("should render a button for each tab", () => {
      const element = createTabBar();
      document.body.appendChild(element);
      const buttons = element.querySelectorAll(".tab-bar-button");
      assert.deepEqual(buttons.length, 3);
    });

    it("should render tab labels", () => {
      const element = createTabBar();
      document.body.appendChild(element);
      const buttons = element.querySelectorAll(".tab-bar-button");
      assert.deepEqual(buttons[0].textContent.trim(), "One");
      assert.deepEqual(buttons[1].textContent.trim(), "Two");
      assert.deepEqual(buttons[2].textContent.trim(), "Three");
    });

    it("should mark the active tab with the active class", () => {
      const element = createTabBar({ activeTab: "two" });
      document.body.appendChild(element);
      const activeButtons = element.querySelectorAll(".tab-bar-button.active");
      assert.deepEqual(activeButtons.length, 1);
      assert.deepEqual(activeButtons[0].textContent.trim(), "Two");
    });

    it("should re-render when tabs property changes", () => {
      const element = createTabBar();
      document.body.appendChild(element);
      element.tabs = [{ value: "x", label: "X" }];
      const buttons = element.querySelectorAll(".tab-bar-button");
      assert.deepEqual(buttons.length, 1);
      assert.deepEqual(buttons[0].textContent.trim(), "X");
    });

    it("should re-render when active-tab attribute changes", () => {
      const element = createTabBar({ activeTab: "one" });
      document.body.appendChild(element);
      element.setAttribute("active-tab", "three");
      const activeButtons = element.querySelectorAll(".tab-bar-button.active");
      assert.deepEqual(activeButtons.length, 1);
      assert.deepEqual(activeButtons[0].textContent.trim(), "Three");
    });
  });

  describe("TabBar - tab-click events", () => {
    it("should dispatch tab-click with the tab value when a button is clicked", () => {
      const element = createTabBar();
      document.body.appendChild(element);
      const handler = mock.fn();
      element.addEventListener("tab-click", (event) => handler(event.detail));
      element.querySelectorAll(".tab-bar-button")[1].click();
      assert.deepEqual(handler.mock.callCount(), 1);
      assert.deepEqual(handler.mock.calls[0].arguments[0], "two");
    });
  });

  describe("TabBar - initial scroll", () => {
    it("should scroll the active tab into view on connect", async () => {
      const element = createTabBar({ activeTab: "two" });
      document.body.appendChild(element);
      await waitForAnimationFrame();
      assert.deepEqual(scrollSpy.mock.callCount(), 1);
      assert.deepEqual(
        scrollSpy.mock.calls[0].arguments[0].textContent.trim(),
        "Two",
      );
    });

    it("should use 'instant' behavior on first scroll", async () => {
      const element = createTabBar({ activeTab: "two" });
      document.body.appendChild(element);
      await waitForAnimationFrame();
      assert.deepEqual(
        scrollSpy.mock.calls[0].arguments[1].behavior,
        "instant",
      );
    });

    it("should not scroll if no active tab is present", async () => {
      const element = createTabBar();
      document.body.appendChild(element);
      await waitForAnimationFrame();
      assert.deepEqual(scrollSpy.mock.callCount(), 0);
    });
  });

  describe("TabBar - binding order", () => {
    it("should scroll instantly when tabs are set after active-tab", async () => {
      const element = document.createElement("tab-bar");
      element.setAttribute("active-tab", "two");
      document.body.appendChild(element);
      await waitForAnimationFrame();
      assert.deepEqual(scrollSpy.mock.callCount(), 0);

      element.tabs = sampleTabs;
      await waitForAnimationFrame();

      assert.deepEqual(scrollSpy.mock.callCount(), 1);
      assert.deepEqual(
        scrollSpy.mock.calls[0].arguments[1].behavior,
        "instant",
      );
      assert.deepEqual(
        scrollSpy.mock.calls[0].arguments[0].textContent.trim(),
        "Two",
      );
    });
  });

  describe("TabBar - active-tab attribute changes", () => {
    it("should scroll the new active tab into view", async () => {
      const element = createTabBar({ activeTab: "one" });
      document.body.appendChild(element);
      await waitForAnimationFrame();
      scrollSpy.mock.resetCalls();

      element.setAttribute("active-tab", "three");
      await waitForAnimationFrame();

      assert.deepEqual(scrollSpy.mock.callCount(), 1);
      assert.deepEqual(
        scrollSpy.mock.calls[0].arguments[0].textContent.trim(),
        "Three",
      );
    });

    it("should use 'smooth' behavior on subsequent scrolls", async () => {
      const element = createTabBar({ activeTab: "one" });
      document.body.appendChild(element);
      await waitForAnimationFrame();

      element.setAttribute("active-tab", "two");
      await waitForAnimationFrame();

      const lastCall = scrollSpy.mock.calls[scrollSpy.mock.callCount() - 1];
      assert.deepEqual(lastCall.arguments[1].behavior, "smooth");
    });
  });

  describe("TabBar - full-width", () => {
    it("should not scroll on connect when full-width is set", async () => {
      const element = createTabBar({ activeTab: "two", fullWidth: true });
      document.body.appendChild(element);
      await waitForAnimationFrame();
      assert.deepEqual(scrollSpy.mock.callCount(), 0);
    });

    it("should not scroll on active-tab change when full-width is set", async () => {
      const element = createTabBar({ activeTab: "one", fullWidth: true });
      document.body.appendChild(element);
      await waitForAnimationFrame();

      element.setAttribute("active-tab", "three");
      await waitForAnimationFrame();

      assert.deepEqual(scrollSpy.mock.callCount(), 0);
    });
  });

  describe("TabBar - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback fires again", () => {
      const element = createTabBar({ activeTab: "one" });
      document.body.appendChild(element);
      const initialButton = element.querySelector(".tab-bar-button");
      element.connectedCallback();
      const afterButton = element.querySelector(".tab-bar-button");
      assert(initialButton === afterButton);
    });
  });
});
