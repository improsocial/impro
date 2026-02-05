import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/animated-sidebar.js";

const t = new TestSuite("AnimatedSidebar");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible"; // needed for scroll lock
  container.appendChild(element);
  document.body.appendChild(container);
}

t.describe("AnimatedSidebar - rendering", (it) => {
  it("should render sidebar-overlay", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const overlay = element.querySelector(".sidebar-overlay");
    assert(overlay !== null);
  });

  it("should render sidebar aside element", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const sidebar = element.querySelector(".sidebar");
    assert(sidebar !== null);
  });

  it("should render sidebar-content", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const content = element.querySelector(".sidebar-content");
    assert(content !== null);
  });

  it("should preserve children in sidebar-content", () => {
    const element = document.createElement("animated-sidebar");
    element.innerHTML = "<span class='test-child'>Test Content</span>";
    connectElement(element);
    const child = element.querySelector(".sidebar-content .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Test Content");
  });
});

t.describe("AnimatedSidebar - initial state", (it) => {
  it("should start with isOpen set to false", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    assertEquals(element.isOpen, false);
  });

  it("should not have open class on overlay initially", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const overlay = element.querySelector(".sidebar-overlay");
    assert(!overlay.classList.contains("open"));
  });

  it("should not have open class on sidebar initially", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const sidebar = element.querySelector(".sidebar");
    assert(!sidebar.classList.contains("open"));
  });
});

t.describe("AnimatedSidebar - open method", (it) => {
  it("should set isOpen to true when open() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);
  });

  it("should add open class to overlay when open() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const overlay = element.querySelector(".sidebar-overlay");
    assert(overlay.classList.contains("open"));
  });

  it("should add open class to sidebar when open() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const sidebar = element.querySelector(".sidebar");
    assert(sidebar.classList.contains("open"));
  });
});

t.describe("AnimatedSidebar - close method", (it) => {
  it("should set isOpen to false when close() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    element.close();
    assertEquals(element.isOpen, false);
  });

  it("should remove open class from overlay when close() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    element.close();
    const overlay = element.querySelector(".sidebar-overlay");
    assert(!overlay.classList.contains("open"));
  });

  it("should remove open class from sidebar when close() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    element.close();
    const sidebar = element.querySelector(".sidebar");
    assert(!sidebar.classList.contains("open"));
  });
});

t.describe("AnimatedSidebar - overlay click", (it) => {
  it("should close sidebar when overlay is clicked", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const overlay = element.querySelector(".sidebar-overlay");
    overlay.click();
    assertEquals(element.isOpen, false);
  });
});

t.describe("AnimatedSidebar - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("animated-sidebar");
    element.innerHTML = "<span class='test-child'>Original</span>";
    connectElement(element);

    // Manually trigger connectedCallback again (simulates re-attachment)
    element.connectedCallback();

    // Should still have the original child preserved
    const child = element.querySelector(".sidebar-content .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
