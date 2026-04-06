import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("automatedAccountBadgeTemplate");

t.describe("automatedAccountBadgeTemplate", (it) => {
  it("should render nothing for non-bot profile", () => {
    const profile = { did: "did:plc:123", handle: "user.bsky.social" };
    const result = automatedAccountBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".automated-account-badge"), null);
  });

  it("should render a button badge for bot profile", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "bot" }],
    };
    const result = automatedAccountBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector("button.automated-account-badge");
    assert(badge !== null);
    assertEquals(badge.getAttribute("title"), "Automated Account");
  });

  it("should render an SVG icon inside the badge", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "bot" }],
    };
    const result = automatedAccountBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const svg = container.querySelector(".automated-account-badge svg");
    assert(svg !== null);
  });

  it("should open a modal when clicked", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "bot" }],
    };
    const result = automatedAccountBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".automated-account-badge");
    badge.click();
    const dialog = document.querySelector("dialog.info-modal");
    assert(dialog !== null);
    assert(dialog.textContent.includes("Automated account"));
    assert(
      dialog.textContent.includes(
        "This account has been marked as automated by its owner.",
      ),
    );
    dialog.close();
    dialog.remove();
  });
});

await t.run();
