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
    const blockedQuote = container.querySelector(
      "[data-testid='blocked-quote']",
    );
    assert(blockedQuote !== null);
    assert(blockedQuote.querySelector(".info-icon") !== null);
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
    const notFoundQuote = container.querySelector(
      "[data-testid='not-found-quote']",
    );
    assert(notFoundQuote !== null);
    assert(notFoundQuote.querySelector(".info-icon") !== null);
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
    const removedQuote = container.querySelector(
      "[data-testid='removed-quote']",
    );
    assert(removedQuote !== null);
    assert(removedQuote.querySelector(".info-icon") !== null);
  });

  it("should use closed-eye icon-style for a muted-account quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: { ...post.author, viewer: { muted: true } },
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
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assertEquals(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should use closed-eye icon-style for a muted-word quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        hasMutedWord: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assertEquals(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should use info icon-style for a content-labeled quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        contentLabel: {
          visibility: "blur",
          label: { uri: "did:plc:other", val: "nsfw" },
          labelDefinition: {
            identifier: "nsfw",
            blurs: "content",
            severity: "alert",
            locales: [
              { lang: "en", name: "NSFW", description: "Adult content" },
            ],
          },
        },
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assertEquals(warning.getAttribute("icon-style"), "info");
  });

  it("should truncate long URLs in quoted post text", () => {
    const url = "https://example.com/very/long/path/to/some/page";
    const text = "See " + url;
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: {
          ...post.record,
          text,
          facets: [
            {
              index: { byteStart: 4, byteEnd: 4 + url.length },
              features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
            },
          ],
        },
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
    const link = container.querySelector(".quoted-post a[href='" + url + "']");
    assert(link !== null);
    assert(link.textContent.endsWith("..."));
    assert(link.textContent.length < url.length);
  });
});

await t.run();
