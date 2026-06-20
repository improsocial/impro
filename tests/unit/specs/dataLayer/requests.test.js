import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Requests } from "/js/dataLayer/requests.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { Preferences } from "/js/preferences.js";
import { ApiError } from "/js/api.js";
import { SignalMap } from "/js/signals.js";

const t = new TestSuite("Requests");

const stubConstellation = { getLinks: async () => [] };
const stubPluginService = {
  $pluginFilteredFeedItems: new SignalMap(),
  refreshFiltersForFeed: async () => {},
};

function createRequests(api, dataStore, preferencesProvider) {
  return new Requests(api, dataStore, preferencesProvider, stubPluginService, {
    constellation: stubConstellation,
  });
}

t.describe("loadPostThread", (it) => {
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
    assertEquals(dataStore.$postThreads.get(postURI), mockPostThread);

    // Check postThreadOther was stored
    assertEquals(dataStore.$postThreadOthers.get(postURI), mockPostThreadOther);

    // Check posts were stored
    assertEquals(dataStore.$posts.get(postURI), normalizedPosts[0]);
    assertEquals(dataStore.$posts.get("reply1"), normalizedPosts[1]);
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

    assertEquals(dataStore.$postThreads.get(postURI), emptyPostThread);
    assertEquals(dataStore.$postThreadOthers.get(postURI), []);
    assertEquals(dataStore.$posts.get(postURI), normalizedPosts[0]);
  });
});

t.describe("loadNextFeedPage", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should load initial feed page", async () => {
    const mockFeed = {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "cursor123",
    };

    const normalizedPosts = [
      { uri: "post1", content: "Post 1" },
      { uri: "post2", content: "Post 2" },
    ];

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

    await requests.loadNextFeedPage(feedURI);

    // Check feed was stored
    assertEquals(dataStore.$feeds.get(feedURI), mockFeed);

    // Check posts were stored
    assertEquals(dataStore.$posts.get("post1"), normalizedPosts[0]);
    assertEquals(dataStore.$posts.get("post2"), normalizedPosts[1]);
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

    const normalizedPosts = [
      { uri: "post2", content: "Post 2" },
      { uri: "post3", content: "Post 3" },
    ];

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

    await requests.loadNextFeedPage(feedURI);

    // Check feed was appended
    const storedFeed = dataStore.$feeds.get(feedURI);
    assertEquals(storedFeed.feed.length, 3);
    assertEquals(storedFeed.feed[0], { post: { uri: "post1" } });
    assertEquals(storedFeed.feed[1], { post: { uri: "post2" } });
    assertEquals(storedFeed.feed[2], { post: { uri: "post3" } });
    assertEquals(storedFeed.cursor, "cursor2");

    // Check new posts were stored
    assertEquals(dataStore.$posts.get("post2"), normalizedPosts[0]);
    assertEquals(dataStore.$posts.get("post3"), normalizedPosts[1]);
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

    await requests.loadNextFeedPage(feedURI);

    assertEquals(dataStore.$feeds.get(feedURI), emptyFeed);
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

    await requests.loadNextFeedPage(feedURI);

    assertEquals(dataStore.$feeds.get(feedURI), feedWithReplies);
    assertEquals(dataStore.$posts.get("post1").uri, normalizedPosts[0].uri);
    assertEquals(dataStore.$posts.get("root1").uri, normalizedPosts[1].uri);
    assertEquals(dataStore.$posts.get("parent1").uri, normalizedPosts[2].uri);
  });
});

t.describe("loadPluginFilteredFeedItems", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  // Stub pluginService that mimics PluginService.refreshFiltersForFeed,
  // storing results in $pluginFilteredFeedItems so tests can verify them.
  function makePluginService(getFilteredFeedItems) {
    const $pluginFilteredFeedItems = new SignalMap();
    return {
      $pluginFilteredFeedItems,
      refreshFiltersForFeed: async (uri, feed, { reload = false } = {}) => {
        const filtered = await getFilteredFeedItems(uri, feed);
        const existing = reload
          ? {}
          : ($pluginFilteredFeedItems.get(uri) ?? {});
        $pluginFilteredFeedItems.set(uri, { ...existing, ...filtered });
      },
    };
  }

  function createRequestsWithPluginService(dataStore, pluginService) {
    return new Requests(
      {},
      dataStore,
      { requirePreferences: () => Preferences.createLoggedOutPreferences() },
      pluginService,
      { constellation: stubConstellation },
    );
  }

  it("should return early without writing when feed is missing", async () => {
    const dataStore = new DataStore();
    let invoked = false;
    const pluginService = makePluginService(async () => {
      invoked = true;
      return { a: { hidden: true } };
    });
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI);

    assertEquals(invoked, false);
    assertEquals(pluginService.$pluginFilteredFeedItems.get(feedURI), null);
  });

  it("should pass the feed to the plugin service and store results", async () => {
    const dataStore = new DataStore();
    const storedFeed = {
      feed: [{ post: { uri: "p1" } }],
      cursor: "c1",
    };
    dataStore.$feeds.set(feedURI, storedFeed);

    let capturedUri = null;
    let capturedFeed = null;
    const pluginService = makePluginService(async (uri, feed) => {
      capturedUri = uri;
      capturedFeed = feed;
      return { p1: { hidden: true } };
    });
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI);

    assertEquals(capturedUri, feedURI);
    assertEquals(capturedFeed, storedFeed);
    assertEquals(pluginService.$pluginFilteredFeedItems.get(feedURI), {
      p1: { hidden: true },
    });
  });

  it("should merge with existing filtered items by default", async () => {
    const dataStore = new DataStore();
    dataStore.$feeds.set(feedURI, { feed: [], cursor: null });
    const pluginService = makePluginService(async () => ({
      p2: { hidden: false },
      p3: { hidden: true },
    }));
    pluginService.$pluginFilteredFeedItems.set(feedURI, {
      p1: { hidden: true },
      p2: { hidden: true },
    });
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI);

    assertEquals(pluginService.$pluginFilteredFeedItems.get(feedURI), {
      p1: { hidden: true },
      p2: { hidden: false },
      p3: { hidden: true },
    });
  });

  it("should replace existing filtered items when reload is true", async () => {
    const dataStore = new DataStore();
    dataStore.$feeds.set(feedURI, { feed: [], cursor: null });
    const pluginService = makePluginService(async () => ({
      p3: { hidden: true },
    }));
    pluginService.$pluginFilteredFeedItems.set(feedURI, {
      p1: { hidden: true },
      p2: { hidden: true },
    });
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI, { reload: true });

    assertEquals(pluginService.$pluginFilteredFeedItems.get(feedURI), {
      p3: { hidden: true },
    });
  });
});

t.describe("loadDetailedProfile", (it) => {
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
    assertEquals(dataStore.$profiles.get(profileDID), mockProfile);
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

    assertEquals(dataStore.$profiles.get(profileDID), initialProfile);

    // Load updated profile
    const updatedProfile = {
      did: profileDID,
      handle: "new.handle",
      displayName: "New Name",
    };

    mockApi.getProfile = async () => updatedProfile;

    await requests.loadDetailedProfile(profileDID);

    assertEquals(dataStore.$profiles.get(profileDID), updatedProfile);
  });
});

t.describe("loadPosts", (it) => {
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

    assertEquals(calledWith, ["at://a", "at://b"]);
    assertEquals(dataStore.$posts.get("at://a"), postA);
    assertEquals(dataStore.$posts.get("at://b"), postB);
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

    assertEquals(called, false);
  });
});

t.describe("loadLabelerInfo", (it) => {
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

    assertEquals(dataStore.$labelerInfo.get(labelerDid), mockLabelerInfo);
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

    assertEquals(calledWithDid, labelerDid);
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
    assertEquals(dataStore.$labelerInfo.get(labelerDid), initialInfo);

    currentInfo = updatedInfo;
    await requests.loadLabelerInfo(labelerDid);
    assertEquals(dataStore.$labelerInfo.get(labelerDid), updatedInfo);
  });
});

t.describe("loadMutedProfiles", (it) => {
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

    assertEquals(dataStore.$mutedProfiles.get(), res);
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
    assertEquals(stored.mutes.length, 2);
    assertEquals(stored.mutes[0].did, "did:plc:a");
    assertEquals(stored.mutes[1].did, "did:plc:b");
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
    assertEquals(capturedCursor, "abc");
  });
});

function makeRequests(api, dataStore = new DataStore(), preferences) {
  const provider = {
    requirePreferences: () =>
      preferences ?? Preferences.createLoggedOutPreferences(),
  };
  return createRequests(api, dataStore, provider);
}

t.describe("loadBlockedProfiles", (it) => {
  it("should store blocked profiles on first load", async () => {
    const res = {
      blocks: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
      cursor: "next",
    };
    const mockApi = { getBlocks: async () => res };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadBlockedProfiles();

    assertEquals(dataStore.$blockedProfiles.get(), res);
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
    assertEquals(stored.blocks.length, 2);
    assertEquals(stored.blocks[0].did, "did:plc:a");
    assertEquals(stored.blocks[1].did, "did:plc:b");
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
    assertEquals(capturedCursor, "abc");
  });
});

t.describe("loadNextAuthorFeedPage", (it) => {
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

    assertEquals(capturedParams.did, did);
    assertEquals(capturedParams.filter, "posts_and_author_threads");
    assertEquals(capturedParams.includePins, true);
    assertEquals(capturedParams.cursor, "");
    assertEquals(dataStore.$authorFeeds.get(`${did}-posts`).feed.length, 1);
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

    assertEquals(capturedParams.filter, "posts_with_replies");
    assertEquals(capturedParams.includePins, false);
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

    assertEquals(capturedParams.filter, "posts_with_media");
    assertEquals(capturedParams.includePins, false);
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

    assertEquals(actorLikesCalled, true);
    assertEquals(authorFeedCalled, false);
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
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[0].post.uri, "old1");
    assertEquals(stored.feed[1].post.uri, "new1");
    assertEquals(stored.cursor, "c2");
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$authorFeeds.get(feedURI);
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "new1");
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

t.describe("loadPostSearch", (it) => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$postSearchResults.set({ posts: [{ uri: "p1" }], cursor: "c1" });
    const mockApi = { searchPosts: async () => ({ posts: [], cursor: null }) };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearch("");

    assertEquals(dataStore.$postSearchResults.get(), null);
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

    await requests.loadPostSearch("hello");

    const stored = dataStore.$postSearchResults.get();
    assertEquals(stored.posts.length, 1);
    assertEquals(stored.cursor, "next");
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

    const firstCall = requests.loadPostSearch("query");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await requests.loadPostSearch("query");
    resolveFirst();
    await firstCall;

    const stored = dataStore.$postSearchResults.get();
    assertEquals(stored.posts[0].uri, "fresh");
    assertEquals(stored.cursor, "fresh");
  });

  it("should append when cursor is provided and existing results present", async () => {
    const dataStore = new DataStore();
    dataStore.$postSearchResults.set({
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

    await requests.loadPostSearch("hello", { cursor: "c1" });

    const stored = dataStore.$postSearchResults.get();
    assertEquals(stored.posts.length, 2);
    assertEquals(stored.posts[1].uri, "p2");
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadProfileSearch", (it) => {
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

    assertEquals(dataStore.$profileSearchResults.get(), null);
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
    assertEquals(stored.actors.length, 1);
    assertEquals(stored.cursor, "next");
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
    assertEquals(stored.actors[0].did, "fresh");
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
    assertEquals(stored.actors.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadFeedSearch", (it) => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.$feedSearchResults.set({ feeds: [{ uri: "f1" }], cursor: "c" });
    const mockApi = {
      searchFeedGenerators: async () => ({ feeds: [], cursor: null }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedSearch("");

    assertEquals(dataStore.$feedSearchResults.get(), null);
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
    assertEquals(stored.feeds.length, 1);
    assertEquals(dataStore.$feedGenerators.get("f1").displayName, "Feed One");
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
    assertEquals(stored.feeds[0].uri, "fresh");
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
    assertEquals(stored.feeds.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadNotifications", (it) => {
  it("should set notifications and cursor on first load", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getNotifications: async () => ({
        notifications: [{ reason: "like", uri: "n1" }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assertEquals(dataStore.$notifications.get().length, 1);
    assertEquals(dataStore.$notificationCursor.get(), "next");
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set([{ reason: "like", uri: "n1" }]);
    dataStore.$notificationCursor.set("page2");

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [{ reason: "follow", uri: "n2" }],
          cursor: "page3",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assertEquals(capturedCursor, "page2");
    assertEquals(dataStore.$notifications.get().length, 2);
    assertEquals(dataStore.$notificationCursor.get(), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$notifications.set([{ reason: "like", uri: "n1" }]);
    dataStore.$notificationCursor.set("page2");

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [{ reason: "follow", uri: "n2" }],
          cursor: "fresh",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications({ reload: true });

    assertEquals(capturedCursor, "");
    const stored = dataStore.$notifications.get();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].uri, "n2");
    assertEquals(dataStore.$notificationCursor.get(), "fresh");
  });
});

t.describe("loadMentionNotifications", (it) => {
  it("should request only mention reasons and store results", async () => {
    const dataStore = new DataStore();
    let capturedReasons;
    const mockApi = {
      getNotifications: async ({ reasons }) => {
        capturedReasons = reasons;
        return {
          notifications: [{ reason: "mention", uri: "n1" }],
          cursor: "next",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assertEquals(capturedReasons, ["mention", "reply", "quote"]);
    assertEquals(dataStore.$mentionNotifications.get().length, 1);
    assertEquals(dataStore.$mentionNotificationCursor.get(), "next");
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.$mentionNotifications.set([{ reason: "mention", uri: "n1" }]);
    dataStore.$mentionNotificationCursor.set("page2");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [{ reason: "reply", uri: "n2" }],
        cursor: "page3",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assertEquals(dataStore.$mentionNotifications.get().length, 2);
    assertEquals(dataStore.$mentionNotificationCursor.get(), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$mentionNotifications.set([{ reason: "mention", uri: "n1" }]);
    dataStore.$mentionNotificationCursor.set("page2");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [{ reason: "quote", uri: "n2" }],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications({ reload: true });

    const stored = dataStore.$mentionNotifications.get();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].uri, "n2");
  });
});

t.describe("loadBookmarks", (it) => {
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
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "post1");
    assertEquals(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.$bookmarks.set({
      feed: [{ post: { uri: "post1" } }],
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
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[1].post.uri, "post2");
    assertEquals(stored.cursor, "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$bookmarks.set({
      feed: [{ post: { uri: "post1" } }],
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$bookmarks.get();
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "post2");
  });
});

t.describe("loadProfileFollowers", (it) => {
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

    assertEquals(dataStore.$profileFollowers.get(profileDid), res);
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
    assertEquals(stored.followers.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadProfileFollows", (it) => {
  const profileDid = "did:plc:profile";

  it("should set follows on first load", async () => {
    const dataStore = new DataStore();
    const res = { follows: [{ did: "did:plc:a" }], cursor: "next" };
    const mockApi = { getFollows: async () => res };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileFollows(profileDid);

    assertEquals(dataStore.$profileFollows.get(profileDid), res);
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
    assertEquals(stored.follows.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadConvoList", (it) => {
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

    assertEquals(dataStore.$convoList.get().length, 2);
    assertEquals(dataStore.$convos.get("c1").id, "c1");
    assertEquals(dataStore.$convos.get("c2").id, "c2");
    assertEquals(dataStore.$convoListCursor.get(), "next");
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set([{ id: "c1" }]);
    dataStore.$convoListCursor.set("page2");

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "c2" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList();

    assertEquals(dataStore.$convoList.get().length, 2);
    assertEquals(dataStore.$convoListCursor.get(), "page3");
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set([{ id: "c1" }]);
    dataStore.$convoListCursor.set("page2");

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "c2" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList({ reload: true });

    assertEquals(capturedCursor, "");
    const stored = dataStore.$convoList.get();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].id, "c2");
  });
});

t.describe("loadConvoMessages", (it) => {
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
    assertEquals(stored.messages.length, 2);
    assertEquals(dataStore.$messages.get("m1").id, "m1");
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
    assertEquals(stored.messages.length, 2);
    assertEquals(stored.messages[0].id, "m1");
    assertEquals(stored.messages[1].id, "m2");
  });

  it("should null out cursor when validation second-page is empty", async () => {
    const dataStore = new DataStore();
    let calls = 0;
    const mockApi = {
      getMessages: async () => {
        calls += 1;
        if (calls === 1) {
          return { messages: [{ id: "m1" }], cursor: "fakecursor" };
        }
        return { messages: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages(convoId);

    assertEquals(dataStore.$convoMessages.get(convoId).cursor, null);
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$convoMessages.get(convoId);
    assertEquals(stored.messages.length, 1);
    assertEquals(stored.messages[0].id, "fresh");
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

    assertEquals(dataStore.$profiles.get("did:plc:a").handle, "a.test");
  });
});

t.describe("pollConvoMessages", (it, { beforeEach }) => {
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

    assertEquals(cursor, "next");
    assertEquals(dataStore.$convoMessages.get(convoId).messages[0].id, "m1");
    assertEquals(dataStore.$messages.get("m1").id, "m1");
  });

  it("should skip messages sent by the current user", async () => {
    const requests = makeRequestsWithLogs([
      makeMessageLog("m1", currentUserDid),
    ]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$convoMessages.get(convoId).messages.length, 0);
  });

  it("should ingest every system-message log kind", async () => {
    const logs = SYSTEM_MESSAGE_LOG_KINDS.map((logKind, index) =>
      makeSystemLog(logKind, `sys${index}`),
    );
    const requests = makeRequestsWithLogs(logs);

    await requests.pollConvoMessages(convoId);

    const stored = dataStore.$convoMessages.get(convoId);
    assertEquals(stored.messages.length, SYSTEM_MESSAGE_LOG_KINDS.length);
    assertEquals(dataStore.$messages.get("sys0").id, "sys0");
  });

  it("should store related profiles from logs", async () => {
    const log = makeSystemLog("logAddMember", "sys1", {
      member: { did: "did:plc:new" },
      addedBy: { did: otherDid },
    });
    log.relatedProfiles = [{ did: "did:plc:new", handle: "new.test" }];
    const requests = makeRequestsWithLogs([log]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$profiles.get("did:plc:new").handle, "new.test");
  });

  it("should not re-ingest an already-stored message", async () => {
    dataStore.$convoMessages.set(convoId, {
      messages: [{ id: "m1" }],
      cursor: null,
    });
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$convoMessages.get(convoId).messages.length, 1);
  });

  it("should update lock status from lock log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logLockConvo", "sys1"),
    ]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$convos.get(convoId).kind.lockStatus, "locked");
  });

  it("should update the group name from edit-group log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logEditGroup", "sys1", {
        oldName: "Test Group",
        newName: "Renamed Group",
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$convos.get(convoId).kind.name, "Renamed Group");
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

    assertEquals(dataStore.$convos.get(convoId).kind.memberCount, 5);
  });

  it("should decrement member count when members are removed", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logMemberLeave", "sys1", {
        member: { did: otherDid },
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assertEquals(dataStore.$convos.get(convoId).kind.memberCount, 2);
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

    assertEquals(dataStore.$convoMessages.get(convoId).messages.length, 0);
  });
});

t.describe("loadPostLikes", (it) => {
  const postUri = "at://did/post/1";

  it("should set likes on first load", async () => {
    const dataStore = new DataStore();
    const res = { likes: [{ actor: { did: "did:plc:a" } }], cursor: "next" };
    const mockApi = { getLikes: async () => res };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostLikes(postUri);

    assertEquals(dataStore.$postLikes.get(postUri), res);
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
    assertEquals(stored.likes.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadPostQuotes", (it) => {
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
    assertEquals(stored.posts.length, 1);
    assertEquals(stored.cursor, "next");
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
    assertEquals(stored.posts.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadPostReposts", (it) => {
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
    assertEquals(stored.reposts.length, 1);
    assertEquals(stored.cursor, "next");
  });

  it("should append reposts when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.$postReposts.set(postUri, {
      reposts: [{ did: "did:plc:a" }],
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
    assertEquals(stored.reposts.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadActorFeeds", (it) => {
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
    assertEquals(stored.feeds.length, 1);
    assertEquals(stored.cursor, "next");
    assertEquals(dataStore.$feedGenerators.get("f1").displayName, "F1");
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
    assertEquals(stored.feeds.length, 2);
    assertEquals(stored.cursor, null);
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

    assertEquals(called, false);
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$actorFeeds.get(did);
    assertEquals(stored.feeds.length, 1);
    assertEquals(stored.feeds[0].uri, "f2");
  });
});

t.describe("loadListsWithMembershipForActor", (it) => {
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
    assertEquals(stored.items.length, 2);
    assertEquals(stored.cursor, "next");
    assertEquals(stored.items[0].listItem.uri, "li1");
  });

  it("should append the next page when called again with a cached cursor", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      items: [{ list: list1 }],
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

    assertEquals(capturedCursor, "c1");
    const stored = dataStore.$listsWithMembershipByActor.get(actorDid);
    assertEquals(stored.items.length, 2);
    assertEquals(stored.cursor, null);
  });

  it("should short-circuit when fully loaded", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      items: [{ list: list1 }],
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

    assertEquals(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$listsWithMembershipByActor.set(actorDid, {
      items: [{ list: list1 }],
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$listsWithMembershipByActor.get(actorDid);
    assertEquals(stored.items.length, 1);
    assertEquals(stored.items[0].list.uri, list2.uri);
  });
});

t.describe("loadHashtagFeed", (it) => {
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
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "p1");
    assertEquals(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.$hashtagFeeds.set("foo-top", {
      feed: [{ post: { uri: "p1" } }],
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
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[1].post.uri, "p2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.$hashtagFeeds.set("foo-top", {
      feed: [{ post: { uri: "p1" } }],
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

    assertEquals(capturedCursor, "");
    const stored = dataStore.$hashtagFeeds.get("foo-top");
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "p2");
  });
});

t.describe("loadPinnedItems", (it) => {
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

    assertEquals(capturedFeedUris, ["at://did/feed/one", "at://did/feed/two"]);
    assertEquals(capturedListUris, ["at://did/list/one"]);
    const pinned = dataStore.$pinnedItems.get();
    assertEquals(pinned.length, 4);
    assertEquals(pinned[0].type, "feed");
    assertEquals(pinned[2].type, "list");
    assertEquals(pinned[3].type, "following");
    assertEquals(
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

    assertEquals(feedsCalled, false);
    assertEquals(listCalled, false);
    const pinned = dataStore.$pinnedItems.get();
    assertEquals(pinned.length, 1);
    assertEquals(pinned[0].type, "following");
  });
});

t.describe("enableStatus / getStatus", (it) => {
  it("should track loading start, end, and clear errors on success", async () => {
    const mockApi = { getMutes: async () => ({ mutes: [], cursor: null }) };
    const dataStore = new DataStore();
    const requests = makeRequests(mockApi, dataStore);

    const initialStatus = requests.getStatus("loadMutedProfiles");
    assertEquals(initialStatus.loading, false);
    assertEquals(initialStatus.error, null);

    const promise = requests.loadMutedProfiles();
    assertEquals(requests.getStatus("loadMutedProfiles").loading, true);
    await promise;

    const finalStatus = requests.getStatus("loadMutedProfiles");
    assertEquals(finalStatus.loading, false);
    assertEquals(finalStatus.error, null);
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
    assertEquals(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
  });

  it("should rethrow non-ApiError and not record it on the status store", async () => {
    const otherError = new Error("boom");
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
    assertEquals(status.loading, false);
    assertEquals(status.error, null);
  });

  it("should namespace status by request id derived from arguments", async () => {
    const dataStore = new DataStore();
    const mockApi = {
      getProfile: async (did) => ({ did, handle: "x" }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadDetailedProfile("did:plc:a");
    await requests.loadDetailedProfile("did:plc:b");

    assertEquals(
      requests.getStatus("loadDetailedProfile-did:plc:a").error,
      null,
    );
    assertEquals(
      requests.getStatus("loadDetailedProfile-did:plc:a").loading,
      false,
    );
    assertEquals(
      requests.getStatus("loadDetailedProfile-did:plc:b").loading,
      false,
    );
  });
});

await t.run();
