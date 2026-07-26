import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/context-menu-item-group.js";

describe("context-menu-item-group", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ContextMenuItemGroup - rendering", () => {
    it("should preserve children", () => {
      const element = document.createElement("context-menu-item-group");
      element.innerHTML = "<span class='test-child'>Test</span>";
      document.body.appendChild(element);
      const child = element.querySelector(".test-child");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Test");
    });

    it("should preserve multiple children", () => {
      const element = document.createElement("context-menu-item-group");
      element.innerHTML = "<span>One</span><span>Two</span><span>Three</span>";
      document.body.appendChild(element);
      const spans = element.querySelectorAll(":scope > span");
      assert.deepEqual(spans.length, 3);
    });
  });
});
