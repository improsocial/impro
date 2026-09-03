import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { render } from "/js/lib/lit-html.js";

describe("verificationBadgeTemplate", () => {
  it("should render nothing for profile without verification", () => {
    const profile = { did: "did:plc:123", handle: "user.bsky.social" };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".verification-badge"), null);
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
    assert.deepEqual(container.querySelector(".verification-badge"), null);
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
    assert.deepEqual(badge.getAttribute("title"), "Verified");
  });

  it("should render verified badge with the verified-check icon", () => {
    const profile = {
      did: "did:plc:123",
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = verificationBadgeTemplate({ profile });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector(
        ".verification-badge app-icon[icon='verified-check']",
      ) !== null,
    );
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
    assert.deepEqual(badge.getAttribute("title"), "Trusted Verifier");
  });

  it("should render verifier badge with the verifier-check icon", () => {
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
    assert(
      container.querySelector(
        ".verification-badge app-icon[icon='verifier-check']",
      ) !== null,
    );
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
    assert.deepEqual(badge.getAttribute("title"), "Trusted Verifier");
  });
});
