import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { render, html } from "/js/lib/lit-html.js";

const t = new TestSuite("headerTemplate");

t.describe("headerTemplate", (it) => {
  it("should render children content", () => {
    const result = headerTemplate({
      children: html`<span class="test-child">Test Content</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const child = container.querySelector(".test-child");
    assert(child !== null);
    assertEquals(child.textContent, "Test Content");
  });
});

t.describe("headerTemplate - left button", (it) => {
  it("should render back button by default", () => {
    const result = headerTemplate({
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='back-button']") !== null);
  });

  it("should render back button when leftButton is 'back'", () => {
    const result = headerTemplate({
      leftButton: "back",
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='back-button']") !== null);
    assertEquals(container.querySelector("[data-testid='menu-button']"), null);
  });

  it("should render menu button when leftButton is 'menu'", () => {
    const result = headerTemplate({
      leftButton: "menu",
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='menu-button']") !== null);
    assertEquals(container.querySelector("[data-testid='back-button']"), null);
  });

  it("should call onClickMenuButton when menu button is clicked", () => {
    let clicked = false;
    const result = headerTemplate({
      leftButton: "menu",
      onClickMenuButton: () => {
        clicked = true;
      },
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='menu-button']").click();
    assert(clicked);
  });
});

t.describe("headerTemplate - loading spinner", (it) => {
  it("should not render loading spinner by default", () => {
    const result = headerTemplate({
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='loading-spinner']"),
      null,
    );
  });

  it("should render loading spinner when showLoadingSpinner is true", () => {
    const result = headerTemplate({
      showLoadingSpinner: true,
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='loading-spinner']") !== null);
  });
});

t.describe("headerTemplate - right item", (it) => {
  it("should render right item when rightItemTemplate is provided", () => {
    const result = headerTemplate({
      rightItemTemplate: () => html`<button class="right-item">Action</button>`,
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const rightItem = container.querySelector(".right-item");
    assert(rightItem !== null);
    assertEquals(rightItem.textContent, "Action");
  });
});

t.describe("headerTemplate - custom className", (it) => {
  it("should apply custom className", () => {
    const result = headerTemplate({
      className: "custom-header",
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".custom-header") !== null);
  });

  it("should keep header class with custom className", () => {
    const result = headerTemplate({
      className: "custom-header",
      children: html`<span>Title</span>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const header = container.querySelector("[data-testid='header']");
    assert(header.classList.contains("header"));
  });
});

await t.run();
