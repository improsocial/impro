import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postLabelsTemplate } from "/js/templates/postLabels.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postLabelsTemplate");

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

t.describe("postLabelsTemplate", (it) => {
  it("should render label badge for each label", () => {
    const result = postLabelsTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assertEquals(badges.length, 1);
  });

  it("should render label badge as link to labeler profile", () => {
    const result = postLabelsTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector("[data-testid='label-badge']");
    assert(badge.tagName === "A");
    assert(badge.getAttribute("href").includes(mockLabeler.creator.handle));
  });

  it("should render labeler avatar image", () => {
    const result = postLabelsTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img !== null);
    assertEquals(img.getAttribute("src"), mockLabeler.creator.avatar);
  });

  it("should render label name text", () => {
    const result = postLabelsTemplate({ badgeLabels: mockBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const text = container.querySelector("[data-testid='label-badge-text']");
    assert(text !== null);
    assert(text.textContent.includes("Informative"));
  });
});

t.describe("postLabelsTemplate - multiple labels", (it) => {
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
    const result = postLabelsTemplate({ badgeLabels: multipleBadgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='label-badge']");
    assertEquals(badges.length, 2);
  });
});

t.describe("postLabelsTemplate - fallback avatar", (it) => {
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
    const result = postLabelsTemplate({ badgeLabels });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='label-badge-image']");
    assert(img.getAttribute("src").includes("labeler-avatar-fallback.svg"));
  });
});

t.describe("postLabelsTemplate - empty labels", (it) => {
  it("should render empty container when no badge labels", () => {
    const result = postLabelsTemplate({ badgeLabels: [] });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-labels']") !== null);
    assertEquals(
      container.querySelectorAll("[data-testid='label-badge']").length,
      0,
    );
  });
});

await t.run();
