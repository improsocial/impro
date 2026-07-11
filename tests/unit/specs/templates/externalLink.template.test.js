import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { render } from "/js/lib/lit-html.js";

describe("externalLinkTemplate", () => {
  it("should render link with correct href", () => {
    const result = externalLinkTemplate({
      url: "https://example.com/page",
      title: "Example",
      description: "Test description",
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert(link.getAttribute("href").includes("example.com"));
  });

  it("should render title", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example Title",
      description: "Test description",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-title']")
        .textContent.trim(),
      "Example Title",
    );
  });

  it("should use url as title when title is not provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "",
      description: "Test description",
    });
    const container = document.createElement("div");
    render(result, container);
    const titleElement = container.querySelector(
      "[data-testid='external-link-title']",
    );
    assert(titleElement.textContent.includes("https://example.com"));
  });

  it("should render description when provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test description text",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-description']")
        .textContent.trim(),
      "Test description text",
    );
  });

  it("should not render description when not provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='external-link-description']"),
      null,
    );
  });

  it("should render domain from url", () => {
    const result = externalLinkTemplate({
      url: "https://example.com/some/path",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-domain']")
        .textContent.trim(),
      "example.com",
    );
  });

  it("should render image when provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      image: "https://example.com/image.jpg",
    });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector(".external-link-image");
    assert(img !== null);
    assert.deepEqual(img.getAttribute("src"), "https://example.com/image.jpg");
  });

  it("should not render image when not provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".external-link-image"), null);
  });

  it("should use lazy loading when lazyLoadImages is true", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      image: "https://example.com/image.jpg",
      lazyLoadImages: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector(".external-link-image");
    assert.deepEqual(img.getAttribute("loading"), "lazy");
  });

  it("should use eager loading when lazyLoadImages is false", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      image: "https://example.com/image.jpg",
      lazyLoadImages: false,
    });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector(".external-link-image");
    assert.deepEqual(img.getAttribute("loading"), "eager");
  });

  it("should open link in new tab", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert.deepEqual(link.getAttribute("target"), "_blank");
  });

  it("should not prevent navigation by default", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    const event = new Event("click", { cancelable: true, bubbles: true });
    link.dispatchEvent(event);
    assert.deepEqual(event.defaultPrevented, false);
  });

  it("should render a play icon for a video link with an image", () => {
    const result = externalLinkTemplate({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Example Video",
      description: "Test",
      image: "https://example.com/thumb.jpg",
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".play-icon") !== null);
  });

  it("should not render a play icon for a non-video link", () => {
    const result = externalLinkTemplate({
      url: "https://example.com/article",
      title: "Example",
      description: "Test",
      image: "https://example.com/image.jpg",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".play-icon"), null);
  });

  it("should render a play icon placeholder for a video link without an image", () => {
    const result = externalLinkTemplate({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Example Video",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    const placeholder = container.querySelector(
      ".external-link-video-placeholder",
    );
    assert(placeholder !== null);
    assert(placeholder.querySelector(".play-icon") !== null);
    assert.deepEqual(container.querySelector(".external-link-image"), null);
  });

  it("should not render the video placeholder for a non-video link without an image", () => {
    const result = externalLinkTemplate({
      url: "https://example.com/article",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector(".external-link-video-placeholder"),
      null,
    );
  });

  it("should call onClick and prevent navigation on a plain click", () => {
    let clicked = false;
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      onClick: () => {
        clicked = true;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    const event = new window.MouseEvent("click", {
      cancelable: true,
      bubbles: true,
    });
    link.dispatchEvent(event);
    assert.deepEqual(clicked, true);
    assert.deepEqual(event.defaultPrevented, true);
  });

  it("should not call onClick on a modified click so the link opens normally", () => {
    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      let clicked = false;
      const result = externalLinkTemplate({
        url: "https://example.com",
        title: "Example",
        description: "Test",
        onClick: () => {
          clicked = true;
        },
      });
      const container = document.createElement("div");
      render(result, container);
      const link = container.querySelector("a");
      const event = new window.MouseEvent("click", {
        cancelable: true,
        bubbles: true,
        [modifier]: true,
      });
      link.dispatchEvent(event);
      assert(clicked === false, `onClick fired on a ${modifier} click`);
      assert.deepEqual(event.defaultPrevented, false);
    }
  });

  it("should label the link with ariaLabel when provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      ariaLabel: "Play Example",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("a").getAttribute("aria-label"),
      "Play Example",
    );
  });

  it("should default the aria-label to the title", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("a").getAttribute("aria-label"),
      "Example",
    );
  });

  it("should default the aria-label to the url when there is no title", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("a").getAttribute("aria-label"),
      "https://example.com",
    );
  });

  it("should render an empty domain instead of throwing for an unparseable url", () => {
    const result = externalLinkTemplate({
      url: "not a url",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-domain']")
        .textContent.trim(),
      "",
    );
  });

  it("should prevent navigation when disableNavigation is true", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
      disableNavigation: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    const event = new Event("click", { cancelable: true, bubbles: true });
    link.dispatchEvent(event);
    assert.deepEqual(event.defaultPrevented, true);
  });
});
