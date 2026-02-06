import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Component, getChildrenFragment } from "/js/components/component.js";

const t = new TestSuite("Component");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("Component - register", (it) => {
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

t.describe("getChildrenFragment", (it) => {
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
    assertEquals(fragment.childNodes.length, 2);
    assertEquals(div.childNodes.length, 0);
  });

  it("should preserve child content", () => {
    const div = document.createElement("div");
    div.innerHTML = "<span class='test'>content</span>";
    const fragment = getChildrenFragment(div);
    const span = fragment.querySelector(".test");
    assert(span !== null);
    assertEquals(span.textContent, "content");
  });

  it("should handle text nodes", () => {
    const div = document.createElement("div");
    div.textContent = "plain text";
    const fragment = getChildrenFragment(div);
    assertEquals(fragment.textContent, "plain text");
  });

  it("should handle empty nodes", () => {
    const div = document.createElement("div");
    const fragment = getChildrenFragment(div);
    assertEquals(fragment.childNodes.length, 0);
  });
});

await t.run();
