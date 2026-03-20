import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals, mock } from "../../testHelpers.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("tabBarTemplate");

const tabs = [
  { value: "one", label: "One" },
  { value: "two", label: "Two" },
  { value: "three", label: "Three" },
];

function renderTemplate(props) {
  const container = document.createElement("div");
  render(tabBarTemplate(props), container);
  return container;
}

t.describe("rendering", (it) => {
  it("should render a tab-bar container", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick: () => {},
    });
    assert(container.querySelector(".tab-bar") !== null);
  });

  it("should render a button for each tab", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick: () => {},
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    assertEquals(buttons.length, 3);
  });

  it("should render tab labels", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick: () => {},
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    assertEquals(buttons[0].textContent.trim(), "One");
    assertEquals(buttons[1].textContent.trim(), "Two");
    assertEquals(buttons[2].textContent.trim(), "Three");
  });

  it("should render no buttons when tabs is empty", () => {
    const container = renderTemplate({
      tabs: [],
      activeTab: null,
      onTabClick: () => {},
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    assertEquals(buttons.length, 0);
  });
});

t.describe("active state", (it) => {
  it("should mark the active tab with the active class", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "two",
      onTabClick: () => {},
    });
    const activeButtons = container.querySelectorAll(".tab-bar-button.active");
    assertEquals(activeButtons.length, 1);
    assertEquals(activeButtons[0].textContent.trim(), "Two");
  });

  it("should not mark inactive tabs as active", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick: () => {},
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    assert(!buttons[1].classList.contains("active"));
    assert(!buttons[2].classList.contains("active"));
  });

  it("should have no active tab when activeTab matches nothing", () => {
    const container = renderTemplate({
      tabs,
      activeTab: "nonexistent",
      onTabClick: () => {},
    });
    const activeButtons = container.querySelectorAll(".tab-bar-button.active");
    assertEquals(activeButtons.length, 0);
  });
});

t.describe("interaction", (it) => {
  it("should call onTabClick with the tab value when clicked", () => {
    const onTabClick = mock();
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick,
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    buttons[1].click();
    assertEquals(onTabClick.calls.length, 1);
    assertEquals(onTabClick.calls[0][0], "two");
  });

  it("should call onTabClick with the correct value for each button", () => {
    const onTabClick = mock();
    const container = renderTemplate({
      tabs,
      activeTab: "one",
      onTabClick,
    });
    const buttons = container.querySelectorAll(".tab-bar-button");
    buttons[0].click();
    buttons[2].click();
    assertEquals(onTabClick.calls[0][0], "one");
    assertEquals(onTabClick.calls[1][0], "three");
  });
});

await t.run();
