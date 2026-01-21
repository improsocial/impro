import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { Requests } from "/js/dataLayer/requests.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { Preferences } from "/js/preferences.js";

const t = new TestSuite("Requests");

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

    const normalizedPosts = [
      { uri: postURI, content: "Main post" },
      { uri: "reply1", content: "Reply 1" },
    ];

    const mockApi = {
      getPostThread: async () => mockPostThread,
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

    await requests.loadPostThread(postURI);

    // Check thread was stored
    assertEquals(dataStore.getPostThread(postURI), mockPostThread);

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
    };

    const dataStore = new DataStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

    await requests.loadPostThread(postURI);

    assertEquals(dataStore.getPostThread(postURI), emptyPostThread);
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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

    await requests.loadNextFeedPage(feedURI);

    assertEquals(dataStore.getFeed(feedURI), feedWithReplies);
    assertEquals(dataStore.getPost("post1").uri, normalizedPosts[0].uri);
    assertEquals(dataStore.getPost("root1").uri, normalizedPosts[1].uri);
    assertEquals(dataStore.getPost("parent1").uri, normalizedPosts[2].uri);
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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

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
    const requests = new Requests(mockApi, dataStore, mockPreferencesProvider);

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

await t.run();
