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
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert.deepEqual(warning.getAttribute("label"), "NSFW");
  });

  it("should set labelerName attribute with @ prefix", () => {
    const result = moderationWarningTemplate({
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
      labelDefinition: mockLabelDefinition,
      labeler: mockLabeler,
      children: html`<div class="hidden-content">Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".hidden-content") !== null);
  });
});

describe("moderationWarningTemplate - no labeler", () => {
  it("should show 'the author.' when labeler is null", () => {
    const result = moderationWarningTemplate({
      labelDefinition: mockLabelDefinition,
      labeler: null,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
    assert.deepEqual(warning.getAttribute("labelerName"), "the author.");
  });

  it("should have null labelerLink when labeler is null", () => {
    const result = moderationWarningTemplate({
      labelDefinition: mockLabelDefinition,
      labeler: null,
      children: html`<div>Hidden content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector("moderation-warning");
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
