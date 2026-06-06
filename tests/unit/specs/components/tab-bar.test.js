import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals, mock } from "../../testHelpers.js";
import "/js/components/tab-bar.js";

const t = new TestSuite("TabBar");

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

t.beforeEach(async () => {
  document.body.innerHTML = "";
  // Drain any requestAnimationFrame callbacks queued by previous tests
  // before installing the spy, so we don't capture stale calls.
  await new Promise((resolve) => setTimeout(resolve, 0));
  originalScrollIntoView =
    window.HTMLElement.prototype.scrollIntoView ?? function () {};
  scrollSpy = mock();
  window.HTMLElement.prototype.scrollIntoView = function (options) {
    scrollSpy(this, options);
  };
});

t.afterEach(() => {
  window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

t.describe("TabBar - rendering", (it) => {
  it("should render a button for each tab", () => {
    const element = createTabBar();
    document.body.appendChild(element);
    const buttons = element.querySelectorAll(".tab-bar-button");
    assertEquals(buttons.length, 3);
  });

  it("should render tab labels", () => {
    const element = createTabBar();
    document.body.appendChild(element);
    const buttons = element.querySelectorAll(".tab-bar-button");
    assertEquals(buttons[0].textContent.trim(), "One");
    assertEquals(buttons[1].textContent.trim(), "Two");
    assertEquals(buttons[2].textContent.trim(), "Three");
  });

  it("should mark the active tab with the active class", () => {
    const element = createTabBar({ activeTab: "two" });
    document.body.appendChild(element);
    const activeButtons = element.querySelectorAll(".tab-bar-button.active");
    assertEquals(activeButtons.length, 1);
    assertEquals(activeButtons[0].textContent.trim(), "Two");
  });

  it("should re-render when tabs property changes", () => {
    const element = createTabBar();
    document.body.appendChild(element);
    element.tabs = [{ value: "x", label: "X" }];
    const buttons = element.querySelectorAll(".tab-bar-button");
    assertEquals(buttons.length, 1);
    assertEquals(buttons[0].textContent.trim(), "X");
  });

  it("should re-render when active-tab attribute changes", () => {
    const element = createTabBar({ activeTab: "one" });
    document.body.appendChild(element);
    element.setAttribute("active-tab", "three");
    const activeButtons = element.querySelectorAll(".tab-bar-button.active");
    assertEquals(activeButtons.length, 1);
    assertEquals(activeButtons[0].textContent.trim(), "Three");
  });
});

t.describe("TabBar - tab-click events", (it) => {
  it("should dispatch tab-click with the tab value when a button is clicked", () => {
    const element = createTabBar();
    document.body.appendChild(element);
    const handler = mock();
    element.addEventListener("tab-click", (event) => handler(event.detail));
    element.querySelectorAll(".tab-bar-button")[1].click();
    assertEquals(handler.calls.length, 1);
    assertEquals(handler.calls[0][0], "two");
  });
});

t.describe("TabBar - initial scroll", (it) => {
  it("should scroll the active tab into view on connect", async () => {
    const element = createTabBar({ activeTab: "two" });
    document.body.appendChild(element);
    await waitForAnimationFrame();
    assertEquals(scrollSpy.calls.length, 1);
    assertEquals(scrollSpy.calls[0][0].textContent.trim(), "Two");
  });

  it("should use 'instant' behavior on first scroll", async () => {
    const element = createTabBar({ activeTab: "two" });
    document.body.appendChild(element);
    await waitForAnimationFrame();
    assertEquals(scrollSpy.calls[0][1].behavior, "instant");
  });

  it("should not scroll if no active tab is present", async () => {
    const element = createTabBar();
    document.body.appendChild(element);
    await waitForAnimationFrame();
    assertEquals(scrollSpy.calls.length, 0);
  });
});

t.describe("TabBar - binding order", (it) => {
  it("should scroll instantly when tabs are set after active-tab", async () => {
    const element = document.createElement("tab-bar");
    element.setAttribute("active-tab", "two");
    document.body.appendChild(element);
    await waitForAnimationFrame();
    assertEquals(scrollSpy.calls.length, 0);

    element.tabs = sampleTabs;
    await waitForAnimationFrame();

    assertEquals(scrollSpy.calls.length, 1);
    assertEquals(scrollSpy.calls[0][1].behavior, "instant");
    assertEquals(scrollSpy.calls[0][0].textContent.trim(), "Two");
  });
});

t.describe("TabBar - active-tab attribute changes", (it) => {
  it("should scroll the new active tab into view", async () => {
    const element = createTabBar({ activeTab: "one" });
    document.body.appendChild(element);
    await waitForAnimationFrame();
    scrollSpy.calls.length = 0;

    element.setAttribute("active-tab", "three");
    await waitForAnimationFrame();

    assertEquals(scrollSpy.calls.length, 1);
    assertEquals(scrollSpy.calls[0][0].textContent.trim(), "Three");
  });

  it("should use 'smooth' behavior on subsequent scrolls", async () => {
    const element = createTabBar({ activeTab: "one" });
    document.body.appendChild(element);
    await waitForAnimationFrame();

    element.setAttribute("active-tab", "two");
    await waitForAnimationFrame();

    const lastCall = scrollSpy.calls[scrollSpy.calls.length - 1];
    assertEquals(lastCall[1].behavior, "smooth");
  });
});

t.describe("TabBar - full-width", (it) => {
  it("should not scroll on connect when full-width is set", async () => {
    const element = createTabBar({ activeTab: "two", fullWidth: true });
    document.body.appendChild(element);
    await waitForAnimationFrame();
    assertEquals(scrollSpy.calls.length, 0);
  });

  it("should not scroll on active-tab change when full-width is set", async () => {
    const element = createTabBar({ activeTab: "one", fullWidth: true });
    document.body.appendChild(element);
    await waitForAnimationFrame();

    element.setAttribute("active-tab", "three");
    await waitForAnimationFrame();

    assertEquals(scrollSpy.calls.length, 0);
  });
});

t.describe("TabBar - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback fires again", () => {
    const element = createTabBar({ activeTab: "one" });
    document.body.appendChild(element);
    const initialButton = element.querySelector(".tab-bar-button");
    element.connectedCallback();
    const afterButton = element.querySelector(".tab-bar-button");
    assert(initialButton === afterButton);
  });
});

await t.run();
