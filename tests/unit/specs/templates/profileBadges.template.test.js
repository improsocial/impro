import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { render } from "/js/lib/lit-html.js";
import { profileBadgesTemplate } from "/js/templates/profileBadges.template.js";
import { createProfile } from "../../../shared/factories.js";

const verification = { verifiedStatus: "valid", trustedVerifierStatus: "none" };

function renderBadges(profile) {
  const container = document.createElement("div");
  render(profileBadgesTemplate({ profile }), container);
  return container;
}

function badgeTestIds(container) {
  return [...container.querySelectorAll(".profile-badges > *")].map((badge) =>
    badge.getAttribute("data-testid"),
  );
}

describe("profileBadgesTemplate", () => {
  it("renders nothing for an unverified, non-automated profile", () => {
    const container = renderBadges(
      createProfile({ did: "did:plc:plain", handle: "plain.test" }),
    );
    assert.deepEqual(container.querySelector(".profile-badges"), null);
  });

  it("renders only the verification badge for a verified profile", () => {
    const container = renderBadges(
      createProfile({
        did: "did:plc:verified",
        handle: "verified.test",
        verification,
      }),
    );
    assert.deepEqual(badgeTestIds(container), ["verification-badge"]);
  });

  it("renders only the automated account badge for a bot profile", () => {
    const container = renderBadges(
      createProfile({
        did: "did:plc:bot",
        handle: "bot.test",
        labels: [{ val: "bot" }],
      }),
    );
    assert.deepEqual(badgeTestIds(container), ["automated-account-badge"]);
  });

  it("renders the verification badge before the automated account badge", () => {
    const container = renderBadges(
      createProfile({
        did: "did:plc:verifiedbot",
        handle: "verifiedbot.test",
        labels: [{ val: "bot" }],
        verification,
      }),
    );
    assert.deepEqual(badgeTestIds(container), [
      "verification-badge",
      "automated-account-badge",
    ]);
  });
});
