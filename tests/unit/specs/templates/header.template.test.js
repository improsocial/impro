import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { headerTemplate } from "/js/templates/header.template.js";
import { render, html } from "/js/lib/lit-html.js";

describe("headerTemplate", () => {
  it("should render header element", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='header']") !== null);
  });

  it("should render title", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    const title = container.querySelector("[data-testid='header-title']");
    assert(title !== null);
    assert.deepEqual(title.textContent, "Test Title");
  });
});

describe("headerTemplate - subtitle", () => {
  it("should render subtitle when provided", () => {
    const result = headerTemplate({
      title: "Test Title",
      subtitle: "Test Subtitle",
    });
    const container = document.createElement("div");
    render(result, container);
    const subtitle = container.querySelector("[data-testid='header-subtitle']");
    assert(subtitle !== null);
    assert.deepEqual(subtitle.textContent, "Test Subtitle");
  });

  it("should not render subtitle when not provided", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='header-subtitle']"),
      null,
    );
  });
});

describe("headerTemplate - avatar", () => {
  it("should render avatar when avatarTemplate is provided", () => {
    const result = headerTemplate({
      title: "Test Title",
      avatarTemplate: () => html`<div class="test-avatar">Avatar</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".test-avatar") !== null);
  });

  it("should not render avatar when avatarTemplate is not provided", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".test-avatar"), null);
  });
});

describe("headerTemplate - left button", () => {
  it("should render back button by default", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='back-button']") !== null);
  });

  it("should render menu button when leftButton is 'menu'", () => {
    const result = headerTemplate({
      title: "Test Title",
      leftButton: "menu",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='menu-button']") !== null);
    assert.deepEqual(
      container.querySelector("[data-testid='back-button']"),
      null,
    );
  });

  it("should call onClickMenuButton when menu button is clicked", () => {
    let clicked = false;
    const result = headerTemplate({
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

describe("headerTemplate - loading spinner", () => {
  it("should not render loading spinner by default", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='loading-spinner']"),
      null,
    );
  });

  it("should render loading spinner when showLoadingSpinner is true", () => {
    const result = headerTemplate({
      title: "Test Title",
      showLoadingSpinner: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='loading-spinner']") !== null);
  });
});

describe("headerTemplate - right item", () => {
  it("should render right item when rightItemTemplate is provided", () => {
    const result = headerTemplate({
      title: "Test Title",
      rightItemTemplate: () =>
        html`<button class="right-action">Action</button>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const rightItem = container.querySelector(".right-action");
    assert(rightItem !== null);
    assert.deepEqual(rightItem.textContent, "Action");
  });

  it("should not render right item by default", () => {
    const result = headerTemplate({
      title: "Test Title",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".right-action"), null);
  });
});
