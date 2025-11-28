import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
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

await t.run();
