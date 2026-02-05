import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/infinite-scroll-container.js";

const t = new TestSuite("InfiniteScrollContainer");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("InfiniteScrollContainer - rendering", (it) => {
  it("should render infinite-scroll-container div", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    const container = element.querySelector(".infinite-scroll-container");
    assert(container !== null);
  });

  it("should render sentinel element", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    const sentinel = element.querySelector(".infinite-scroll-sentinel");
    assert(sentinel !== null);
  });

  it("should preserve children in container", () => {
    const element = document.createElement("infinite-scroll-container");
    element.innerHTML = "<div class='test-child'>Content</div>";
    document.body.appendChild(element);
    const child = element.querySelector(
      ".infinite-scroll-container .test-child",
    );
    assert(child !== null);
    assertEquals(child.textContent, "Content");
  });
});

t.describe("InfiniteScrollContainer - attributes", (it) => {
  it("should read lookahead attribute", () => {
    const element = document.createElement("infinite-scroll-container");
    element.setAttribute("lookahead", "1000px");
    document.body.appendChild(element);
    assertEquals(element.lookahead, "1000px");
  });

  it("should default lookahead to 2000px", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    assertEquals(element.lookahead, "2000px");
  });

  it("should set sentinel height based on lookahead", () => {
    const element = document.createElement("infinite-scroll-container");
    element.setAttribute("lookahead", "500px");
    document.body.appendChild(element);
    const sentinel = element.querySelector(".infinite-scroll-sentinel");
    assert(sentinel.style.height.includes("500px"));
  });

  it("should read inverted attribute", () => {
    const element = document.createElement("infinite-scroll-container");
    element.setAttribute("inverted", "");
    document.body.appendChild(element);
    assertEquals(element.inverted, true);
  });

  it("should not be inverted by default", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    assertEquals(element.inverted, false);
  });
});

t.describe("InfiniteScrollContainer - sentinel positioning", (it) => {
  it("should place sentinel at bottom by default", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    const sentinel = element.querySelector(".infinite-scroll-sentinel");
    assert(sentinel.style.cssText.includes("bottom: 0"));
  });

  it("should place sentinel at top when inverted", () => {
    const element = document.createElement("infinite-scroll-container");
    element.setAttribute("inverted", "");
    document.body.appendChild(element);
    const sentinel = element.querySelector(".infinite-scroll-sentinel");
    assert(sentinel.style.cssText.includes("top: 0"));
  });
});

t.describe("InfiniteScrollContainer - disabled state", (it) => {
  it("should not be disabled by default", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    assert(!element.hasAttribute("disabled"));
  });

  it("should accept disabled attribute", () => {
    const element = document.createElement("infinite-scroll-container");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    assert(element.hasAttribute("disabled"));
  });
});

t.describe("InfiniteScrollContainer - observer", (it) => {
  it("should create an IntersectionObserver", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    assert(element.observer !== null);
    assert(element.observer instanceof IntersectionObserver);
  });

  it("should disconnect observer when element is removed", () => {
    const element = document.createElement("infinite-scroll-container");
    document.body.appendChild(element);
    const observer = element.observer;

    let disconnected = false;
    const originalDisconnect = observer.disconnect.bind(observer);
    observer.disconnect = () => {
      disconnected = true;
      originalDisconnect();
    };

    element.remove();
    assert(disconnected);
  });
});

t.describe("InfiniteScrollContainer - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("infinite-scroll-container");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector(".infinite-scroll-container .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
