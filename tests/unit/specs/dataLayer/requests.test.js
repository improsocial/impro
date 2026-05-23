import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Requests } from "/js/dataLayer/requests.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { Preferences } from "/js/preferences.js";
import { ApiError } from "/js/api.js";

const t = new TestSuite("Requests");

const stubConstellation = { getLinks: async () => [] };
const stubPluginService = { getFilteredFeedItems: async () => ({}) };

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
    assertEquals(dataStore.getPostThread(postURI), mockPostThread);

    // Check postThreadOther was stored
    assertEquals(dataStore.getPostThreadOther(postURI), mockPostThreadOther);

    // Check posts were stored
    assertEquals(dataStore.getPost(postURI), normalizedPosts[0]);
    assertEquals(dataStore.getPost("reply1"), normalizedPosts[1]);
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

    assertEquals(dataStore.getPostThread(postURI), emptyPostThread);
    assertEquals(dataStore.getPostThreadOther(postURI), []);
    assertEquals(dataStore.getPost(postURI), normalizedPosts[0]);
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
    assertEquals(dataStore.getFeed(feedURI), mockFeed);

    // Check posts were stored
    assertEquals(dataStore.getPost("post1"), normalizedPosts[0]);
    assertEquals(dataStore.getPost("post2"), normalizedPosts[1]);
  });

  it("should append to existing feed", async () => {
    const dataStore = new DataStore();

    // Set up existing feed
    const existingFeed = {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor1",
    };
    dataStore.setFeed(feedURI, existingFeed);

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
    const storedFeed = dataStore.getFeed(feedURI);
    assertEquals(storedFeed.feed.length, 3);
    assertEquals(storedFeed.feed[0], { post: { uri: "post1" } });
    assertEquals(storedFeed.feed[1], { post: { uri: "post2" } });
    assertEquals(storedFeed.feed[2], { post: { uri: "post3" } });
    assertEquals(storedFeed.cursor, "cursor2");

    // Check new posts were stored
    assertEquals(dataStore.getPost("post2"), normalizedPosts[0]);
    assertEquals(dataStore.getPost("post3"), normalizedPosts[1]);
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

    assertEquals(dataStore.getFeed(feedURI), emptyFeed);
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

    assertEquals(dataStore.getFeed(feedURI), feedWithReplies);
    assertEquals(dataStore.getPost("post1").uri, normalizedPosts[0].uri);
    assertEquals(dataStore.getPost("root1").uri, normalizedPosts[1].uri);
    assertEquals(dataStore.getPost("parent1").uri, normalizedPosts[2].uri);
  });
});

t.describe("loadPluginFilteredFeedItems", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  function makePluginService(getFilteredFeedItems) {
    return { getFilteredFeedItems };
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
    assertEquals(dataStore.getPluginFilteredFeedItems(feedURI), undefined);
  });

  it("should pass the feed to the plugin service and store results", async () => {
    const dataStore = new DataStore();
    const storedFeed = {
      feed: [{ post: { uri: "p1" } }],
      cursor: "c1",
    };
    dataStore.setFeed(feedURI, storedFeed);

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
    assertEquals(dataStore.getPluginFilteredFeedItems(feedURI), {
      p1: { hidden: true },
    });
  });

  it("should merge with existing filtered items by default", async () => {
    const dataStore = new DataStore();
    dataStore.setFeed(feedURI, { feed: [], cursor: null });
    dataStore.setPluginFilteredFeedItems(feedURI, {
      p1: { hidden: true },
      p2: { hidden: true },
    });

    const pluginService = makePluginService(async () => ({
      p2: { hidden: false },
      p3: { hidden: true },
    }));
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI);

    assertEquals(dataStore.getPluginFilteredFeedItems(feedURI), {
      p1: { hidden: true },
      p2: { hidden: false },
      p3: { hidden: true },
    });
  });

  it("should replace existing filtered items when reload is true", async () => {
    const dataStore = new DataStore();
    dataStore.setFeed(feedURI, { feed: [], cursor: null });
    dataStore.setPluginFilteredFeedItems(feedURI, {
      p1: { hidden: true },
      p2: { hidden: true },
    });

    const pluginService = makePluginService(async () => ({
      p3: { hidden: true },
    }));
    const requests = createRequestsWithPluginService(dataStore, pluginService);

    await requests.loadPluginFilteredFeedItems(feedURI, { reload: true });

    assertEquals(dataStore.getPluginFilteredFeedItems(feedURI), {
      p3: { hidden: true },
    });
  });
});

t.describe("loadProfile", (it) => {
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

    await requests.loadProfile(profileDID);

    // Check profile was stored
    assertEquals(dataStore.getProfile(profileDID), mockProfile);
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

    await requests.loadProfile(profileDID);

    assertEquals(dataStore.getProfile(profileDID), initialProfile);

    // Load updated profile
    const updatedProfile = {
      did: profileDID,
      handle: "new.handle",
      displayName: "New Name",
    };

    mockApi.getProfile = async () => updatedProfile;

    await requests.loadProfile(profileDID);

    assertEquals(dataStore.getProfile(profileDID), updatedProfile);
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
    assertEquals(dataStore.getPost("at://a"), postA);
    assertEquals(dataStore.getPost("at://b"), postB);
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

    assertEquals(dataStore.getLabelerInfo(labelerDid), mockLabelerInfo);
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
    assertEquals(dataStore.getLabelerInfo(labelerDid), initialInfo);

    currentInfo = updatedInfo;
    await requests.loadLabelerInfo(labelerDid);
    assertEquals(dataStore.getLabelerInfo(labelerDid), updatedInfo);
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

    assertEquals(dataStore.getMutedProfiles(), res);
  });

  it("should append paginated muted profiles when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setMutedProfiles({
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

    const stored = dataStore.getMutedProfiles();
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
    dataStore.setMutedProfiles({ mutes: [], cursor: "abc" });
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

    assertEquals(dataStore.getBlockedProfiles(), res);
  });

  it("should append paginated blocked profiles when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setBlockedProfiles({
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

    const stored = dataStore.getBlockedProfiles();
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
    dataStore.setBlockedProfiles({ blocks: [], cursor: "abc" });
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
    assertEquals(dataStore.getAuthorFeed(`${did}-posts`).feed.length, 1);
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
    dataStore.setAuthorFeed(feedURI, {
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

    const stored = dataStore.getAuthorFeed(feedURI);
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[0].post.uri, "old1");
    assertEquals(stored.feed[1].post.uri, "new1");
    assertEquals(stored.cursor, "c2");
  });

  it("should reset cursor and replace feed on reload", async () => {
    const feedURI = `${did}-posts`;
    const dataStore = new DataStore();
    dataStore.setAuthorFeed(feedURI, {
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
    const stored = dataStore.getAuthorFeed(feedURI);
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
    dataStore.setPostSearchResults({ posts: [{ uri: "p1" }], cursor: "c1" });
    const mockApi = { searchPosts: async () => ({ posts: [], cursor: null }) };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearch("");

    assertEquals(dataStore.getPostSearchResults(), null);
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

    const stored = dataStore.getPostSearchResults();
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

    const stored = dataStore.getPostSearchResults();
    assertEquals(stored.posts[0].uri, "fresh");
    assertEquals(stored.cursor, "fresh");
  });

  it("should append when cursor is provided and existing results present", async () => {
    const dataStore = new DataStore();
    dataStore.setPostSearchResults({
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

    const stored = dataStore.getPostSearchResults();
    assertEquals(stored.posts.length, 2);
    assertEquals(stored.posts[1].uri, "p2");
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadProfileSearch", (it) => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.setProfileSearchResults({ actors: [{ did: "x" }], cursor: "c" });
    const mockApi = {
      searchProfiles: async () => ({ actors: [], cursor: null }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileSearch("");

    assertEquals(dataStore.getProfileSearchResults(), null);
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

    const stored = dataStore.getProfileSearchResults();
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

    const stored = dataStore.getProfileSearchResults();
    assertEquals(stored.actors[0].did, "fresh");
  });

  it("should append when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setProfileSearchResults({
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

    const stored = dataStore.getProfileSearchResults();
    assertEquals(stored.actors.length, 2);
    assertEquals(stored.cursor, "c2");
  });
});

t.describe("loadFeedSearch", (it) => {
  it("should clear results when query is empty", async () => {
    const dataStore = new DataStore();
    dataStore.setFeedSearchResults({ feeds: [{ uri: "f1" }], cursor: "c" });
    const mockApi = {
      searchFeedGenerators: async () => ({ feeds: [], cursor: null }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedSearch("");

    assertEquals(dataStore.getFeedSearchResults(), null);
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

    const stored = dataStore.getFeedSearchResults();
    assertEquals(stored.feeds.length, 1);
    assertEquals(dataStore.getFeedGenerator("f1").displayName, "Feed One");
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

    const stored = dataStore.getFeedSearchResults();
    assertEquals(stored.feeds[0].uri, "fresh");
  });

  it("should append when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setFeedSearchResults({
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

    const stored = dataStore.getFeedSearchResults();
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

    assertEquals(dataStore.getNotifications().length, 1);
    assertEquals(dataStore.getNotificationCursor(), "next");
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.setNotifications([{ reason: "like", uri: "n1" }]);
    dataStore.setNotificationCursor("page2");

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
    assertEquals(dataStore.getNotifications().length, 2);
    assertEquals(dataStore.getNotificationCursor(), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setNotifications([{ reason: "like", uri: "n1" }]);
    dataStore.setNotificationCursor("page2");

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
    const stored = dataStore.getNotifications();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].uri, "n2");
    assertEquals(dataStore.getNotificationCursor(), "fresh");
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
    assertEquals(dataStore.getMentionNotifications().length, 1);
    assertEquals(dataStore.getMentionNotificationCursor(), "next");
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore();
    dataStore.setMentionNotifications([{ reason: "mention", uri: "n1" }]);
    dataStore.setMentionNotificationCursor("page2");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [{ reason: "reply", uri: "n2" }],
        cursor: "page3",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assertEquals(dataStore.getMentionNotifications().length, 2);
    assertEquals(dataStore.getMentionNotificationCursor(), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setMentionNotifications([{ reason: "mention", uri: "n1" }]);
    dataStore.setMentionNotificationCursor("page2");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [{ reason: "quote", uri: "n2" }],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications({ reload: true });

    const stored = dataStore.getMentionNotifications();
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

    const stored = dataStore.getBookmarks();
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "post1");
    assertEquals(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.setBookmarks({
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

    const stored = dataStore.getBookmarks();
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[1].post.uri, "post2");
    assertEquals(stored.cursor, "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setBookmarks({
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
    const stored = dataStore.getBookmarks();
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

    assertEquals(dataStore.getProfileFollowers(profileDid), res);
  });

  it("should append followers when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setProfileFollowers(profileDid, {
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

    const stored = dataStore.getProfileFollowers(profileDid);
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

    assertEquals(dataStore.getProfileFollows(profileDid), res);
  });

  it("should append follows when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setProfileFollows(profileDid, {
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

    const stored = dataStore.getProfileFollows(profileDid);
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

    assertEquals(dataStore.getConvoList().length, 2);
    assertEquals(dataStore.getConvo("c1").id, "c1");
    assertEquals(dataStore.getConvo("c2").id, "c2");
    assertEquals(dataStore.getConvoListCursor(), "next");
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore();
    dataStore.setConvoList([{ id: "c1" }]);
    dataStore.setConvoListCursor("page2");

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "c2" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoList();

    assertEquals(dataStore.getConvoList().length, 2);
    assertEquals(dataStore.getConvoListCursor(), "page3");
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setConvoList([{ id: "c1" }]);
    dataStore.setConvoListCursor("page2");

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
    const stored = dataStore.getConvoList();
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

    const stored = dataStore.getConvoMessages(convoId);
    assertEquals(stored.messages.length, 2);
    assertEquals(dataStore.getMessage("m1").id, "m1");
  });

  it("should append messages when prior cursor exists", async () => {
    const dataStore = new DataStore();
    dataStore.setConvoMessages(convoId, {
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

    const stored = dataStore.getConvoMessages(convoId);
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

    assertEquals(dataStore.getConvoMessages(convoId).cursor, null);
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setConvoMessages(convoId, {
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
    const stored = dataStore.getConvoMessages(convoId);
    assertEquals(stored.messages.length, 1);
    assertEquals(stored.messages[0].id, "fresh");
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

    assertEquals(dataStore.getPostLikes(postUri), res);
  });

  it("should append likes when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setPostLikes(postUri, {
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

    const stored = dataStore.getPostLikes(postUri);
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

    const stored = dataStore.getPostQuotes(postUri);
    assertEquals(stored.posts.length, 1);
    assertEquals(stored.cursor, "next");
  });

  it("should append quotes when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setPostQuotes(postUri, {
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

    const stored = dataStore.getPostQuotes(postUri);
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

    const stored = dataStore.getPostReposts(postUri);
    assertEquals(stored.reposts.length, 1);
    assertEquals(stored.cursor, "next");
  });

  it("should append reposts when cursor is provided", async () => {
    const dataStore = new DataStore();
    dataStore.setPostReposts(postUri, {
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

    const stored = dataStore.getPostReposts(postUri);
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

    const stored = dataStore.getActorFeeds(did);
    assertEquals(stored.feeds.length, 1);
    assertEquals(stored.cursor, "next");
    assertEquals(dataStore.getFeedGenerator("f1").displayName, "F1");
  });

  it("should append on subsequent calls when cursor remains", async () => {
    const dataStore = new DataStore();
    dataStore.setActorFeeds(did, {
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

    const stored = dataStore.getActorFeeds(did);
    assertEquals(stored.feeds.length, 2);
    assertEquals(stored.cursor, null);
  });

  it("should short-circuit when there is no remaining cursor", async () => {
    const dataStore = new DataStore();
    dataStore.setActorFeeds(did, {
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
    dataStore.setActorFeeds(did, {
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
    const stored = dataStore.getActorFeeds(did);
    assertEquals(stored.feeds.length, 1);
    assertEquals(stored.feeds[0].uri, "f2");
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

    const stored = dataStore.getHashtagFeed("foo-top");
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "p1");
    assertEquals(stored.cursor, "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore();
    dataStore.setHashtagFeed("foo-top", {
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

    const stored = dataStore.getHashtagFeed("foo-top");
    assertEquals(stored.feed.length, 2);
    assertEquals(stored.feed[1].post.uri, "p2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore();
    dataStore.setHashtagFeed("foo-top", {
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
    const stored = dataStore.getHashtagFeed("foo-top");
    assertEquals(stored.feed.length, 1);
    assertEquals(stored.feed[0].post.uri, "p2");
  });
});

t.describe("loadPinnedFeedGenerators", (it) => {
  it("should fan out to getFeedGenerators for pinned uris and cache results", async () => {
    const pinnedFeedUris = [
      "at://did/feed/one",
      "at://did/feed/two",
      "following",
    ];
    const preferences = {
      getPinnedFeeds: () => pinnedFeedUris.map((value) => ({ value })),
    };

    let capturedUris;
    const mockApi = {
      getFeedGenerators: async (uris) => {
        capturedUris = uris;
        return uris.map((uri) => ({ uri, displayName: `name-${uri}` }));
      },
    };
    const dataStore = new DataStore();
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(mockApi, dataStore, provider);

    await requests.loadPinnedFeedGenerators();

    assertEquals(capturedUris, ["at://did/feed/one", "at://did/feed/two"]);
    const pinned = dataStore.getPinnedFeedGenerators();
    assertEquals(pinned.length, 2);
    assertEquals(
      dataStore.getFeedGenerator("at://did/feed/one").displayName,
      "name-at://did/feed/one",
    );
  });

  it("should skip the api call when no pinned feeds", async () => {
    const preferences = { getPinnedFeeds: () => [] };
    let called = false;
    const mockApi = {
      getFeedGenerators: async () => {
        called = true;
        return [];
      },
    };
    const dataStore = new DataStore();
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(mockApi, dataStore, provider);

    await requests.loadPinnedFeedGenerators();

    assertEquals(called, false);
    assertEquals(dataStore.getPinnedFeedGenerators(), []);
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

    await requests.loadProfile("did:plc:a");
    await requests.loadProfile("did:plc:b");

    assertEquals(requests.getStatus("loadProfile-did:plc:a").error, null);
    assertEquals(requests.getStatus("loadProfile-did:plc:a").loading, false);
    assertEquals(requests.getStatus("loadProfile-did:plc:b").loading, false);
  });
});

await t.run();
