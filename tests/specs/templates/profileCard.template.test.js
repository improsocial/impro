import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("profileCardTemplate");

const mockProfile = {
  displayName: "Test User",
  handle: "testuser.bsky.social",
  avatar: "https://example.com/avatar.jpg",
  description: "Test description",
  followersCount: 100,
  followsCount: 50,
  postsCount: 200,
  viewer: {
    following: false,
    followedBy: false,
  },
};

t.describe("profileCardTemplate", (it) => {
  it("should render profile card", () => {
    const result = profileCardTemplate({
      profile: mockProfile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='profile-name']")
        .textContent.trim(),
      "Test User",
    );
  });

  it("should render profile card with not following state", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='follow-button']")
        .textContent.trim(),
      "+ Follow",
    );
  });

  it("should render profile card with following state", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='follow-button']")
        .textContent.trim(),
      "Following",
    );
  });

  it("should not render followedBy indicator when not followed by", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='follows-you-badge']"),
      null,
    );
  });

  it("should render profile card with followedBy indicator", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: true },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='follows-you-badge']") !== null,
    );
  });

  it("should call onClickFollow when follow button clicked", () => {
    let followCallArgs = null;
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const onClickFollow = (p, shouldFollow) => {
      followCallArgs = { profile: p, shouldFollow };
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      onClickFollow,
    });
    const container = document.createElement("div");
    render(result, container);
    const followButton = container.querySelector(
      "[data-testid='follow-button']",
    );
    followButton.click();
    assert(followCallArgs !== null);
    assertEquals(followCallArgs.profile, profile);
    assertEquals(followCallArgs.shouldFollow, true);
  });

  it("should call onClickFollow with false when unfollow button clicked", () => {
    let followCallArgs = null;
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const onClickFollow = (p, shouldFollow) => {
      followCallArgs = { profile: p, shouldFollow };
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      onClickFollow,
    });
    const container = document.createElement("div");
    render(result, container);
    const followButton = container.querySelector(
      "[data-testid='follow-button']",
    );
    followButton.click();
    assert(followCallArgs !== null);
    assertEquals(followCallArgs.profile, profile);
    assertEquals(followCallArgs.shouldFollow, false);
  });
});

t.describe("profileCardTemplate - labeler support", (it) => {
  it("should render subscribe button for labeler profile when not subscribed", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: false,
      isAuthenticated: true,
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='subscribe-button']")
        .textContent.trim(),
      "+ Subscribe",
    );
  });

  it("should render subscribed button for labeler profile when subscribed", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: true,
      isAuthenticated: true,
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='subscribe-button']")
        .textContent.trim(),
      "Subscribed",
    );
  });

  it("should render follow button for labeler in context menu", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      isSubscribed: false,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickFollow: () => {},
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='context-menu-follow']") !== null,
    );
  });

  it("should render unfollow button for labeler in context menu when following", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      isSubscribed: false,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickFollow: () => {},
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='context-menu-follow']")
        .textContent.trim(),
      "Unfollow account",
    );
  });

  it("should call onClickSubscribe when subscribe button clicked for labeler", () => {
    let subscribeCallArgs = null;
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const onClickSubscribe = (p, shouldSubscribe) => {
      subscribeCallArgs = { profile: p, shouldSubscribe };
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: false,
      isAuthenticated: true,
      onClickSubscribe,
    });
    const container = document.createElement("div");
    render(result, container);
    const subscribeButton = container.querySelector(
      "[data-testid='subscribe-button']",
    );
    subscribeButton.click();
    assert(subscribeCallArgs !== null);
    assertEquals(subscribeCallArgs.profile, profile);
    assertEquals(subscribeCallArgs.shouldSubscribe, true);
  });
});

t.describe("profileCardTemplate - blocked profile", (it) => {
  it("should render unblock button for blocked profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false, blocking: "block-uri" },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickBlock: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='unblock-button']") !== null);
  });

  it("should show blocked badge and hide stats for blocked profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false, blocking: "block-uri" },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickBlock: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='blocked-badge']") !== null);
    assertEquals(
      container.querySelector("[data-testid='profile-stats']"),
      null,
    );
  });

  it("should hide followedBy badge for blocked profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: true, blocking: "block-uri" },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickBlock: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='follows-you-badge']"),
      null,
    );
  });
});

t.describe("profileCardTemplate - authentication states", (it) => {
  it("should not render chat button for unauthenticated user", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: false,
      isCurrentUser: false,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='chat-button']"), null);
  });

  it("should not render interaction buttons for current user", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='chat-button']"), null);
    assertEquals(
      container.querySelector("[data-testid='follow-button']"),
      null,
    );
  });

  it("should render chat button for authenticated user viewing other profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickChat: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='chat-button']") !== null);
  });

  it("should render stats for non-blocked profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='profile-stats']") !== null);
  });
});

t.describe("profileCardTemplate - labelerInfo parameter", (it) => {
  const mockLabelerInfo = {
    uri: "at://did:plc:testlabeler/app.bsky.labeler.service/self",
    creator: { did: "did:plc:testlabeler", handle: "labeler.test" },
    policies: {
      labelValueDefinitions: [
        { identifier: "nsfw", locales: [{ lang: "en", name: "NSFW" }] },
        { identifier: "gore", locales: [{ lang: "en", name: "Gore" }] },
      ],
    },
  };

  it("should render labeler profile with labelerInfo", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: true,
      isAuthenticated: true,
      labelerInfo: mockLabelerInfo,
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='subscribe-button']")
        .textContent.trim(),
      "Subscribed",
    );
  });

  it("should render labeler profile without labelerInfo", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: false,
      isAuthenticated: true,
      labelerInfo: null,
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='subscribe-button']")
        .textContent.trim(),
      "+ Subscribe",
    );
  });

  it("should render non-labeler profile with labelerInfo set to null", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: false,
      labelerInfo: null,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='follow-button']")
        .textContent.trim(),
      "+ Follow",
    );
  });

  it("should render labeler profile with empty policies", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const emptyLabelerInfo = {
      ...mockLabelerInfo,
      policies: { labelValueDefinitions: [] },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      showSubscribeButton: true,
      isSubscribed: true,
      isAuthenticated: true,
      labelerInfo: emptyLabelerInfo,
      onClickSubscribe: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container
        .querySelector("[data-testid='subscribe-button']")
        .textContent.trim(),
      "Subscribed",
    );
  });
});

await t.run();
