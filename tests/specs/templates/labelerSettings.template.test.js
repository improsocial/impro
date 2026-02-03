import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { labelerSettingsTemplate } from "/js/templates/labelerSettings.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("labelerSettingsTemplate");

const mockLabelerInfo = {
  uri: "at://did:plc:testlabeler/app.bsky.labeler.service/self",
  creator: { did: "did:plc:testlabeler", handle: "labeler.test" },
  policies: {
    labelValueDefinitions: [
      {
        identifier: "nsfw",
        blurs: "content",
        severity: "alert",
        locales: [{ lang: "en", name: "NSFW", description: "Adult content" }],
      },
      {
        identifier: "gore",
        blurs: "content",
        severity: "alert",
        locales: [
          { lang: "en", name: "Gore", description: "Graphic violence" },
        ],
      },
    ],
  },
};

t.describe("labelerSettingsTemplate", (it) => {
  it("should render header with description", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const header = container.querySelector(
      "[data-testid='labeler-settings-header']",
    );
    assert(header !== null);
    assert(header.textContent.includes("Labels are annotations"));
  });

  it("should render label preference list", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='label-preference-list']") !== null,
    );
  });

  it("should render label preference rows for each label", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const rows = container.querySelectorAll(
      "[data-testid='label-preference-row']",
    );
    assertEquals(rows.length, 2);
  });

  it("should render label names", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const names = container.querySelectorAll(
      "[data-testid='label-preference-name']",
    );
    assert(names[0].textContent.includes("NSFW"));
    assert(names[1].textContent.includes("Gore"));
  });
});

t.describe("labelerSettingsTemplate - no configurable labels", (it) => {
  it("should show message when labeler has no configurable labels", () => {
    const emptyLabelerInfo = {
      ...mockLabelerInfo,
      policies: { labelValueDefinitions: [] },
    };
    const result = labelerSettingsTemplate({
      labelerInfo: emptyLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.textContent.includes("no configurable labels"));
  });

  it("should not show label preference list when no configurable labels", () => {
    const emptyLabelerInfo = {
      ...mockLabelerInfo,
      policies: { labelValueDefinitions: [] },
    };
    const result = labelerSettingsTemplate({
      labelerInfo: emptyLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='label-preference-list']"),
      null,
    );
  });

  it("should filter out system labels starting with !", () => {
    const labelerWithSystemLabels = {
      ...mockLabelerInfo,
      policies: {
        labelValueDefinitions: [
          {
            identifier: "!hide",
            blurs: "content",
            severity: "alert",
            locales: [{ lang: "en", name: "Hide" }],
          },
          {
            identifier: "nsfw",
            blurs: "content",
            severity: "alert",
            locales: [{ lang: "en", name: "NSFW" }],
          },
        ],
      },
    };
    const result = labelerSettingsTemplate({
      labelerInfo: labelerWithSystemLabels,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const rows = container.querySelectorAll(
      "[data-testid='label-preference-row']",
    );
    assertEquals(rows.length, 1);
  });
});

t.describe("labelerSettingsTemplate - subscription state", (it) => {
  it("should render preference buttons when subscribed", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='label-preference-buttons']") !==
        null,
    );
  });

  it("should not render preference buttons when not subscribed", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: false,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='label-preference-buttons']"),
      null,
    );
  });

  it("should render Off, Warn, and Hide buttons when subscribed", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const buttons = container.querySelectorAll(
      "[data-testid='label-pref-button']",
    );
    const buttonTexts = Array.from(buttons).map((b) => b.textContent.trim());
    assert(buttonTexts.includes("Off"));
    assert(buttonTexts.includes("Warn"));
    assert(buttonTexts.includes("Hide"));
  });
});

t.describe("labelerSettingsTemplate - current settings", (it) => {
  it("should mark active button based on current setting", () => {
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [{ label: "nsfw", visibility: "hide" }],
    });
    const container = document.createElement("div");
    render(result, container);
    const activeButtons = container.querySelectorAll(
      "[data-testid='label-pref-button'].active",
    );
    assert(activeButtons.length > 0);
  });

  it("should call onClick when preference button is clicked", () => {
    let clickedLabel = null;
    let clickedValue = null;
    const result = labelerSettingsTemplate({
      labelerInfo: mockLabelerInfo,
      isSubscribed: true,
      labelerSettings: [{ label: "nsfw", visibility: "warn" }],
      onClick: (label, value) => {
        clickedLabel = label;
        clickedValue = value;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    // Click the "Hide" button for the first label
    const hideButtons = Array.from(
      container.querySelectorAll("[data-testid='label-pref-button']"),
    ).filter((b) => b.textContent.trim() === "Hide");
    hideButtons[0].click();
    assertEquals(clickedLabel, "nsfw");
    assertEquals(clickedValue, "hide");
  });
});

await t.run();
