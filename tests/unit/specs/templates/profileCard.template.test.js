import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";
import { render } from "/js/lib/lit-html.js";

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

const mockBadgeLabels = [
  {
    visibility: "warn",
    label: { val: "spam", src: "did:plc:labeler1" },
    labelDefinition: {
      identifier: "spam",
      blurs: "none",
      severity: "inform",
      locales: [{ lang: "en", name: "Spam", description: "Spam account" }],
    },
    labeler: {
      creator: {
        did: "did:plc:labeler1",
        handle: "labeler.test",
        avatar: null,
      },
    },
  },
];

describe("profileCardTemplate", () => {
  it("should render badge label pills for another user's labeled profile", () => {
    const profile = { ...mockProfile, badgeLabels: mockBadgeLabels };
    const result = profileCardTemplate({
      profile,
      isCurrentUser: false,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector("[data-testid='label-badge']");
    assert(badge);
    assert.deepEqual(
      badge
        .querySelector("[data-testid='label-badge-text']")
        .textContent.trim(),
      "Spam",
    );
  });

  it("should not render badge label pills on the current user's profile", () => {
    const profile = { ...mockProfile, badgeLabels: mockBadgeLabels };
    const result = profileCardTemplate({
      profile,
      isCurrentUser: true,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='label-badge']"),
      null,
    );
  });

  it("should not render a label pill row for an unlabeled profile", () => {
    const result = profileCardTemplate({
      profile: mockProfile,
      isCurrentUser: false,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='label-badges']"),
      null,
    );
  });

  it("should render profile card", () => {
    const result = profileCardTemplate({
      profile: mockProfile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='follow-button']")
        .getAttribute("data-teststate"),
      "follow",
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='follow-button']")
        .getAttribute("data-teststate"),
      "following",
    );
  });

  it("should render follow-back state when followed by but not following", () => {
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='follow-button']")
        .getAttribute("data-teststate"),
      "follow-back",
    );
  });

  it("should render following (not follow-back) state when mutuals", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: true },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='follow-button']")
        .getAttribute("data-teststate"),
      "following",
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
    assert.deepEqual(
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
    assert.deepEqual(followCallArgs.profile, profile);
    assert.deepEqual(followCallArgs.shouldFollow, true);
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
    assert.deepEqual(followCallArgs.profile, profile);
    assert.deepEqual(followCallArgs.shouldFollow, false);
  });
});

describe("profileCardTemplate - post notifications button", () => {
  it("should render post notifications button when following", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-notifications-button']") !==
        null,
    );
  });

  it("should not render post notifications button when not following", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should not render post notifications button when only followed by", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: true },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should not render post notifications button for unauthenticated user", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: false,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should not render post notifications button for current user", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: true,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should not render post notifications button when the profile allows no subscriptions", () => {
    const profile = {
      ...mockProfile,
      associated: { activitySubscription: { allowSubscriptions: "none" } },
      viewer: { following: true, followedBy: true },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should render post notifications button for mutuals only when followed back", () => {
    const mutualsProfile = {
      ...mockProfile,
      associated: { activitySubscription: { allowSubscriptions: "mutuals" } },
    };
    const renderWith = (viewer) => {
      const container = document.createElement("div");
      render(
        profileCardTemplate({
          profile: { ...mutualsProfile, viewer },
          isAuthenticated: true,
          isCurrentUser: false,
          onClickPostNotifications: () => {},
        }),
        container,
      );
      return container.querySelector(
        "[data-testid='post-notifications-button']",
      );
    };
    assert.deepEqual(renderWith({ following: true, followedBy: false }), null);
    assert(renderWith({ following: true, followedBy: true }) !== null);
  });

  it("should render post notifications button for followers when the declaration is followers", () => {
    const profile = {
      ...mockProfile,
      associated: { activitySubscription: { allowSubscriptions: "followers" } },
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='post-notifications-button']") !==
        null,
    );
  });

  it("should not render post notifications button for an unknown declaration value", () => {
    const profile = {
      ...mockProfile,
      associated: {
        activitySubscription: { allowSubscriptions: "something-new" },
      },
      viewer: { following: true, followedBy: true },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='post-notifications-button']"),
      null,
    );
  });

  it("should call onClickPostNotifications when bell clicked", () => {
    let notificationsCallArg = null;
    const profile = {
      ...mockProfile,
      viewer: { following: true, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      onClickPostNotifications: (p) => {
        notificationsCallArg = p;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    container
      .querySelector("[data-testid='post-notifications-button']")
      .click();
    assert.deepEqual(notificationsCallArg, profile);
  });
});

describe("profileCardTemplate - verification badge", () => {
  it("should render verification badge for verified profile", () => {
    const profile = {
      ...mockProfile,
      verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(
      "[data-testid='profile-name'] .verification-badge",
    );
    assert(badge !== null);
    assert.deepEqual(badge.getAttribute("title"), "Verified");
  });

  it("should not render verification badge for non-verified profile", () => {
    const result = profileCardTemplate({
      profile: mockProfile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector(
        "[data-testid='profile-name'] .verification-badge",
      ),
      null,
    );
  });

  it("should render verifier badge for trusted verifier profile", () => {
    const profile = {
      ...mockProfile,
      verification: {
        verifiedStatus: "none",
        trustedVerifierStatus: "valid",
      },
    };
    const result = profileCardTemplate({
      profile,
      onClickFollow: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const badge = container.querySelector(
      "[data-testid='profile-name'] .verification-badge",
    );
    assert(badge !== null);
    assert.deepEqual(badge.getAttribute("title"), "Trusted Verifier");
  });
});

describe("profileCardTemplate - labeler support", () => {
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='subscribe-button']")
        .getAttribute("data-teststate"),
      "not-subscribed",
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='subscribe-button']")
        .getAttribute("data-teststate"),
      "subscribed",
    );
  });

  it("should render follow button for labeler in context menu", async () => {
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
    container.classList.add("page-visible");
    document.body.appendChild(container);
    render(result, container);
    container.querySelector(".ellipsis-button").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const item = document.body.querySelector(
      "[data-testid='menu-action-profile-follow']",
    );
    assert(item !== null);
    document.body.querySelector(".profile-context-menu")?.remove();
    container.remove();
  });

  it("should render unfollow button for labeler in context menu when following", async () => {
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
    container.classList.add("page-visible");
    document.body.appendChild(container);
    render(result, container);
    container.querySelector(".ellipsis-button").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const item = document.body.querySelector(
      "[data-testid='menu-action-profile-follow']",
    );
    assert(item !== null);
    assert.deepEqual(item.getAttribute("data-teststate"), "following");
    document.body.querySelector(".profile-context-menu")?.remove();
    container.remove();
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
    assert.deepEqual(subscribeCallArgs.profile, profile);
    assert.deepEqual(subscribeCallArgs.shouldSubscribe, true);
  });
});

describe("profileCardTemplate - blocked profile", () => {
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
    assert.deepEqual(
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
    assert.deepEqual(
      container.querySelector("[data-testid='follows-you-badge']"),
      null,
    );
  });
});

describe("profileCardTemplate - authentication states", () => {
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
    assert.deepEqual(
      container.querySelector("[data-testid='chat-button']"),
      null,
    );
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
    assert.deepEqual(
      container.querySelector("[data-testid='chat-button']"),
      null,
    );
    assert.deepEqual(
      container.querySelector("[data-testid='follow-button']"),
      null,
    );
  });

  it("should render edit profile button for current user", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: true,
      onClickEditProfile: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const editButton = container.querySelector(
      "[data-testid='edit-profile-button']",
    );
    assert(editButton !== null);
  });

  it("should not render edit profile button for other users", () => {
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
    assert.deepEqual(
      container.querySelector("[data-testid='edit-profile-button']"),
      null,
    );
  });

  it("should call onClickEditProfile when edit button clicked", () => {
    let editProfileCalled = false;
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: true,
      onClickEditProfile: () => {
        editProfileCalled = true;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    const editButton = container.querySelector(
      "[data-testid='edit-profile-button']",
    );
    editButton.click();
    assert(editProfileCalled);
  });

  it("should render enabled chat button when following and chat is allowed", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: "at://follow", followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      profileChatStatus: { canChat: true },
      onClickChat: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='chat-button']");
    assert(button !== null);
    assert.deepEqual(button.disabled, false);
  });

  it("should render disabled chat button when following but chat status is not yet loaded", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: "at://follow", followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      profileChatStatus: null,
      onClickChat: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='chat-button']");
    assert(button !== null);
    assert.deepEqual(button.disabled, true);
  });

  it("should render disabled chat button when following but chat is not allowed", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: "at://follow", followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      profileChatStatus: { canChat: false },
      onClickChat: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector("[data-testid='chat-button']");
    assert(button !== null);
    assert.deepEqual(button.disabled, true);
  });

  it("should not render chat button when not following the profile", () => {
    const profile = {
      ...mockProfile,
      viewer: { following: false, followedBy: false },
    };
    const result = profileCardTemplate({
      profile,
      isAuthenticated: true,
      isCurrentUser: false,
      profileChatStatus: { canChat: true },
      onClickChat: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='chat-button']"),
      null,
    );
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

describe("profileCardTemplate - labelerInfo parameter", () => {
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='subscribe-button']")
        .getAttribute("data-teststate"),
      "subscribed",
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='subscribe-button']")
        .getAttribute("data-teststate"),
      "not-subscribed",
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='follow-button']")
        .textContent.trim(),
      "Follow",
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
    assert.deepEqual(
      container
        .querySelector("[data-testid='subscribe-button']")
        .getAttribute("data-teststate"),
      "subscribed",
    );
  });
});
