import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/moderation-warning.js";

describe("moderation-warning", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ModerationWarning - rendering", () => {
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
      assert.deepEqual(label.textContent.trim(), "Show");
    });

    it("should preserve children in toggle-content", () => {
      const element = document.createElement("moderation-warning");
      element.innerHTML = "<div class='test-child'>Hidden content</div>";
      document.body.appendChild(element);
      const child = element.querySelector(".toggle-content .test-child");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Hidden content");
    });
  });

  describe("ModerationWarning - labeler info", () => {
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
      assert.deepEqual(link.textContent, "Bluesky");
      assert.deepEqual(
        link.href,
        "https://bsky.app/profile/moderation.bsky.app",
      );
    });

    it("should not render link if only name is provided", () => {
      const element = document.createElement("moderation-warning");
      element.setAttribute("labelerName", "Test Labeler");
      document.body.appendChild(element);
      const link = element.querySelector(
        ".post-moderation-warning-description a",
      );
      assert.deepEqual(link, null);
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

  describe("ModerationWarning - initial state", () => {
    it("should start with expanded set to false", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      assert.deepEqual(element.expanded, false);
    });

    it("should have aria-expanded set to false initially", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      assert.deepEqual(topBar.getAttribute("aria-expanded"), "false");
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
      assert.deepEqual(label.textContent.trim(), "Show");
    });
  });

  describe("ModerationWarning - toggle", () => {
    it("should set expanded to true when toggle() is called", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      element.toggle();
      assert.deepEqual(element.expanded, true);
    });

    it("should update aria-expanded when toggled", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      element.toggle();
      const topBar = element.querySelector(".top-bar");
      assert.deepEqual(topBar.getAttribute("aria-expanded"), "true");
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
      assert.deepEqual(label.textContent.trim(), "Hide");
    });

    it("should toggle back to collapsed state", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      element.toggle();
      element.toggle();
      assert.deepEqual(element.expanded, false);
      const label = element.querySelector(".show-hide-label");
      assert.deepEqual(label.textContent.trim(), "Show");
    });
  });

  describe("ModerationWarning - click interaction", () => {
    it("should toggle when top-bar is clicked", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      topBar.click();
      assert.deepEqual(element.expanded, true);
    });
  });

  describe("ModerationWarning - keyboard interaction", () => {
    it("should toggle when Enter is pressed on top-bar", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      const event = new window.KeyboardEvent("keydown", { key: "Enter" });
      topBar.dispatchEvent(event);
      assert.deepEqual(element.expanded, true);
    });

    it("should toggle when Space is pressed on top-bar", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      const event = new window.KeyboardEvent("keydown", { key: " " });
      topBar.dispatchEvent(event);
      assert.deepEqual(element.expanded, true);
    });
  });

  describe("ModerationWarning - accessibility", () => {
    it("should have tabindex on top-bar", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      assert.deepEqual(topBar.getAttribute("tabindex"), "0");
    });

    it("should have role button on top-bar", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      const topBar = element.querySelector(".top-bar");
      assert.deepEqual(topBar.getAttribute("role"), "button");
    });
  });

  describe("ModerationWarning - icon style", () => {
    it("should render info icon by default", () => {
      const element = document.createElement("moderation-warning");
      document.body.appendChild(element);
      assert(element.querySelector(".info-icon") !== null);
      assert.deepEqual(element.querySelector(".eye-slash-icon"), null);
    });

    it("should render info icon when icon-style is 'info'", () => {
      const element = document.createElement("moderation-warning");
      element.setAttribute("icon-style", "info");
      document.body.appendChild(element);
      assert(element.querySelector(".info-icon") !== null);
      assert.deepEqual(element.querySelector(".eye-slash-icon"), null);
    });

    it("should render eye-slash icon when icon-style is 'closed-eye'", () => {
      const element = document.createElement("moderation-warning");
      element.setAttribute("icon-style", "closed-eye");
      document.body.appendChild(element);
      assert(element.querySelector(".eye-slash-icon") !== null);
      assert.deepEqual(element.querySelector(".info-icon"), null);
    });

    it("should render icon inside the top-bar label", () => {
      const element = document.createElement("moderation-warning");
      element.setAttribute("label", "Hidden");
      document.body.appendChild(element);
      const labelEl = element.querySelector(
        ".top-bar .moderation-warning-label",
      );
      assert(labelEl !== null);
      assert(labelEl.querySelector(".icon") !== null);
      assert(labelEl.textContent.includes("Hidden"));
    });
  });

  describe("ModerationWarning - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("moderation-warning");
      element.innerHTML = "<span class='test'>Original</span>";
      document.body.appendChild(element);

      element.connectedCallback();

      const child = element.querySelector(".toggle-content .test");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Original");
    });
  });
});
