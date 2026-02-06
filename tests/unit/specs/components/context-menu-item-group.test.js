import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/context-menu-item-group.js";

const t = new TestSuite("ContextMenuItemGroup");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ContextMenuItemGroup - rendering", (it) => {
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
    const child = element.querySelector(".context-menu-item-group .test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Test");
  });

  it("should preserve multiple children", () => {
    const element = document.createElement("context-menu-item-group");
    element.innerHTML = "<span>One</span><span>Two</span><span>Three</span>";
    document.body.appendChild(element);
    const spans = element.querySelectorAll(".context-menu-item-group span");
    assertEquals(spans.length, 3);
  });
});

t.describe("ContextMenuItemGroup - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("context-menu-item-group");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector(".context-menu-item-group .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
