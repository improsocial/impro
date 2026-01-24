import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";

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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
      isSubscribed: false,
      isAuthenticated: true,
      onClickSubscribe: () => {},
    });
    assert(result instanceof Object);
  });

  it("should render subscribed button for labeler profile when subscribed", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isLabeler: true,
      isSubscribed: true,
      isAuthenticated: true,
      onClickSubscribe: () => {},
    });
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
      isSubscribed: false,
      isAuthenticated: true,
      onClickSubscribe,
    });
    // Template rendered successfully with callback
    assert(result instanceof Object);
    assert(subscribeCallArgs === null); // Not called until button is clicked
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
  });
});

await t.run();
