import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { DataLayer } from "/js/dataLayer/dataLayer.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";

const t = new TestSuite("DataLayer");

function createMockApi(options = {}) {
  return {
    getProfile: async (did) => options.profiles?.[did] ?? null,
    isAuthenticated: options.isAuthenticated ?? false,
    getPreferences: async () => options.preferences ?? [],
    getLabelers: async () => options.labelers ?? [],
    updatePreferences: async () => {},
  };
}

function createDataLayer(api) {
  return new DataLayer(api, null, new PreferencesProvider(api), {
    resolveHandle: async () => null,
  });
}

t.describe("constructor", (it) => {
  it("should initialize all components", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    assert(dataLayer.api !== undefined);
    assert(dataLayer.dataStore !== undefined);
    assert(dataLayer.patchStore !== undefined);
    assert(dataLayer.preferencesProvider !== undefined);
    assert(dataLayer.requests !== undefined);
    assert(dataLayer.mutations !== undefined);
    assert(dataLayer.derived !== undefined);
    assert(dataLayer.declarative !== undefined);
  });

  it("should set isAuthenticated from api", () => {
    const mockApi = createMockApi({ isAuthenticated: true });
    const dataLayer = createDataLayer(mockApi);

    assertEquals(dataLayer.isAuthenticated, true);
  });

  it("should initialize empty subscribers array", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    assertEquals(dataLayer.subscribers, []);
  });
});

t.describe("initializePreferences", (it) => {
  it("should call preferencesProvider.fetchPreferences", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);

    await dataLayer.initializePreferences();

    // Verify preferences were loaded (logged out preferences for unauthenticated)
    const preferences = dataLayer.preferencesProvider.requirePreferences();
    assert(preferences !== null);
  });

  it("should fetch preferences from API when authenticated", async () => {
    const mockPreferences = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
    ];
    const mockApi = createMockApi({
      isAuthenticated: true,
      preferences: mockPreferences,
    });
    const dataLayer = createDataLayer(mockApi);

    await dataLayer.initializePreferences();

    const preferences = dataLayer.preferencesProvider.requirePreferences();
    assertEquals(preferences.obj, mockPreferences);
  });
});

t.describe("hasCachedFeed", (it) => {
  it("should return false when feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    const result = dataLayer.hasCachedFeed("at://feed/uri");

    assertEquals(result, false);
  });

  it("should return true when feed is cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);
    const feedURI = "at://feed/uri";

    dataLayer.dataStore.$feeds.set(feedURI, { feed: [], cursor: null });

    const result = dataLayer.hasCachedFeed(feedURI);

    assertEquals(result, true);
  });
});

t.describe("hasCachedAuthorFeed", (it) => {
  it("should return false when author feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    const result = dataLayer.hasCachedAuthorFeed("did:test:user", "posts");

    assertEquals(result, false);
  });

  it("should return true when author feed is cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);
    const profileDid = "did:test:user";
    const feedType = "posts";

    dataLayer.dataStore.$authorFeeds.set(`${profileDid}-${feedType}`, {
      feed: [],
      cursor: null,
    });

    const result = dataLayer.hasCachedAuthorFeed(profileDid, feedType);

    assertEquals(result, true);
  });

  it("should construct correct feed URI from profileDid and feedType", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);
    const profileDid = "did:test:user";
    const feedType = "replies";

    // Cache with the expected URI format
    dataLayer.dataStore.$authorFeeds.set("did:test:user-replies", {
      feed: [],
      cursor: null,
    });

    const result = dataLayer.hasCachedAuthorFeed(profileDid, feedType);

    assertEquals(result, true);
  });
});

t.describe("component integration", (it) => {
  it("should pass dataStore to derived", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, text: "test", likeCount: 5 };

    // Initialize preferences first (required by derived)
    await dataLayer.initializePreferences();

    // Set data through dataStore
    dataLayer.dataStore.$posts.set(postURI, post);

    // Verify derived can access it
    const result = dataLayer.derived.$hydratedPosts.get(postURI);
    assertEquals(result.uri, postURI);
  });

  it("should pass patchStore to derived", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, likeCount: 5, viewer: { like: null } };

    // Initialize preferences first (required by derived)
    await dataLayer.initializePreferences();

    dataLayer.dataStore.$posts.set(postURI, post);
    dataLayer.patchStore.addPostPatch(postURI, { type: "addLike" });

    // Verify derived apply patches
    const result = dataLayer.derived.$hydratedPosts.get(postURI);
    assertEquals(result.likeCount, 6);
  });

  it("should pass derived and requests to declarative", async () => {
    const mockApi = createMockApi({
      isAuthenticated: false,
      profiles: {
        "did:test:user": { did: "did:test:user", handle: "test.user" },
      },
    });
    const dataLayer = createDataLayer(mockApi);

    // Initialize preferences first
    await dataLayer.initializePreferences();

    // Verify declarative can access derived
    const profile = await dataLayer.declarative.ensureProfile("did:test:user");
    assert(profile !== null);
  });
});

await t.run();
