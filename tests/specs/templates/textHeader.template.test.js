import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { render, html } from "/js/lib/lit-html.js";

const t = new TestSuite("textHeaderTemplate");

t.describe("textHeaderTemplate", (it) => {
  it("should render header element", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='header']") !== null);
  });

  it("should render title", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    const title = container.querySelector("[data-testid='header-title']");
    assert(title !== null);
    assertEquals(title.textContent, "Test Title");
  });
});

t.describe("textHeaderTemplate - subtitle", (it) => {
  it("should render subtitle when provided", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
      subtitle: "Test Subtitle",
    });
    const container = document.createElement("div");
    render(result, container);
    const subtitle = container.querySelector("[data-testid='header-subtitle']");
    assert(subtitle !== null);
    assertEquals(subtitle.textContent, "Test Subtitle");
  });

  it("should not render subtitle when not provided", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='header-subtitle']"),
      null,
    );
  });
});

t.describe("textHeaderTemplate - avatar", (it) => {
  it("should render avatar when avatarTemplate is provided", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
      avatarTemplate: () => html`<div class="test-avatar">Avatar</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".test-avatar") !== null);
  });

  it("should not render avatar when avatarTemplate is not provided", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".test-avatar"), null);
  });
});

t.describe("textHeaderTemplate - left button", (it) => {
  it("should render back button by default", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='back-button']") !== null);
  });

  it("should render menu button when leftButton is 'menu'", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
      leftButton: "menu",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='menu-button']") !== null);
    assertEquals(container.querySelector("[data-testid='back-button']"), null);
  });

  it("should call onClickMenuButton when menu button is clicked", () => {
    let clicked = false;
    const result = textHeaderTemplate({
      title: "Test Title",
      leftButton: "menu",
      onClickMenuButton: () => {
        clicked = true;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='menu-button']").click();
    assert(clicked);
  });
});

t.describe("textHeaderTemplate - loading spinner", (it) => {
  it("should not render loading spinner by default", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='loading-spinner']"),
      null,
    );
  });

  it("should render loading spinner when showLoadingSpinner is true", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
      showLoadingSpinner: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='loading-spinner']") !== null);
  });
});

t.describe("textHeaderTemplate - right item", (it) => {
  it("should render right item when rightItemTemplate is provided", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
      rightItemTemplate: () =>
        html`<button class="right-action">Action</button>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const rightItem = container.querySelector(".right-action");
    assert(rightItem !== null);
    assertEquals(rightItem.textContent, "Action");
  });

  it("should not render right item by default", () => {
    const result = textHeaderTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".right-action"), null);
  });
});

await t.run();
