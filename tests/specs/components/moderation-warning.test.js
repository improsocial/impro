import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/moderation-warning.js";

const t = new TestSuite("ModerationWarning");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ModerationWarning - rendering", (it) => {
  it("should render top-bar element", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    assert(topBar !== null);
  });

  it("should render toggle-content element", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content !== null);
  });

  it("should display label text", () => {
    const element = document.createElement("moderation-warning");
    element.setAttribute("label", "Adult content");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    assert(topBar.textContent.includes("Adult content"));
  });

  it("should display show/hide label", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const label = element.querySelector(".show-hide-label");
    assert(label !== null);
    assertEquals(label.textContent.trim(), "Show");
  });

  it("should preserve children in toggle-content", () => {
    const element = document.createElement("moderation-warning");
    element.innerHTML = "<div class='test-child'>Hidden content</div>";
    document.body.appendChild(element);
    const child = element.querySelector(".toggle-content .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Hidden content");
  });
});

t.describe("ModerationWarning - labeler info", (it) => {
  it("should display labeler name when provided", () => {
    const element = document.createElement("moderation-warning");
    element.setAttribute("labelerName", "Bluesky Moderation");
    document.body.appendChild(element);
    const description = element.querySelector(
      ".post-moderation-warning-description",
    );
    assert(description !== null);
    assert(description.textContent.includes("Bluesky Moderation"));
  });

  it("should display labeler link when provided", () => {
    const element = document.createElement("moderation-warning");
    element.setAttribute("labelerName", "Bluesky");
    element.setAttribute(
      "labelerLink",
      "https://bsky.app/profile/moderation.bsky.app",
    );
    document.body.appendChild(element);
    const link = element.querySelector(
      ".post-moderation-warning-description a",
    );
    assert(link !== null);
    assertEquals(link.textContent, "Bluesky");
    assertEquals(link.href, "https://bsky.app/profile/moderation.bsky.app");
  });

  it("should not render link if only name is provided", () => {
    const element = document.createElement("moderation-warning");
    element.setAttribute("labelerName", "Test Labeler");
    document.body.appendChild(element);
    const link = element.querySelector(
      ".post-moderation-warning-description a",
    );
    assertEquals(link, null);
    const description = element.querySelector(
      ".post-moderation-warning-description",
    );
    assert(description.textContent.includes("Test Labeler"));
  });

  it("should hide labeler description when expanded", () => {
    const element = document.createElement("moderation-warning");
    element.setAttribute("labelerName", "Test Labeler");
    document.body.appendChild(element);
    element.toggle();
    const description = element.querySelector(
      ".post-moderation-warning-description",
    );
    assert(description.hidden);
  });
});

t.describe("ModerationWarning - initial state", (it) => {
  it("should start with expanded set to false", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    assertEquals(element.expanded, false);
  });

  it("should have aria-expanded set to false initially", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    assertEquals(topBar.getAttribute("aria-expanded"), "false");
  });

  it("should hide toggle-content initially", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content.hidden);
  });

  it("should display 'Show' label initially", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const label = element.querySelector(".show-hide-label");
    assertEquals(label.textContent.trim(), "Show");
  });
});

t.describe("ModerationWarning - toggle", (it) => {
  it("should set expanded to true when toggle() is called", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    element.toggle();
    assertEquals(element.expanded, true);
  });

  it("should update aria-expanded when toggled", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    element.toggle();
    const topBar = element.querySelector(".top-bar");
    assertEquals(topBar.getAttribute("aria-expanded"), "true");
  });

  it("should show toggle-content when expanded", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    element.toggle();
    const content = element.querySelector(".toggle-content");
    assert(!content.hidden);
  });

  it("should display 'Hide' label when expanded", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    element.toggle();
    const label = element.querySelector(".show-hide-label");
    assertEquals(label.textContent.trim(), "Hide");
  });

  it("should toggle back to collapsed state", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    element.toggle();
    element.toggle();
    assertEquals(element.expanded, false);
    const label = element.querySelector(".show-hide-label");
    assertEquals(label.textContent.trim(), "Show");
  });
});

t.describe("ModerationWarning - click interaction", (it) => {
  it("should toggle when top-bar is clicked", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    topBar.click();
    assertEquals(element.expanded, true);
  });
});

t.describe("ModerationWarning - keyboard interaction", (it) => {
  it("should toggle when Enter is pressed on top-bar", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    const event = new window.KeyboardEvent("keydown", { key: "Enter" });
    topBar.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });

  it("should toggle when Space is pressed on top-bar", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    const event = new window.KeyboardEvent("keydown", { key: " " });
    topBar.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });
});

t.describe("ModerationWarning - accessibility", (it) => {
  it("should have tabindex on top-bar", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    assertEquals(topBar.getAttribute("tabindex"), "0");
  });

  it("should have role button on top-bar", () => {
    const element = document.createElement("moderation-warning");
    document.body.appendChild(element);
    const topBar = element.querySelector(".top-bar");
    assertEquals(topBar.getAttribute("role"), "button");
  });
});

t.describe("ModerationWarning - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("moderation-warning");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector(".toggle-content .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
