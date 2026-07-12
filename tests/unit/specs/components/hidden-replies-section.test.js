import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/hidden-replies-section.js";

describe("hidden-replies-section", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("HiddenRepliesSection - rendering", () => {
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
      assert.deepEqual(child.textContent, "Hidden Reply");
    });
  });

  describe("HiddenRepliesSection - initial state", () => {
    it("should start with expanded set to false", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      assert.deepEqual(element.expanded, false);
    });

    it("should have aria-expanded set to false initially", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      const section = element.querySelector(".hidden-replies-section");
      assert.deepEqual(section.getAttribute("aria-expanded"), "false");
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

  describe("HiddenRepliesSection - toggle", () => {
    it("should set expanded to true when toggle() is called", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      element.toggle();
      assert.deepEqual(element.expanded, true);
    });

    it("should update aria-expanded when toggled", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      element.toggle();
      const section = element.querySelector(".hidden-replies-section");
      assert.deepEqual(section.getAttribute("aria-expanded"), "true");
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
      assert.deepEqual(element.expanded, false);
    });
  });

  describe("HiddenRepliesSection - click interaction", () => {
    it("should toggle when button is clicked", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      const button = element.querySelector(".hidden-replies-button");
      button.click();
      assert.deepEqual(element.expanded, true);
    });
  });

  describe("HiddenRepliesSection - keyboard interaction", () => {
    it("should toggle when Enter is pressed on button", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      const button = element.querySelector(".hidden-replies-button");
      const event = new window.KeyboardEvent("keydown", { key: "Enter" });
      button.dispatchEvent(event);
      assert.deepEqual(element.expanded, true);
    });

    it("should toggle when Space is pressed on button", () => {
      const element = document.createElement("hidden-replies-section");
      document.body.appendChild(element);
      const button = element.querySelector(".hidden-replies-button");
      const event = new window.KeyboardEvent("keydown", { key: " " });
      button.dispatchEvent(event);
      assert.deepEqual(element.expanded, true);
    });
  });

  describe("HiddenRepliesSection - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("hidden-replies-section");
      element.innerHTML = "<span class='test'>Original</span>";
      document.body.appendChild(element);

      element.connectedCallback();

      const child = element.querySelector(".toggle-content .test");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Original");
    });
  });
});
