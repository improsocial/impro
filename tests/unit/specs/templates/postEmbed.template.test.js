import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postEmbedTemplate");

t.describe("postEmbedTemplate - images", (it) => {
  it("should render image embed", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        {
          thumb: "https://example.com/image.jpg",
          alt: "Test image",
        },
      ],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-images']") !== null);
  });

  it("should render multiple images", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        { thumb: "https://example.com/image1.jpg", alt: "Image 1" },
        { thumb: "https://example.com/image2.jpg", alt: "Image 2" },
      ],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const images = container.querySelectorAll(".post-image");
    assertEquals(images.length, 2);
  });

  it("should show ALT indicator when image has alt text", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [{ thumb: "https://example.com/image.jpg", alt: "Test image" }],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".alt-indicator") !== null);
  });

  it("should not show ALT indicator when image has no alt text", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [{ thumb: "https://example.com/image.jpg", alt: "" }],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".alt-indicator"), null);
  });
});

t.describe("postEmbedTemplate - external links", (it) => {
  it("should render external link embed", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com",
        title: "Example",
        description: "Test description",
        thumb: "https://example.com/thumb.jpg",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='external-link']") !== null);
  });

  it("should render external link with title", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com",
        title: "Example Title",
        description: "Test description",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
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

  it("should render external link with domain", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com/page",
        title: "Example",
        description: "Test description",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
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
});

t.describe("postEmbedTemplate - quoted posts", (it) => {
  it("should render quoted post embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".quoted-post") !== null);
  });

  it("should render blocked quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewBlocked",
        uri: "blocked-uri",
        blocked: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='blocked-quote']") !== null);
  });

  it("should render not found quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewNotFound",
        uri: "not-found-uri",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='not-found-quote']") !== null);
  });

  it("should render detached/removed quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewDetached",
        uri: "detached-uri",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='removed-quote']") !== null);
  });
});

await t.run();
