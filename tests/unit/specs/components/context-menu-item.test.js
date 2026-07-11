import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/context-menu-item.js";

describe("context-menu-item", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ContextMenuItem - rendering", () => {
    it("should render context-menu-item div", () => {
      const element = document.createElement("context-menu-item");
      document.body.appendChild(element);
      const item = element.querySelector(".context-menu-item");
      assert(item !== null);
    });

    it("should render a button inside the item", () => {
      const element = document.createElement("context-menu-item");
      document.body.appendChild(element);
      const button = element.querySelector(".context-menu-item button");
      assert(button !== null);
    });

    it("should preserve children inside the button", () => {
      const element = document.createElement("context-menu-item");
      element.innerHTML = "<span class='test-child'>Click me</span>";
      document.body.appendChild(element);
      const child = element.querySelector("button .test-child");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Click me");
    });
  });

  describe("ContextMenuItem - disabled state", () => {
    it("should not be disabled by default", () => {
      const element = document.createElement("context-menu-item");
      document.body.appendChild(element);
      assert.deepEqual(element.disabled, false);
    });

    it("should be disabled when disabled attribute is set", () => {
      const element = document.createElement("context-menu-item");
      element.setAttribute("disabled", "");
      document.body.appendChild(element);
      assert.deepEqual(element.disabled, true);
    });

    it("should disable the button when disabled", () => {
      const element = document.createElement("context-menu-item");
      element.setAttribute("disabled", "");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button.disabled);
    });

    it("should update disabled state when attribute changes", () => {
      const element = document.createElement("context-menu-item");
      document.body.appendChild(element);
      assert.deepEqual(element.disabled, false);

      element.setAttribute("disabled", "");
      assert.deepEqual(element.disabled, true);

      element.removeAttribute("disabled");
      assert.deepEqual(element.disabled, false);
    });

    it("should update button disabled state when attribute changes", () => {
      const element = document.createElement("context-menu-item");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(!button.disabled);

      element.setAttribute("disabled", "");
      assert(button.disabled);
    });
  });

  describe("ContextMenuItem - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("context-menu-item");
      element.innerHTML = "<span class='test'>Original</span>";
      document.body.appendChild(element);

      element.connectedCallback();

      const child = element.querySelector("button .test");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Original");
    });
  });
});
