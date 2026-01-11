import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { DataLayer } from "../../src/js/dataLayer/dataLayer.js";

const t = new TestSuite("DataLayer");

function createMockApi(options = {}) {
  return {
    isAuthenticated: options.isAuthenticated ?? false,
    getPreferences: async () => options.preferences ?? [],
    getLabelers: async () => options.labelers ?? [],
    updatePreferences: async () => {},
  };
}

t.describe("constructor", (it) => {
  it("should initialize all components", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);

    assert(dataLayer.api !== undefined);
    assert(dataLayer.dataStore !== undefined);
    assert(dataLayer.patchStore !== undefined);
    assert(dataLayer.preferencesProvider !== undefined);
    assert(dataLayer.requests !== undefined);
    assert(dataLayer.mutations !== undefined);
    assert(dataLayer.selectors !== undefined);
    assert(dataLayer.declarative !== undefined);
  });

  it("should set isAuthenticated from api", () => {
    const mockApi = createMockApi({ isAuthenticated: true });
    const dataLayer = new DataLayer(mockApi);

    assertEquals(dataLayer.isAuthenticated, true);
  });

  it("should initialize empty subscribers array", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);

    assertEquals(dataLayer.subscribers, []);
  });
});

t.describe("initializePreferences", (it) => {
  it("should call preferencesProvider.fetchPreferences", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = new DataLayer(mockApi);

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
    const dataLayer = new DataLayer(mockApi);

    await dataLayer.initializePreferences();

    const preferences = dataLayer.preferencesProvider.requirePreferences();
    assertEquals(preferences.obj, mockPreferences);
  });
});

t.describe("hasCachedFeed", (it) => {
  it("should return false when feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);

    const result = dataLayer.hasCachedFeed("at://feed/uri");

    assertEquals(result, false);
  });

  it("should return true when feed is cached", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);
    const feedURI = "at://feed/uri";

    dataLayer.dataStore.setFeed(feedURI, { feed: [], cursor: null });

    const result = dataLayer.hasCachedFeed(feedURI);

    assertEquals(result, true);
  });
});

t.describe("hasCachedAuthorFeed", (it) => {
  it("should return false when author feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);

    const result = dataLayer.hasCachedAuthorFeed("did:test:user", "posts");

    assertEquals(result, false);
  });

  it("should return true when author feed is cached", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);
    const profileDid = "did:test:user";
    const feedType = "posts";

    dataLayer.dataStore.setAuthorFeed(`${profileDid}-${feedType}`, {
      feed: [],
      cursor: null,
    });

    const result = dataLayer.hasCachedAuthorFeed(profileDid, feedType);

    assertEquals(result, true);
  });

  it("should construct correct feed URI from profileDid and feedType", () => {
    const mockApi = createMockApi();
    const dataLayer = new DataLayer(mockApi);
    const profileDid = "did:test:user";
    const feedType = "replies";

    // Cache with the expected URI format
    dataLayer.dataStore.setAuthorFeed("did:test:user-replies", {
      feed: [],
      cursor: null,
    });

    const result = dataLayer.hasCachedAuthorFeed(profileDid, feedType);

    assertEquals(result, true);
  });
});

t.describe("component integration", (it) => {
  it("should pass dataStore to selectors", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = new DataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, text: "test", likeCount: 5 };

    // Initialize preferences first (required by selectors)
    await dataLayer.initializePreferences();

    // Set data through dataStore
    dataLayer.dataStore.setPost(postURI, post);

    // Verify selectors can access it
    const result = dataLayer.selectors.getPost(postURI);
    assertEquals(result.uri, postURI);
  });

  it("should pass patchStore to selectors", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = new DataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, likeCount: 5, viewer: { like: null } };

    // Initialize preferences first (required by selectors)
    await dataLayer.initializePreferences();

    dataLayer.dataStore.setPost(postURI, post);
    dataLayer.patchStore.addPostPatch(postURI, { type: "addLike" });

    // Verify selectors apply patches
    const result = dataLayer.selectors.getPost(postURI);
    assertEquals(result.likeCount, 6);
  });

  it("should pass selectors and requests to declarative", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = new DataLayer(mockApi);

    // Initialize preferences first
    await dataLayer.initializePreferences();

    // Verify declarative can access selectors
    const preferences = await dataLayer.declarative.ensurePreferences();
    assert(preferences !== null);
  });
});

await t.run();
