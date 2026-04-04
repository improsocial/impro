import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postHeaderTextTemplate");

t.describe("postHeaderTextTemplate", (it) => {
  it("should render header with author name", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      includeTime: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='post-author-name']")
        .textContent.trim(),
      post.author.displayName,
    );
  });

  it("should render header with author handle", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      includeTime: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='post-author-handle']")
        .textContent.trim(),
      `@${post.author.handle}`,
    );
  });

  it("should render header with time", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      includeTime: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-time']") !== null);
  });

  it("should render header without time when includeTime is false", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      includeTime: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='post-time']"), null);
  });

  it("should render header without handle when includeHandle is false", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      includeHandle: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='post-author-handle']"),
      null,
    );
  });

  it("should render handle as name when displayName is missing", () => {
    const authorWithoutDisplayName = { ...post.author, displayName: null };
    const result = postHeaderTextTemplate({
      author: authorWithoutDisplayName,
      timestamp: post.indexedAt,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='post-author-name']")
        .textContent.trim(),
      post.author.handle,
    );
  });

  it("should render as link when enableProfileLink is true", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      enableProfileLink: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const nameElement = container.querySelector(
      "[data-testid='post-author-name']",
    );
    assertEquals(nameElement.tagName.toLowerCase(), "a");
  });

  it("should render as span when enableProfileLink is false", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
      enableProfileLink: false,
    });
    const container = document.createElement("div");
    render(result, container);
    const nameElement = container.querySelector(
      "[data-testid='post-author-name']",
    );
    assertEquals(nameElement.tagName.toLowerCase(), "span");
  });

  it("should render verification badge for verified author", () => {
    const verifiedAuthor = {
      ...post.author,
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = postHeaderTextTemplate({
      author: verifiedAuthor,
      timestamp: post.indexedAt,
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assertEquals(badge.getAttribute("title"), "Verified");
  });

  it("should not render verification badge for non-verified author", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.indexedAt,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".verification-badge"), null);
  });

  it("should render verifier badge for trusted verifier author", () => {
    const verifierAuthor = {
      ...post.author,
      verification: {
        verifiedStatus: "none",
        trustedVerifierStatus: "valid",
      },
    };
    const result = postHeaderTextTemplate({
      author: verifierAuthor,
      timestamp: post.indexedAt,
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assertEquals(badge.getAttribute("title"), "Trusted Verifier");
  });
});

await t.run();
