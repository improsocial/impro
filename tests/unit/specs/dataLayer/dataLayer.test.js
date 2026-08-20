import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DataLayer } from "/js/dataLayer/dataLayer.js";
import { DraftMediaStore } from "/js/drafts.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { Constellation } from "/js/constellation.js";

function createMockApi(options = {}) {
  const isAuthenticated = options.isAuthenticated ?? false;
  return {
    getProfile: async (did) => options.profiles?.[did] ?? null,
    isAuthenticated,
    session: isAuthenticated ? { did: "did:plc:testuser" } : null,
    getPreferences: async () => options.preferences ?? [],
    getLabelers: async () => options.labelers ?? [],
    updatePreferences: async () => {},
  };
}

function createDataLayer(api) {
  return new DataLayer(
    api,
    new PreferencesProvider(api),
    { resolveHandle: async () => null },
    new DraftMediaStore("test-media"),
    new HiddenFeedItemsStore(),
    new Constellation(),
  );
}

describe("constructor", () => {
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

    assert.deepEqual(dataLayer.isAuthenticated, true);
  });

  it("should initialize empty subscribers array", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    assert.deepEqual(dataLayer.subscribers, []);
  });
});

describe("preferences", () => {
  it("should load logged out preferences on demand", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);

    const preferences =
      await dataLayer.preferencesProvider.requirePreferences();

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

    const preferences =
      await dataLayer.preferencesProvider.requirePreferences();

    assert.deepEqual(preferences.obj, mockPreferences);
  });
});

describe("hasCachedFeed", () => {
  it("should return false when feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    const result = dataLayer.hasCachedFeed("at://feed/uri");

    assert.deepEqual(result, false);
  });

  it("should return true when feed is cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);
    const feedURI = "at://feed/uri";

    dataLayer.dataStore.$feeds.set(feedURI, { feed: [], cursor: null });

    const result = dataLayer.hasCachedFeed(feedURI);

    assert.deepEqual(result, true);
  });
});

describe("hasCachedAuthorFeed", () => {
  it("should return false when author feed not cached", () => {
    const mockApi = createMockApi();
    const dataLayer = createDataLayer(mockApi);

    const result = dataLayer.hasCachedAuthorFeed("did:test:user", "posts");

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
  });
});

describe("component integration", () => {
  it("should pass dataStore to derived", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, text: "test", likeCount: 5 };

    await dataLayer.preferencesProvider.requirePreferences();

    // Set data through dataStore
    dataLayer.dataStore.$posts.set(postURI, post);

    // Verify derived can access it
    const result = dataLayer.derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.uri, postURI);
  });

  it("should pass patchStore to derived", async () => {
    const mockApi = createMockApi({ isAuthenticated: false });
    const dataLayer = createDataLayer(mockApi);
    const postURI = "at://post/uri";
    const post = { uri: postURI, likeCount: 5, viewer: { like: null } };

    await dataLayer.preferencesProvider.requirePreferences();

    dataLayer.dataStore.$posts.set(postURI, post);
    dataLayer.patchStore.addPostPatch(postURI, { type: "addLike" });

    // Verify derived apply patches
    const result = dataLayer.derived.$hydratedPosts.get(postURI);
    assert.deepEqual(result.likeCount, 6);
  });

  it("should pass derived and requests to declarative", async () => {
    const mockApi = createMockApi({
      isAuthenticated: false,
      profiles: {
        "did:test:user": { did: "did:test:user", handle: "test.user" },
      },
    });
    const dataLayer = createDataLayer(mockApi);

    await dataLayer.preferencesProvider.requirePreferences();

    // Verify declarative can access derived
    const profile =
      await dataLayer.declarative.ensureDetailedProfile("did:test:user");
    assert(profile !== null);
  });
});

describe("selected feed persistence", () => {
  // createMockApi's authenticated session did
  const sessionStateKey = "session-state:did:plc:testuser";
  const legacyKey = "home-view-currentFeedUri";

  // PersistedReactiveStore saves via an effect, which flushes on a double
  // requestAnimationFrame
  function flushEffects() {
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }

  function cleanup() {
    localStorage.removeItem(sessionStateKey);
    localStorage.removeItem(legacyKey);
  }

  function createAuthedDataLayer() {
    return createDataLayer(createMockApi({ isAuthenticated: true }));
  }

  beforeEach(cleanup);
  afterEach(cleanup);

  it("restores the stored selection for the account", () => {
    localStorage.setItem(
      sessionStateKey,
      JSON.stringify({ selectedFeedUri: "following" }),
    );
    const dataLayer = createAuthedDataLayer();
    assert.deepEqual(dataLayer.dataStore.$selectedFeedUri.get(), "following");
  });

  it("migrates a selection stored under the legacy key", () => {
    localStorage.setItem(legacyKey, JSON.stringify("following"));
    const dataLayer = createAuthedDataLayer();
    assert.deepEqual(dataLayer.dataStore.$selectedFeedUri.get(), "following");
    assert.deepEqual(localStorage.getItem(legacyKey), null);
  });

  it("prefers the session-state key over the legacy key", () => {
    localStorage.setItem(
      sessionStateKey,
      JSON.stringify({ selectedFeedUri: "following" }),
    );
    localStorage.setItem(legacyKey, JSON.stringify("stale"));
    const dataLayer = createAuthedDataLayer();
    assert.deepEqual(dataLayer.dataStore.$selectedFeedUri.get(), "following");
  });

  it("persists selection changes", async () => {
    const dataLayer = createAuthedDataLayer();
    dataLayer.mutations.setSelectedFeedUri("following");
    await flushEffects();
    assert.deepEqual(JSON.parse(localStorage.getItem(sessionStateKey)), {
      selectedFeedUri: "following",
    });
  });

  it("persists a fallback applied by setPinnedItems", async () => {
    const dataLayer = createAuthedDataLayer();
    dataLayer.mutations.setSelectedFeedUri(
      "at://did:test/app.bsky.feed.generator/gone",
    );
    dataLayer.dataStore.setPinnedItems([
      { type: "timeline", data: { uri: "following" } },
    ]);
    await flushEffects();
    assert.deepEqual(JSON.parse(localStorage.getItem(sessionStateKey)), {
      selectedFeedUri: "following",
    });
  });

  it("neither restores nor persists without a session", async () => {
    localStorage.setItem(legacyKey, JSON.stringify("following"));
    const dataLayer = createDataLayer(createMockApi());
    assert.deepEqual(dataLayer.dataStore.$selectedFeedUri.get(), null);
    dataLayer.mutations.setSelectedFeedUri("following");
    await flushEffects();
    assert.deepEqual(localStorage.getItem(sessionStateKey), null);
  });
});
