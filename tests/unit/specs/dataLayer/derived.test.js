import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Derived } from "/js/dataLayer/derived.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { DraftMediaStore, getDraftDeviceId } from "/js/drafts.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Preferences } from "/js/preferences.js";
import { Signal, SignalMap } from "/js/signals.js";

function makeDerived(dataStore, { preferences, draftMediaStore } = {}) {
  const patchStore = new PatchStore(dataStore);
  const prefs = preferences ?? Preferences.createLoggedOutPreferences();
  const preferencesProvider = {
    requirePreferences: () => prefs,
    $preferences: new Signal.State(prefs),
  };
  const pluginService = {
    $pluginFilteredFeedItems: new SignalMap(),
  };
  const derived = new Derived(
    dataStore,
    patchStore,
    preferencesProvider,
    pluginService,
    false,
    draftMediaStore ?? new DraftMediaStore("test-media"),
  );
  return { derived, patchStore };
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
    clone() {
      return this;
    },
    ...overrides,
  };
}

describe("$hydratedFeeds", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedFeeds.get(feedURI), null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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

describe("$hydratedHashtagFeeds", () => {
  const hashtagKey = "javascript-top";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedHashtagFeeds.get(hashtagKey), null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedProfiles.get(did), null);
  });

  it("should return the profile when it exists", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const profile = { did, handle: "user.test", followersCount: 10 };
    dataStore.$profiles.set(did, profile);
    const result = derived.$hydratedProfiles.get(did);
    assert.deepEqual(result.did, did);
    assert.deepEqual(result.handle, "user.test");
    assert.deepEqual(result.followersCount, 10);
  });

  it("should apply profile patches", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$convoProfiles.get(convoId), []);
  });

  it("should return the members when no other profiles are referenced", () => {
    const dataStore = new DataStore();
    setupConvo(dataStore);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 1);
    assert.deepEqual(profiles[0].did, memberDid);
  });

  it("should append hydrated profiles referenced by the last interaction", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    setupConvo(dataStore, {
      lastMessage: { id: "msg1", sender: { did: memberDid } },
    });
    dataStore.setProfiles([{ did: memberDid, handle: "member.test" }]);
    const { derived } = makeDerived(dataStore);
    const profiles = derived.$convoProfiles.get(convoId);
    assert.deepEqual(profiles.length, 1);
  });

  it("should skip referenced dids whose profiles are not hydrated", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedAuthorFeeds.get(feedURI), null);
  });

  it("should hydrate and return an author feed", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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

  it("should apply author feed patches", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$actorFeeds.get(did), null);
  });

  it("should return the stored actor feeds", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const actorFeeds = { feeds: [{ uri: "feed-1" }], cursor: "c" };
    dataStore.$actorFeeds.set(did, actorFeeds);
    assert.deepEqual(derived.$actorFeeds.get(did), actorFeeds);
  });
});

describe("$profileChatStatus", () => {
  const did = "did:plc:user";

  it("should return null when chat status does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$profileChatStatus.get(did), null);
  });

  it("should return the stored chat status", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const status = { canChat: true, convo: null };
    dataStore.$profileChatStatus.set(did, status);
    assert.deepEqual(derived.$profileChatStatus.get(did), status);
  });
});

describe("$labelerInfo", () => {
  const did = "did:plc:labeler";

  it("should return null when labeler info does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$labelerInfo.get(did), null);
  });

  it("should return the stored labeler info", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const info = { policies: { labelValues: ["spam"] } };
    dataStore.$labelerInfo.set(did, info);
    assert.deepEqual(derived.$labelerInfo.get(did), info);
  });
});

describe("$labelerSettings", () => {
  it("should return labeler settings from preferences", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const labelerDid = "did:plc:labeler";
    const result = derived.$labelerSettings.get(labelerDid);
    // Logged-out preferences should still return a settings object
    assert.deepEqual(typeof result, "object");
  });
});

describe("$hydratedBookmarks", () => {
  it("should return null when bookmarks do not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedBookmarks.get(), null);
  });

  it("should hydrate and return bookmarks", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPinnedItems.get(), null);
  });

  it("should hydrate pinned feed generators from the store", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$hydratedPosts.get(postURI), null);
  });

  it("should mark the post when it contains a muted word", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ postHasMutedWord: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer.hasMutedWord, true);
  });

  it("should not mark the post when there is no muted word match", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer, undefined);
  });

  it("should mark the post hidden when preferences say so", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ isPostHidden: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.viewer.isHidden, true);
  });

  it("should attach badge, content, and media labels from preferences", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$unavailablePosts.set(quotedUri, {
      $type: "social.impro.feed.defs#unavailablePost",
      uri: quotedUri,
    });
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
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    const quotedUri = "at://did:blocked/app.bsky.feed.post/q";
    dataStore.$unavailablePosts.set(quotedUri, {
      $type: "social.impro.feed.defs#unavailablePost",
      uri: quotedUri,
    });
    dataStore.$posts.set(postURI, makeBlockedQuotePost({ blockedBy: true }));
    const result = derived.$hydratedPosts.get(postURI);
    assert.deepEqual(
      result.embed.record.$type,
      "app.bsky.embed.record#viewNotFound",
    );
  });

  it("should keep a viewer-blocked quote blocked even when the quoted post is loaded", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    dataStore.$convos.set("direct1", {
      id: "direct1",
      members,
      kind: { $type: "chat.bsky.convo.defs#directConvo" },
    });
    const { derived } = makeDerived(dataStore);

    assert.deepEqual(derived.$convoForProfile.get(profileDid).id, "direct1");
  });

  it("should ignore group convos even with two members", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    seedMessages(dataStore, [
      { id: "m1", sender: { did: "did:plc:alice" }, text: "hello" },
    ]);
    const { derived } = makeDerived(dataStore);
    const result = derived.$hydratedConvoMessages.get(convoId);
    assert.deepEqual(result.messages[0].reactions, undefined);
  });

  it("should not recompute when the convo changes but members stay the same", () => {
    const dataStore = new DataStore();
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
    const dataStore = new DataStore();
    const draftMediaStore = new DraftMediaStore("test-media");
    draftMediaStore.$media.set(localMedia);
    const { derived } = makeDerived(dataStore, { draftMediaStore });
    dataStore.$drafts.set({ drafts: draftViews, cursor: null });
    return derived.$hydratedDrafts.get().drafts[0].posts;
  }

  it("is null before loading and carries the view fields and cursor through", () => {
    const dataStore = new DataStore();
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
});

describe("$groupConvoMemberList", () => {
  const convoId = "convo1";

  it("should return null when nothing is loaded", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assert.deepEqual(derived.$groupConvoMemberList.get(convoId), null);
  });

  it("should pass through the stored members and cursor", () => {
    const dataStore = new DataStore();
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
