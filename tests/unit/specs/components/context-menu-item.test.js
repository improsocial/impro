import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/context-menu-item.js";

const t = new TestSuite("ContextMenuItem");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ContextMenuItem - rendering", (it) => {
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
    assertEquals(child.textContent, "Click me");
  });
});

t.describe("ContextMenuItem - disabled state", (it) => {
  it("should not be disabled by default", () => {
    const element = document.createElement("context-menu-item");
    document.body.appendChild(element);
    assertEquals(element.disabled, false);
  });

  it("should be disabled when disabled attribute is set", () => {
    const element = document.createElement("context-menu-item");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    assertEquals(element.disabled, true);
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
    assertEquals(element.disabled, false);

    element.setAttribute("disabled", "");
    assertEquals(element.disabled, true);

    element.removeAttribute("disabled");
    assertEquals(element.disabled, false);
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

t.describe("ContextMenuItem - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("context-menu-item");
    element.innerHTML = "<span class='test'>Original</span>";
    document.body.appendChild(element);

    element.connectedCallback();

    const child = element.querySelector("button .test");
    assert(child !== null);
    assertEquals(child.textContent, "Original");
  });
});

await t.run();
