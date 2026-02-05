import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/hidden-replies-section.js";

const t = new TestSuite("HiddenRepliesSection");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("HiddenRepliesSection - rendering", (it) => {
  it("should render hidden-replies-section div", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const section = element.querySelector(".hidden-replies-section");
    assert(section !== null);
  });

  it("should render hidden-replies-button", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    assert(button !== null);
  });

  it("should render toggle-content div", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content !== null);
  });

  it("should display 'Show more replies' text", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    assert(button.textContent.includes("Show more replies"));
  });

  it("should preserve children in toggle-content", () => {
    const element = document.createElement("hidden-replies-section");
    element.innerHTML = "<div class='test-child'>Hidden Reply</div>";
    document.body.appendChild(element);
    const child = element.querySelector(".toggle-content .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Hidden Reply");
  });
});

t.describe("HiddenRepliesSection - initial state", (it) => {
  it("should start with expanded set to false", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    assertEquals(element.expanded, false);
  });

  it("should have aria-expanded set to false initially", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const section = element.querySelector(".hidden-replies-section");
    assertEquals(section.getAttribute("aria-expanded"), "false");
  });

  it("should show button initially", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    assert(!button.hidden);
  });

  it("should hide toggle-content initially", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content.hidden);
  });
});

t.describe("HiddenRepliesSection - toggle", (it) => {
  it("should set expanded to true when toggle() is called", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    assertEquals(element.expanded, true);
  });

  it("should update aria-expanded when toggled", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    const section = element.querySelector(".hidden-replies-section");
    assertEquals(section.getAttribute("aria-expanded"), "true");
  });

  it("should show toggle-content when expanded", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    const content = element.querySelector(".toggle-content");
    assert(!content.hidden);
  });

  it("should hide button when expanded", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    const button = element.querySelector(".hidden-replies-button");
    assert(button.hidden);
  });

  it("should add expanded class when expanded", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    const section = element.querySelector(".hidden-replies-section");
    assert(section.classList.contains("expanded"));
  });

  it("should toggle back to collapsed state", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    element.toggle();
    element.toggle();
    assertEquals(element.expanded, false);
  });
});

t.describe("HiddenRepliesSection - click interaction", (it) => {
  it("should toggle when button is clicked", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    button.click();
    assertEquals(element.expanded, true);
  });
});

t.describe("HiddenRepliesSection - keyboard interaction", (it) => {
  it("should toggle when Enter is pressed on button", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    const event = new window.KeyboardEvent("keydown", { key: "Enter" });
    button.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });

  it("should toggle when Space is pressed on button", () => {
    const element = document.createElement("hidden-replies-section");
    document.body.appendChild(element);
    const button = element.querySelector(".hidden-replies-button");
    const event = new window.KeyboardEvent("keydown", { key: " " });
    button.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });
});

t.describe("HiddenRepliesSection - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("hidden-replies-section");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector(".toggle-content .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
