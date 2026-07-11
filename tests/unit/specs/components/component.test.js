import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Component, getChildrenFragment } from "/js/components/component.js";

describe("component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("Component - register", () => {
    it("should convert PascalCase class name to kebab-case tag name", () => {
      class TestPascalCase extends Component {}
      TestPascalCase.register();
      const element = document.createElement("test-pascal-case");
      assert(element instanceof TestPascalCase);
    });

    it("should handle multiple uppercase letters", () => {
      class MyTestComponent extends Component {}
      MyTestComponent.register();
      const element = document.createElement("my-test-component");
      assert(element instanceof MyTestComponent);
    });
  });

  describe("getChildrenFragment", () => {
    it("should return a DocumentFragment", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span>test</span>";
      const fragment = getChildrenFragment(div);
      assert(fragment instanceof DocumentFragment);
    });

    it("should move all children to the fragment", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span>one</span><span>two</span>";
      const fragment = getChildrenFragment(div);
      assert.deepEqual(fragment.childNodes.length, 2);
      assert.deepEqual(div.childNodes.length, 0);
    });

    it("should preserve child content", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span class='test'>content</span>";
      const fragment = getChildrenFragment(div);
      const span = fragment.querySelector(".test");
      assert(span !== null);
      assert.deepEqual(span.textContent, "content");
    });

    it("should handle text nodes", () => {
      const div = document.createElement("div");
      div.textContent = "plain text";
      const fragment = getChildrenFragment(div);
      assert.deepEqual(fragment.textContent, "plain text");
    });

    it("should handle empty nodes", () => {
      const div = document.createElement("div");
      const fragment = getChildrenFragment(div);
      assert.deepEqual(fragment.childNodes.length, 0);
    });
  });
});
