import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Derived } from "/js/dataLayer/derived.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";
import { DraftMediaStore, getDraftDeviceId } from "/js/drafts.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { createUnavailablePost } from "/js/dataHelpers.js";
import {
  createConvo,
  createMessage,
  createNotification,
  createPost,
  createProfile,
} from "../../../shared/factories.js";

function makeDerived(dataStore, { preferences, draftMediaStore } = {}) {
  const patchStore = new PatchStore(dataStore);
  const prefs = preferences ?? Preferences.createLoggedOutPreferences();
  const preferencesProvider = {
    requirePreferences: () => prefs,
    $preferences: new Signal.State(prefs),
  };
  const hiddenFeedItemsStore = new HiddenFeedItemsStore();
  const derived = new Derived(
    dataStore,
    patchStore,
    preferencesProvider,
    hiddenFeedItemsStore,
    false,
    draftMediaStore ?? new DraftMediaStore("test-media"),
  );
  return { derived, patchStore, hiddenFeedItemsStore };
}

function fakePreferences(overrides = {}) {
  return {
    postHasMutedWord: () => false,
    quotedPostHasMutedWord: () => false,
    isPostHidden: () => false,
    getBadgeLabelsForPost: () => [],
    getContentLabel: () => null,
    getMediaLabel: () => null,
    getProfileBlurLabel: () => null,
    getBadgeLabelsForProfile: () => [],
    getFollowingFeedPreference: () => null,
    clone() {
      return this;
    },
    ...overrides,
  };
}

describe("$hydratedFeeds", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedFeeds.get(feedURI), null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);

    const rawFeed = {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "cursor123",
    };
    const post1 = { uri: "post1", content: "First post", likeCount: 5 };
    const post2 = { uri: "post2", content: "Second post", likeCount: 10 };

    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$feeds.set(feedURI, rawFeed);

    const result = derived.$hydratedFeeds.get(feedURI);
    assert.deepEqual(result, {
      feed: [
        { post: post1, feedContext: undefined },
        { post: post2, feedContext: undefined },
      ],
      cursor: "cursor123",
    });
  });

  it("should apply patches to posts in feed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);

    const rawFeed = {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor123",
    };
    const post1 = {
      uri: "post1",
      content: "Test post",
      likeCount: 5,
      viewer: { like: null },
    };

    dataStore.$posts.set("post1", post1);
    dataStore.$feeds.set(feedURI, rawFeed);
    patchStore.addPostPatch("post1", { type: "addLike" });

    const result = derived.$hydratedFeeds.get(feedURI);
    assert.deepEqual(result.feed[0].post.likeCount, 6);
    assert.deepEqual(result.feed[0].post.viewer.like, "fake like");
  });
});

describe("$hydratedEmbeddedPosts", () => {
  it("hydrates embedded posts without exposing them as full posts", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const post = {
      uri: "at://did:test/app.bsky.feed.post/quoted",
      cid: "quoted-cid",
      author: { did: "did:test", handle: "quoted.test" },
      record: { text: "quoted" },
      indexedAt: "2026-07-20T00:00:00Z",
    };

    dataStore.$embeddedPosts.set(post.uri, post);

    assert.deepEqual(derived.$hydratedPosts.get(post.uri), null);
    assert.deepEqual(derived.$hydratedEmbeddedPosts.get(post.uri), post);
  });
});

describe("$hydratedHashtagFeeds", () => {
  const hashtagKey = "javascript-top";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedHashtagFeeds.get(hashtagKey), null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);

    const rawFeed = {
      posts: [{ uri: "post1" }, { uri: "post2" }],
      cursor: "cursor123",
    };
    const post1 = { uri: "post1", content: "First post", likeCount: 5 };
    const post2 = { uri: "post2", content: "Second post", likeCount: 10 };

    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$hashtagFeeds.set(hashtagKey, rawFeed);

    const result = derived.$hydratedHashtagFeeds.get(hashtagKey);
    assert.deepEqual(result, {
      feed: [{ post: post1 }, { post: post2 }],
      cursor: "cursor123",
    });
  });

  it("should attach parentAuthor when post is a reply and parent is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);

    const parentAuthor = { did: "did:parent", handle: "parent.test" };
    const parent = {
      uri: "post-parent",
      author: parentAuthor,
    };
    const reply = {
      uri: "post-reply",
      record: {
        text: "reply text",
        reply: { parent: { uri: "post-parent" }, root: { uri: "post-parent" } },
      },
    };
    const rawFeed = {
      posts: [{ uri: "post-reply" }],
      cursor: "c",
    };

    dataStore.$posts.set("post-parent", parent);
    dataStore.$posts.set("post-reply", reply);
    dataStore.$hashtagFeeds.set(hashtagKey, rawFeed);

    const result = derived.$hydratedHashtagFeeds.get(hashtagKey);
    assert.deepEqual(
      result.feed[0].post.record.reply.parentAuthor,
      parentAuthor,
    );
  });

  it("should apply patches to posts in feed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);

    const rawFeed = {
      posts: [{ uri: "post1" }],
      cursor: "c",
    };
    const post1 = {
      uri: "post1",
      likeCount: 5,
      viewer: { like: null },
    };

    dataStore.$posts.set("post1", post1);
    dataStore.$hashtagFeeds.set(hashtagKey, rawFeed);
    patchStore.addPostPatch("post1", { type: "addLike" });

    const result = derived.$hydratedHashtagFeeds.get(hashtagKey);
    assert.deepEqual(result.feed[0].post.likeCount, 6);
    assert.deepEqual(result.feed[0].post.viewer.like, "fake like");
  });
});

describe("$hydratedProfiles", () => {
  const did = "did:plc:user";

  it("should return null when profile does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedProfiles.get(did), null);
  });

  it("should return the profile when it exists", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const profile = { did, handle: "user.test", followersCount: 10 };
    dataStore.$profiles.set(did, profile);
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.did, did);
    assert.deepEqual(result.handle, "user.test");
    assert.deepEqual(result.followersCount, 10);
  });

  it("should apply profile patches", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    const profile = {
      did,
      handle: "user.test",
      followersCount: 10,
      viewer: { following: null },
    };
    dataStore.$profiles.set(did, profile);
    patchStore.addProfilePatch(did, { type: "followProfile" });
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.followersCount, 11);
    assert.deepEqual(result.viewer.following, "fake following");
  });
});

describe("$convoProfiles", () => {
  const convoId = "convo1";
  const memberDid = "did:plc:member";
  const referencedDid = "did:plc:referenced";

  function setupConvo(dataStore, convoFields = {}) {
    dataStore.$convos.set(convoId, {
      id: convoId,
      members: [{ did: memberDid, handle: "member.test" }],
      ...convoFields,
    });
  }

  it("should return an empty list for an unknown convo", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$convoProfiles.get(convoId), []);
  });

  it("should return the members when no other profiles are referenced", () => {
    const dataStore = new DataStore(createSessionState(null));
    setupConvo(dataStore);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 1);
    assert.deepEqual(profiles[0].did, memberDid);
  });

  it("should append hydrated profiles referenced by the last interaction", () => {
    const dataStore = new DataStore(createSessionState(null));
    setupConvo(dataStore, {
      lastMessage: { id: "msg1", sender: { did: referencedDid } },
    });
    dataStore.setProfiles([{ did: referencedDid, handle: "referenced.test" }]);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 2);
    assert.deepEqual(profiles[0].did, memberDid);
    assert.deepEqual(profiles[1].did, referencedDid);
    assert.deepEqual(profiles[1].handle, "referenced.test");
  });

  it("should append hydrated profiles referenced by loaded messages", () => {
    const dataStore = new DataStore(createSessionState(null));
    setupConvo(dataStore);
    dataStore.$convoMessages.set(convoId, {
      messages: [
        { id: "msg1", sender: { did: referencedDid } },
        { id: "sys1", data: { member: { did: "did:plc:added" } } },
      ],
      cursor: null,
    });
    dataStore.setProfiles([
      { did: referencedDid, handle: "referenced.test" },
      { did: "did:plc:added", handle: "added.test" },
    ]);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 3);
    assert.deepEqual(profiles[1].handle, "referenced.test");
    assert.deepEqual(profiles[2].handle, "added.test");
  });

  it("should not duplicate referenced profiles that are also members", () => {
    const dataStore = new DataStore(createSessionState(null));
    setupConvo(dataStore, {
      lastMessage: { id: "msg1", sender: { did: memberDid } },
    });
    dataStore.setProfiles([{ did: memberDid, handle: "member.test" }]);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 1);
  });

  it("should skip referenced dids whose profiles are not hydrated", () => {
    const dataStore = new DataStore(createSessionState(null));
    setupConvo(dataStore, {
      lastMessage: { id: "msg1", sender: { did: referencedDid } },
    });
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 1);
    assert.deepEqual(profiles[0].did, memberDid);
  });
});

describe("$hydratedAuthorFeeds", () => {
  const did = "did:plc:author";
  const feedURI = `${did}-posts`;

  it("should return null when author feed does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedAuthorFeeds.get(feedURI), null);
  });

  it("should hydrate and return an author feed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const post1 = { uri: "post1", likeCount: 1 };
    const post2 = { uri: "post2", likeCount: 2 };
    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$authorFeeds.set(feedURI, {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "c",
    });
    const result = derived.$hydratedAuthorFeeds.get(feedURI);
    assert.deepEqual(result.feed.length, 2);
    assert.deepEqual(result.feed[0].post.uri, "post1");
    assert.deepEqual(result.feed[1].post.uri, "post2");
    assert.deepEqual(result.cursor, "c");
  });

  it("should filter to replies-only for replies feed type", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const repliesFeedURI = `${did}-replies`;
    const post1 = { uri: "post1" };
    const post2 = { uri: "post2" };
    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$posts.set("parent", { uri: "parent" });
    dataStore.$authorFeeds.set(repliesFeedURI, {
      feed: [
        { post: { uri: "post1" } }, // top-level, should be filtered out
        {
          post: { uri: "post2" },
          reply: { root: { uri: "parent" }, parent: { uri: "parent" } },
        },
      ],
      cursor: "c",
    });
    const result = derived.$hydratedAuthorFeeds.get(repliesFeedURI);
    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(result.feed[0].post.uri, "post2");
  });

  it("should pass through tombstone reply roots and parents unchanged", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const repliesFeedURI = `${did}-replies`;
    const notFoundRoot = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: "root",
      notFound: true,
    };
    const blockedParent = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "parent",
      blocked: true,
      author: { did: "did:plc:blocked", viewer: {} },
    };
    dataStore.$posts.set("post1", { uri: "post1" });
    dataStore.$authorFeeds.set(repliesFeedURI, {
      feed: [
        {
          post: { uri: "post1" },
          reply: { root: notFoundRoot, parent: blockedParent },
        },
      ],
      cursor: null,
    });
    const result = derived.$hydratedAuthorFeeds.get(repliesFeedURI);
    assert.deepEqual(result.feed[0].reply.root, notFoundRoot);
    assert.deepEqual(result.feed[0].reply.parent, blockedParent);
  });

  it("should hydrate postView reply roots and parents from the post store", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const repliesFeedURI = `${did}-replies`;
    const rootPost = { uri: "root", likeCount: 3 };
    dataStore.$posts.set("post1", { uri: "post1" });
    dataStore.$posts.set("root", rootPost);
    dataStore.$authorFeeds.set(repliesFeedURI, {
      feed: [
        {
          post: { uri: "post1" },
          reply: {
            root: { $type: "app.bsky.feed.defs#postView", uri: "root" },
            parent: { $type: "app.bsky.feed.defs#postView", uri: "root" },
          },
        },
      ],
      cursor: null,
    });
    const result = derived.$hydratedAuthorFeeds.get(repliesFeedURI);
    assert.deepEqual(result.feed[0].reply.root.likeCount, 3);
    assert.deepEqual(result.feed[0].reply.parent.likeCount, 3);
  });

  it("should apply author feed patches", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    const pinnedPost = { uri: "pinned", likeCount: 0 };
    const otherPost = { uri: "other", likeCount: 0 };
    dataStore.$posts.set("pinned", pinnedPost);
    dataStore.$posts.set("other", otherPost);
    dataStore.$authorFeeds.set(feedURI, {
      feed: [{ post: { uri: "other" } }, { post: { uri: "pinned" } }],
      cursor: null,
    });
    patchStore.addAuthorFeedPatch(feedURI, {
      type: "pinPost",
      post: { uri: "pinned" },
    });
    const result = derived.$hydratedAuthorFeeds.get(feedURI);
    assert.deepEqual(result.feed[0].post.uri, "pinned");
  });
});

describe("$actorFeeds", () => {
  const did = "did:plc:author";

  it("should return null when actor feeds do not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$actorFeeds.get(did), null);
  });

  it("should return the stored actor feeds", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const actorFeeds = { feeds: [{ uri: "feed-1" }], cursor: "c" };
    dataStore.$actorFeeds.set(did, actorFeeds);
    assert.deepEqual(derived.$actorFeeds.get(did), actorFeeds);
  });
});

describe("$profileChatStatus", () => {
  const did = "did:plc:user";

  it("should return null when chat status does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$profileChatStatus.get(did), null);
  });

  it("should return the stored chat status", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const status = { canChat: true, convo: null };
    dataStore.$profileChatStatus.set(did, status);
    assert.deepEqual(derived.$profileChatStatus.get(did), status);
  });
});

describe("$labelerInfo", () => {
  const did = "did:plc:labeler";

  it("should return null when labeler info does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$labelerInfo.get(did), null);
  });

  it("should return the stored labeler info", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const info = { policies: { labelValues: ["spam"] } };
    dataStore.$labelerInfo.set(did, info);
    assert.deepEqual(derived.$labelerInfo.get(did), info);
  });
});

describe("$labelerSettings", () => {
  it("should return labeler settings from preferences", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const labelerDid = "did:plc:labeler";
    const result = derived.$labelerSettings.get(labelerDid);
    // Logged-out preferences should still return a settings object
    assert.deepEqual(typeof result, "object");
  });
});

describe("$hydratedBookmarks", () => {
  it("should return null when bookmarks do not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedBookmarks.get(), null);
  });

  it("should hydrate and return bookmarks", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const post1 = { uri: "post1", likeCount: 5 };
    const post2 = { uri: "post2", likeCount: 10 };
    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$bookmarks.set({
      bookmarks: [{ item: { uri: "post1" } }, { item: { uri: "post2" } }],
      cursor: "c",
    });
    const result = derived.$hydratedBookmarks.get();
    assert.deepEqual(result.feed.length, 2);
    assert.deepEqual(result.feed[0].post.uri, "post1");
    assert.deepEqual(result.feed[1].post.uri, "post2");
    assert.deepEqual(result.cursor, "c");
  });

  it("should attach parentAuthor when bookmarked post is a reply", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const parentAuthor = { did: "did:parent", handle: "parent.test" };
    dataStore.$posts.set("post-parent", {
      uri: "post-parent",
      author: parentAuthor,
    });
    dataStore.$posts.set("post-reply", {
      uri: "post-reply",
      record: {
        text: "reply",
        reply: { parent: { uri: "post-parent" }, root: { uri: "post-parent" } },
      },
    });
    dataStore.$bookmarks.set({
      bookmarks: [{ item: { uri: "post-reply" } }],
      cursor: null,
    });
    const result = derived.$hydratedBookmarks.get();
    assert.deepEqual(
      result.feed[0].post.record.reply.parentAuthor,
      parentAuthor,
    );
  });
});

describe("$hydratedPinnedItems", () => {
  it("should return null when pinned items are not set", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPinnedItems.get(), null);
  });

  it("should hydrate pinned feed generators from the store", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const fg1 = { uri: "feed-1", displayName: "Feed One" };
    const fg2 = { uri: "feed-2", displayName: "Feed Two" };
    dataStore.$feedGenerators.set("feed-1", fg1);
    dataStore.$feedGenerators.set("feed-2", fg2);
    dataStore.$pinnedItems.set([
      { type: "feed", data: fg1 },
      { type: "feed", data: fg2 },
    ]);
    const result = derived.$hydratedPinnedItems.get();
    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].type, "feed");
    assert.deepEqual(result[0].uri, "feed-1");
    assert.deepEqual(result[0].displayName, "Feed One");
    assert.deepEqual(result[1].uri, "feed-2");
    assert.deepEqual(result[1].displayName, "Feed Two");
  });

  it("should hydrate list and timeline entries", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const list = { uri: "list-1", name: "My List" };
    dataStore.$pinnedItems.set([
      { type: "timeline", data: { uri: "following" } },
      { type: "list", data: list },
    ]);
    const result = derived.$hydratedPinnedItems.get();
    assert.deepEqual(result[0].type, "timeline");
    assert.deepEqual(result[0].displayName, "Following");
    assert.deepEqual(result[1].type, "list");
    assert.deepEqual(result[1].uri, "list-1");
    assert.deepEqual(result[1].displayName, "My List");
  });
});

describe("$hydratedPosts (post hydration)", () => {
  const postURI = "at://did:test/app.bsky.feed.post/x";

  it("should return null when the post does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPosts.get(postURI), null);
  });

  it("should mark the post when it contains a muted word", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ postHasMutedWord: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer.hasMutedWord, true);
  });

  it("should not mark the post when there is no muted word match", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer, undefined);
  });

  it("should mark the post hidden when preferences say so", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ isPostHidden: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer.isHidden, true);
  });

  it("should attach badge, content, and media labels from preferences", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForPost: () => ["badge"],
        getContentLabel: () => "warn",
        getMediaLabel: () => "blur",
      }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.badgeLabels, ["badge"]);
    assert.deepEqual(result.contentLabel, "warn");
    assert.deepEqual(result.mediaLabel, "blur");
  });

  it("should leave the post untouched when no labels apply", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.badgeLabels, undefined);
    assert.deepEqual(result.contentLabel, undefined);
    assert.deepEqual(result.mediaLabel, undefined);
  });

  it("should compose muted/hidden/label marks on a single post", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        postHasMutedWord: () => true,
        isPostHidden: () => true,
        getBadgeLabelsForPost: () => ["b"],
      }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer.hasMutedWord, true);
    assert.deepEqual(result.viewer.isHidden, true);
    assert.deepEqual(result.badgeLabels, ["b"]);
  });

  it("should synthesize a #blockedPost when the viewer blocks the author", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, {
      uri: postURI,
      record: { text: "should be hidden" },
      author: {
        did: "did:test",
        viewer: { blocking: "at://did:me/app.bsky.graph.block/1" },
      },
    });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result, {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: postURI,
      author: {
        did: "did:test",
        viewer: { blocking: "at://did:me/app.bsky.graph.block/1" },
      },
      blocked: true,
    });
  });

  it("should not re-synthesize a post that is already a #blockedPost", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: postURI,
      cid: "cid1",
      author: { did: "did:test" },
      blocked: true,
    };
    dataStore.$posts.set(postURI, blockedPost);
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result, blockedPost);
  });

  function makeBlockedQuotePost(viewerState) {
    return {
      uri: postURI,
      record: { text: "quoting post" },
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewBlocked",
          uri: "at://did:blocked/app.bsky.feed.post/q",
          blocked: true,
          author: { did: "did:blocked", viewer: viewerState },
        },
      },
    };
  }

  it("should keep a viewer-blocked quote as blocked when the quoted post is not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(
      postURI,
      makeBlockedQuotePost({ blocking: "at://did:me/app.bsky.graph.block/1" }),
    );
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewBlocked",
    );
  });

  it("should mark a viewer-blocked quote as deleted when the post is confirmed unavailable", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$unavailablePosts.set(
      quotedUri,
      createUnavailablePost(quotedUri),
    );
    dataStore.$posts.set(
      postURI,
      makeBlockedQuotePost({ blocking: "at://did:me/app.bsky.graph.block/1" }),
    );
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewNotFound",
    );
  });

  it("should mark a blocked-by quote as deleted when the post is confirmed unavailable", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$unavailablePosts.set(
      quotedUri,
      createUnavailablePost(quotedUri),
    );
    dataStore.$posts.set(postURI, makeBlockedQuotePost({ blockedBy: true }));
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewNotFound",
    );
  });

  it("should keep a viewer-blocked quote blocked even when the quoted post is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$posts.set(quotedUri, {
      uri: quotedUri,
      cid: "cid-q",
      author: { did: "did:blocked" },
      record: { text: "the quoted text" },
    });
    dataStore.$posts.set(
      postURI,
      makeBlockedQuotePost({ blocking: "at://did:me/app.bsky.graph.block/1" }),
    );
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewBlocked",
    );
  });

  it("should resolve a third-party-blocked quote when the quoted post is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$posts.set(quotedUri, {
      uri: quotedUri,
      cid: "cid-q",
      author: { did: "did:blocked" },
      record: { text: "the quoted text" },
    });
    dataStore.$posts.set(postURI, makeBlockedQuotePost({}));
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewRecord",
    );
    assert.deepEqual(result.embed.record.uri, quotedUri);
  });

  it("should keep the quote blocked when the quoted author blocks the viewer", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$posts.set(quotedUri, {
      uri: quotedUri,
      cid: "cid-q",
      author: { did: "did:blocked" },
      record: { text: "the quoted text" },
    });
    dataStore.$posts.set(postURI, makeBlockedQuotePost({ blockedBy: true }));
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewBlocked",
    );
  });

  it("should return the post unchanged when there is no blocked quote to resolve", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const post = { uri: postURI, record: { text: "hello" } };
    dataStore.$posts.set(postURI, post);
    const result = derived.$hydratedPosts.get(postURI);
    // hydratePostForView always returns a fresh clone
    assert.deepEqual(result.uri, post.uri);
    assert.deepEqual(result.record.text, "hello");
  });
});

describe("$convoForProfile", () => {
  const profileDid = "did:plc:other";
  const members = [{ did: "did:plc:me" }, { did: profileDid }];

  it("should return the direct convo containing the profile", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convos.set("direct1", {
      id: "direct1",
      members,
      kind: { $type: "chat.bsky.convo.defs#directConvo" },
    });
    const { derived } = makeDerived(dataStore);

    assert.deepEqual(derived.$convoForProfile.get(profileDid).id, "direct1");
  });

  it("should ignore group convos even with two members", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convos.set("group1", {
      id: "group1",
      members,
      kind: {
        $type: "chat.bsky.convo.defs#groupConvo",
        name: "Tiny Group",
        memberCount: 2,
        memberLimit: 10,
        lockStatus: "unlocked",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });
    const { derived } = makeDerived(dataStore);

    assert.deepEqual(derived.$convoForProfile.get(profileDid), null);
  });
});

describe("$hydratedConvoMessages", () => {
  const convoId = "convo-1";

  it("should return null when the convo has no messages", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedConvoMessages.get(convoId), null);
  });

  function seedMessages(dataStore, convoMessages, cursor = null) {
    for (const message of convoMessages) {
      dataStore.$messages.set(message.id, message);
    }
    dataStore.$convoMessages.set(convoId, {
      messages: convoMessages,
      cursor,
    });
  }

  it("should pass through raw messages and cursor", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedMessages(
      dataStore,
      [
        { id: "m1", sender: { did: "did:plc:alice" }, text: "hello" },
        { id: "m2", sender: { did: "did:plc:bob" }, text: "hi" },
      ],
      "abc",
    );
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.cursor, "abc");
    assert.deepEqual(result.messages.length, 2);
    assert.deepEqual(result.messages[0].id, "m1");
    assert.deepEqual(result.messages[1].id, "m2");
  });

  it("should preserve replyTo when present on a message", () => {
    const dataStore = new DataStore(createSessionState(null));
    const replyTo = {
      $type: "chat.bsky.convo.defs#messageView",
      id: "m1",
      sender: { did: "did:plc:alice" },
      text: "original",
    };
    seedMessages(dataStore, [
      { id: "m1", sender: { did: "did:plc:alice" }, text: "original" },
      {
        id: "m2",
        sender: { did: "did:plc:bob" },
        text: "reply text",
        replyTo,
      },
    ]);
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.messages[1].replyTo.id, "m1");
    assert.deepEqual(result.messages[1].replyTo.text, "original");
  });

  function seedConvoMembers(dataStore, members) {
    dataStore.$convos.set(convoId, { id: convoId, members });
  }

  const reaction = (value, did) => ({
    value,
    sender: { did },
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("should drop reactions from senders the viewer is blocking or blocked by", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedConvoMembers(dataStore, [
      {
        did: "did:plc:blocked",
        viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/1" },
      },
      { did: "did:plc:blocker", viewer: { blockedBy: true } },
      { did: "did:plc:alice", viewer: {} },
    ]);
    seedMessages(dataStore, [
      {
        id: "m1",
        sender: { did: "did:plc:alice" },
        text: "hello",
        reactions: [
          reaction("❤️", "did:plc:blocked"),
          reaction("👀", "did:plc:blocker"),
          reaction("👍", "did:plc:alice"),
        ],
      },
    ]);
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.messages[0].reactions.length, 1);
    assert.deepEqual(result.messages[0].reactions[0].value, "👍");
  });

  it("should keep reactions from senders who are not convo members", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedConvoMembers(dataStore, [{ did: "did:plc:alice", viewer: {} }]);
    seedMessages(dataStore, [
      {
        id: "m1",
        sender: { did: "did:plc:alice" },
        text: "hello",
        reactions: [reaction("❤️", "did:plc:departed")],
      },
    ]);
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.messages[0].reactions.length, 1);
  });

  it("should leave messages without reactions untouched", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedMessages(dataStore, [
      { id: "m1", sender: { did: "did:plc:alice" }, text: "hello" },
    ]);
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.messages[0].reactions, undefined);
  });

  it("should not recompute when the convo changes but members stay the same", () => {
    const dataStore = new DataStore(createSessionState(null));
    const members = [{ did: "did:plc:alice", viewer: {} }];
    dataStore.$convos.set(convoId, { id: convoId, members, unreadCount: 3 });
    seedMessages(dataStore, [
      {
        id: "m1",
        sender: { did: "did:plc:alice" },
        text: "hello",
        reactions: [reaction("👍", "did:plc:alice")],
      },
    ]);
    const { derived } = makeDerived(dataStore);
    const before = derived.$hydratedConvoMessages.get(convoId);

    const convo = dataStore.$convos.get(convoId);
    dataStore.$convos.set(convoId, { ...convo, unreadCount: 0 });
    const after = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(after === before, true);

    dataStore.$convos.set(convoId, {
      ...convo,
      members: [
        {
          did: "did:plc:alice",
          viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/1" },
        },
      ],
    });
    const afterBlock = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(afterBlock === before, false);
    assert.deepEqual(afterBlock.messages[0].reactions.length, 0);
  });
});

describe("$hydratedDrafts", () => {
  function makeDraftView(draftOverrides = {}) {
    return {
      id: "draft-1",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
      draft: {
        $type: "app.bsky.draft.defs#draft",
        deviceId: getDraftDeviceId(),
        deviceName: "Web",
        posts: [{ $type: "app.bsky.draft.defs#draftPost", text: "hi" }],
        ...draftOverrides,
      },
    };
  }

  // `localMedia` seeds the store's $media: path -> { url } | null
  function hydrateDraftPosts(draftViews, { localMedia = {} } = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const draftMediaStore = new DraftMediaStore("test-media");
    draftMediaStore.$media.set(localMedia);
    const { derived } = makeDerived(dataStore, { draftMediaStore });
    dataStore.$drafts.set({ drafts: draftViews, cursor: null });
    return derived.$hydratedDrafts.get().drafts[0].posts;
  }

  it("is null before loading and carries the view fields and cursor through", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedDrafts.get(), null);
    dataStore.$drafts.set({ drafts: [makeDraftView()], cursor: "next" });
    const data = derived.$hydratedDrafts.get();
    assert.deepEqual(data.cursor, "next");
    assert.deepEqual(data.drafts[0].id, "draft-1");
    assert.deepEqual(data.drafts[0].updatedAt, "2026-07-02T00:00:00.000Z");
    assert.deepEqual(data.drafts[0].draft.deviceName, "Web");
  });

  it("passes a text-only draft post through unchanged", () => {
    const posts = hydrateDraftPosts([makeDraftView()]);
    assert.deepEqual(posts, [
      { $type: "app.bsky.draft.defs#draftPost", text: "hi" },
    ]);
  });

  it("decorates gallery images with exists and previewUrl on the originating device", () => {
    const posts = hydrateDraftPosts(
      [
        makeDraftView({
          posts: [
            {
              text: "pics",
              embedGallery: {
                items: [{ localRef: { path: "image:a" }, alt: "cat" }],
              },
            },
          ],
        }),
      ],
      { localMedia: { "image:a": { url: "blob:stub-image:a" } } },
    );
    assert.deepEqual(posts[0].embedGallery.items, [
      {
        localRef: { path: "image:a" },
        alt: "cat",
        exists: true,
        previewUrl: "blob:stub-image:a",
      },
    ]);
  });

  it("decorates legacy embedImages the same way", () => {
    const posts = hydrateDraftPosts(
      [
        makeDraftView({
          posts: [
            {
              text: "",
              embedImages: [{ localRef: { path: "image:a" }, alt: "old" }],
            },
          ],
        }),
      ],
      { localMedia: { "image:a": { url: null } } },
    );
    assert.deepEqual(posts[0].embedImages[0].exists, true);
  });

  it("marks media missing when bytes are gone on the originating device", () => {
    const posts = hydrateDraftPosts([
      makeDraftView({
        posts: [
          {
            text: "",
            embedVideos: [{ localRef: { path: "video:video/mp4:v.mp4" } }],
          },
        ],
      }),
    ]);
    assert.deepEqual(posts[0].embedVideos[0].exists, false);
  });

  it("hydrates from local byte presence even for drafts saved on another device", () => {
    const posts = hydrateDraftPosts(
      [
        makeDraftView({
          deviceId: "some-other-device",
          posts: [
            {
              text: "",
              embedGallery: {
                items: [
                  { localRef: { path: "image:a" } },
                  { localRef: { path: "image:elsewhere" } },
                ],
              },
            },
          ],
        }),
      ],
      { localMedia: { "image:a": { url: "blob:stub-image:a" } } },
    );
    assert.deepEqual(posts[0].embedGallery.items[0].exists, true);
    assert.deepEqual(
      posts[0].embedGallery.items[0].previewUrl,
      "blob:stub-image:a",
    );
    assert.deepEqual(posts[0].embedGallery.items[1].exists, false);
    assert.deepEqual(posts[0].embedGallery.items[1].previewUrl, null);
  });

  it("hydrates every post of a thread draft", () => {
    const posts = hydrateDraftPosts([
      makeDraftView({
        posts: [
          {
            text: "a",
            embedRecords: [{ record: { uri: "at://x", cid: "c" } }],
          },
          { text: "b" },
          { text: "c" },
        ],
      }),
    ]);
    assert.deepEqual(posts.length, 3);
    assert.deepEqual(posts[0].embedRecords, [
      { record: { uri: "at://x", cid: "c" } },
    ]);
    assert.deepEqual(posts[1].embedRecords, undefined);
  });

  it("leaves gallery items without a localRef path untouched", () => {
    const posts = hydrateDraftPosts([
      makeDraftView({
        posts: [
          {
            text: "",
            embedGallery: { items: [{ alt: "remote-only" }] },
          },
        ],
      }),
    ]);
    assert.deepEqual(posts[0].embedGallery.items, [{ alt: "remote-only" }]);
  });

  it("leaves video embeds without a localRef path untouched", () => {
    const posts = hydrateDraftPosts([
      makeDraftView({
        posts: [
          {
            text: "",
            embedVideos: [{ captions: [] }],
          },
        ],
      }),
    ]);
    assert.deepEqual(posts[0].embedVideos, [{ captions: [] }]);
  });
});

describe("$groupConvoMemberList", () => {
  const convoId = "convo1";

  it("should return null when nothing is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$groupConvoMemberList.get(convoId), null);
  });

  it("should pass through the stored members and cursor", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convoMemberLists.set(convoId, {
      members: [{ did: "did:plc:alice" }, { did: "did:plc:bob" }],
      cursor: "2",
    });
    const { derived } = makeDerived(dataStore);
    const result = derived.$groupConvoMemberList.get(convoId);
    assert.deepEqual(
      result.members.map((member) => member.did),
      ["did:plc:alice", "did:plc:bob"],
    );
    assert.deepEqual(result.cursor, "2");
  });
});

describe("$hydratedPosts (nested quotes and author labels)", () => {
  const postURI = "at://did:test/app.bsky.feed.post/x";
  const quotedUri = "at://did:quoted/app.bsky.feed.post/q";

  function makeQuotePost() {
    return {
      uri: postURI,
      record: { text: "quoting post" },
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewRecord",
          uri: quotedUri,
          author: { did: "did:quoted" },
          value: { text: "quoted text" },
        },
      },
    };
  }

  it("should mark a quoted post that contains a muted word", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        quotedPostHasMutedWord: (quotedPost) => quotedPost.uri === quotedUri,
      }),
    });
    dataStore.$posts.set(postURI, makeQuotePost());
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.embed.record.hasMutedWord, true);
    assert.deepEqual(result.viewer, undefined);
  });

  it("should mark a quoted post that is hidden", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        isPostHidden: (uri) => uri === quotedUri,
      }),
    });
    dataStore.$posts.set(postURI, makeQuotePost());
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.embed.record.isHidden, true);
    assert.deepEqual(result.viewer, undefined);
  });

  it("should attach a blur label to the post author", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getProfileBlurLabel: (author) =>
          author?.did === "did:author" ? "adult" : null,
      }),
    });
    dataStore.$posts.set(postURI, {
      uri: postURI,
      author: { did: "did:author" },
      record: { text: "hello" },
    });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.author.blurLabel, "adult");
  });

  it("should keep a third-party-blocked quote blocked when the quoted post is not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, {
      uri: postURI,
      record: { text: "quoting post" },
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewBlocked",
          uri: "at://did:blocked/app.bsky.feed.post/q",
          blocked: true,
          author: { did: "did:blocked", viewer: {} },
        },
      },
    });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewBlocked",
    );
  });
});

describe("$hydratedPosts (join link previews)", () => {
  const postURI = "at://did:test/app.bsky.feed.post/x";

  function makeInviteLinkPost() {
    return {
      uri: postURI,
      record: { text: "join us" },
      embed: {
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://bsky.app/chat/abc1234" },
      },
    };
  }

  it("should attach a loaded join link preview to an invite link embed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const preview = {
      $type: "chat.bsky.group.defs#joinLinkPreviewView",
      code: "abc1234",
      groupName: "The Group",
    };
    dataStore.$joinLinkPreviewsByCode.set("abc1234", preview);
    dataStore.$posts.set(postURI, makeInviteLinkPost());
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.embed.$type, "chat.bsky.embed.joinLink#view");
    assert.deepEqual(result.embed.joinLinkPreview, preview);
  });

  it("should leave the embed unchanged when no preview is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set(postURI, makeInviteLinkPost());
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.embed.$type, "app.bsky.embed.external#view");
  });
});

describe("$hydratedFeeds (reason, replies, following feed)", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should preserve the feed item reason", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const reason = {
      $type: "app.bsky.feed.defs#reasonRepost",
      by: { did: "did:plc:reposter", handle: "reposter.test" },
    };
    dataStore.$posts.set("post1", { uri: "post1", record: { text: "hi" } });
    dataStore.$feeds.set(feedURI, {
      feed: [{ post: { uri: "post1" }, reason }],
      cursor: null,
    });
    const result = derived.$hydratedFeeds.get(feedURI);
    assert.deepEqual(result.feed[0].reason, reason);
  });

  it("should hydrate reply root and parent post views and pass through other reply nodes", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const rootPost = { uri: "root1", record: { text: "r" }, likeCount: 7 };
    const parentPost = { uri: "parent1", record: { text: "p" }, likeCount: 3 };
    const unknownNode = { $type: "custom#unknownNode", uri: "gone" };
    dataStore.$posts.set("root1", rootPost);
    dataStore.$posts.set("parent1", parentPost);
    dataStore.$posts.set("reply1", { uri: "reply1", record: { text: "a" } });
    dataStore.$posts.set("reply2", { uri: "reply2", record: { text: "b" } });
    dataStore.$feeds.set(feedURI, {
      feed: [
        {
          post: { uri: "reply1" },
          reply: {
            root: { $type: "app.bsky.feed.defs#postView", uri: "root1" },
            parent: { $type: "app.bsky.feed.defs#postView", uri: "parent1" },
          },
        },
        {
          post: { uri: "reply2" },
          reply: { root: unknownNode, parent: unknownNode },
        },
      ],
      cursor: null,
    });
    const result = derived.$hydratedFeeds.get(feedURI);
    assert.deepEqual(result.feed[0].reply.root.likeCount, 7);
    assert.deepEqual(result.feed[0].reply.parent.likeCount, 3);
    assert.deepEqual(result.feed[1].reply.root, unknownNode);
    assert.deepEqual(result.feed[1].reply.parent, unknownNode);
  });

  it("should run the following feed through the following filter pipeline", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const post = createPost({
      uri: "at://did:plc:author/app.bsky.feed.post/1",
      text: "hello",
      authorHandle: "author.test",
    });
    dataStore.$posts.set(post.uri, post);
    dataStore.$feeds.set("following", {
      feed: [{ post: { uri: post.uri } }],
      cursor: "fc",
    });
    const result = derived.$hydratedFeeds.get("following");
    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(result.feed[0].post.uri, post.uri);
    assert.deepEqual(result.cursor, "fc");
  });
});

describe("$notifications", () => {
  const author = createProfile({ did: "did:plc:actor", handle: "actor.test" });

  function seedNotifications(dataStore, notifications, cursor = null) {
    dataStore.setProfiles(
      notifications.map((notification) => notification.author),
    );
    dataStore.$notifications.set({ notifications, cursor });
  }

  it("should return null when notifications are not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$notifications.get(), null);
  });

  it("should attach the liked post as subject when it is loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("post1", { uri: "post1", record: { text: "hi" } });
    seedNotifications(dataStore, [
      createNotification({ reason: "like", author, reasonSubject: "post1" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].subject.uri, "post1");
    assert.deepEqual(result[0].subject.record.text, "hi");
  });

  it("should attach an unavailable subject when the liked post is missing", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    seedNotifications(dataStore, [
      createNotification({ reason: "repost", author, reasonSubject: "gone" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].subject, createUnavailablePost("gone"));
  });

  it("should resolve via-repost notifications from the record subject", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("post1", { uri: "post1", record: { text: "hi" } });
    seedNotifications(dataStore, [
      createNotification({
        reason: "like-via-repost",
        author,
        record: { subject: { uri: "post1" } },
      }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].subject.uri, "post1");
  });

  it("should attach post and parent for reply notifications", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("reply1", { uri: "reply1", record: { text: "r" } });
    dataStore.$posts.set("parent1", { uri: "parent1", record: { text: "p" } });
    seedNotifications(dataStore, [
      createNotification({
        reason: "reply",
        author,
        uri: "reply1",
        record: { reply: { parent: { uri: "parent1" } } },
      }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].post.uri, "reply1");
    assert.deepEqual(result[0].parentPost.uri, "parent1");
  });

  it("should leave parentPost null for mentions without a reply parent", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("m1", { uri: "m1", record: { text: "m" } });
    seedNotifications(dataStore, [
      createNotification({ reason: "mention", author, uri: "m1", record: {} }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].post.uri, "m1");
    assert.deepEqual(result[0].parentPost, null);
  });

  it("should attach the post as reasonSubject for subscribed-post notifications", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("s1", { uri: "s1", record: { text: "s" } });
    seedNotifications(dataStore, [
      createNotification({ reason: "subscribed-post", author, uri: "s1" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].reasonSubject.uri, "s1");
  });

  it("should pass through notifications with other reasons unchanged", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const notification = createNotification({ reason: "follow", author });
    seedNotifications(dataStore, [notification]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0], notification);
  });

  it("should hydrate the author from the profile store", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    seedNotifications(dataStore, [
      createNotification({ reason: "follow", author }),
    ]);
    patchStore.addProfilePatch(author.did, { type: "followProfile" });
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].author.badgeLabels, ["verified"]);
    assert.deepEqual(result[0].author.viewer.following, "fake following");
  });

  it("should override isRead using the captured seenAt", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    seedNotifications(dataStore, [
      createNotification({
        reason: "follow",
        author,
        uri: "old",
        isRead: false,
        indexedAt: "2025-01-15T09:00:00.000Z",
      }),
      createNotification({
        reason: "follow",
        author,
        uri: "new",
        isRead: true,
        indexedAt: "2025-01-15T11:00:00.000Z",
      }),
    ]);
    dataStore.$notificationsLastSeenAt.set("2025-01-15T10:00:00.000Z");
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].isRead, true);
    assert.deepEqual(result[1].isRead, false);
  });

  it("should treat a notification indexed exactly at seenAt as read", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    seedNotifications(dataStore, [
      createNotification({
        reason: "follow",
        author,
        isRead: false,
        indexedAt: "2025-01-15T10:00:00.000Z",
      }),
    ]);
    dataStore.$notificationsLastSeenAt.set("2025-01-15T10:00:00.000Z");
    assert.deepEqual(derived.$notifications.get()[0].isRead, true);
  });

  it("should trust the server isRead when seenAt is null", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    seedNotifications(dataStore, [
      createNotification({ reason: "follow", author, uri: "r", isRead: true }),
      createNotification({ reason: "follow", author, uri: "u", isRead: false }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result[0].isRead, true);
    assert.deepEqual(result[1].isRead, false);
  });

  it("should filter out notifications from authors the viewer is blocking", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const blocked = createProfile({
      did: "did:plc:blocked",
      handle: "blocked.test",
      viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/1" },
    });
    seedNotifications(dataStore, [
      createNotification({ reason: "follow", author, uri: "n1" }),
      createNotification({ reason: "follow", author: blocked, uri: "n2" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].author.did, author.did);
  });

  it("should filter out notifications from muted authors the viewer does not follow", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const muted = createProfile({
      did: "did:plc:muted",
      handle: "muted.test",
      viewer: { muted: true },
    });
    seedNotifications(dataStore, [
      createNotification({ reason: "follow", author, uri: "n1" }),
      createNotification({ reason: "follow", author: muted, uri: "n2" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].author.did, author.did);
  });

  it("should keep notifications from muted authors when the viewer follows them", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const mutedFollow = createProfile({
      did: "did:plc:mutedfollow",
      handle: "mutedfollow.test",
      viewer: {
        muted: true,
        following: "at://did:plc:me/app.bsky.graph.follow/1",
      },
    });
    seedNotifications(dataStore, [
      createNotification({ reason: "follow", author: mutedFollow, uri: "n1" }),
    ]);
    const result = derived.$notifications.get();
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].author.did, mutedFollow.did);
  });

  it("should recompute isRead when seenAt is captured later", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    seedNotifications(dataStore, [
      createNotification({
        reason: "follow",
        author,
        isRead: true,
        indexedAt: "2025-01-15T11:00:00.000Z",
      }),
    ]);
    assert.deepEqual(derived.$notifications.get()[0].isRead, true);
    dataStore.$notificationsLastSeenAt.set("2025-01-15T10:00:00.000Z");
    assert.deepEqual(derived.$notifications.get()[0].isRead, false);
  });
});

describe("$mentionNotifications", () => {
  it("should return null when mention notifications are not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$mentionNotifications.get(), null);
  });

  it("should hydrate mention notifications", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const author = createProfile({ did: "did:plc:a", handle: "a.test" });
    dataStore.setProfiles([author]);
    dataStore.$posts.set("m1", { uri: "m1", record: { text: "m" } });
    dataStore.$mentionNotifications.set({
      notifications: [
        createNotification({
          reason: "mention",
          author,
          uri: "m1",
          record: {},
        }),
      ],
      cursor: "mc",
    });
    const result = derived.$mentionNotifications.get();
    assert.deepEqual(result[0].post.uri, "m1");
    assert.deepEqual(derived.$mentionNotificationCursor.get(), "mc");
  });

  it("should override isRead using the shared seenAt from the main feed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const author = createProfile({ did: "did:plc:a", handle: "a.test" });
    dataStore.setProfiles([author]);
    dataStore.$mentionNotifications.set({
      notifications: [
        createNotification({
          reason: "follow",
          author,
          isRead: true,
          indexedAt: "2025-01-15T11:00:00.000Z",
        }),
      ],
      cursor: null,
    });
    dataStore.$notificationsLastSeenAt.set("2025-01-15T10:00:00.000Z");
    assert.deepEqual(derived.$mentionNotifications.get()[0].isRead, false);
  });
});

describe("$hydratedPostThreads", () => {
  const threadUri = "post1";

  it("should return null when the thread or its hidden replies are not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPostThreads.get(threadUri), null);
    dataStore.$postThreads.set(threadUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: threadUri },
    });
    // Still null without $postThreadOthers
    assert.deepEqual(derived.$hydratedPostThreads.get(threadUri), null);
  });

  it("should pass through an empty (not found) thread", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const notFound = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: threadUri,
    };
    dataStore.$postThreads.set(threadUri, notFound);
    dataStore.$postThreadOthers.set(threadUri, []);
    assert.deepEqual(derived.$hydratedPostThreads.get(threadUri), notFound);
  });

  it("should return null when the thread root post is not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$postThreads.set(threadUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: threadUri },
    });
    dataStore.$postThreadOthers.set(threadUri, []);
    assert.deepEqual(derived.$hydratedPostThreads.get(threadUri), null);
  });

  it("should hydrate replies, marking hidden ones and passing through non-post replies", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const blockedReply = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blocked1",
      blocked: true,
    };
    dataStore.$posts.set(threadUri, {
      uri: threadUri,
      record: { text: "root" },
    });
    dataStore.$posts.set("reply1", { uri: "reply1", record: { text: "r1" } });
    dataStore.$postThreads.set(threadUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: threadUri },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1" },
        },
        blockedReply,
      ],
    });
    dataStore.$postThreadOthers.set(threadUri, [{ uri: "reply1" }]);
    const result = derived.$hydratedPostThreads.get(threadUri);
    assert.deepEqual(result.post.uri, threadUri);
    assert.deepEqual(result.replies[0].post.uri, "reply1");
    assert.deepEqual(result.replies[0].post.isHidden, true);
    assert.deepEqual(result.replies[1], blockedReply);
  });

  function seedThreadWithParent(dataStore, parent) {
    dataStore.$posts.set(threadUri, {
      uri: threadUri,
      record: { text: "root" },
    });
    dataStore.$postThreads.set(threadUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: threadUri },
      parent,
    });
    dataStore.$postThreadOthers.set(threadUri, []);
  }

  it("should hydrate a parent chain recursively", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const grandparent = { $type: "app.bsky.feed.defs#notFoundPost", uri: "gp" };
    dataStore.$posts.set("pp", { uri: "pp", record: { text: "parent" } });
    seedThreadWithParent(dataStore, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: "pp" },
      parent: grandparent,
    });
    const result = derived.$hydratedPostThreads.get(threadUri);
    assert.deepEqual(result.parent.post.uri, "pp");
    assert.deepEqual(result.parent.post.record.text, "parent");
    assert.deepEqual(result.parent.parent, grandparent);
  });

  it("should replace a confirmed-unavailable parent with an unavailable post", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$unavailablePosts.set("pp", createUnavailablePost("pp"));
    seedThreadWithParent(dataStore, {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "pp",
      blocked: true,
      author: { did: "did:blocked", viewer: {} },
    });
    const result = derived.$hydratedPostThreads.get(threadUri);
    assert.deepEqual(result.parent, createUnavailablePost("pp"));
  });

  it("should keep a blocked parent as-is when the parent author blocks the viewer", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const blockedParent = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "pp",
      blocked: true,
      author: { did: "did:blocked", viewer: { blockedBy: true } },
    };
    seedThreadWithParent(dataStore, blockedParent);
    const result = derived.$hydratedPostThreads.get(threadUri);
    assert.deepEqual(result.parent, blockedParent);
  });
});

describe("actor search results", () => {
  const did = "did:plc:found";

  function seedProfile(dataStore) {
    dataStore.setProfiles([createProfile({ did, handle: "found.test" })]);
  }

  it("$profileSearchResults should be null before a search and hydrate after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$profileSearchResults.get(), null);
    assert.deepEqual(derived.$profileSearchCursor.get(), null);
    seedProfile(dataStore);
    dataStore.$profileSearchResults.set({
      actors: [{ did }],
      cursor: "pc",
    });
    const result = derived.$profileSearchResults.get();
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].handle, "found.test");
    assert.deepEqual(derived.$profileSearchCursor.get(), "pc");
  });

  it("$chatRecipientSearchResults should be null before a search and hydrate after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$chatRecipientSearchResults.get(), null);
    seedProfile(dataStore);
    dataStore.$chatRecipientSearchResults.set({ actors: [{ did }] });
    const result = derived.$chatRecipientSearchResults.get();
    assert.deepEqual(result[0].handle, "found.test");
  });

  it("$searchTypeaheadResults should be null before a search and hydrate after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$searchTypeaheadResults.get(), null);
    seedProfile(dataStore);
    dataStore.$searchTypeaheadResults.set({ actors: [{ did }] });
    const result = derived.$searchTypeaheadResults.get();
    assert.deepEqual(result[0].handle, "found.test");
  });
});

describe("$feedSearchResults", () => {
  it("should be null before a search and pass feeds through after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$feedSearchResults.get(), null);
    assert.deepEqual(derived.$feedSearchCursor.get(), null);
    const feeds = [{ uri: "feed-1", displayName: "Feed One" }];
    dataStore.$feedSearchResults.set({ feeds, cursor: "fc" });
    assert.deepEqual(derived.$feedSearchResults.get(), feeds);
    assert.deepEqual(derived.$feedSearchCursor.get(), "fc");
  });
});

describe("post search results", () => {
  it("should be null before a search and hydrate loaded posts after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$postSearchResultsTop.get(), null);
    assert.deepEqual(derived.$postSearchResultsLatest.get(), null);
    assert.deepEqual(derived.$postSearchCursorTop.get(), null);
    assert.deepEqual(derived.$postSearchCursorLatest.get(), null);
    dataStore.$posts.set("post1", { uri: "post1", record: { text: "hit" } });
    dataStore.$postSearchResultsTop.set({
      posts: [{ uri: "post1" }, { uri: "missing" }],
      cursor: "tc",
    });
    dataStore.$postSearchResultsLatest.set({
      posts: [{ uri: "post1" }],
      cursor: "lc",
    });
    const top = derived.$postSearchResultsTop.get();
    assert.deepEqual(top.length, 1);
    assert.deepEqual(top[0].uri, "post1");
    const latest = derived.$postSearchResultsLatest.get();
    assert.deepEqual(latest.length, 1);
    assert.deepEqual(derived.$postSearchCursorTop.get(), "tc");
    assert.deepEqual(derived.$postSearchCursorLatest.get(), "lc");
  });
});

describe("$hydratedPostQuotes", () => {
  const postUri = "post1";

  it("should return null when quotes are not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPostQuotes.get(postUri), null);
  });

  it("should hydrate loaded quote posts and skip missing ones", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    dataStore.$posts.set("quote1", { uri: "quote1", record: { text: "q" } });
    dataStore.$postQuotes.set(postUri, {
      posts: [{ uri: "quote1" }, { uri: "missing" }],
      cursor: "qc",
    });
    const result = derived.$hydratedPostQuotes.get(postUri);
    assert.deepEqual(result.posts.length, 1);
    assert.deepEqual(result.posts[0].uri, "quote1");
    assert.deepEqual(result.cursor, "qc");
  });
});

describe("$listMembers", () => {
  const listUri = "at://did:plc:owner/app.bsky.graph.list/1";

  it("should return null when list members are not loaded", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$listMembers.get(listUri), null);
  });

  it("should hydrate member profiles and carry the cursor", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    const did = "did:plc:member";
    dataStore.setProfiles([createProfile({ did, handle: "member.test" })]);
    dataStore.$listMembers.set(listUri, {
      items: [{ subject: { did } }],
      cursor: "lc",
    });
    const result = derived.$listMembers.get(listUri);
    assert.deepEqual(result.members.length, 1);
    assert.deepEqual(result.members[0].handle, "member.test");
    assert.deepEqual(result.cursor, "lc");
  });
});

describe("$hydratedProfiles (labels)", () => {
  const did = "did:plc:user";

  it("should attach a blur label from preferences", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ getProfileBlurLabel: () => "adult" }),
    });
    dataStore.setProfiles([createProfile({ did, handle: "user.test" })]);
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.blurLabel, "adult");
  });

  it("should attach badge labels from preferences", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    dataStore.setProfiles([createProfile({ did, handle: "user.test" })]);
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.badgeLabels, ["verified"]);
  });

  it("should return the profile unchanged when no labels apply", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.setProfiles([createProfile({ did, handle: "user.test" })]);
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.blurLabel, undefined);
    assert.deepEqual(result.badgeLabels, undefined);
  });
});

describe("$mutedProfiles and $blockedProfiles", () => {
  const did = "did:plc:user";

  function seedMuted(dataStore) {
    const profile = createProfile({ did, handle: "user.test" });
    dataStore.setProfiles([profile]);
    dataStore.$mutedProfiles.set({ mutes: [profile], cursor: null });
  }

  it("should attach badge labels to muted profiles", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    seedMuted(dataStore);
    const result = derived.$mutedProfiles.get();
    assert.deepEqual(result.mutes[0].badgeLabels, ["verified"]);
    assert.deepEqual(result.cursor, null);
  });

  it("should attach badge labels to blocked profiles", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    const profile = createProfile({ did, handle: "user.test" });
    dataStore.setProfiles([profile]);
    dataStore.$blockedProfiles.set({ blocks: [profile], cursor: null });
    const result = derived.$blockedProfiles.get();
    assert.deepEqual(result.blocks[0].badgeLabels, ["verified"]);
  });

  it("should return the lists unchanged when no labels apply", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    seedMuted(dataStore);
    const result = derived.$mutedProfiles.get();
    assert.deepEqual(result.mutes[0].badgeLabels, undefined);
    assert.deepEqual(result.mutes[0].blurLabel, undefined);
  });

  it("should reflect profile patches in the list", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    seedMuted(dataStore);
    patchStore.addProfilePatch(did, { type: "followProfile" });
    const result = derived.$mutedProfiles.get();
    assert.deepEqual(result.mutes[0].viewer.following, "fake following");
  });
});

describe("$hydratedDetailedProfiles", () => {
  const did = "did:plc:user";

  it("should return null when the detailed profile does not exist", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedDetailedProfiles.get(did), null);
  });

  it("should return the profile unchanged when no labels apply", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$detailedProfiles.set(
      did,
      createProfile({ did, handle: "user.test" }),
    );
    const result = derived.$hydratedDetailedProfiles.get(did);
    assert.deepEqual(result.handle, "user.test");
    assert.deepEqual(result.blurLabel, undefined);
    assert.deepEqual(result.badgeLabels, undefined);
  });

  it("should attach blur and badge labels from preferences", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getProfileBlurLabel: () => "adult",
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    dataStore.$detailedProfiles.set(
      did,
      createProfile({ did, handle: "user.test" }),
    );
    const result = derived.$hydratedDetailedProfiles.get(did);
    assert.deepEqual(result.blurLabel, "adult");
    assert.deepEqual(result.badgeLabels, ["verified"]);
  });
});

describe("$convoList and $convoRequestList", () => {
  function seedConvos(dataStore, convos) {
    for (const convo of convos) {
      dataStore.$convos.set(convo.id, convo);
    }
  }

  function makeConvoWithMessage(id, sentAt, status = "accepted") {
    return createConvo({
      id,
      status,
      otherMember: createProfile({
        did: `did:plc:${id}`,
        handle: `${id}.test`,
      }),
      lastMessage: createMessage({
        id: `msg-${id}`,
        text: "hello",
        senderDid: `did:plc:${id}`,
        sentAt,
      }),
    });
  }

  it("$convoList should be null before loading", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$convoList.get(), null);
    assert.deepEqual(derived.$convoListCursor.get(), null);
  });

  it("$convoList should sort convos by last interaction, newest first", () => {
    const dataStore = new DataStore(createSessionState(null));
    const older = makeConvoWithMessage("older", "2026-01-01T00:00:00.000Z");
    const newer = makeConvoWithMessage("newer", "2026-01-05T00:00:00.000Z");
    seedConvos(dataStore, [older, newer]);
    dataStore.$convoList.set({
      convos: [older, newer],
      cursor: "cc",
    });
    const { derived } = makeDerived(dataStore);
    const result = derived.$convoList.get();
    assert.deepEqual(
      result.map((convo) => convo.id),
      ["newer", "older"],
    );
    assert.deepEqual(derived.$convoListCursor.get(), "cc");
  });

  it("$convoRequestList should be null before loading", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$convoRequestList.get(), null);
    assert.deepEqual(derived.$convoRequestListCursor.get(), null);
  });

  it("$convoRequestList should drop unknown convos and sort the rest", () => {
    const dataStore = new DataStore(createSessionState(null));
    const older = makeConvoWithMessage(
      "older",
      "2026-01-01T00:00:00.000Z",
      "request",
    );
    const newer = makeConvoWithMessage(
      "newer",
      "2026-01-05T00:00:00.000Z",
      "request",
    );
    seedConvos(dataStore, [older, newer]);
    dataStore.$convoRequestList.set({
      convos: [older, newer, { id: "not-in-store" }],
      cursor: "rc",
    });
    const { derived } = makeDerived(dataStore);
    const result = derived.$convoRequestList.get();
    assert.deepEqual(
      result.map((convo) => convo.id),
      ["newer", "older"],
    );
    assert.deepEqual(derived.$convoRequestListCursor.get(), "rc");
  });
});

describe("$convoProfiles (labels)", () => {
  function seedConvo(dataStore) {
    dataStore.$convos.set("convo1", {
      id: "convo1",
      members: [{ did: "did:plc:member", handle: "member.test" }],
    });
  }

  it("should attach badge labels to convo members", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedConvo(dataStore);
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabelsForProfile: () => ["verified"],
      }),
    });
    const profiles = derived.$convoProfiles.get("convo1");
    assert.deepEqual(profiles[0].badgeLabels, ["verified"]);
  });

  it("should attach a blur label to convo members", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedConvo(dataStore);
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ getProfileBlurLabel: () => "adult" }),
    });
    const profiles = derived.$convoProfiles.get("convo1");
    assert.deepEqual(profiles[0].blurLabel, "adult");
  });

  it("should return members unchanged when no labels apply", () => {
    const dataStore = new DataStore(createSessionState(null));
    seedConvo(dataStore);
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const profiles = derived.$convoProfiles.get("convo1");
    assert.deepEqual(profiles[0].badgeLabels, undefined);
    assert.deepEqual(profiles[0].blurLabel, undefined);
  });
});

describe("interaction and graph list hydration", () => {
  const actorDid = "did:plc:actor";

  function seedActor(dataStore) {
    dataStore.setProfiles([
      createProfile({ did: actorDid, handle: "actor.test" }),
    ]);
  }

  it("$postLikes should be null before loading and hydrate actors after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$postLikes.get("post1"), null);
    seedActor(dataStore);
    dataStore.$postLikes.set("post1", {
      likes: [{ actor: { did: actorDid }, createdAt: "2026-01-01T00:00:00Z" }],
      cursor: "lc",
    });
    const result = derived.$postLikes.get("post1");
    assert.deepEqual(result.likes[0].actor.handle, "actor.test");
    assert.deepEqual(result.likes[0].createdAt, "2026-01-01T00:00:00Z");
    assert.deepEqual(result.cursor, "lc");
  });

  it("$postReposts should be null before loading and hydrate actors after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$postReposts.get("post1"), null);
    seedActor(dataStore);
    dataStore.$postReposts.set("post1", {
      repostedBy: [{ did: actorDid }],
      cursor: "rc",
    });
    const result = derived.$postReposts.get("post1");
    assert.deepEqual(result.repostedBy[0].handle, "actor.test");
    assert.deepEqual(result.cursor, "rc");
  });

  it("$profileFollows should be null before loading and hydrate actors after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$profileFollows.get("did:plc:subject"), null);
    seedActor(dataStore);
    dataStore.$profileFollows.set("did:plc:subject", {
      follows: [{ did: actorDid }],
      cursor: "fc",
    });
    const result = derived.$profileFollows.get("did:plc:subject");
    assert.deepEqual(result.follows[0].handle, "actor.test");
    assert.deepEqual(result.cursor, "fc");
  });

  it("$profileFollowers should be null before loading and hydrate actors after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$profileFollowers.get("did:plc:subject"), null);
    seedActor(dataStore);
    dataStore.$profileFollowers.set("did:plc:subject", {
      followers: [{ did: actorDid }],
      cursor: "fc",
    });
    const result = derived.$profileFollowers.get("did:plc:subject");
    assert.deepEqual(result.followers[0].handle, "actor.test");
    assert.deepEqual(result.cursor, "fc");
  });

  it("$knownFollowers should be null before loading and hydrate actors after", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$knownFollowers.get("did:plc:subject"), null);
    seedActor(dataStore);
    dataStore.$knownFollowers.set("did:plc:subject", {
      followers: [{ did: actorDid }],
      count: 3,
    });
    const result = derived.$knownFollowers.get("did:plc:subject");
    assert.deepEqual(result.followers[0].handle, "actor.test");
    assert.deepEqual(result.count, 3);
  });
});

describe("$isFollowPending / $isBlockPending / $isMutePending", () => {
  const did = "did:test:pending";

  it("$isFollowPending is false when no follow/unfollow patch is pending", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$isFollowPending.get(did), false);
  });

  it("$isFollowPending flips true while a followProfile patch is pending", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    const patchId = patchStore.addProfilePatch(did, { type: "followProfile" });
    assert.deepEqual(derived.$isFollowPending.get(did), true);
    patchStore.removeProfilePatch(did, patchId);
    assert.deepEqual(derived.$isFollowPending.get(did), false);
  });

  it("$isFollowPending flips true while an unfollowProfile patch is pending", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    patchStore.addProfilePatch(did, { type: "unfollowProfile" });
    assert.deepEqual(derived.$isFollowPending.get(did), true);
  });

  it("$isFollowPending ignores unrelated profile patches", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    patchStore.addProfilePatch(did, { type: "muteProfile" });
    patchStore.addProfilePatch(did, { type: "blockProfile" });
    assert.deepEqual(derived.$isFollowPending.get(did), false);
  });

  it("$isBlockPending covers blockProfile and unblockProfile", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    const blockId = patchStore.addProfilePatch(did, { type: "blockProfile" });
    assert.deepEqual(derived.$isBlockPending.get(did), true);
    patchStore.removeProfilePatch(did, blockId);
    patchStore.addProfilePatch(did, { type: "unblockProfile" });
    assert.deepEqual(derived.$isBlockPending.get(did), true);
  });

  it("$isMutePending covers muteProfile and unmuteProfile", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    const muteId = patchStore.addProfilePatch(did, { type: "muteProfile" });
    assert.deepEqual(derived.$isMutePending.get(did), true);
    patchStore.removeProfilePatch(did, muteId);
    patchStore.addProfilePatch(did, { type: "unmuteProfile" });
    assert.deepEqual(derived.$isMutePending.get(did), true);
  });

  it("pending signals are keyed per profile", () => {
    const dataStore = new DataStore(createSessionState(null));
    const { derived, patchStore } = makeDerived(dataStore);
    patchStore.addProfilePatch(did, { type: "followProfile" });
    assert.deepEqual(derived.$isFollowPending.get(did), true);
    assert.deepEqual(derived.$isFollowPending.get("did:test:other"), false);
  });
});
