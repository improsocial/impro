import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("externalLinkTemplate");

t.describe("externalLinkTemplate", (it) => {
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
    assertEquals(
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
    assertEquals(
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
    assertEquals(
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
    assertEquals(
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
    assertEquals(img.getAttribute("src"), "https://example.com/image.jpg");
  });

  it("should not render image when not provided", () => {
    const result = externalLinkTemplate({
      url: "https://example.com",
      title: "Example",
      description: "Test",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".external-link-image"), null);
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
    assertEquals(img.getAttribute("loading"), "lazy");
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
    assertEquals(img.getAttribute("loading"), "eager");
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
    assertEquals(link.getAttribute("target"), "_blank");
  });
});

await t.run();
