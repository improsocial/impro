import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/context-menu-item-group.js";

describe("context-menu-item-group", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ContextMenuItemGroup - rendering", () => {
    it("should render context-menu-item-group div", () => {
      const element = document.createElement("context-menu-item-group");
      document.body.appendChild(element);
      const group = element.querySelector(".context-menu-item-group");
      assert(group !== null);
    });

    it("should preserve children in the group", () => {
      const element = document.createElement("context-menu-item-group");
      element.innerHTML = "<span class='test-child'>Test</span>";
      document.body.appendChild(element);
      const child = element.querySelector(
        ".context-menu-item-group .test-child",
      );
      assert(child !== null);
      assert.deepEqual(child.textContent, "Test");
    });

    it("should preserve multiple children", () => {
      const element = document.createElement("context-menu-item-group");
      element.innerHTML = "<span>One</span><span>Two</span><span>Three</span>";
      document.body.appendChild(element);
      const spans = element.querySelectorAll(".context-menu-item-group span");
      assert.deepEqual(spans.length, 3);
    });
  });

  describe("ContextMenuItemGroup - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("context-menu-item-group");
      element.innerHTML = "<span class='test'>Original</span>";
      document.body.appendChild(element);

      element.connectedCallback();

      const child = element.querySelector(".context-menu-item-group .test");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Original");
    });
  });
});
