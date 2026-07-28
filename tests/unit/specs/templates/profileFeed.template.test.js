import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
  profileFeedTemplate,
} from "/js/templates/profileFeed.template.js";
import { html, render } from "/js/lib/lit-html.js";

const mockActor = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
};

describe("profileListItemTemplate", () => {
  it("should render avatar", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render display name", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName !== null);
    assert(displayName.textContent.includes("Test User"));
  });

  it("should render handle with @ prefix", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const handle = container.querySelector(
      "[data-testid='profile-list-item-handle']",
    );
    assert(handle !== null);
    assert(handle.textContent.includes("@testuser.bsky.social"));
  });

  it("should render profile link", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector(".profile-list-item-name");
    assert(link !== null);
    assert(link.getAttribute("href").includes(mockActor.handle));
  });
});

describe("profileListItemTemplate - follows-you badge", () => {
  const followsBackActor = {
    ...mockActor,
    viewer: { followedBy: "at://did:plc:testuser/app.bsky.graph.follow/1" },
  };

  it("should render follows-you badge by default", () => {
    const result = profileListItemTemplate({ actor: followsBackActor });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='follows-you-badge']") !== null,
    );
  });

  it("should hide follows-you badge when compact", () => {
    const result = profileListItemTemplate({
      actor: followsBackActor,
      compact: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='follows-you-badge']") === null,
    );
  });
});

describe("profileListItemTemplate - verification badge", () => {
  it("should render verification badge for verified actor", () => {
    const verifiedActor = {
      ...mockActor,
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = profileListItemTemplate({ actor: verifiedActor });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assert.deepEqual(badge.getAttribute("title"), "Verified");
  });

  it("should not render verification badge for non-verified actor", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".verification-badge"), null);
  });

  it("should render verifier badge for trusted verifier actor", () => {
    const verifierActor = {
      ...mockActor,
      verification: {
        verifiedStatus: "none",
        trustedVerifierStatus: "valid",
      },
    };
    const result = profileListItemTemplate({ actor: verifierActor });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(".verification-badge");
    assert(badge !== null);
    assert.deepEqual(badge.getAttribute("title"), "Trusted Verifier");
  });
});

describe("profileListItemTemplate - no display name", () => {
  it("should use handle as display name when displayName is missing", () => {
    const actorWithoutDisplayName = {
      ...mockActor,
      displayName: null,
    };
    const result = profileListItemTemplate({ actor: actorWithoutDisplayName });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes(mockActor.handle));
  });

  it("should use handle as display name when displayName is empty", () => {
    const actorWithEmptyDisplayName = {
      ...mockActor,
      displayName: "",
    };
    const result = profileListItemTemplate({
      actor: actorWithEmptyDisplayName,
    });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes(mockActor.handle));
  });
});

describe("profileListItemTemplate - special handles", () => {
  it("should render 'Deleted Account' for missing handle without displayName", () => {
    const deletedActor = {
      ...mockActor,
      handle: "missing.invalid",
      displayName: null,
    };
    const result = profileListItemTemplate({ actor: deletedActor });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes("Deleted Account"));
  });

  it("should render 'Invalid Handle' for invalid handle without displayName", () => {
    const invalidActor = {
      ...mockActor,
      handle: "handle.invalid",
      displayName: null,
    };
    const result = profileListItemTemplate({ actor: invalidActor });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes("Invalid Handle"));
  });
});

describe("profileListItemTemplate - displayName sanitization", () => {
  it("should strip check marks from displayName", () => {
    const actorWithCheckmark = {
      ...mockActor,
      displayName: "Test User ✓",
    };
    const result = profileListItemTemplate({ actor: actorWithCheckmark });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(!displayName.textContent.includes("✓"));
    assert(displayName.textContent.includes("Test User"));
  });

  it("should collapse repeated whitespace in displayName", () => {
    const actorWithExtraSpaces = {
      ...mockActor,
      displayName: "Test   User",
    };
    const result = profileListItemTemplate({ actor: actorWithExtraSpaces });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes("Test User"));
    assert(!displayName.textContent.includes("Test   User"));
  });
});

describe("profileListItemTemplate - custom badge", () => {
  it("should render the badge returned by rightItemTemplate", () => {
    const result = profileListItemTemplate({
      actor: mockActor,
      rightItemTemplate: (actor) =>
        html`<div data-testid="custom-badge">${actor.handle}</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector("[data-testid='custom-badge']");
    assert(badge !== null);
    assert(badge.textContent.includes(mockActor.handle));
  });

  it("should render nothing when rightItemTemplate returns null", () => {
    const result = profileListItemTemplate({
      actor: mockActor,
      rightItemTemplate: () => null,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='custom-badge']"),
      null,
    );
  });
});

describe("profileListItemTemplate - label badges", () => {
  const badgeLabels = [
    {
      labelDefinition: {
        identifier: "cool-badge",
        locales: [{ lang: "en", name: "Cool Badge", description: "A badge" }],
      },
      labeler: {
        creator: { handle: "labeler.test", avatar: null },
      },
    },
  ];

  it("should render label badges when the actor has badgeLabels", () => {
    const result = profileListItemTemplate({
      actor: { ...mockActor, badgeLabels },
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelector("[data-testid='label-badges']");
    assert(badges !== null);
    assert(badges.textContent.includes("Cool Badge"));
  });

  it("should not render label badges when the actor has none", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });

  it("should not render label badges when compact", () => {
    const result = profileListItemTemplate({
      actor: { ...mockActor, badgeLabels },
      compact: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });

  it("should not render label badges on the current user's own row", () => {
    const result = profileListItemTemplate({
      actor: { ...mockActor, badgeLabels },
      currentUserDid: mockActor.did,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });
});

describe("profileListItemTemplate - badges wrapper", () => {
  const badgeLabels = [
    {
      labelDefinition: {
        identifier: "cool-badge",
        locales: [{ lang: "en", name: "Cool Badge", description: "A badge" }],
      },
      labeler: {
        creator: { handle: "labeler.test", avatar: null },
      },
    },
  ];

  it("should render label badges and the plugin slot inside a shared wrapper", () => {
    const result = profileListItemTemplate({
      actor: { ...mockActor, badgeLabels },
      pluginService: {},
    });
    const container = document.createElement("div");
    render(result, container);
    const wrapper = container.querySelector(".profile-list-item-badges");
    assert(wrapper !== null);
    assert(wrapper.querySelector("[data-testid='label-badges']") !== null);
    assert(wrapper.querySelector("plugin-slot[name='author-badges']") !== null);
  });
});

describe("profileListItemTemplate - plugin author badges", () => {
  it("should render an author-badges plugin slot when pluginService is provided", () => {
    const result = profileListItemTemplate({
      actor: mockActor,
      pluginService: {},
    });
    const container = document.createElement("div");
    render(result, container);
    const slot = container.querySelector("plugin-slot[name='author-badges']");
    assert(slot !== null);
    assert.deepEqual(slot.getAttribute("context-did"), mockActor.did);
  });

  it("should not render a plugin slot without pluginService", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector("plugin-slot"), null);
  });
});

describe("profileListItemSkeletonTemplate", () => {
  it("should render skeleton avatar", () => {
    const result = profileListItemSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='skeleton-avatar']") !== null);
  });
});

describe("profileFeedTemplate", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    // These tests omit pluginService; silence the missing-pluginService warning.
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should render skeleton when profiles is null", () => {
    const result = profileFeedTemplate({ profiles: null, hasMore: false });
    render(result, container);
    assert(container.querySelector("[data-testid='skeleton-avatar']") !== null);
  });

  it("should render empty message when profiles is empty", () => {
    const result = profileFeedTemplate({
      profiles: [],
      hasMore: false,
      emptyMessage: "Nothing here.",
    });
    render(result, container);
    const msg = container.querySelector("[data-testid='feed-end-message']");
    assert(msg !== null);
    assert(msg.textContent.includes("Nothing here."));
  });

  it("should render profile list items when profiles is non-empty", () => {
    const result = profileFeedTemplate({
      profiles: [mockActor],
      hasMore: false,
    });
    render(result, container);
    assert(
      container.querySelector(
        "[data-testid='profile-list-item-display-name']",
      ) !== null,
    );
  });

  it("should render 10 skeletons by default when loading", () => {
    const result = profileFeedTemplate({ profiles: null, hasMore: false });
    render(result, container);
    assert.deepEqual(
      container.querySelectorAll("[data-testid='skeleton-avatar']").length,
      10,
    );
  });

  it("should honor skeletonCount when loading", () => {
    const result = profileFeedTemplate({
      profiles: null,
      hasMore: false,
      skeletonCount: 3,
    });
    render(result, container);
    assert.deepEqual(
      container.querySelectorAll("[data-testid='skeleton-avatar']").length,
      3,
    );
  });

  it("should not render end-of-feed message by default when not hasMore", () => {
    const result = profileFeedTemplate({
      profiles: [mockActor],
      hasMore: false,
    });
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='feed-end-message']"),
      null,
    );
  });

  it("should render end-of-feed message when showEndMessage is true and not hasMore", () => {
    const result = profileFeedTemplate({
      profiles: [mockActor],
      hasMore: false,
      showEndMessage: true,
    });
    render(result, container);
    const msg = container.querySelector("[data-testid='feed-end-message']");
    assert(msg !== null);
    assert(msg.textContent.includes("End of feed"));
  });

  it("should pass rightItemTemplate through to list items", () => {
    const result = profileFeedTemplate({
      profiles: [mockActor],
      hasMore: false,
      rightItemTemplate: () =>
        html`<div data-testid="custom-badge">Admin</div>`,
    });
    render(result, container);
    assert(container.querySelector("[data-testid='custom-badge']") !== null);
  });

  it("should render loading indicator when hasMore is true", () => {
    const result = profileFeedTemplate({
      profiles: [mockActor],
      hasMore: true,
    });
    render(result, container);
    assert(
      container.querySelector("[data-testid='feed-loading-indicator']") !==
        null,
    );
    assert.deepEqual(
      container.querySelector("[data-testid='feed-end-message']"),
      null,
    );
  });
});

describe("profileFeedTemplate - missing pluginService warning", () => {
  let container;
  let warn;

  beforeEach(() => {
    container = document.createElement("div");
    warn = mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should warn when a non-compact feed has no pluginService", () => {
    render(
      profileFeedTemplate({ profiles: [mockActor], hasMore: false }),
      container,
    );
    assert.deepEqual(warn.mock.callCount(), 1);
    assert(warn.mock.calls[0].arguments[0].includes("pluginService"));
  });

  it("should not warn when pluginService is provided", () => {
    render(
      profileFeedTemplate({
        profiles: [mockActor],
        hasMore: false,
        pluginService: {},
      }),
      container,
    );
    assert.deepEqual(warn.mock.callCount(), 0);
  });

  it("should not warn for compact feeds", () => {
    render(
      profileFeedTemplate({
        profiles: [mockActor],
        hasMore: false,
        compact: true,
      }),
      container,
    );
    assert.deepEqual(warn.mock.callCount(), 0);
  });
});
