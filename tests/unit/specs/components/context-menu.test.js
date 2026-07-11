import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock MutationObserver before importing the component
let mutationCallbacks = [];
globalThis.MutationObserver = class {
  constructor(callback) {
    this._callback = callback;
    this._connected = false;
    mutationCallbacks.push(this);
  }
  observe() {
    this._connected = true;
  }
  disconnect() {
    this._connected = false;
  }
  _trigger() {
    if (this._connected) {
      this._callback();
    }
  }
};

await import("/js/components/context-menu.js");

describe("context-menu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mutationCallbacks = [];
  });

  function connectElement(element) {
    const container = document.createElement("div");
    container.className = "page-visible";
    container.appendChild(element);
    document.body.appendChild(container);
  }

  describe("ContextMenu - rendering", () => {
    it("should render context-menu-container", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      const container = element.querySelector(".context-menu-container");
      assert(container !== null);
    });

    it("should render dialog element", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      const dialog = element.querySelector(".context-menu");
      assert(dialog !== null);
      assert.deepEqual(dialog.tagName, "DIALOG");
    });

    it("should preserve children in the dialog", () => {
      const element = document.createElement("context-menu");
      element.innerHTML = "<span class='test-child'>Menu Item</span>";
      connectElement(element);
      const child = element.querySelector(".context-menu .test-child");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Menu Item");
    });
  });

  describe("ContextMenu - initial state", () => {
    it("should start with isOpen set to false", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      assert.deepEqual(element.isOpen, false);
    });

    it("should not have open class on container initially", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      const container = element.querySelector(".context-menu-container");
      assert(!container.classList.contains("open"));
    });
  });

  describe("ContextMenu - open method", () => {
    it("should set isOpen to true when open() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      assert.deepEqual(element.isOpen, true);
    });

    it("should add open class to container when open() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      const container = element.querySelector(".context-menu-container");
      assert(container.classList.contains("open"));
    });

    it("should show the dialog when open() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      const dialog = element.querySelector(".context-menu");
      assert(dialog.open);
    });
  });

  describe("ContextMenu - close method", () => {
    it("should set isOpen to false when close() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      element.close();
      assert.deepEqual(element.isOpen, false);
    });

    it("should remove open class from container when close() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      element.close();
      const container = element.querySelector(".context-menu-container");
      assert(!container.classList.contains("open"));
    });

    it("should close the dialog when close() is called", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      element.close();
      const dialog = element.querySelector(".context-menu");
      assert(!dialog.open);
    });
  });

  describe("ContextMenu - container click", () => {
    it("should close menu when container is clicked", () => {
      const element = document.createElement("context-menu");
      connectElement(element);
      element.open(100, 100);
      const container = element.querySelector(".context-menu-container");
      container.click();
      assert.deepEqual(element.isOpen, false);
    });
  });

  describe("ContextMenu - child updates", () => {
    it("should update dialog contents when children change", () => {
      const element = document.createElement("context-menu");
      element.innerHTML = "<span class='item-a'>Item A</span>";
      connectElement(element);
      const observer = mutationCallbacks[mutationCallbacks.length - 1];

      const itemA = element.querySelector(".context-menu .item-a");
      assert(itemA !== null, "Initial child should be in dialog");

      const newChild = document.createElement("span");
      newChild.className = "item-b";
      newChild.textContent = "Item B";
      element.appendChild(newChild);
      observer._trigger();

      const itemB = element.querySelector(".context-menu .item-b");
      assert(itemB !== null, "New child should be moved into dialog");
      assert.deepEqual(itemB.textContent, "Item B");
    });

    it("should include all children when full set is provided", () => {
      const element = document.createElement("context-menu");
      element.innerHTML = "<span class='original'>Original</span>";
      connectElement(element);
      const observer = mutationCallbacks[mutationCallbacks.length - 1];

      // Simulate lit-html re-rendering all children (old + new)
      const original = document.createElement("span");
      original.className = "original";
      original.textContent = "Original";
      const added = document.createElement("span");
      added.className = "added";
      added.textContent = "Added";
      element.appendChild(original);
      element.appendChild(added);
      observer._trigger();

      const items = element.querySelectorAll(".context-menu span");
      assert.deepEqual(items.length, 2);
      assert.deepEqual(items[0].textContent, "Original");
      assert.deepEqual(items[1].textContent, "Added");
    });

    it("should replace dialog contents when children are replaced", () => {
      const element = document.createElement("context-menu");
      element.innerHTML =
        "<span class='keep'>Keep</span><span class='remove'>Remove</span>";
      connectElement(element);
      const observer = mutationCallbacks[mutationCallbacks.length - 1];

      const dialog = element.querySelector(".context-menu");
      assert.deepEqual(dialog.querySelectorAll("span").length, 2);

      const replacement = document.createElement("span");
      replacement.className = "only";
      replacement.textContent = "Only";
      element.appendChild(replacement);
      observer._trigger();

      const spans = dialog.querySelectorAll("span");
      assert.deepEqual(spans.length, 1);
      assert.deepEqual(spans[0].textContent, "Only");
    });
  });

  describe("ContextMenu - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("context-menu");
      element.innerHTML = "<span class='test'>Original</span>";
      connectElement(element);

      element.connectedCallback();

      const child = element.querySelector(".context-menu .test");
      assert(child !== null);
      assert.deepEqual(child.textContent, "Original");
    });
  });
});
