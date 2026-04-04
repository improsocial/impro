import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("verificationBadgeTemplate");

t.describe("verificationBadgeTemplate", (it) => {
  it("should render nothing for profile without verification", () => {
    const profile = { did: "did:plc:123", handle: "user.bsky.social" };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".verification-badge"), null);
  });

  it("should render nothing for profile with invalid verification", () => {
    const profile = {
      did: "did:plc:123",
      verification: {
        verifiedStatus: "invalid",
        trustedVerifierStatus: "none",
      },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector(".verification-badge"), null);
  });

  it("should render verified badge with correct title", () => {
    const profile = {
      did: "did:plc:123",
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assertEquals(badge.getAttribute("title"), "Verified");
  });

  it("should render verified badge with circle SVG", () => {
    const profile = {
      did: "did:plc:123",
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const svg = container.querySelector(".verification-badge svg");
    assert(svg !== null);
    assert(svg.querySelector("circle") !== null);
  });

  it("should render verifier badge with correct title", () => {
    const profile = {
      did: "did:plc:123",
      verification: {
        verifiedStatus: "none",
        trustedVerifierStatus: "valid",
      },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assertEquals(badge.getAttribute("title"), "Trusted Verifier");
  });

  it("should render verifier badge with shield SVG (no circle)", () => {
    const profile = {
      did: "did:plc:123",
      verification: {
        verifiedStatus: "none",
        trustedVerifierStatus: "valid",
      },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const svg = container.querySelector(".verification-badge svg");
    assert(svg !== null);
    assertEquals(svg.querySelector("circle"), null);
  });

  it("should render verifier badge when both statuses are valid", () => {
    const profile = {
      did: "did:plc:123",
      verification: {
        verifiedStatus: "valid",
        trustedVerifierStatus: "valid",
      },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assertEquals(badge.getAttribute("title"), "Trusted Verifier");
  });
});

await t.run();
