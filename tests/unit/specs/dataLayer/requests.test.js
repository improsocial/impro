import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Requests } from "/js/dataLayer/requests.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { DraftMediaStore } from "/js/drafts.js";
import { Preferences } from "/js/preferences.js";
import { ApiError } from "/js/api.js";
import { EventEmitter } from "/js/eventEmitter.js";

const stubConstellation = { getLinks: async () => [] };

function createRequests(api, dataStore, preferencesProvider, events = null) {
  return new Requests(
    api,
    dataStore,
    preferencesProvider,
    new DraftMediaStore("test-media"),
    events ?? new EventEmitter(),
    stubConstellation,
  );
}

describe("loadPostThread", () => {
  const postURI = "at://did:test/app.bsky.feed.post/thread";

  it("should load and store post thread", async () => {
    const mockPostThread = {
      post: { uri: postURI, content: "Main post" },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
      ],
    };

    const mockPostThreadOther = [{ uri: "reply1" }];

    const normalizedPosts = [
      { uri: postURI, content: "Main post" },
      { uri: "reply1", content: "Reply 1" },
    ];

    const mockApi = {
      getPostThread: async () => mockPostThread,
      getPostThreadOther: async () => mockPostThreadOther,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPostThread(postURI);

    // Check thread was stored
    assert.deepEqual(dataStore.$postThreads.get(postURI), mockPostThread);

    // Check postThreadOther was stored
    assert.deepEqual(
      dataStore.$postThreadOthers.get(postURI),
      mockPostThreadOther,
    );

    // Check posts were stored
    assert.deepEqual(dataStore.$posts.get(postURI), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("reply1"), normalizedPosts[1]);
  });

  it("should handle empty post thread", async () => {
    const emptyPostThread = {
      post: { uri: postURI, content: "Lonely post" },
      replies: [],
    };

    const normalizedPosts = [{ uri: postURI, content: "Lonely post" }];

    const mockApi = {
      getPostThread: async () => emptyPostThread,
      getPostThreadOther: async () => [],
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPostThread(postURI);

    assert.deepEqual(dataStore.$postThreads.get(postURI), emptyPostThread);
    assert.deepEqual(dataStore.$postThreadOthers.get(postURI), []);
    assert.deepEqual(dataStore.$posts.get(postURI), normalizedPosts[0]);
  });
});

describe("loadNextFeedPage", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should load initial feed page", async () => {
    const mockFeed = {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "cursor123",
    };

    const normalizedPosts = [{ uri: "post1" }, { uri: "post2" }];

    const mockApi = {
      getFeed: async () => mockFeed,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    // Check feed was stored
    assert.deepEqual(dataStore.$feeds.get(feedURI), mockFeed);

    // Check posts were stored
    assert.deepEqual(dataStore.$posts.get("post1"), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("post2"), normalizedPosts[1]);
  });

  it("should append to existing feed", async () => {
    const dataStore = new DataStore();

    // Set up existing feed
    const existingFeed = {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor1",
    };
    dataStore.$feeds.set(feedURI, existingFeed);

    // New page
    const newPage = {
      feed: [{ post: { uri: "post2" } }, { post: { uri: "post3" } }],
      cursor: "cursor2",
    };

    const normalizedPosts = [{ uri: "post2" }, { uri: "post3" }];

    const mockApi = {
      getFeed: async () => newPage,
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    // Check feed was appended
    const storedFeed = dataStore.$feeds.get(feedURI);
    assert.deepEqual(storedFeed.feed.length, 3);
    assert.deepEqual(storedFeed.feed[0], { post: { uri: "post1" } });
    assert.deepEqual(storedFeed.feed[1], { post: { uri: "post2" } });
    assert.deepEqual(storedFeed.feed[2], { post: { uri: "post3" } });
    assert.deepEqual(storedFeed.cursor, "cursor2");

    // Check new posts were stored
    assert.deepEqual(dataStore.$posts.get("post2"), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("post3"), normalizedPosts[1]);
  });

  it("should discard a stale page when a reload lands mid-flight", async () => {
    const dataStore = new DataStore();
    dataStore.$feeds.set(feedURI, {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor1",
    });

    const reloadedFeed = {
      feed: [{ post: { uri: "post9" } }],
      cursor: "cursor9",
    };
    const mockApi = {
      getFeed: async () => {
        // Simulate a reload finishing while this page request is in flight
        dataStore.$feeds.set(feedURI, reloadedFeed);
        return { feed: [{ post: { uri: "post2" } }], cursor: "cursor2" };
      },
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    assert.deepEqual(dataStore.$feeds.get(feedURI), reloadedFeed);
  });

  it("should emit feedLoaded with the reload flag", async () => {
    const dataStore = new DataStore();
    dataStore.$feeds.set(feedURI, {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor1",
    });

    const mockApi = {
      getFeed: async () => ({ feed: [], cursor: "end" }),
    };
    const events = new EventEmitter();
    const capturedReloads = [];
    events.on("feedLoaded", ({ reload }) => capturedReloads.push(reload));
    const requests = createRequests(
      mockApi,
      dataStore,
      { requirePreferences: () => Preferences.createLoggedOutPreferences() },
      events,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });
    await requests.loadNextFeedPage(
      { type: "feed", uri: feedURI },
      { reload: true },
    );

    assert.deepEqual(capturedReloads, [false, true]);
  });

  it("should handle empty feed", async () => {
    const emptyFeed = {
      feed: [],
      cursor: "end",
    };

    const mockApi = {
      getFeed: async () => emptyFeed,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    assert.deepEqual(dataStore.$feeds.get(feedURI), emptyFeed);
  });

  it("should handle feed with reply context", async () => {
    const feedWithReplies = {
      feed: [
        {
          post: { uri: "post1" },
          reply: {
            root: { $type: "app.bsky.feed.defs#postView", uri: "root1" },
            parent: { $type: "app.bsky.feed.defs#postView", uri: "parent1" },
          },
        },
      ],
      cursor: "cursor123",
    };

    const normalizedPosts = [
      { uri: "post1", content: "Reply post" },
      { uri: "root1", content: "Root post" },
      { uri: "parent1", content: "Parent post" },
    ];

    const mockApi = {
      getFeed: async () => feedWithReplies,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    assert.deepEqual(dataStore.$feeds.get(feedURI), feedWithReplies);
    assert.deepEqual(dataStore.$posts.get("post1").uri, normalizedPosts[0].uri);
    assert.deepEqual(dataStore.$posts.get("root1").uri, normalizedPosts[1].uri);
    assert.deepEqual(
      dataStore.$posts.get("parent1").uri,
      normalizedPosts[2].uri,
    );
  });
});

describe("loadDetailedProfile", () => {
  const profileDID = "did:test:profile";

  it("should load and store profile", async () => {
    const mockProfile = {
      did: profileDID,
      handle: "test.user",
      displayName: "Test User",
      description: "A test user",
    };

    const mockApi = {
      getProfile: async () => mockProfile,
    };

    const dataStore = new DataStore();

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadDetailedProfile(profileDID);

    // Check profile was stored
    assert.deepEqual(dataStore.$profiles.get(profileDID), mockProfile);
  });

  it("should handle profile updates", async () => {
    const dataStore = new DataStore();

    // Load initial profile
    const initialProfile = {
      did: profileDID,
      handle: "old.handle",
      displayName: "Old Name",
    };

    const mockApi = {
      getProfile: async () => initialProfile,
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadDetailedProfile(profileDID);

    assert.deepEqual(dataStore.$profiles.get(profileDID), initialProfile);

    // Load updated profile
    const updatedProfile = {
      did: profileDID,
      handle: "new.handle",
      displayName: "New Name",
    };

    mockApi.getProfile = async () => updatedProfile;

    await requests.loadDetailedProfile(profileDID);

    assert.deepEqual(dataStore.$profiles.get(profileDID), updatedProfile);
  });
});

describe("loadPosts", () => {
  it("loads and stores each post by uri", async () => {
    const postA = { uri: "at://a", content: "A" };
    const postB = { uri: "at://b", content: "B" };
    let calledWith = null;

    const mockApi = {
      getPosts: async (uris) => {
        calledWith = uris;
        return [postA, postB];
      },
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPosts(["at://a", "at://b"]);

    assert.deepEqual(calledWith, ["at://a", "at://b"]);
    assert.deepEqual(dataStore.$posts.get("at://a"), postA);
    assert.deepEqual(dataStore.$posts.get("at://b"), postB);
  });

  it("does not call api when uris is empty", async () => {
    let called = false;
    const mockApi = {
      getPosts: async () => {
        called = true;
        return [];
      },
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPosts([]);

    assert.deepEqual(called, false);
  });
});

describe("loadLabelerInfo", () => {
  const labelerDid = "did:plc:testlabeler";

  it("should load and store labeler info", async () => {
    const mockLabelerInfo = {
      uri: `at://${labelerDid}/app.bsky.labeler.service/self`,
      creator: { did: labelerDid, handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          { identifier: "nsfw", locales: [{ lang: "en", name: "NSFW" }] },
        ],
      },
    };

    const mockApi = {
      getLabeler: async () => mockLabelerInfo,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);

    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), mockLabelerInfo);
  });

  it("should call api.getLabeler with correct DID", async () => {
    let calledWithDid = null;
    const mockApi = {
      getLabeler: async (did) => {
        calledWithDid = did;
        return { creator: { did } };
      },
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);

    assert.deepEqual(calledWithDid, labelerDid);
  });

  it("should overwrite existing labeler info on reload", async () => {
    const initialInfo = {
      creator: { did: labelerDid, handle: "old.handle" },
      policies: { labelValueDefinitions: [] },
    };
    const updatedInfo = {
      creator: { did: labelerDid, handle: "new.handle" },
      policies: {
        labelValueDefinitions: [{ identifier: "test" }],
      },
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };

    let currentInfo = initialInfo;
    const mockApi = {
      getLabeler: async () => currentInfo,
    };

    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);
    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), initialInfo);

    currentInfo = updatedInfo;
    await requests.loadLabelerInfo(labelerDid);
    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), updatedInfo);
  });
});

describe("loadMutedProfiles", () => {
  it("should store muted profiles on first load", async () => {
    const res = {
      mutes: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
      cursor: "next",
    };
    const mockApi = { getMutes: async () => res };
    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadMutedProfiles();

    assert.deepEqual(dataStore.$mutedProfiles.get(), res);
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
    assert.deepEqual(dataStore.$profiles.get("did:plc:b"), {
      did: "did:plc:b",
    });
  });

  it("should append paginated muted profiles when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$mutedProfiles.set({
      mutes: [{ did: "did:plc:a" }],
      cursor: "page2",
    });

    const mockApi = {
      getMutes: async () => ({
        mutes: [{ did: "did:plc:b" }],
        cursor: undefined,
      }),
    };
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadMutedProfiles({ cursor: "page2" });

    const stored = dataStore.$mutedProfiles.get();
    assert.deepEqual(stored.mutes.length, 2);
    assert.deepEqual(stored.mutes[0].did, "did:plc:a");
    assert.deepEqual(stored.mutes[1].did, "did:plc:b");
  });

  it("should pass cursor through to the api", async () => {
    let capturedCursor;
    const mockApi = {
      getMutes: async ({ cursor }) => {
        capturedCursor = cursor;
        return { mutes: [], cursor: undefined };
      },
    };
    const dataStore = new DataStore();
    dataStore.$mutedProfiles.set({ mutes: [], cursor: "abc" });
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadMutedProfiles({ cursor: "abc" });
    assert.deepEqual(capturedCursor, "abc");
  });

  it("should discard the response when the cursor no longer matches", async () => {
    const dataStore = new DataStore();
    const existing = {
      mutes: [{ did: "did:plc:a" }],
      cursor: "page3",
    };
    dataStore.$mutedProfiles.set(existing);

    const mockApi = {
      getMutes: async () => ({
        mutes: [{ did: "did:plc:b" }],
        cursor: "page4",
      }),
    };
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadMutedProfiles({ cursor: "page2" });

    assert.deepEqual(dataStore.$mutedProfiles.get(), existing);
  });
});

function makeRequests(api, dataStore = new DataStore(), preferences) {
  const provider = {
    requirePreferences: () =>
      preferences ?? Preferences.createLoggedOutPreferences(),
  };
  return createRequests(api, dataStore, provider);
}

describe("loadBlockedProfiles", () => {
  it("should store blocked profiles on first load", async () => {
    const res = {
      blocks: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
      cursor: "next",
    };
    const mockApi = { getBlocks: async () => res };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBlockedProfiles();

    assert.deepEqual(dataStore.$blockedProfiles.get(), res);
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
    assert.deepEqual(dataStore.$profiles.get("did:plc:b"), {
      did: "did:plc:b",
    });
  });

  it("should append paginated blocked profiles when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$blockedProfiles.set({
      blocks: [{ did: "did:plc:a" }],
      cursor: "page2",
    });

    const mockApi = {
      getBlocks: async () => ({
        blocks: [{ did: "did:plc:b" }],
        cursor: undefined,
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBlockedProfiles({ cursor: "page2" });

    const stored = dataStore.$blockedProfiles.get();
    assert.deepEqual(stored.blocks.length, 2);
    assert.deepEqual(stored.blocks[0].did, "did:plc:a");
    assert.deepEqual(stored.blocks[1].did, "did:plc:b");
  });

  it("should pass cursor through to the api", async () => {
    let capturedCursor;
    const mockApi = {
      getBlocks: async ({ cursor }) => {
        capturedCursor = cursor;
        return { blocks: [], cursor: undefined };
      },
    };
    const dataStore = new DataStore();
    dataStore.$blockedProfiles.set({ blocks: [], cursor: "abc" });
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBlockedProfiles({ cursor: "abc" });
    assert.deepEqual(capturedCursor, "abc");
  });
});

describe("loadNextAuthorFeedPage", () => {
  const did = "did:plc:author";

  it("should call getAuthorFeed with posts filter for posts feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (calledDid, params) => {
        capturedParams = { did: calledDid, ...params };
        return { feed: [{ post: { uri: "p1" } }], cursor: "c1" };
      },
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextAuthorFeedPage(did, "posts");

    assert.deepEqual(capturedParams.did, did);
    assert.deepEqual(capturedParams.filter, "posts_and_author_threads");
    assert.deepEqual(capturedParams.includePins, true);
    assert.deepEqual(capturedParams.cursor, "");
    assert.deepEqual(dataStore.$authorFeeds.get(`${did}-posts`).feed.length, 1);
  });

  it("should use posts_with_replies filter for replies feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedParams = params;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage(did, "replies");

    assert.deepEqual(capturedParams.filter, "posts_with_replies");
    assert.deepEqual(capturedParams.includePins, false);
  });

  it("should use posts_with_media filter for media feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedParams = params;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage(did, "media");

    assert.deepEqual(capturedParams.filter, "posts_with_media");
    assert.deepEqual(capturedParams.includePins, false);
  });

  it("should call getActorLikes for likes feedType", async () => {
    let actorLikesCalled = false;
    let authorFeedCalled = false;
    const mockApi = {
      getActorLikes: async () => {
        actorLikesCalled = true;
        return { feed: [], cursor: null };
      },
      getAuthorFeed: async () => {
        authorFeedCalled = true;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage(did, "likes");

    assert.deepEqual(actorLikesCalled, true);
    assert.deepEqual(authorFeedCalled, false);
  });

  it("should append to existing feed", async () => {
    const feedURI = `${did}-posts`;
    const dataStore = new DataStore();
    dataStore.$authorFeeds.set(feedURI, {
      feed: [{ post: { uri: "old1" } }],
      cursor: "c1",
    });

    const mockApi = {
      getAuthorFeed: async () => ({
        feed: [{ post: { uri: "new1" } }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextAuthorFeedPage(did, "posts");

    const stored = dataStore.$authorFeeds.get(feedURI);
    assert.deepEqual(stored.feed.length, 2);
    assert.deepEqual(stored.feed[0].post.uri, "old1");
    assert.deepEqual(stored.feed[1].post.uri, "new1");
    assert.deepEqual(stored.cursor, "c2");
  });

  it("should reset cursor and replace feed on reload", async () => {
    const feedURI = `${did}-posts`;
    const dataStore = new DataStore();
    dataStore.$authorFeeds.set(feedURI, {
      feed: [{ post: { uri: "old1" } }],
      cursor: "c1",
    });

    let capturedCursor;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedCursor = params.cursor;
        return { feed: [{ post: { uri: "new1" } }], cursor: "c2" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextAuthorFeedPage(did, "posts", { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$authorFeeds.get(feedURI);
    assert.deepEqual(stored.feed.length, 1);
    assert.deepEqual(stored.feed[0].post.uri, "new1");
  });

  it("should throw on unknown feed type", async () => {
    const mockApi = { getAuthorFeed: async () => ({ feed: [], cursor: null }) };
    const requests = makeRequests(mockApi);

    let caught = null;
    try {
      await requests.loadNextAuthorFeedPage(did, "bogus");
    } catch (error) {
      caught = error;
    }
    assert(caught !== null, "expected error for unknown feed type");
  });
});

describe("loadPostSearchTop / loadPostSearchLatest", () => {
  it("should clear results for both sorts when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$postSearchResultsTop.set({
      posts: [{ uri: "p1" }],
      cursor: "c1",
    });
    dataStore.$postSearchResultsLatest.set({
      posts: [{ uri: "p2" }],
      cursor: "c2",
    });
    const mockApi = { searchPosts: async () => ({ posts: [], cursor: null }) };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop("");
    await requests.loadPostSearchLatest("");

    assert.deepEqual(dataStore.$postSearchResultsTop.get(), null);
    assert.deepEqual(dataStore.$postSearchResultsLatest.get(), null);
  });

  it("should store results from a fresh search", async () => {
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p1", record: {} }],
        cursor: "next",
      }),
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop("hello");

    const stored = dataStore.$postSearchResultsTop.get();
    assert.deepEqual(stored.posts.length, 1);
    assert.deepEqual(stored.cursor, "next");
  });

  it("should store each sort's results independently", async () => {
    const mockApi = {
      searchPosts: async (query, { sort }) => ({
        posts: [{ uri: `post-${sort}`, record: {} }],
        cursor: null,
      }),
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop("hello");
    await requests.loadPostSearchLatest("hello");

    assert.deepEqual(
      dataStore.$postSearchResultsTop.get().posts[0].uri,
      "post-top",
    );
    assert.deepEqual(
      dataStore.$postSearchResultsLatest.get().posts[0].uri,
      "post-latest",
    );
  });

  it("should not discard an in-flight sort when the other sort loads", async () => {
    const dataStore = new DataStore();
    let resolveTop;
    const topPromise = new Promise((resolve) => {
      resolveTop = resolve;
    });
    const mockApi = {
      searchPosts: async (query, { sort }) => {
        if (sort === "top") {
          await topPromise;
          return { posts: [{ uri: "top-post", record: {} }], cursor: "tc" };
        }
        return { posts: [{ uri: "latest-post", record: {} }], cursor: "lc" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const topCall = requests.loadPostSearchTop("query");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadPostSearchLatest("query");
    resolveTop();
    await topCall;

    assert.deepEqual(
      dataStore.$postSearchResultsTop.get().posts[0].uri,
      "top-post",
    );
    assert.deepEqual(
      dataStore.$postSearchResultsLatest.get().posts[0].uri,
      "latest-post",
    );
  });

  it("should discard stale responses based on requestTime guard", async () => {
    const dataStore = new DataStore();
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let callIndex = 0;
    const mockApi = {
      searchPosts: async () => {
        callIndex += 1;
        if (callIndex === 1) {
          await firstPromise;
          return { posts: [{ uri: "stale", record: {} }], cursor: "stale" };
        }
        return { posts: [{ uri: "fresh", record: {} }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const firstCall = requests.loadPostSearchTop("query");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadPostSearchTop("query");
    resolveFirst();
    await firstCall;

    const stored = dataStore.$postSearchResultsTop.get();
    assert.deepEqual(stored.posts[0].uri, "fresh");
    assert.deepEqual(stored.cursor, "fresh");
  });

  it("should discard a stale cursored response that finishes dependency loading after a re-search", async () => {
    const dataStore = new DataStore();
    const replyPost = (uri) => ({
      uri,
      record: { reply: { parent: { uri: `${uri}-parent` } } },
    });
    const page1 = { posts: [replyPost("p1")], cursor: "c1" };
    const page2 = { posts: [replyPost("p2")], cursor: null };
    let getPostsGate = null;
    const mockApi = {
      searchPosts: async (query, { cursor }) => (cursor ? page2 : page1),
      getPosts: async () => {
        if (getPostsGate) {
          const gate = getPostsGate;
          getPostsGate = null;
          await gate;
        }
        return [];
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop("query");

    // A load-more passes the requestTime guard, then stalls loading
    // dependencies while a re-search and a fresh load-more complete
    let releaseGate;
    getPostsGate = new Promise((resolve) => {
      releaseGate = resolve;
    });
    const staleLoadMore = requests.loadPostSearchTop("query", { cursor: "c1" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadPostSearchTop("query");
    await requests.loadPostSearchTop("query", { cursor: "c1" });
    releaseGate();
    await staleLoadMore;

    const stored = dataStore.$postSearchResultsTop.get();
    assert.deepEqual(
      stored.posts.map((post) => post.uri),
      ["p1", "p2"],
    );
  });

  it("should append when cursor is provided and existing results present", async () => {
    const dataStore = new DataStore();
    dataStore.$postSearchResultsTop.set({
      posts: [{ uri: "p1", record: {} }],
      cursor: "c1",
    });
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p2", record: {} }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop("hello", { cursor: "c1" });

    const stored = dataStore.$postSearchResultsTop.get();
    assert.deepEqual(stored.posts.length, 2);
    assert.deepEqual(stored.posts[1].uri, "p2");
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadProfileSearch", () => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$profileSearchResults.set({
      actors: [{ did: "x" }],
      cursor: "c",
    });
    const mockApi = {
      searchProfiles: async () => ({ actors: [], cursor: null }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileSearch("");

    assert.deepEqual(dataStore.$profileSearchResults.get(), null);
  });

  it("should store actors from a fresh search", async () => {
    const mockApi = {
      searchProfiles: async () => ({
        actors: [{ did: "did:plc:a" }],
        cursor: "next",
      }),
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileSearch("alice");

    const stored = dataStore.$profileSearchResults.get();
    assert.deepEqual(stored.actors.length, 1);
    assert.deepEqual(stored.cursor, "next");
  });

  it("should discard stale responses", async () => {
    const dataStore = new DataStore();
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let callIndex = 0;
    const mockApi = {
      searchProfiles: async () => {
        callIndex += 1;
        if (callIndex === 1) {
          await firstPromise;
          return { actors: [{ did: "stale" }], cursor: "stale" };
        }
        return { actors: [{ did: "fresh" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const firstCall = requests.loadProfileSearch("query");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadProfileSearch("query");
    resolveFirst();
    await firstCall;

    const stored = dataStore.$profileSearchResults.get();
    assert.deepEqual(stored.actors[0].did, "fresh");
  });

  it("should append when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$profileSearchResults.set({
      actors: [{ did: "did:plc:a" }],
      cursor: "c1",
    });
    const mockApi = {
      searchProfiles: async () => ({
        actors: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileSearch("query", { cursor: "c1" });

    const stored = dataStore.$profileSearchResults.get();
    assert.deepEqual(stored.actors.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });

  it("should discard in-flight responses after the query is cleared", async () => {
    const dataStore = new DataStore();
    let resolveSearch;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const mockApi = {
      searchProfiles: async () => {
        await searchPromise;
        return { actors: [{ did: "stale" }], cursor: "stale" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const inFlight = requests.loadProfileSearch("query");
    await requests.loadProfileSearch("");
    resolveSearch();
    await inFlight;

    assert.deepEqual(dataStore.$profileSearchResults.get(), null);
  });
});

describe("loadChatRecipientSearch", () => {
  it("should store the search results", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      searchProfilesTypeahead: async () => ({
        actors: [{ did: "did:plc:a" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadChatRecipientSearch("alice");

    const stored = dataStore.$chatRecipientSearchResults.get();
    assert.deepEqual(stored.actors.length, 1);
    assert.deepEqual(stored.actors[0].did, "did:plc:a");
  });

  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$chatRecipientSearchResults.set({ actors: [{ did: "x" }] });
    const mockApi = {
      searchProfilesTypeahead: async () => ({ actors: [] }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadChatRecipientSearch("");

    assert.deepEqual(dataStore.$chatRecipientSearchResults.get(), null);
  });

  it("should discard in-flight responses after the query is cleared", async () => {
    const dataStore = new DataStore();
    let resolveSearch;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const mockApi = {
      searchProfilesTypeahead: async () => {
        await searchPromise;
        return { actors: [{ did: "stale" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const inFlight = requests.loadChatRecipientSearch("query");
    await requests.loadChatRecipientSearch("");
    resolveSearch();
    await inFlight;

    assert.deepEqual(dataStore.$chatRecipientSearchResults.get(), null);
  });
});

describe("loadSearchTypeahead", () => {
  it("should store the search results and hydrate profiles", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      searchProfilesTypeahead: async () => ({
        actors: [{ did: "did:plc:a" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadSearchTypeahead("alice");

    const stored = dataStore.$searchTypeaheadResults.get();
    assert.deepEqual(stored.actors.length, 1);
    assert.deepEqual(stored.actors[0].did, "did:plc:a");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
  });

  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$searchTypeaheadResults.set({ actors: [{ did: "x" }] });
    const mockApi = {
      searchProfilesTypeahead: async () => ({ actors: [] }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadSearchTypeahead("");

    assert.deepEqual(dataStore.$searchTypeaheadResults.get(), null);
  });

  it("should discard in-flight responses after the query is cleared", async () => {
    const dataStore = new DataStore();
    let resolveSearch;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const mockApi = {
      searchProfilesTypeahead: async () => {
        await searchPromise;
        return { actors: [{ did: "stale" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const inFlight = requests.loadSearchTypeahead("query");
    await requests.loadSearchTypeahead("");
    resolveSearch();
    await inFlight;

    assert.deepEqual(dataStore.$searchTypeaheadResults.get(), null);
  });
});

describe("loadFeedSearch", () => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$feedSearchResults.set({ feeds: [{ uri: "f1" }], cursor: "c" });
    const mockApi = {
      searchFeedGenerators: async () => ({ feeds: [], cursor: null }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedSearch("");

    assert.deepEqual(dataStore.$feedSearchResults.get(), null);
  });

  it("should store feeds and cache feed generators", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      searchFeedGenerators: async () => ({
        feeds: [{ uri: "f1", displayName: "Feed One" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedSearch("news");

    const stored = dataStore.$feedSearchResults.get();
    assert.deepEqual(stored.feeds.length, 1);
    assert.deepEqual(
      dataStore.$feedGenerators.get("f1").displayName,
      "Feed One",
    );
  });

  it("should discard stale responses", async () => {
    const dataStore = new DataStore();
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let callIndex = 0;
    const mockApi = {
      searchFeedGenerators: async () => {
        callIndex += 1;
        if (callIndex === 1) {
          await firstPromise;
          return { feeds: [{ uri: "stale" }], cursor: "stale" };
        }
        return { feeds: [{ uri: "fresh" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    const firstCall = requests.loadFeedSearch("query");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadFeedSearch("query");
    resolveFirst();
    await firstCall;

    const stored = dataStore.$feedSearchResults.get();
    assert.deepEqual(stored.feeds[0].uri, "fresh");
  });

  it("should append when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$feedSearchResults.set({
      feeds: [{ uri: "f1" }],
      cursor: "c1",
    });
    const mockApi = {
      searchFeedGenerators: async () => ({
        feeds: [{ uri: "f2" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedSearch("query", { cursor: "c1" });

    const stored = dataStore.$feedSearchResults.get();
    assert.deepEqual(stored.feeds.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadNotifications", () => {
  it("should set notifications and cursor on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(dataStore.$notifications.get().notifications.length, 1);
    assert.deepEqual(dataStore.$notifications.get().cursor, "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:liker"), {
      did: "did:plc:liker",
    });
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ reason: "like", uri: "n1" }],
      cursor: "page2",
    });

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [
            { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
          ],
          cursor: "page3",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(capturedCursor, "page2");
    assert.deepEqual(dataStore.$notifications.get().notifications.length, 2);
    assert.deepEqual(dataStore.$notifications.get().cursor, "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ reason: "like", uri: "n1" }],
      cursor: "page2",
    });

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [
            { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
          ],
          cursor: "fresh",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications({ reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$notifications.get();
    assert.deepEqual(stored.notifications.length, 1);
    assert.deepEqual(stored.notifications[0].uri, "n2");
    assert.deepEqual(stored.cursor, "fresh");
  });

  it("should capture seenAt on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-15T10:00:00.000Z",
    );
  });

  it("should overwrite the captured seenAt on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ reason: "like", uri: "n1" }],
      cursor: "page2",
    });
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
        ],
        cursor: "fresh",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications({ reload: true });

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-15T10:00:00.000Z",
    );
  });

  it("should not capture seenAt on subsequent pages", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ reason: "like", uri: "n1" }],
      cursor: "page2",
    });
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
        ],
        cursor: "page3",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-14T10:00:00.000Z",
    );
  });

  it("should set seenAt to null when the response omits it", async () => {
    const dataStore = new DataStore();
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(dataStore.$notificationsLastSeenAt.get(), null);
  });

  it("should discard a stale response when a reload lands mid-flight", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ uri: "n1", reason: "follow" }],
      cursor: "c1",
    });

    const reloadedNotifications = {
      notifications: [{ uri: "n9", reason: "follow" }],
      cursor: "c9",
    };
    const mockApi = {
      getNotifications: async () => {
        // Simulate a reload finishing while this page request is in flight
        dataStore.$notifications.set(reloadedNotifications);
        return {
          notifications: [
            { uri: "n2", reason: "follow", author: { did: "did:plc:f" } },
          ],
          cursor: "c2",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(dataStore.$notifications.get(), reloadedNotifications);
  });

  it("should discard a stale page when the list reaches its end mid-flight", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set({
      notifications: [{ uri: "n1", reason: "follow" }],
      cursor: "c1",
    });

    const fullyLoadedNotifications = {
      notifications: [
        { uri: "n1", reason: "follow" },
        { uri: "n2", reason: "follow" },
      ],
      cursor: null,
    };
    const mockApi = {
      getNotifications: async () => {
        // Simulate a duplicate page request landing first and exhausting the list
        dataStore.$notifications.set(fullyLoadedNotifications);
        return {
          notifications: [
            { uri: "n2", reason: "follow", author: { did: "did:plc:f" } },
          ],
          cursor: null,
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(dataStore.$notifications.get(), fullyLoadedNotifications);
  });
});

describe("loadMentionNotifications", () => {
  it("should request only mention reasons and store results", async () => {
    const dataStore = new DataStore();
    let capturedReasons;
    const mockApi = {
      getNotifications: async ({ reasons }) => {
        capturedReasons = reasons;
        return {
          notifications: [
            { reason: "mention", uri: "n1", author: { did: "did:plc:m" } },
          ],
          cursor: "next",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(capturedReasons, ["mention", "reply", "quote"]);
    assert.deepEqual(
      dataStore.$mentionNotifications.get().notifications.length,
      1,
    );
    assert.deepEqual(dataStore.$mentionNotifications.get().cursor, "next");
  });

  it("should not capture seenAt", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "mention", uri: "n1", author: { did: "did:plc:m" } },
        ],
        cursor: "next",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(dataStore.$notificationsLastSeenAt.get(), null);
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.$mentionNotifications.set({
      notifications: [{ reason: "mention", uri: "n1" }],
      cursor: "page2",
    });

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "reply", uri: "n2", author: { did: "did:plc:r" } },
        ],
        cursor: "page3",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(
      dataStore.$mentionNotifications.get().notifications.length,
      2,
    );
    assert.deepEqual(dataStore.$mentionNotifications.get().cursor, "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$mentionNotifications.set({
      notifications: [{ reason: "mention", uri: "n1" }],
      cursor: "page2",
    });

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "quote", uri: "n2", author: { did: "did:plc:q" } },
        ],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications({ reload: true });

    const stored = dataStore.$mentionNotifications.get();
    assert.deepEqual(stored.notifications.length, 1);
    assert.deepEqual(stored.notifications[0].uri, "n2");
  });
});

describe("loadBookmarks", () => {
  it("should set bookmarks on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getBookmarks: async () => ({
        bookmarks: [{ item: { uri: "post1", record: {} } }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBookmarks();

    const stored = dataStore.$bookmarks.get();
    assert.deepEqual(stored.bookmarks.length, 1);
    assert.deepEqual(stored.bookmarks[0].item.uri, "post1");
    assert.deepEqual(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.$bookmarks.set({
      bookmarks: [{ item: { uri: "post1" } }],
      cursor: "c1",
    });
    const mockApi = {
      getBookmarks: async () => ({
        bookmarks: [{ item: { uri: "post2", record: {} } }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBookmarks();

    const stored = dataStore.$bookmarks.get();
    assert.deepEqual(stored.bookmarks.length, 2);
    assert.deepEqual(stored.bookmarks[1].item.uri, "post2");
    assert.deepEqual(stored.cursor, "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$bookmarks.set({
      bookmarks: [{ item: { uri: "post1" } }],
      cursor: "c1",
    });

    let capturedCursor;
    const mockApi = {
      getBookmarks: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          bookmarks: [{ item: { uri: "post2", record: {} } }],
          cursor: "fresh",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBookmarks({ reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$bookmarks.get();
    assert.deepEqual(stored.bookmarks.length, 1);
    assert.deepEqual(stored.bookmarks[0].item.uri, "post2");
  });
});

describe("loadProfileFollowers", () => {
  const profileDid = "did:plc:profile";

  it("should set followers on first load", async () => {
    const dataStore = new DataStore();
    const res = {
      followers: [{ did: "did:plc:a" }],
      cursor: "next",
    };
    const mockApi = { getFollowers: async () => res };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileFollowers(profileDid);

    assert.deepEqual(dataStore.$profileFollowers.get(profileDid), res);
  });

  it("should append followers when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$profileFollowers.set(profileDid, {
      followers: [{ did: "did:plc:a" }],
      cursor: "c1",
    });
    const mockApi = {
      getFollowers: async () => ({
        followers: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileFollowers(profileDid, { cursor: "c1" });

    const stored = dataStore.$profileFollowers.get(profileDid);
    assert.deepEqual(stored.followers.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadProfileFollows", () => {
  const profileDid = "did:plc:profile";

  it("should set follows on first load", async () => {
    const dataStore = new DataStore();
    const res = { follows: [{ did: "did:plc:a" }], cursor: "next" };
    const mockApi = { getFollows: async () => res };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileFollows(profileDid);

    assert.deepEqual(dataStore.$profileFollows.get(profileDid), res);
  });

  it("should append follows when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$profileFollows.set(profileDid, {
      follows: [{ did: "did:plc:a" }],
      cursor: "c1",
    });
    const mockApi = {
      getFollows: async () => ({
        follows: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileFollows(profileDid, { cursor: "c1" });

    const stored = dataStore.$profileFollows.get(profileDid);
    assert.deepEqual(stored.follows.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadConvoList", () => {
  it("should set convo list and cache individual convos on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      listConvos: async () => ({
        convos: [
          { id: "c1", lastMessage: null },
          { id: "c2", lastMessage: null },
        ],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList();

    assert.deepEqual(dataStore.$convoList.get().convos.length, 2);
    assert.deepEqual(dataStore.$convos.get("c1").id, "c1");
    assert.deepEqual(dataStore.$convos.get("c2").id, "c2");
    assert.deepEqual(dataStore.$convoList.get().cursor, "next");
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [{ id: "c1" }], cursor: "page2" });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "c2" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList();

    assert.deepEqual(dataStore.$convoList.get().convos.length, 2);
    assert.deepEqual(dataStore.$convoList.get().cursor, "page3");
  });

  it("should drop convos already in the list when appending a page", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({
      convos: [{ id: "c2", unreadCount: 1 }, { id: "c1" }],
      cursor: "page2",
    });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "c2", unreadCount: 0 }, { id: "c3" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList();

    const list = dataStore.$convoList.get();
    assert.deepEqual(
      list.convos.map((listConvo) => listConvo.id),
      ["c2", "c1", "c3"],
    );
    assert.deepEqual(list.convos[0].unreadCount, 1);
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [{ id: "c1" }], cursor: "page2" });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "c2" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList({ reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$convoList.get();
    assert.deepEqual(stored.convos.length, 1);
    assert.deepEqual(stored.convos[0].id, "c2");
  });
});

describe("loadConvoRequestList", () => {
  it("should request only request convos and cache them on first load", async () => {
    const dataStore = new DataStore();
    let capturedStatus;
    const mockApi = {
      listConvos: async ({ status }) => {
        capturedStatus = status;
        return {
          convos: [
            { id: "r1", status: "request", lastMessage: null },
            { id: "r2", status: "request", lastMessage: null },
          ],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(capturedStatus, "request");
    assert.deepEqual(dataStore.$convoRequestList.get().convos.length, 2);
    assert.deepEqual(dataStore.$convos.get("r1").id, "r1");
    assert.deepEqual(dataStore.$convos.get("r2").id, "r2");
    assert.deepEqual(dataStore.$convoRequestList.get().cursor, "next");
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore();
    dataStore.$convoRequestList.set({
      convos: [{ id: "r1" }],
      cursor: "page2",
    });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "r2" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(dataStore.$convoRequestList.get().convos.length, 2);
    assert.deepEqual(dataStore.$convoRequestList.get().cursor, "page3");
  });

  it("should drop convos already in the list when appending a page", async () => {
    const dataStore = new DataStore();
    dataStore.$convoRequestList.set({
      convos: [{ id: "r2" }, { id: "r1" }],
      cursor: "page2",
    });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "r2" }, { id: "r3" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(
      dataStore.$convoRequestList.get().convos.map((listConvo) => listConvo.id),
      ["r2", "r1", "r3"],
    );
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$convoRequestList.set({
      convos: [{ id: "r1" }],
      cursor: "page2",
    });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "r2" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoRequestList({ reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$convoRequestList.get();
    assert.deepEqual(stored.convos.length, 1);
    assert.deepEqual(stored.convos[0].id, "r2");
  });
});

describe("loadConvo", () => {
  const convoId = "convo1";

  it("should store the convo and track status under a namespaced key", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getConvo: async () => ({ convo: { id: convoId } }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvo(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).id, convoId);
    const status = requests.getStatus("loadConvo-" + convoId);
    assert.deepEqual(status.loading, false);
    assert.deepEqual(status.error, null);
  });

  it("should add the convo to the loaded convo list", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [{ id: "other" }], cursor: null });
    const mockApi = {
      getConvo: async () => ({ convo: { id: convoId, status: "accepted" } }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvo(convoId);

    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      [convoId, "other"],
    );
  });

  it("should record an ApiError under the namespaced key without rethrowing", async () => {
    const apiError = new ApiError({
      status: 400,
      statusText: "Bad Request",
      data: { error: "InvalidConvo" },
      headers: {},
      url: "/x",
    });
    const dataStore = new DataStore();
    const mockApi = {
      getConvo: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvo(convoId);

    const status = requests.getStatus("loadConvo-" + convoId);
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
    assert.deepEqual(dataStore.$convos.get(convoId), null);
  });
});

describe("loadConvoForProfile", () => {
  it("should store the convo and add it to the loaded convo list", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [{ id: "other" }], cursor: null });
    const mockApi = {
      getConvoForMembers: async () => ({
        convo: { id: "c-new", status: "accepted" },
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoForProfile("did:plc:alice");

    assert.deepEqual(dataStore.$convos.get("c-new").id, "c-new");
    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      ["c-new", "other"],
    );
  });
});

describe("loadConvoMembers", () => {
  const convoId = "convo1";

  it("should store the first page with its cursor", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getConvoMembers: async () => ({
        members: [{ did: "did:plc:alice" }, { did: "did:plc:bob" }],
        cursor: "2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMembers(convoId);

    const stored = dataStore.$convoMemberLists.get(convoId);
    assert.deepEqual(
      stored.members.map((member) => member.did),
      ["did:plc:alice", "did:plc:bob"],
    );
    assert.deepEqual(stored.cursor, "2");
  });

  it("should append the next page using the stored cursor", async () => {
    const dataStore = new DataStore();
    const capturedCursors = [];
    const pages = [
      { members: [{ did: "did:plc:alice" }], cursor: "1" },
      { members: [{ did: "did:plc:bob" }] },
    ];
    const mockApi = {
      getConvoMembers: async (id, { cursor }) => {
        capturedCursors.push(cursor);
        return pages.shift();
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMembers(convoId);
    await requests.loadConvoMembers(convoId);

    assert.deepEqual(capturedCursors, ["", "1"]);
    const stored = dataStore.$convoMemberLists.get(convoId);
    assert.deepEqual(
      stored.members.map((member) => member.did),
      ["did:plc:alice", "did:plc:bob"],
    );
    assert.deepEqual(stored.cursor, null);
  });

  it("should overwrite the stored list on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$convoMemberLists.set(convoId, {
      members: [{ did: "did:plc:stale" }],
      cursor: "5",
    });
    const capturedCursors = [];
    const mockApi = {
      getConvoMembers: async (id, { cursor }) => {
        capturedCursors.push(cursor);
        return { members: [{ did: "did:plc:alice" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMembers(convoId, { reload: true });

    assert.deepEqual(capturedCursors, [""]);
    const stored = dataStore.$convoMemberLists.get(convoId);
    assert.deepEqual(
      stored.members.map((member) => member.did),
      ["did:plc:alice"],
    );
  });

  it("should record an ApiError under the namespaced key without rethrowing", async () => {
    const apiError = new ApiError({
      status: 400,
      statusText: "Bad Request",
      data: { error: "InvalidConvo" },
      headers: {},
      url: "/x",
    });
    const dataStore = new DataStore();
    const mockApi = {
      getConvoMembers: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMembers(convoId);

    const status = requests.getStatus("loadConvoMembers-" + convoId);
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
    assert.deepEqual(dataStore.$convoMemberLists.get(convoId), null);
  });
});

describe("loadConvoMessages", () => {
  const convoId = "convo1";

  it("should set messages on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getMessages: async () => ({
        messages: [{ id: "m1" }, { id: "m2" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 2);
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should append messages when prior cursor exists", async () => {
    const dataStore = new DataStore();
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1" }],
      cursor: "page2",
    });

    let calls = 0;
    const mockApi = {
      getMessages: async () => {
        calls += 1;
        if (calls === 1) {
          return { messages: [{ id: "m2" }], cursor: null };
        }
        return { messages: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 2);
    assert.deepEqual(stored.messages[0].id, "m1");
    assert.deepEqual(stored.messages[1].id, "m2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "old" }],
      cursor: "page2",
    });

    let capturedCursor;
    const mockApi = {
      getMessages: async (_id, { cursor }) => {
        capturedCursor = cursor;
        return { messages: [{ id: "fresh" }], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages(convoId, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 1);
    assert.deepEqual(stored.messages[0].id, "fresh");
  });

  it("should store related profiles", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getMessages: async () => ({
        messages: [{ id: "m1" }],
        cursor: null,
        relatedProfiles: [{ did: "did:plc:a", handle: "a.test" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages(convoId);

    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a.test");
  });
});

describe("pollConvoMessages", () => {
  const convoId = "convo1";
  const currentUserDid = "did:plc:me";
  const otherDid = "did:plc:other";

  const SYSTEM_MESSAGE_LOG_KINDS = [
    "logAddMember",
    "logRemoveMember",
    "logMemberJoin",
    "logMemberLeave",
    "logLockConvo",
    "logUnlockConvo",
    "logLockConvoPermanently",
    "logEditGroup",
    "logCreateJoinLink",
    "logEditJoinLink",
    "logEnableJoinLink",
    "logDisableJoinLink",
  ];

  let dataStore;

  beforeEach(() => {
    dataStore = new DataStore();
    dataStore.$currentUser.set({ did: currentUserDid });
    dataStore.$convos.set(convoId, {
      id: convoId,
      members: [{ did: currentUserDid }, { did: otherDid }],
      kind: {
        $type: "chat.bsky.convo.defs#groupConvo",
        name: "Test Group",
        memberCount: 3,
        memberLimit: 10,
        lockStatus: "unlocked",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });
    dataStore.$convoMessages.set(convoId, { messages: [], cursor: null });
  });

  function makeMessageLog(messageId, senderDid) {
    return {
      $type: "chat.bsky.convo.defs#logCreateMessage",
      rev: "rev1",
      convoId,
      message: {
        $type: "chat.bsky.convo.defs#messageView",
        id: messageId,
        rev: "rev1",
        text: "hello",
        sender: { did: senderDid },
        sentAt: "2026-06-11T00:00:00.000Z",
      },
    };
  }

  function makeSystemLog(logKind, messageId, data = {}) {
    return {
      $type: `chat.bsky.convo.defs#${logKind}`,
      rev: "rev1",
      convoId,
      message: {
        $type: "chat.bsky.convo.defs#systemMessageView",
        id: messageId,
        rev: "rev1",
        sentAt: "2026-06-11T00:00:00.000Z",
        data,
      },
      relatedProfiles: [],
    };
  }

  function makeRequestsWithLogs(logs, cursor = "next") {
    const mockApi = { getChatLogs: async () => ({ logs, cursor }) };
    return makeRequests(mockApi, dataStore);
  }

  it("should prepend messages from other senders and return the cursor", async () => {
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(
      dataStore.$convoMessages.get(convoId).messages[0].id,
      "m1",
    );
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should ingest the current user's own messages when not already stored", async () => {
    const requests = makeRequestsWithLogs([
      makeMessageLog("m1", currentUserDid),
    ]);

    await requests.pollConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 1);
    assert.deepEqual(stored.messages[0].id, "m1");
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should dedupe the current user's own messages already in the store", async () => {
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1" }],
      cursor: null,
    });
    const requests = makeRequestsWithLogs([
      makeMessageLog("m1", currentUserDid),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convoMessages.get(convoId).messages.length, 1);
  });

  it("should ingest every system-message log kind", async () => {
    const logs = SYSTEM_MESSAGE_LOG_KINDS.map((logKind, index) =>
      makeSystemLog(logKind, `sys${index}`),
    );
    const requests = makeRequestsWithLogs(logs);

    await requests.pollConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, SYSTEM_MESSAGE_LOG_KINDS.length);
    assert.deepEqual(dataStore.$messages.get("sys0").id, "sys0");
  });

  it("should store related profiles from logs", async () => {
    const log = makeSystemLog("logAddMember", "sys1", {
      member: { did: "did:plc:new" },
      addedBy: { did: otherDid },
    });
    log.relatedProfiles = [{ did: "did:plc:new", handle: "new.test" }];
    const requests = makeRequestsWithLogs([log]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$profiles.get("did:plc:new").handle, "new.test");
  });

  it("should not re-ingest an already-stored message", async () => {
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1" }],
      cursor: null,
    });
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convoMessages.get(convoId).messages.length, 1);
  });

  it("should update lock status from lock log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logLockConvo", "sys1"),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.lockStatus, "locked");
  });

  it("should update the group name from edit-group log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logEditGroup", "sys1", {
        oldName: "Test Group",
        newName: "Renamed Group",
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.name, "Renamed Group");
  });

  it("should increment member count when members are added", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logAddMember", "sys1", {
        member: { did: "did:plc:new" },
        addedBy: { did: otherDid },
      }),
      makeSystemLog("logMemberJoin", "sys2", {
        member: { did: "did:plc:new2" },
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.memberCount, 5);
  });

  it("should decrement member count when members are removed", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logMemberLeave", "sys1", {
        member: { did: otherDid },
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.memberCount, 2);
  });

  it("should remove a message when a logDeleteMessage event arrives", async () => {
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1" }, { id: "m2" }],
      cursor: null,
    });
    dataStore.$messages.set("m1", { id: "m1" });
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logDeleteMessage",
        rev: "rev1",
        convoId,
        message: {
          $type: "chat.bsky.convo.defs#deletedMessageView",
          id: "m1",
          rev: "rev1",
          sender: { did: otherDid },
          sentAt: "2026-06-11T00:00:00.000Z",
        },
      },
    ]);

    await requests.pollConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 1);
    assert.deepEqual(stored.messages[0].id, "m2");
    assert.deepEqual(dataStore.$messages.get("m1"), null);
  });

  it("should ignore join-request log events", async () => {
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logIncomingJoinRequest",
        rev: "rev1",
        convoId,
        requestedBy: { did: "did:plc:new" },
      },
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convoMessages.get(convoId).messages.length, 0);
  });

  it("should replace the stored message when an add-reaction log arrives", async () => {
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1", text: "hi", reactions: [] }],
      cursor: "keep",
    });
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logAddReaction",
        rev: "rev1",
        convoId,
        message: {
          id: "m1",
          text: "hi",
          reactions: [{ value: "👍", sender: { did: otherDid } }],
        },
        reaction: { value: "👍", sender: { did: otherDid } },
        relatedProfiles: [{ did: otherDid, handle: "other.test" }],
      },
    ]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    const stored = dataStore.$convoMessages.get(convoId);
    assert.deepEqual(stored.messages.length, 1);
    assert.deepEqual(stored.messages[0].reactions.length, 1);
    assert.deepEqual(stored.cursor, "keep");
    assert.deepEqual(dataStore.$messages.get("m1").reactions.length, 1);
    assert.deepEqual(dataStore.$profiles.get(otherDid).handle, "other.test");
  });

  it("should update only the message store when a remove-reaction log arrives for an unloaded convo", async () => {
    dataStore.$convoMessages.delete(convoId);
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logRemoveReaction",
        rev: "rev1",
        convoId,
        message: { id: "m1", text: "hi", reactions: [] },
        reaction: { value: "👍", sender: { did: otherDid } },
      },
    ]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(dataStore.$messages.get("m1").reactions, []);
    assert.deepEqual(dataStore.$convoMessages.get(convoId), null);
  });

  it("should stop and return the cursor when no messages data exists for the convo", async () => {
    dataStore.$convoMessages.delete(convoId);
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(dataStore.$messages.get("m1"), null);
    assert.deepEqual(dataStore.$convoMessages.get(convoId), null);
  });
});

describe("loadPostLikes", () => {
  const postUri = "at://did/post/1";

  it("should set likes on first load", async () => {
    const dataStore = new DataStore();
    const res = { likes: [{ actor: { did: "did:plc:a" } }], cursor: "next" };
    const mockApi = { getLikes: async () => res };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostLikes(postUri);

    assert.deepEqual(dataStore.$postLikes.get(postUri), res);
  });

  it("should append likes when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$postLikes.set(postUri, {
      likes: [{ actor: { did: "did:plc:a" } }],
      cursor: "c1",
    });
    const mockApi = {
      getLikes: async () => ({
        likes: [{ actor: { did: "did:plc:b" } }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostLikes(postUri, { cursor: "c1" });

    const stored = dataStore.$postLikes.get(postUri);
    assert.deepEqual(stored.likes.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadPostQuotes", () => {
  const postUri = "at://did/post/1";

  it("should set quotes on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getQuotes: async () => ({
        posts: [{ uri: "q1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostQuotes(postUri);

    const stored = dataStore.$postQuotes.get(postUri);
    assert.deepEqual(stored.posts.length, 1);
    assert.deepEqual(stored.cursor, "next");
  });

  it("should append quotes when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$postQuotes.set(postUri, {
      posts: [{ uri: "q1", record: {} }],
      cursor: "c1",
    });
    const mockApi = {
      getQuotes: async () => ({
        posts: [{ uri: "q2", record: {} }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostQuotes(postUri, { cursor: "c1" });

    const stored = dataStore.$postQuotes.get(postUri);
    assert.deepEqual(stored.posts.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadPostReposts", () => {
  const postUri = "at://did/post/1";

  it("should set reposts on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getRepostedBy: async () => ({
        repostedBy: [{ did: "did:plc:a" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostReposts(postUri);

    const stored = dataStore.$postReposts.get(postUri);
    assert.deepEqual(stored.repostedBy.length, 1);
    assert.deepEqual(stored.cursor, "next");
  });

  it("should append reposts when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$postReposts.set(postUri, {
      repostedBy: [{ did: "did:plc:a" }],
      cursor: "c1",
    });
    const mockApi = {
      getRepostedBy: async () => ({
        repostedBy: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostReposts(postUri, { cursor: "c1" });

    const stored = dataStore.$postReposts.get(postUri);
    assert.deepEqual(stored.repostedBy.length, 2);
    assert.deepEqual(stored.cursor, "c2");
  });
});

describe("loadActorFeeds", () => {
  const did = "did:plc:author";

  it("should set actor feeds and cache feed generators on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getActorFeeds: async () => ({
        feeds: [{ uri: "f1", displayName: "F1" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorFeeds(did);

    const stored = dataStore.$actorFeeds.get(did);
    assert.deepEqual(stored.feeds.length, 1);
    assert.deepEqual(stored.cursor, "next");
    assert.deepEqual(dataStore.$feedGenerators.get("f1").displayName, "F1");
  });

  it("should append on subsequent calls when cursor remains", async () => {
    const dataStore = new DataStore();
    dataStore.$actorFeeds.set(did, {
      feeds: [{ uri: "f1" }],
      cursor: "c1",
    });
    const mockApi = {
      getActorFeeds: async () => ({
        feeds: [{ uri: "f2" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorFeeds(did);

    const stored = dataStore.$actorFeeds.get(did);
    assert.deepEqual(stored.feeds.length, 2);
    assert.deepEqual(stored.cursor, null);
  });

  it("should short-circuit when there is no remaining cursor", async () => {
    const dataStore = new DataStore();
    dataStore.$actorFeeds.set(did, {
      feeds: [{ uri: "f1" }],
      cursor: null,
    });
    let called = false;
    const mockApi = {
      getActorFeeds: async () => {
        called = true;
        return { feeds: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorFeeds(did);

    assert.deepEqual(called, false);
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$actorFeeds.set(did, {
      feeds: [{ uri: "f1" }],
      cursor: null,
    });

    let capturedCursor;
    const mockApi = {
      getActorFeeds: async (_did, { cursor }) => {
        capturedCursor = cursor;
        return { feeds: [{ uri: "f2" }], cursor: "next" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorFeeds(did, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$actorFeeds.get(did);
    assert.deepEqual(stored.feeds.length, 1);
    assert.deepEqual(stored.feeds[0].uri, "f2");
  });
});

describe("loadListsWithMembershipForActor", () => {
  const actorDid = "did:plc:target";
  const list1 = { uri: "at://owner/app.bsky.graph.list/1", name: "L1" };
  const list2 = { uri: "at://owner/app.bsky.graph.list/2", name: "L2" };

  it("should store the first page keyed by actor", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getListsWithMembership: async () => ({
        listsWithMembership: [
          { list: list1, listItem: { uri: "li1", subject: actorDid } },
          { list: list2 },
        ],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListsWithMembershipForActor(actorDid);

    const stored = dataStore.$listsWithMembershipByActor.get(actorDid);
    assert.deepEqual(stored.listsWithMembership.length, 2);
    assert.deepEqual(stored.cursor, "next");
    assert.deepEqual(stored.listsWithMembership[0].listItem.uri, "li1");
  });

  it("should append the next page when called again with a cached cursor", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      listsWithMembership: [{ list: list1 }],
      cursor: "c1",
    });
    let capturedCursor;
    const mockApi = {
      getListsWithMembership: async (_actor, { cursor }) => {
        capturedCursor = cursor;
        return {
          listsWithMembership: [{ list: list2 }],
          cursor: null,
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListsWithMembershipForActor(actorDid);

    assert.deepEqual(capturedCursor, "c1");
    const stored = dataStore.$listsWithMembershipByActor.get(actorDid);
    assert.deepEqual(stored.listsWithMembership.length, 2);
    assert.deepEqual(stored.cursor, null);
  });

  it("should short-circuit when fully loaded", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      listsWithMembership: [{ list: list1 }],
      cursor: null,
    });
    let called = false;
    const mockApi = {
      getListsWithMembership: async () => {
        called = true;
        return { listsWithMembership: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListsWithMembershipForActor(actorDid);

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      listsWithMembership: [{ list: list1 }],
      cursor: "c1",
    });
    let capturedCursor;
    const mockApi = {
      getListsWithMembership: async (_actor, { cursor }) => {
        capturedCursor = cursor;
        return {
          listsWithMembership: [{ list: list2 }],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListsWithMembershipForActor(actorDid, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$listsWithMembershipByActor.get(actorDid);
    assert.deepEqual(stored.listsWithMembership.length, 1);
    assert.deepEqual(stored.listsWithMembership[0].list.uri, list2.uri);
  });
});

describe("loadHashtagFeed", () => {
  it("should store hashtag feed posts on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadHashtagFeed("foo", "top");

    const stored = dataStore.$hashtagFeeds.get("foo-top");
    assert.deepEqual(stored.posts.length, 1);
    assert.deepEqual(stored.posts[0].uri, "p1");
    assert.deepEqual(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.$hashtagFeeds.set("foo-top", {
      posts: [{ uri: "p1" }],
      cursor: "c1",
    });
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p2", record: {} }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadHashtagFeed("foo", "top");

    const stored = dataStore.$hashtagFeeds.get("foo-top");
    assert.deepEqual(stored.posts.length, 2);
    assert.deepEqual(stored.posts[1].uri, "p2");
  });

  it("should store an empty page when the response has no posts array", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      searchPosts: async () => ({ cursor: null }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadHashtagFeed("foo", "top");

    const stored = dataStore.$hashtagFeeds.get("foo-top");
    assert.deepEqual(stored.posts, []);
    assert.deepEqual(stored.cursor, null);
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$hashtagFeeds.set("foo-top", {
      posts: [{ uri: "p1" }],
      cursor: "c1",
    });

    let capturedCursor;
    const mockApi = {
      searchPosts: async (_query, { cursor }) => {
        capturedCursor = cursor;
        return { posts: [{ uri: "p2", record: {} }], cursor: "fresh" };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadHashtagFeed("foo", "top", { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$hashtagFeeds.get("foo-top");
    assert.deepEqual(stored.posts.length, 1);
    assert.deepEqual(stored.posts[0].uri, "p2");
  });
});

describe("loadPinnedItems", () => {
  it("should fan out to getFeedGenerators and getList for pinned items and cache results", async () => {
    const preferences = {
      getPinnedFeeds: () => [
        { type: "feed", value: "at://did/feed/one" },
        { type: "feed", value: "at://did/feed/two" },
        { type: "list", value: "at://did/list/one" },
        { type: "timeline", value: "following" },
      ],
    };

    let capturedFeedUris;
    const capturedListUris = [];
    const mockApi = {
      getFeedGenerators: async (uris) => {
        capturedFeedUris = uris;
        return uris.map((uri) => ({ uri, displayName: `name-${uri}` }));
      },
      getList: async (uri) => {
        capturedListUris.push(uri);
        return { list: { uri, name: `list-${uri}` }, items: [], cursor: "" };
      },
    };
    const dataStore = new DataStore();
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(mockApi, dataStore, provider);

    await requests.loadPinnedItems();

    assert.deepEqual(capturedFeedUris, [
      "at://did/feed/one",
      "at://did/feed/two",
    ]);
    assert.deepEqual(capturedListUris, ["at://did/list/one"]);
    const pinned = dataStore.$pinnedItems.get();
    assert.deepEqual(pinned.length, 4);
    assert.deepEqual(pinned[0].type, "feed");
    assert.deepEqual(pinned[2].type, "list");
    assert.deepEqual(pinned[3].type, "timeline");
    assert.deepEqual(
      dataStore.$feedGenerators.get("at://did/feed/one").displayName,
      "name-at://did/feed/one",
    );
  });

  it("should skip the api call when no pinned feeds or lists", async () => {
    const preferences = {
      getPinnedFeeds: () => [{ type: "timeline", value: "following" }],
    };
    let feedsCalled = false;
    let listCalled = false;
    const mockApi = {
      getFeedGenerators: async () => {
        feedsCalled = true;
        return [];
      },
      getList: async () => {
        listCalled = true;
        return null;
      },
    };
    const dataStore = new DataStore();
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(mockApi, dataStore, provider);

    await requests.loadPinnedItems();

    assert.deepEqual(feedsCalled, false);
    assert.deepEqual(listCalled, false);
    const pinned = dataStore.$pinnedItems.get();
    assert.deepEqual(pinned.length, 1);
    assert.deepEqual(pinned[0].type, "timeline");
  });
});

describe("enableStatus / getStatus", () => {
  it("should track loading start, end, and clear errors on success", async () => {
    const mockApi = { getMutes: async () => ({ mutes: [], cursor: null }) };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    const initialStatus = requests.getStatus("loadMutedProfiles");
    assert.deepEqual(initialStatus.loading, false);
    assert.deepEqual(initialStatus.error, null);

    const promise = requests.loadMutedProfiles();
    assert.deepEqual(requests.getStatus("loadMutedProfiles").loading, true);
    await promise;

    const finalStatus = requests.getStatus("loadMutedProfiles");
    assert.deepEqual(finalStatus.loading, false);
    assert.deepEqual(finalStatus.error, null);
  });

  it("should record ApiError and clear loading on error path", async () => {
    const apiError = new ApiError({
      status: 500,
      statusText: "Server Error",
      data: null,
      headers: {},
      url: "/x",
    });
    const mockApi = {
      getMutes: async () => {
        throw apiError;
      },
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMutedProfiles();

    const status = requests.getStatus("loadMutedProfiles");
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
  });

  it("should record non-ApiErrors on the status store and rethrow them", async () => {
    const otherError = new TypeError("Failed to fetch");
    const mockApi = {
      getMutes: async () => {
        throw otherError;
      },
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    let caught = null;
    try {
      await requests.loadMutedProfiles();
    } catch (error) {
      caught = error;
    }
    assert(caught === otherError, "expected non-ApiError to propagate");
    const status = requests.getStatus("loadMutedProfiles");
    assert.deepEqual(status.loading, false);
    assert(
      status.error === otherError,
      "expected status.error to be the network error",
    );
  });

  it("should clear a recorded error once a later request succeeds", async () => {
    let shouldFail = true;
    const mockApi = {
      getMutes: async () => {
        if (shouldFail) {
          throw new TypeError("Failed to fetch");
        }
        return { mutes: [], cursor: null };
      },
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMutedProfiles().catch(() => {});
    assert(requests.getStatus("loadMutedProfiles").error !== null);

    shouldFail = false;
    await requests.loadMutedProfiles();
    assert.deepEqual(requests.getStatus("loadMutedProfiles").error, null);
  });

  it("should namespace status by request id derived from arguments", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getProfile: async (did) => ({ did, handle: "x" }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadDetailedProfile("did:plc:a");
    await requests.loadDetailedProfile("did:plc:b");

    assert.deepEqual(
      requests.getStatus("loadDetailedProfile-did:plc:a").error,
      null,
    );
    assert.deepEqual(
      requests.getStatus("loadDetailedProfile-did:plc:a").loading,
      false,
    );
    assert.deepEqual(
      requests.getStatus("loadDetailedProfile-did:plc:b").loading,
      false,
    );
  });
});

describe("_loadBlockedPosts", () => {
  const existingUri = "at://did:plc:blocked/app.bsky.feed.post/exists";
  const deletedUri = "at://did:plc:blocked/app.bsky.feed.post/gone";

  function setup({ getPosts = async () => [], getRecord }) {
    const mockApi = { getPosts, getRecord };
    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );
    return { requests, dataStore };
  }

  it("should mark a post unavailable when its record is confirmed deleted", async () => {
    const { requests, dataStore } = setup({
      getRecord: async (uri) => {
        if (uri === deletedUri) {
          throw new ApiError({
            status: 400,
            statusText: "Bad Request",
            data: { error: "RecordNotFound" },
            headers: {},
            url: "",
          });
        }
        return { uri, value: {} };
      },
    });
    await requests._loadBlockedPosts([existingUri, deletedUri]);
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
    assert(dataStore.$unavailablePosts.get(deletedUri) !== null);
    assert.deepEqual(
      dataStore.$unavailablePosts.get(deletedUri).uri,
      deletedUri,
    );
  });

  it("should not mark a post unavailable when the record probe fails for other reasons", async () => {
    const { requests, dataStore } = setup({
      getRecord: async () => {
        throw new TypeError("network down");
      },
    });
    await requests._loadBlockedPosts([existingUri]);
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
  });

  it("should not probe records for posts that getPosts returned", async () => {
    const { requests, dataStore } = setup({
      getPosts: async () => [{ uri: existingUri, record: { text: "hi" } }],
      getRecord: async () => {
        throw new Error("getRecord should not be called");
      },
    });
    await requests._loadBlockedPosts([existingUri]);
    assert.deepEqual(dataStore.$posts.get(existingUri).record.text, "hi");
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
  });
});

function makeRequestsWithConstellation(api, dataStore, constellation) {
  return new Requests(
    api,
    dataStore,
    { requirePreferences: () => Preferences.createLoggedOutPreferences() },
    new DraftMediaStore("test-media"),
    new EventEmitter(),
    constellation,
  );
}

describe("statusStore.$statuses", () => {
  it("should expose combined loading and error state per request id", async () => {
    const apiError = new ApiError({
      status: 500,
      statusText: "Server Error",
      data: null,
      headers: {},
      url: "/x",
    });
    const mockApi = {
      getMutes: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(mockApi, new DataStore());

    assert.deepEqual(requests.statusStore.$statuses.get("loadMutedProfiles"), {
      loading: false,
      error: null,
    });

    const promise = requests.loadMutedProfiles();
    assert.deepEqual(
      requests.statusStore.$statuses.get("loadMutedProfiles").loading,
      true,
    );
    await promise;

    const status = requests.statusStore.$statuses.get("loadMutedProfiles");
    assert.deepEqual(status.loading, false);
    assert(status.error === apiError, "expected the recorded ApiError");
  });
});

describe("loadCurrentUser", () => {
  it("should resolve the session did and store the profile", async () => {
    const profile = { did: "did:plc:me", handle: "me.test" };
    let requestedDid = null;
    const mockApi = {
      getSession: async () => ({ did: "did:plc:me" }),
      getProfile: async (did) => {
        requestedDid = did;
        return profile;
      },
    };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadCurrentUser();

    assert.deepEqual(requestedDid, "did:plc:me");
    assert.deepEqual(dataStore.$currentUser.get(), profile);
  });
});

describe("loadPost", () => {
  it("should load and store a single post", async () => {
    const post = { uri: "at://did:plc:a/app.bsky.feed.post/1", record: {} };
    const mockApi = { getPost: async () => post };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPost(post.uri);

    assert.deepEqual(dataStore.$posts.get(post.uri), post);
  });
});

describe("loadPostThread with a blocked parent", () => {
  const rootUri = "at://did:plc:root/app.bsky.feed.post/root";
  const parentUri = "at://did:plc:blockedauthor/app.bsky.feed.post/parent";
  const postURI = "at://did:plc:viewer/app.bsky.feed.post/main";

  function makeMainPost() {
    return {
      uri: postURI,
      replyCount: 0,
      record: {
        reply: { root: { uri: rootUri }, parent: { uri: parentUri } },
      },
    };
  }

  function makeBlockedParent(viewer = {}) {
    return {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: parentUri,
      blocked: true,
      author: { did: "did:plc:blockedauthor", viewer },
    };
  }

  const parentPost = {
    uri: parentUri,
    author: { did: "did:plc:blockedauthor" },
    record: { reply: { root: { uri: rootUri }, parent: { uri: rootUri } } },
  };
  const rootPost = {
    uri: rootUri,
    author: { did: "did:plc:root" },
    record: {},
  };

  function makeApiWithPosts() {
    const postsByUri = new Map([
      [parentUri, parentPost],
      [rootUri, rootPost],
    ]);
    return {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) =>
        uris.map((uri) => postsByUri.get(uri)).filter(Boolean),
    };
  }

  it("should rebuild the parent chain from backlinks across blocked authors", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "parent",
        },
      ],
    };
    const requests = makeRequestsWithConstellation(
      makeApiWithPosts(),
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    const thread = dataStore.$postThreads.get(postURI);
    assert.deepEqual(thread.parent.$type, "app.bsky.feed.defs#threadViewPost");
    assert.deepEqual(thread.parent.post.uri, parentUri);
    assert.deepEqual(thread.parent.parent.post.uri, rootUri);
    assert.deepEqual(thread.parent.parent.parent, null);
    assert.deepEqual(dataStore.$posts.get(parentUri), parentPost);
    assert.deepEqual(dataStore.$posts.get(rootUri), rootPost);
  });

  it("should walk through multiple loaded posts by the same blocked author", async () => {
    const grandparentUri =
      "at://did:plc:blockedauthor/app.bsky.feed.post/grandparent";
    const nearParentPost = {
      uri: parentUri,
      author: { did: "did:plc:blockedauthor" },
      record: {
        reply: { root: { uri: rootUri }, parent: { uri: grandparentUri } },
      },
    };
    const grandparentPost = {
      uri: grandparentUri,
      author: { did: "did:plc:blockedauthor" },
      record: { reply: { root: { uri: rootUri }, parent: { uri: rootUri } } },
    };
    const postsByUri = new Map([
      [parentUri, nearParentPost],
      [grandparentUri, grandparentPost],
      [rootUri, rootPost],
    ]);
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "parent",
        },
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "grandparent",
        },
      ],
    };
    const mockApi = {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) =>
        uris.map((uri) => postsByUri.get(uri)).filter(Boolean),
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    const thread = dataStore.$postThreads.get(postURI);
    assert.deepEqual(thread.parent.post.uri, parentUri);
    assert.deepEqual(thread.parent.parent.post.uri, grandparentUri);
    assert.deepEqual(thread.parent.parent.parent.post.uri, rootUri);
  });

  it("should rethrow non-abort backlink failures", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => {
        throw new TypeError("network down");
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await assert.rejects(requests.loadPostThread(postURI), /network down/);
  });

  it("should fall back to loading the blocked parent thread when the viewer is involved in the block", async () => {
    const dataStore = new DataStore();
    let constellationCalled = false;
    const constellation = {
      getLinks: async () => {
        constellationCalled = true;
        return [];
      },
    };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent({ blocking: "at://block" }),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    assert.deepEqual(constellationCalled, false);
    const thread = dataStore.$postThreads.get(postURI);
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });

  it("should fall back to loading the blocked parent thread when backlinks time out", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => {
        throw Object.assign(new Error("timed out"), { name: "AbortError" });
      },
    };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent(),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    const thread = dataStore.$postThreads.get(postURI);
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });

  it("should fall back to loading the blocked parent thread when backlinks yield no posts", async () => {
    const dataStore = new DataStore();
    // No backlinks by the blocked author — only the root gets appended
    const constellation = { getLinks: async () => [] };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent(),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    const thread = dataStore.$postThreads.get(postURI);
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });
});

describe("_loadBlockedReplies", () => {
  const postURI = "at://did:plc:op/app.bsky.feed.post/main";
  const replyUri = "at://did:plc:replier/app.bsky.feed.post/r1";
  const blockedReplyUri = "at://did:plc:blocker/app.bsky.feed.post/r2";

  it("should return an empty list when the thread has no post", async () => {
    const requests = makeRequests({}, new DataStore());

    const replies = await requests._loadBlockedReplies({});

    assert.deepEqual(replies, []);
  });

  it("should keep the loaded replies when backlinks time out", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => {
        throw Object.assign(new Error("timed out"), { name: "AbortError" });
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 1, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    assert.deepEqual(dataStore.$postThreads.get(postURI).replies, []);
  });

  it("should rethrow non-abort backlink failures", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => {
        throw new TypeError("network down");
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 1, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await assert.rejects(requests.loadPostThread(postURI), /network down/);
  });

  it("should load missing replies from backlinks and mark them as blocked replies", async () => {
    const dataStore = new DataStore();
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:replier",
          collection: "app.bsky.feed.post",
          rkey: "r1",
        },
        {
          did: "did:plc:blocker",
          collection: "app.bsky.feed.post",
          rkey: "r2",
        },
      ],
    };
    const replyPost = {
      uri: replyUri,
      author: { did: "did:plc:replier", viewer: {} },
      record: {},
    };
    const blockingReplyPost = {
      uri: blockedReplyUri,
      author: { did: "did:plc:blocker", viewer: { blockedBy: true } },
      record: {},
    };
    let requestedUris = null;
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 2, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) => {
        requestedUris = uris;
        return [replyPost, blockingReplyPost];
      },
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
    );

    await requests.loadPostThread(postURI);

    assert.deepEqual(requestedUris, [replyUri, blockedReplyUri]);
    const thread = dataStore.$postThreads.get(postURI);
    // The reply from the author blocking the viewer is filtered out
    assert.deepEqual(thread.replies.length, 1);
    assert.deepEqual(thread.replies[0].post.uri, replyUri);
    assert.deepEqual(thread.replies[0].post.isBlockedReply, true);
    assert.deepEqual(dataStore.$posts.get(replyUri).isBlockedReply, true);
  });
});

describe("loadNextFeedPage feed types", () => {
  it("should use getFollowingFeed for the timeline type", async () => {
    const dataStore = new DataStore();
    let called = false;
    const mockApi = {
      getFollowingFeed: async () => {
        called = true;
        return { feed: [{ post: { uri: "t1" } }], cursor: "c1" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextFeedPage({ type: "timeline", uri: "following" });

    assert.deepEqual(called, true);
    assert.deepEqual(dataStore.$feeds.get("following").feed.length, 1);
  });

  it("should use getListFeed for the list type", async () => {
    const dataStore = new DataStore();
    const listUri = "at://did/app.bsky.graph.list/1";
    let requestedUri = null;
    const mockApi = {
      getListFeed: async (uri) => {
        requestedUri = uri;
        return { feed: [{ post: { uri: "l1" } }], cursor: "c1" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextFeedPage({ type: "list", uri: listUri });

    assert.deepEqual(requestedUri, listUri);
    assert.deepEqual(dataStore.$feeds.get(listUri).feed.length, 1);
  });

  it("should reject on an unknown feed type", async () => {
    const requests = makeRequests({}, new DataStore());

    await assert.rejects(
      requests.loadNextFeedPage({ type: "bogus", uri: "x" }),
      /Unknown pinned item type/,
    );
  });
});

describe("loadDetailedProfiles", () => {
  it("should store each profile in both profile maps", async () => {
    const profiles = [
      { did: "did:plc:a", handle: "a.test" },
      { did: "did:plc:b", handle: "b.test" },
    ];
    const mockApi = { getProfiles: async () => profiles };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadDetailedProfiles(["did:plc:a", "did:plc:b"]);

    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), profiles[0]);
    assert.deepEqual(dataStore.$detailedProfiles.get("did:plc:b"), profiles[1]);
  });

  it("should not call the api when dids is empty", async () => {
    let called = false;
    const mockApi = {
      getProfiles: async () => {
        called = true;
        return [];
      },
    };
    const requests = makeRequests(mockApi, new DataStore());

    await requests.loadDetailedProfiles([]);

    assert.deepEqual(called, false);
  });
});

describe("_loadJoinLinkPreviews", () => {
  it("should fetch distinct codes and store previews by code", async () => {
    const dataStore = new DataStore();
    let requestedCodes = null;
    const mockApi = {
      isAuthenticated: true,
      getJoinLinkPreviews: async (codes) => {
        requestedCodes = codes;
        return {
          joinLinkPreviews: [
            { code: "abc", name: "Group" },
            { name: "no code" },
          ],
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests._loadJoinLinkPreviews(["abc", "abc", null, "def"]);

    assert.deepEqual(requestedCodes, ["abc", "def"]);
    assert.deepEqual(
      dataStore.$joinLinkPreviewsByCode.get("abc").name,
      "Group",
    );
    assert.deepEqual(dataStore.$joinLinkPreviewsByCode.get("def"), null);
  });

  it("should not fetch when unauthenticated or when there are no codes", async () => {
    let called = false;
    const mockApi = {
      isAuthenticated: false,
      getJoinLinkPreviews: async () => {
        called = true;
        return { joinLinkPreviews: [] };
      },
    };
    const requests = makeRequests(mockApi, new DataStore());

    await requests._loadJoinLinkPreviews(["abc"]);
    assert.deepEqual(called, false);

    mockApi.isAuthenticated = true;
    await requests._loadJoinLinkPreviews([null, undefined]);
    assert.deepEqual(called, false);
  });

  it("should swallow fetch failures", async () => {
    const mockApi = {
      isAuthenticated: true,
      getJoinLinkPreviews: async () => {
        throw new Error("boom");
      },
    };
    const requests = makeRequests(mockApi, new DataStore());

    await requests._loadJoinLinkPreviews(["abc"]);
  });
});

describe("_loadPostDependencies", () => {
  it("should not reject when a dependency loader fails", async () => {
    const mockApi = {
      getPosts: async () => {
        throw new Error("network down");
      },
    };
    const requests = makeRequests(mockApi, new DataStore());
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "at://did:plc:x/app.bsky.feed.post/1",
    };

    await requests._loadPostDependencies([blockedPost]);
  });
});

describe("loadFeedGenerator / loadList / loadStarterPack", () => {
  it("should store the feed generator by uri", async () => {
    const dataStore = new DataStore();
    const feedGenerator = { uri: "at://did/feed/1", displayName: "Feed" };
    const mockApi = { getFeedGenerator: async () => feedGenerator };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedGenerator(feedGenerator.uri);

    assert.deepEqual(
      dataStore.$feedGenerators.get(feedGenerator.uri),
      feedGenerator,
    );
  });

  it("should store the list view by uri", async () => {
    const dataStore = new DataStore();
    const listUri = "at://did/app.bsky.graph.list/1";
    let capturedOptions = null;
    const mockApi = {
      getList: async (_uri, options) => {
        capturedOptions = options;
        return { list: { uri: listUri, name: "L1" }, items: [] };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadList(listUri);

    assert.deepEqual(capturedOptions, { limit: 1 });
    assert.deepEqual(dataStore.$lists.get(listUri).name, "L1");
  });

  it("should store the starter pack by uri", async () => {
    const dataStore = new DataStore();
    const starterPack = { uri: "at://did/starterpack/1", record: {} };
    const mockApi = { getStarterPack: async () => starterPack };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadStarterPack(starterPack.uri);

    assert.deepEqual(dataStore.$starterPacks.get(starterPack.uri), starterPack);
  });
});

describe("loadListMembers", () => {
  const listUri = "at://did/app.bsky.graph.list/1";

  it("should store the first page and hydrate member profiles", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getList: async () => ({
        list: { uri: listUri },
        items: [{ uri: "li1", subject: { did: "did:plc:a", handle: "a" } }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListMembers(listUri);

    const stored = dataStore.$listMembers.get(listUri);
    assert.deepEqual(stored.items.length, 1);
    assert.deepEqual(stored.cursor, "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a");
  });

  it("should short-circuit when fully loaded", async () => {
    const dataStore = new DataStore();
    dataStore.$listMembers.set(listUri, { items: [], cursor: null });
    let called = false;
    const mockApi = {
      getList: async () => {
        called = true;
        return { items: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListMembers(listUri);

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$listMembers.set(listUri, {
      items: [{ uri: "li1", subject: { did: "did:plc:a" } }],
      cursor: null,
    });
    let capturedCursor;
    const mockApi = {
      getList: async (_uri, { cursor }) => {
        capturedCursor = cursor;
        return {
          items: [{ uri: "li2", subject: { did: "did:plc:b" } }],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadListMembers(listUri, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$listMembers.get(listUri);
    assert.deepEqual(stored.items.length, 1);
    assert.deepEqual(stored.items[0].uri, "li2");
  });
});

describe("loadActorLists", () => {
  const did = "did:plc:author";

  it("should store actor lists and cache each list view", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getActorLists: async () => ({
        lists: [{ uri: "at://did/app.bsky.graph.list/1", name: "L1" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorLists(did);

    const stored = dataStore.$actorLists.get(did);
    assert.deepEqual(stored.lists.length, 1);
    assert.deepEqual(stored.cursor, "next");
    assert.deepEqual(
      dataStore.$lists.get("at://did/app.bsky.graph.list/1").name,
      "L1",
    );
  });

  it("should short-circuit when there is no remaining cursor", async () => {
    const dataStore = new DataStore();
    dataStore.$actorLists.set(did, { lists: [], cursor: null });
    let called = false;
    const mockApi = {
      getActorLists: async () => {
        called = true;
        return { lists: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorLists(did);

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$actorLists.set(did, {
      lists: [{ uri: "old" }],
      cursor: null,
    });
    let capturedCursor;
    const mockApi = {
      getActorLists: async (_did, { cursor }) => {
        capturedCursor = cursor;
        return { lists: [{ uri: "new" }], cursor: "next" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadActorLists(did, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$actorLists.get(did);
    assert.deepEqual(stored.lists.length, 1);
    assert.deepEqual(stored.lists[0].uri, "new");
  });
});

describe("loadCurrentUserLists", () => {
  it("should do nothing when there is no current user", async () => {
    let called = false;
    const mockApi = {
      getActorLists: async () => {
        called = true;
        return { lists: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, new DataStore());

    await requests.loadCurrentUserLists();

    assert.deepEqual(called, false);
  });

  it("should load the current user's lists", async () => {
    const dataStore = new DataStore();
    dataStore.$currentUser.set({ did: "did:plc:me" });
    let requestedDid = null;
    const mockApi = {
      getActorLists: async (did) => {
        requestedDid = did;
        return { lists: [{ uri: "l1" }], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadCurrentUserLists();

    assert.deepEqual(requestedDid, "did:plc:me");
    assert.deepEqual(dataStore.$actorLists.get("did:plc:me").lists.length, 1);
  });
});

describe("loadDrafts", () => {
  function makeRequestsWithDraftStore(api, dataStore, draftMediaStore) {
    return new Requests(
      api,
      dataStore,
      { requirePreferences: () => Preferences.createLoggedOutPreferences() },
      draftMediaStore,
      new EventEmitter(),
      stubConstellation,
    );
  }

  it("should store the drafts page and load local media refs", async () => {
    const dataStore = new DataStore();
    const draftView = {
      draft: {
        posts: [
          {
            embedImages: [{ localRef: { path: "media/1" } }],
            embedVideos: [{ localRef: { path: "media/2" } }],
          },
        ],
      },
    };
    const mockApi = {
      getDrafts: async () => ({ drafts: [draftView], cursor: "next" }),
    };
    let loadedRefs = null;
    const draftMediaStore = {
      load: async (refs) => {
        loadedRefs = refs;
      },
    };
    const requests = makeRequestsWithDraftStore(
      mockApi,
      dataStore,
      draftMediaStore,
    );

    await requests.loadDrafts();

    assert.deepEqual(loadedRefs, ["media/1", "media/2"]);
    const stored = dataStore.$drafts.get();
    assert.deepEqual(stored.drafts.length, 1);
    assert.deepEqual(stored.cursor, "next");
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$drafts.set({ drafts: [{ draft: {} }], cursor: "c1" });
    let capturedCursor;
    const mockApi = {
      getDrafts: async ({ cursor }) => {
        capturedCursor = cursor;
        return { drafts: [{ draft: { posts: [] } }], cursor: null };
      },
    };
    const requests = makeRequestsWithDraftStore(mockApi, dataStore, {
      load: async () => {},
    });

    await requests.loadDrafts({ reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = dataStore.$drafts.get();
    assert.deepEqual(stored.drafts.length, 1);
    assert.deepEqual(stored.cursor, null);
  });
});

describe("loadKnownFollowers", () => {
  const profileDid = "did:plc:target";

  it("should store known followers and hydrate profiles on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getKnownFollowers: async () => ({
        followers: [{ did: "did:plc:a", handle: "a" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadKnownFollowers(profileDid);

    const stored = dataStore.$knownFollowers.get(profileDid);
    assert.deepEqual(stored.followers.length, 1);
    assert.deepEqual(stored.cursor, "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a");
  });

  it("should append when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$knownFollowers.set(profileDid, {
      followers: [{ did: "did:plc:a" }],
      cursor: "c1",
    });
    const mockApi = {
      getKnownFollowers: async () => ({
        followers: [{ did: "did:plc:b" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadKnownFollowers(profileDid, { cursor: "c1" });

    const stored = dataStore.$knownFollowers.get(profileDid);
    assert.deepEqual(stored.followers.length, 2);
    assert.deepEqual(stored.cursor, null);
  });
});

describe("loadProfileChatStatus", () => {
  it("should store the availability response keyed by profile did", async () => {
    const dataStore = new DataStore();
    let requestedDids = null;
    const availability = { canChat: true };
    const mockApi = {
      getConvoAvailability: async (dids) => {
        requestedDids = dids;
        return availability;
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileChatStatus("did:plc:a");

    assert.deepEqual(requestedDids, ["did:plc:a"]);
    assert.deepEqual(
      dataStore.$profileChatStatus.get("did:plc:a"),
      availability,
    );
  });
});
