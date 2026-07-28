import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorBadgesTemplate } from "/js/templates/labelBadges.template.js";
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

const mockDid = "did:plc:author";

function renderTemplate(props) {
  const container = document.createElement("div");
  render(authorBadgesTemplate(props), container);
  return container;
}

describe("authorBadgesTemplate", () => {
  it("should render label badge for each label", () => {
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
    });
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assert.deepEqual(badges.length, 1);
  });

  it("should render label badge as link to labeler profile", () => {
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
    });
    const badge = container.querySelector("[data-testid='label-badge']");
    assert(badge.tagName === "A");
    assert(badge.getAttribute("href").includes(mockLabeler.creator.handle));
  });

  it("should render labeler avatar image", () => {
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
    });
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img !== null);
    assert.deepEqual(img.getAttribute("src"), mockLabeler.creator.avatar);
  });

  it("should render label name text", () => {
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
    });
    const text = container.querySelector("[data-testid='label-badge-text']");
    assert(text !== null);
    assert(text.textContent.includes("Informative"));
  });
});

describe("authorBadgesTemplate - multiple labels", () => {
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
    const container = renderTemplate({
      badgeLabels: multipleBadgeLabels,
      did: mockDid,
    });
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assert.deepEqual(badges.length, 2);
  });
});

describe("authorBadgesTemplate - fallback avatar", () => {
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
    const container = renderTemplate({ badgeLabels, did: mockDid });
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img.getAttribute("src").includes("labeler-avatar-fallback.svg"));
  });
});

describe("authorBadgesTemplate - empty labels", () => {
  it("should not render badge container when badge labels are empty", () => {
    const container = renderTemplate({ badgeLabels: [], did: mockDid });
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });

  it("should not render badge container when badge labels are null", () => {
    const container = renderTemplate({ badgeLabels: null, did: mockDid });
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });
});

describe("authorBadgesTemplate - plugin slot", () => {
  it("should render plugin slot with the author did when pluginService is set", () => {
    const pluginService = {};
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
      pluginService,
    });
    const slot = container.querySelector("plugin-slot[name='author-badges']");
    assert(slot !== null);
    assert.deepEqual(slot.getAttribute("context-did"), mockDid);
    assert.deepEqual(slot.pluginService, pluginService);
  });

  it("should render plugin slot even when no badge labels", () => {
    const container = renderTemplate({
      badgeLabels: null,
      did: mockDid,
      pluginService: {},
    });
    assert(
      container.querySelector("plugin-slot[name='author-badges']") !== null,
    );
  });

  it("should not render plugin slot without pluginService", () => {
    const container = renderTemplate({
      badgeLabels: mockBadgeLabels,
      did: mockDid,
    });
    assert.deepEqual(container.querySelector("plugin-slot"), null);
  });

  it("should render an empty context-did when did is missing", () => {
    const container = renderTemplate({
      badgeLabels: null,
      did: null,
      pluginService: {},
    });
    const slot = container.querySelector("plugin-slot[name='author-badges']");
    assert.deepEqual(slot.getAttribute("context-did"), "");
  });
});
