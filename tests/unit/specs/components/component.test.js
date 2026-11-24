import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Component, getChildrenFragment } from "/js/components/component.js";

describe("component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("Component - register", () => {
    it("should define the element under its static tagName", () => {
      class RenamedByMinifier extends Component {
        static tagName = "test-explicit-tag";
      }
      RenamedByMinifier.register();
      const element = document.createElement("test-explicit-tag");
      assert(element instanceof RenamedByMinifier);
    });

    it("should throw when tagName is missing", (t) => {
      t.mock.method(console, "error", () => {});
      class MissingTagName extends Component {}
      assert.throws(() => MissingTagName.register());
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
