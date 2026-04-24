import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/animated-sidebar.js";

const t = new TestSuite("AnimatedSidebar");

const originalMatchMedia = window.matchMedia;

// Media query list that supports `change` listener dispatch so tests can
// simulate a viewport resize crossing the mobile breakpoint.
function createMediaQueryList(matches, media) {
  const listeners = new Set();
  return {
    get matches() {
      return this._matches;
    },
    _matches: matches,
    media,
    onchange: null,
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    dispatchEvent: () => {},
    _set(newMatches) {
      this._matches = newMatches;
      for (const fn of listeners) {
        fn({ matches: newMatches, media });
      }
    },
  };
}

let mobileQueryList;

t.beforeEach(() => {
  document.body.innerHTML = "";
  // Default to mobile viewport so open() goes through showModal().
  // Desktop-specific tests override this.
  mobileQueryList = createMediaQueryList(true, "(max-width: 799px)");
  window.matchMedia = (query) => {
    if (query === "(max-width: 799px)") {
      return mobileQueryList;
    }
    return createMediaQueryList(false, query);
  };
});

t.afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible"; // needed for scroll lock
  container.appendChild(element);
  document.body.appendChild(container);
}

t.describe("AnimatedSidebar - rendering", (it) => {
  it("should render sidebar dialog element", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const sidebar = element.querySelector("dialog.sidebar");
    assert(sidebar !== null);
  });

  it("should set data-dialog-wrapper on the host element", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    assert(element.hasAttribute("data-dialog-wrapper"));
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

  it("should not have open attribute on sidebar initially", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const sidebar = element.querySelector("dialog.sidebar");
    assert(!sidebar.hasAttribute("open"));
  });
});

t.describe("AnimatedSidebar - open method", (it) => {
  it("should set isOpen to true when open() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);
  });

  it("should set open attribute on sidebar when open() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const sidebar = element.querySelector("dialog.sidebar");
    assert(sidebar.hasAttribute("open"));
  });

  it("should be findable via dialog[open] selector when opened", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const openDialog = document.querySelector("dialog[open]");
    assert(openDialog !== null);
    assert(openDialog.closest("[data-dialog-wrapper]") === element);
  });

  it("should be a no-op on desktop viewports", () => {
    mobileQueryList._set(false);
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, false);
    const sidebar = element.querySelector("dialog.sidebar");
    assert(!sidebar.hasAttribute("open"));
  });
});

t.describe("AnimatedSidebar - viewport resize", (it) => {
  it("should close when resizing from mobile to desktop while open", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);
    mobileQueryList._set(false);
    assertEquals(element.isOpen, false);
    const sidebar = element.querySelector("dialog.sidebar");
    assert(!sidebar.hasAttribute("open"));
  });

  it("should not re-open or error when resizing back to mobile", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    mobileQueryList._set(false);
    mobileQueryList._set(true);
    assertEquals(element.isOpen, false);
  });

  it("should still respond to viewport changes after reconnecting", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    const container = element.parentElement;
    container.remove();
    document.body.appendChild(container);
    element.open();
    assertEquals(element.isOpen, true);
    mobileQueryList._set(false);
    assertEquals(element.isOpen, false);
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

  it("should remove open attribute from sidebar when close() is called", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    element.close();
    const sidebar = element.querySelector("dialog.sidebar");
    assert(!sidebar.hasAttribute("open"));
  });
});

t.describe("AnimatedSidebar - dismissal", (it) => {
  it("should close when cancel event fires on the dialog (ESC key)", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const sidebar = element.querySelector("dialog.sidebar");
    sidebar.dispatchEvent(new Event("cancel"));
    assertEquals(element.isOpen, false);
  });

  it("should close when the dialog itself is clicked (backdrop click)", () => {
    const element = document.createElement("animated-sidebar");
    connectElement(element);
    element.open();
    const sidebar = element.querySelector("dialog.sidebar");
    sidebar.click();
    assertEquals(element.isOpen, false);
  });

  it("should not close when a child of the dialog is clicked", () => {
    const element = document.createElement("animated-sidebar");
    element.innerHTML = "<button class='test-btn'>nav</button>";
    connectElement(element);
    element.open();
    const button = element.querySelector(".test-btn");
    button.click();
    assertEquals(element.isOpen, true);
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
