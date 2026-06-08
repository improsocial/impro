import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { Derived } from "/js/dataLayer/derived.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Preferences } from "/js/preferences.js";
import { Signal, SignalMap } from "/js/signals.js";

function makeDerived(dataStore, { preferences } = {}) {
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
  );
  return { derived, patchStore };
}

function fakePreferences(overrides = {}) {
  return {
    postHasMutedWord: () => false,
    quotedPostHasMutedWord: () => false,
    isPostHidden: () => false,
    getBadgeLabels: () => [],
    getContentLabel: () => null,
    getMediaLabel: () => null,
    getProfileBlurLabel: () => null,
    clone() {
      return this;
    },
    ...overrides,
  };
}

const t = new TestSuite("Derived");

t.describe("$hydratedFeeds", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedFeeds.get(feedURI), null);
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
    assertEquals(result, {
      feed: [{ post: post1 }, { post: post2 }],
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
    assertEquals(result.feed[0].post.likeCount, 6);
    assertEquals(result.feed[0].post.viewer.like, "fake like");
  });
});

t.describe("$hydratedHashtagFeeds", (it) => {
  const hashtagKey = "javascript-top";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedHashtagFeeds.get(hashtagKey), null);
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
    dataStore.$hashtagFeeds.set(hashtagKey, rawFeed);

    const result = derived.$hydratedHashtagFeeds.get(hashtagKey);
    assertEquals(result, {
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
      feed: [{ post: { uri: "post-reply" } }],
      cursor: "c",
    };

    dataStore.$posts.set("post-parent", parent);
    dataStore.$posts.set("post-reply", reply);
    dataStore.$hashtagFeeds.set(hashtagKey, rawFeed);

    const result = derived.$hydratedHashtagFeeds.get(hashtagKey);
    assertEquals(result.feed[0].post.record.reply.parentAuthor, parentAuthor);
  });

  it("should apply patches to posts in feed", () => {
    const dataStore = new DataStore();
    const { derived, patchStore } = makeDerived(dataStore);

    const rawFeed = {
      feed: [{ post: { uri: "post1" } }],
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
    assertEquals(result.feed[0].post.likeCount, 6);
    assertEquals(result.feed[0].post.viewer.like, "fake like");
  });
});

t.describe("$hydratedProfiles", (it) => {
  const did = "did:plc:user";

  it("should return null when profile does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedProfiles.get(did), null);
  });

  it("should return the profile when it exists", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const profile = { did, handle: "user.test", followersCount: 10 };
    dataStore.$profiles.set(did, profile);
    const result = derived.$hydratedProfiles.get(did);
    assertEquals(result.did, did);
    assertEquals(result.handle, "user.test");
    assertEquals(result.followersCount, 10);
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
    assertEquals(result.followersCount, 11);
    assertEquals(result.viewer.following, "fake following");
  });
});

t.describe("$hydratedAuthorFeeds", (it) => {
  const did = "did:plc:author";
  const feedURI = `${did}-posts`;

  it("should return null when author feed does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedAuthorFeeds.get(feedURI), null);
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
    assertEquals(result.feed.length, 2);
    assertEquals(result.feed[0].post.uri, "post1");
    assertEquals(result.feed[1].post.uri, "post2");
    assertEquals(result.cursor, "c");
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
    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].post.uri, "post2");
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
    assertEquals(result.feed[0].post.uri, "pinned");
  });
});

t.describe("$actorFeeds", (it) => {
  const did = "did:plc:author";

  it("should return null when actor feeds do not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$actorFeeds.get(did), null);
  });

  it("should return the stored actor feeds", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const actorFeeds = { feeds: [{ uri: "feed-1" }], cursor: "c" };
    dataStore.$actorFeeds.set(did, actorFeeds);
    assertEquals(derived.$actorFeeds.get(did), actorFeeds);
  });
});

t.describe("$profileChatStatus", (it) => {
  const did = "did:plc:user";

  it("should return null when chat status does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$profileChatStatus.get(did), null);
  });

  it("should return the stored chat status", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const status = { canChat: true, convo: null };
    dataStore.$profileChatStatus.set(did, status);
    assertEquals(derived.$profileChatStatus.get(did), status);
  });
});

t.describe("$labelerInfo", (it) => {
  const did = "did:plc:labeler";

  it("should return null when labeler info does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$labelerInfo.get(did), null);
  });

  it("should return the stored labeler info", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const info = { policies: { labelValues: ["spam"] } };
    dataStore.$labelerInfo.set(did, info);
    assertEquals(derived.$labelerInfo.get(did), info);
  });
});

t.describe("$labelerSettings", (it) => {
  it("should return labeler settings from preferences", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const labelerDid = "did:plc:labeler";
    const result = derived.$labelerSettings.get(labelerDid);
    // Logged-out preferences should still return a settings object
    assertEquals(typeof result, "object");
  });
});

t.describe("$hydratedBookmarks", (it) => {
  it("should return null when bookmarks do not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedBookmarks.get(), null);
  });

  it("should hydrate and return bookmarks", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const post1 = { uri: "post1", likeCount: 5 };
    const post2 = { uri: "post2", likeCount: 10 };
    dataStore.$posts.set("post1", post1);
    dataStore.$posts.set("post2", post2);
    dataStore.$bookmarks.set({
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "c",
    });
    const result = derived.$hydratedBookmarks.get();
    assertEquals(result.feed.length, 2);
    assertEquals(result.feed[0].post.uri, "post1");
    assertEquals(result.feed[1].post.uri, "post2");
    assertEquals(result.cursor, "c");
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
      feed: [{ post: { uri: "post-reply" } }],
      cursor: null,
    });
    const result = derived.$hydratedBookmarks.get();
    assertEquals(result.feed[0].post.record.reply.parentAuthor, parentAuthor);
  });
});

t.describe("$hydratedPinnedItems", (it) => {
  it("should return null when pinned items are not set", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedPinnedItems.get(), null);
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
    assertEquals(result.length, 2);
    assertEquals(result[0].type, "feed");
    assertEquals(result[0].uri, "feed-1");
    assertEquals(result[0].displayName, "Feed One");
    assertEquals(result[1].uri, "feed-2");
    assertEquals(result[1].displayName, "Feed Two");
  });

  it("should hydrate list and following entries", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    const list = { uri: "list-1", name: "My List" };
    dataStore.$pinnedItems.set([
      { type: "following", data: { uri: "following" } },
      { type: "list", data: list },
    ]);
    const result = derived.$hydratedPinnedItems.get();
    assertEquals(result[0].type, "following");
    assertEquals(result[0].displayName, "Following");
    assertEquals(result[1].type, "list");
    assertEquals(result[1].uri, "list-1");
    assertEquals(result[1].displayName, "My List");
  });
});

t.describe("$hydratedPosts (post hydration)", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/x";

  it("should return null when the post does not exist", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore);
    assertEquals(derived.$hydratedPosts.get(postURI), null);
  });

  it("should mark the post when it contains a muted word", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ postHasMutedWord: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.viewer.hasMutedWord, true);
  });

  it("should not mark the post when there is no muted word match", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.viewer, undefined);
  });

  it("should mark the post hidden when preferences say so", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({ isPostHidden: () => true }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.viewer.isHidden, true);
  });

  it("should attach badge, content, and media labels from preferences", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        getBadgeLabels: () => ["badge"],
        getContentLabel: () => "warn",
        getMediaLabel: () => "blur",
      }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.badgeLabels, ["badge"]);
    assertEquals(result.contentLabel, "warn");
    assertEquals(result.mediaLabel, "blur");
  });

  it("should leave the post untouched when no labels apply", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences(),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.badgeLabels, undefined);
    assertEquals(result.contentLabel, undefined);
    assertEquals(result.mediaLabel, undefined);
  });

  it("should compose muted/hidden/label marks on a single post", () => {
    const dataStore = new DataStore();
    const { derived } = makeDerived(dataStore, {
      preferences: fakePreferences({
        postHasMutedWord: () => true,
        isPostHidden: () => true,
        getBadgeLabels: () => ["b"],
      }),
    });
    dataStore.$posts.set(postURI, { uri: postURI, record: { text: "hello" } });
    const result = derived.$hydratedPosts.get(postURI);
    assertEquals(result.viewer.hasMutedWord, true);
    assertEquals(result.viewer.isHidden, true);
    assertEquals(result.badgeLabels, ["b"]);
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
    assertEquals(result.uri, post.uri);
    assertEquals(result.record.text, "hello");
  });
});

await t.run();
