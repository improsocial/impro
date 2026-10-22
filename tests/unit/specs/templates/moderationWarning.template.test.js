import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moderationWarningTemplate } from "/js/templates/moderationWarning.template.js";
import { render, html } from "/js/lib/lit-html.js";

const mockLabelDefinition = {
  identifier: "nsfw",
  blurs: "content",
  severity: "alert",
  locales: [{ lang: "en", name: "NSFW", description: "Adult content" }],
};

const mockLabel = {
  src: "did:plc:testlabeler",
  uri: "at://did:plc:author/app.bsky.feed.post/abc",
  val: "nsfw",
};

const mockLabeler = {
  uri: "at://did:plc:testlabeler/app.bsky.labeler.service/self",
  creator: {
    did: "did:plc:testlabeler",
    handle: "labeler.test",
    displayName: "Test Labeler",
  },
};

describe("moderationWarningTemplate", () => {
  it("should render moderation-warning element", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("moderation-warning") !== null);
  });

  it("should set label attribute from label definition", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert.deepEqual(warning.getAttribute("label"), "NSFW");
  });

  it("should label sexual and porn warnings as Adult Content", () => {
    for (const identifier of ["sexual", "porn"]) {
      const result = moderationWarningTemplate({
        label: mockLabel,
        labelDefinition: {
          ...mockLabelDefinition,
          identifier,
          locales: [{ lang: "en", name: "Sexually Suggestive" }],
        },
        labeler: mockLabeler,
        children: html`<div>Hidden content</div>`,
      });
      const container = document.createElement("div");
      render(result, container);
      const warning = container.querySelector("moderation-warning");
      assert.deepEqual(warning.getAttribute("label"), "Adult Content");
    }
  });

  it("should set labelerName attribute with @ prefix", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert.deepEqual(warning.getAttribute("labelerName"), "@labeler.test");
  });

  it("should set labelerLink attribute", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(warning.getAttribute("labelerLink") !== null);
  });

  it("should render children content", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div class="hidden-content">Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".hidden-content") !== null);
  });
});

describe("moderationWarningTemplate - labeler attribution", () => {
  function renderWarning({ label, labeler }) {
    const container = document.createElement("div");
    render(
      moderationWarningTemplate({
        label,
        labelDefinition: mockLabelDefinition,
        labeler,
        children: html`<div>Hidden content</div>`,
      }),
      container,
    );
    return container.querySelector("moderation-warning");
  }

  it("should attribute a post self-label to the author", () => {
    const warning = renderWarning({
      label: { ...mockLabel, src: "did:plc:author" },
      labeler: null,
    });
    assert.deepEqual(warning.getAttribute("labelerName"), "the author.");
  });

  it("should attribute an account self-label to the author", () => {
    const warning = renderWarning({
      label: { ...mockLabel, src: "did:plc:author", uri: "did:plc:author" },
      labeler: null,
    });
    assert.deepEqual(warning.getAttribute("labelerName"), "the author.");
  });

  it("should attribute an unloaded Bluesky moderation label to moderation.bsky.app", () => {
    const warning = renderWarning({
      label: { ...mockLabel, src: "did:plc:ar7c4by46qjdydhdevvrndac" },
      labeler: null,
    });
    assert.deepEqual(
      warning.getAttribute("labelerName"),
      "moderation.bsky.app",
    );
  });

  it("should attribute a label from an unloaded labeler to an unknown labeler", () => {
    const warning = renderWarning({ label: mockLabel, labeler: null });
    assert.deepEqual(warning.getAttribute("labelerName"), "an unknown labeler");
  });

  it("should not link the labeler when the labeler is not loaded", () => {
    const warning = renderWarning({ label: mockLabel, labeler: null });
    // When labelerLink is null, the attribute value is empty or "null" string
    const labelerLink = warning.getAttribute("labelerLink");
    assert(
      labelerLink === "" || labelerLink === "null" || labelerLink === null,
    );
  });
});

describe("moderationWarningTemplate - custom className", () => {
  it("should apply custom className", () => {
    const result = moderationWarningTemplate({
      className: "custom-warning",
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("moderation-warning.custom-warning") !== null,
    );
  });

  it("should keep post-moderation-warning class with custom className", () => {
    const result = moderationWarningTemplate({
      className: "custom-warning",
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(warning.classList.contains("post-moderation-warning"));
    assert(warning.classList.contains("custom-warning"));
  });
});

describe("moderationWarningTemplate - noOverride", () => {
  it("should set the no-override attribute when noOverride is true", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      noOverride: true,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(warning.hasAttribute("no-override"));
  });

  it("should not set the no-override attribute when noOverride is false", () => {
    const result = moderationWarningTemplate({
      label: mockLabel,
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      noOverride: false,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert(!warning.hasAttribute("no-override"));
  });
});
