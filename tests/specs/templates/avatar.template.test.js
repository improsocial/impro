import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("avatarTemplate");

t.describe("avatarTemplate", (it) => {
  it("should render avatar container", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render avatar image with author info", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img !== null);
    assert(img.getAttribute("src").includes(post.author.did));
  });

  it("should render fallback avatar when no avatar URL", () => {
    const author = { ...post.author, avatar: null };
    const result = avatarTemplate({ author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img !== null);
    assert(img.getAttribute("src").includes("avatar-fallback.svg"));
  });

  it("should render as link by default", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a.avatar-link");
    assert(link !== null);
  });

  it("should render as lightbox when clickAction is lightbox", () => {
    const result = avatarTemplate({
      author: post.author,
      clickAction: "lightbox",
    });
    const container = document.createElement("div");
    render(result, container);
    const lightbox = container.querySelector("lightbox-image-group");
    assert(lightbox !== null);
  });

  it("should render without wrapper when clickAction is none", () => {
    const result = avatarTemplate({
      author: post.author,
      clickAction: "none",
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("a.avatar-link"), null);
    assertEquals(container.querySelector("lightbox-image-group"), null);
  });

  it("should use lazy loading when lazyLoad is true", () => {
    const result = avatarTemplate({
      author: post.author,
      lazyLoad: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assertEquals(img.getAttribute("loading"), "lazy");
  });

  it("should use eager loading by default", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assertEquals(img.getAttribute("loading"), "eager");
  });
});

t.describe("avatarTemplate - labeler profiles", (it) => {
  it("should render avatar for labeler profile with labeler class", () => {
    const labelerAuthor = {
      ...post.author,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.classList.contains("labeler-avatar"));
  });

  it("should render avatar for non-labeler profile without labeler class", () => {
    const normalAuthor = {
      ...post.author,
      associated: { labeler: false },
    };
    const result = avatarTemplate({ author: normalAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(!img.classList.contains("labeler-avatar"));
  });

  it("should render avatar when associated is undefined", () => {
    const authorWithoutAssociated = { ...post.author };
    delete authorWithoutAssociated.associated;
    const result = avatarTemplate({ author: authorWithoutAssociated });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar-image']") !== null);
  });

  it("should use labeler fallback avatar for labeler without avatar URL", () => {
    const labelerAuthor = {
      ...post.author,
      avatar: null,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("labeler-avatar-fallback.svg"));
  });

  it("should use regular fallback avatar for non-labeler without avatar URL", () => {
    const normalAuthor = {
      ...post.author,
      avatar: null,
      associated: { labeler: false },
    };
    const result = avatarTemplate({ author: normalAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("avatar-fallback.svg"));
    assert(!img.getAttribute("src").includes("labeler"));
  });
});

await t.run();
