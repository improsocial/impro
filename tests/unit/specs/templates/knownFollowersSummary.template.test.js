import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  getKnownFollowersText,
  knownFollowersSummaryTemplate,
} from "/js/templates/knownFollowersSummary.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("knownFollowersSummaryTemplate");

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

t.describe("getKnownFollowersText", (it) => {
  it("should name a single known follower", () => {
    assertEquals(
      getKnownFollowersText({ count: 1, followers: [alice] }),
      "Followed by Alice",
    );
  });

  it("should count unnamed others beyond a single named follower", () => {
    assertEquals(
      getKnownFollowersText({ count: 2, followers: [alice] }),
      "Followed by Alice and 1 other",
    );
    assertEquals(
      getKnownFollowersText({ count: 3, followers: [alice] }),
      "Followed by Alice and 2 others",
    );
  });

  it("should name two known followers", () => {
    assertEquals(
      getKnownFollowersText({ count: 2, followers: [alice, bob] }),
      "Followed by Alice and Bob",
    );
  });

  it("should count others beyond two named followers", () => {
    assertEquals(
      getKnownFollowersText({ count: 3, followers: [alice, bob] }),
      "Followed by Alice, Bob, and 1 other",
    );
    assertEquals(
      getKnownFollowersText({
        count: 5,
        followers: [alice, bob, { did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by Alice, Bob, and 3 others",
    );
  });

  it("should fall back to the array length when count is missing", () => {
    assertEquals(
      getKnownFollowersText({
        followers: [alice, bob, { did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by Alice, Bob, and 1 other",
    );
  });

  it("should fall back to handles for followers without display names", () => {
    assertEquals(
      getKnownFollowersText({
        count: 1,
        followers: [{ did: "did:plc:c", handle: "c.bsky.social" }],
      }),
      "Followed by c.bsky.social",
    );
  });
});

t.describe("knownFollowersSummaryTemplate", (it) => {
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
    assertEquals(container.textContent.trim(), "");
  });

  it("should render the placeholder when showPlaceholder is set", () => {
    const container = renderTemplate({
      profile: { did: "did:plc:requester", viewer: {} },
      showPlaceholder: true,
    });
    assertEquals(
      container.querySelector(".known-followers-text").textContent.trim(),
      "Not followed by anyone you're following",
    );
    assertEquals(
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
    assertEquals(
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
    assertEquals(summary.querySelectorAll(".known-followers-avatar").length, 2);
    assertEquals(
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
    assertEquals(
      container.querySelectorAll(".known-followers-avatar").length,
      3,
    );
  });
});

await t.run();
