import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getKnownFollowersText,
  knownFollowersSummaryTemplate,
} from "/js/templates/knownFollowersSummary.template.js";
import { render } from "/js/lib/lit-html.js";

const alice = {
  did: "did:plc:alice",
  handle: "alice.bsky.social",
  displayName: "Alice",
};
const bob = {
  did: "did:plc:bob",
  handle: "bob.bsky.social",
  displayName: "Bob",
};

describe("getKnownFollowersText", () => {
  it("should name a single known follower", () => {
    assert.deepEqual(
      getKnownFollowersText({ count: 1, followers: [alice] }),
      "Followed by Alice",
    );
  });

  it("should count unnamed others beyond a single named follower", () => {
    assert.deepEqual(
      getKnownFollowersText({ count: 2, followers: [alice] }),
      "Followed by Alice and 1 other",
    );
    assert.deepEqual(
      getKnownFollowersText({ count: 3, followers: [alice] }),
      "Followed by Alice and 2 others",
    );
  });

  it("should name two known followers", () => {
    assert.deepEqual(
      getKnownFollowersText({ count: 2, followers: [alice, bob] }),
      "Followed by Alice and Bob",
    );
  });

  it("should count others beyond two named followers", () => {
    assert.deepEqual(
      getKnownFollowersText({ count: 3, followers: [alice, bob] }),
      "Followed by Alice, Bob, and 1 other",
    );
    assert.deepEqual(
      getKnownFollowersText({
        count: 5,
        followers: [alice, bob, { did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by Alice, Bob, and 3 others",
    );
  });

  it("should fall back to the array length when count is missing", () => {
    assert.deepEqual(
      getKnownFollowersText({
        followers: [alice, bob, { did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by Alice, Bob, and 1 other",
    );
  });

  it("should fall back to handles for followers without display names", () => {
    assert.deepEqual(
      getKnownFollowersText({
        count: 1,
        followers: [{ did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by c.bsky.social",
    );
  });
});

describe("knownFollowersSummaryTemplate", () => {
  function renderTemplate(props) {
    const container = document.createElement("div");
    render(knownFollowersSummaryTemplate(props), container);
    return container;
  }

  function profileWithKnownFollowers({ count, followers }) {
    return {
      did: "did:plc:requester",
      handle: "requester.bsky.social",
      viewer: { knownFollowers: { count, followers } },
    };
  }

  it("should render nothing without known followers by default", () => {
    const container = renderTemplate({
      profile: { did: "did:plc:requester", viewer: {} },
    });
    assert.deepEqual(container.textContent.trim(), "");
  });

  it("should render the placeholder when showPlaceholder is set", () => {
    const container = renderTemplate({
      profile: { did: "did:plc:requester", viewer: {} },
      showPlaceholder: true,
    });
    assert.deepEqual(
      container.querySelector(".known-followers-text").textContent.trim(),
      "Not followed by anyone you're following",
    );
    assert.deepEqual(
      container.querySelector('[data-testid="known-followers-summary"]'),
      null,
    );
  });

  it("should render the placeholder when all known followers are blocked", () => {
    // count includes blocked users, the followers array does not
    const container = renderTemplate({
      profile: profileWithKnownFollowers({ count: 2, followers: [] }),
      showPlaceholder: true,
    });
    assert.deepEqual(
      container.querySelector(".known-followers-text").textContent.trim(),
      "Not followed by anyone you're following",
    );
  });

  it("should render a linked summary with avatars for known followers", () => {
    const container = renderTemplate({
      profile: profileWithKnownFollowers({ count: 3, followers: [alice, bob] }),
    });
    const summary = container.querySelector(
      '[data-testid="known-followers-summary"]',
    );
    assert(summary !== null);
    assert(summary.getAttribute("href").includes("known-followers"));
    assert.deepEqual(
      summary.querySelectorAll(".known-followers-avatar").length,
      2,
    );
    assert.deepEqual(
      summary.querySelector(".known-followers-text").textContent.trim(),
      "Followed by Alice, Bob, and 1 other",
    );
  });

  it("should show at most three follower avatars", () => {
    const followers = [
      alice,
      bob,
      { did: "did:plc:c", handle: "c.bsky.social" },
      { did: "did:plc:d", handle: "d.bsky.social" },
    ];
    const container = renderTemplate({
      profile: profileWithKnownFollowers({ count: 4, followers }),
    });
    assert.deepEqual(
      container.querySelectorAll(".known-followers-avatar").length,
      3,
    );
  });
});
