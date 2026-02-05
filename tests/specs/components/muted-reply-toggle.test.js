import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/muted-reply-toggle.js";

const t = new TestSuite("MutedReplyToggle");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("MutedReplyToggle - rendering", (it) => {
  it("should render muted-reply-toggle div", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const toggle = element.querySelector(".muted-reply-toggle");
    assert(toggle !== null);
  });

  it("should render muted-reply-toggle-button", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assert(button !== null);
  });

  it("should render toggle-content div", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content !== null);
  });

  it("should display default label 'Muted reply'", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assert(button.textContent.includes("Muted reply"));
  });

  it("should display custom label when provided", () => {
    const element = document.createElement("muted-reply-toggle");
    element.setAttribute("label", "Hidden by mute list");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assert(button.textContent.includes("Hidden by mute list"));
  });

  it("should display 'Show' text", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const showMore = element.querySelector(".muted-account-show-more");
    assert(showMore !== null);
    assertEquals(showMore.textContent, "Show");
  });

  it("should preserve children in toggle-content", () => {
    const element = document.createElement("muted-reply-toggle");
    element.innerHTML = "<div class='test-child'>Muted Reply Content</div>";
    document.body.appendChild(element);
    const child = element.querySelector(".toggle-content .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Muted Reply Content");
  });

  it("should render icon", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const icon = element.querySelector(".muted-reply-toggle-button-icon");
    assert(icon !== null);
  });
});

t.describe("MutedReplyToggle - initial state", (it) => {
  it("should start with expanded set to false", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    assertEquals(element.expanded, false);
  });

  it("should have aria-expanded set to false initially", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const toggle = element.querySelector(".muted-reply-toggle");
    assertEquals(toggle.getAttribute("aria-expanded"), "false");
  });

  it("should show button initially", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assert(!button.hidden);
  });

  it("should hide toggle-content initially", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const content = element.querySelector(".toggle-content");
    assert(content.hidden);
  });

  it("should not have expanded class initially", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const toggle = element.querySelector(".muted-reply-toggle");
    assert(!toggle.classList.contains("expanded"));
  });
});

t.describe("MutedReplyToggle - toggle", (it) => {
  it("should set expanded to true when toggle() is called", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    assertEquals(element.expanded, true);
  });

  it("should update aria-expanded when toggled", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    const toggle = element.querySelector(".muted-reply-toggle");
    assertEquals(toggle.getAttribute("aria-expanded"), "true");
  });

  it("should show toggle-content when expanded", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    const content = element.querySelector(".toggle-content");
    assert(!content.hidden);
  });

  it("should hide button when expanded", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    const button = element.querySelector(".muted-reply-toggle-button");
    assert(button.hidden);
  });

  it("should add expanded class when expanded", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    const toggle = element.querySelector(".muted-reply-toggle");
    assert(toggle.classList.contains("expanded"));
  });

  it("should toggle back to collapsed state", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    element.toggle();
    element.toggle();
    assertEquals(element.expanded, false);
  });
});

t.describe("MutedReplyToggle - click interaction", (it) => {
  it("should toggle when button is clicked", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    button.click();
    assertEquals(element.expanded, true);
  });
});

t.describe("MutedReplyToggle - keyboard interaction", (it) => {
  it("should toggle when Enter is pressed on button", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    const event = new window.KeyboardEvent("keydown", { key: "Enter" });
    button.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });

  it("should toggle when Space is pressed on button", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    const event = new window.KeyboardEvent("keydown", { key: " " });
    button.dispatchEvent(event);
    assertEquals(element.expanded, true);
  });
});

t.describe("MutedReplyToggle - accessibility", (it) => {
  it("should have tabindex on button", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assertEquals(button.getAttribute("tabindex"), "0");
  });

  it("should have role button", () => {
    const element = document.createElement("muted-reply-toggle");
    document.body.appendChild(element);
    const button = element.querySelector(".muted-reply-toggle-button");
    assertEquals(button.getAttribute("role"), "button");
  });
});

t.describe("MutedReplyToggle - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("muted-reply-toggle");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector(".toggle-content .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
