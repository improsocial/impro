import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelBadgesTemplate } from "/js/templates/labelBadges.template.js";
import { render } from "/js/lib/lit-html.js";

const mockLabeler = {
  uri: "at://did:plc:testlabeler/app.bsky.labeler.service/self",
  creator: {
    did: "did:plc:testlabeler",
    handle: "labeler.test",
    displayName: "Test Labeler",
    avatar: "https://example.com/avatar.jpg",
  },
};

const mockLabelDefinition = {
  identifier: "informative",
  blurs: "none",
  severity: "inform",
  locales: [
    { lang: "en", name: "Informative", description: "Educational content" },
  ],
};

const mockBadgeLabels = [
  {
    labelDefinition: mockLabelDefinition,
    labeler: mockLabeler,
  },
];

describe("labelBadgesTemplate", () => {
  it("should render label badge for each label", () => {
    const result = labelBadgesTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assert.deepEqual(badges.length, 1);
  });

  it("should render label badge as link to labeler profile", () => {
    const result = labelBadgesTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector("[data-testid='label-badge']");
    assert(badge.tagName === "A");
    assert(badge.getAttribute("href").includes(mockLabeler.creator.handle));
  });

  it("should render labeler avatar image", () => {
    const result = labelBadgesTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img !== null);
    assert.deepEqual(img.getAttribute("src"), mockLabeler.creator.avatar);
  });

  it("should render label name text", () => {
    const result = labelBadgesTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const text = container.querySelector("[data-testid='label-badge-text']");
    assert(text !== null);
    assert(text.textContent.includes("Informative"));
  });
});

describe("labelBadgesTemplate - multiple labels", () => {
  it("should render multiple label badges", () => {
    const secondLabelDefinition = {
      identifier: "educational",
      blurs: "none",
      severity: "inform",
      locales: [{ lang: "en", name: "Educational" }],
    };
    const secondLabeler = {
      uri: "at://did:plc:otherlabeler/app.bsky.labeler.service/self",
      creator: {
        did: "did:plc:otherlabeler",
        handle: "other.labeler",
        avatar: "https://example.com/other-avatar.jpg",
      },
    };
    const multipleBadgeLabels = [
      { labelDefinition: mockLabelDefinition, labeler: mockLabeler },
      { labelDefinition: secondLabelDefinition, labeler: secondLabeler },
    ];
    const result = labelBadgesTemplate({ badgeLabels: multipleBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assert.deepEqual(badges.length, 2);
  });
});

describe("labelBadgesTemplate - fallback avatar", () => {
  it("should use fallback avatar when labeler has no avatar", () => {
    const labelerWithoutAvatar = {
      ...mockLabeler,
      creator: {
        ...mockLabeler.creator,
        avatar: null,
      },
    };
    const badgeLabels = [
      {
        labelDefinition: mockLabelDefinition,
        labeler: labelerWithoutAvatar,
      },
    ];
    const result = labelBadgesTemplate({ badgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img.getAttribute("src").includes("labeler-avatar-fallback.svg"));
  });
});

describe("labelBadgesTemplate - empty labels", () => {
  it("should render empty container when no badge labels", () => {
    const result = labelBadgesTemplate({ badgeLabels: [] });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='label-badges']") !== null);
    assert.deepEqual(
      container.querySelectorAll("[data-testid='label-badge']").length,
      0,
    );
  });
});
