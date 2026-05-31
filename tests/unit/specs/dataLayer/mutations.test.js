import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Derived } from "/js/dataLayer/derived.js";
import { Preferences } from "/js/preferences.js";
import { Signal, SignalMap } from "/js/signals.js";

// Minimal pluginService stub for Derived constructor.
function makePluginService() {
  return {
    $pluginFilteredFeedItems: new SignalMap(),
  };
}

// `applyPostPatches` now requires the patches array. Helper that fetches the
// current patches for a post URI and applies them.
function applyPostPatches(patchStore, post) {
  const patches = patchStore.$postPatches.get(post.uri) || [];
  return patchStore.applyPostPatches(post, patches);
}

function makeDerived(
  dataStore,
  patchStore,
  preferencesProvider,
  isAuthenticated = true,
) {
  // Derived' $preferences computed reads `preferencesProvider.$preferences.get()`.
  // If the provider doesn't supply that signal, give it a passthrough.
  const provider = preferencesProvider.$preferences
    ? preferencesProvider
    : {
        ...preferencesProvider,
        $preferences: new Signal.State(
          preferencesProvider.requirePreferences
            ? preferencesProvider.requirePreferences()
            : null,
        ),
      };
  return new Derived(
    dataStore,
    patchStore,
    provider,
    makePluginService(),
    isAuthenticated,
  );
}

const t = new TestSuite("Mutations");

t.describe("addLike", (it) => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    likeCount: 5,
    viewer: { like: null },
  };

  it("should add optimistic patch immediately", () => {
    const mockApi = {
      createLikeRecord: async () => ({ uri: "like-uri" }),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.addLike(testPost);

    const patchedPost = applyPostPatches(patchStore, testPost);
    assertEquals(patchedPost.viewer.like, "fake like");
    assertEquals(patchedPost.likeCount, 6);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockLike = { uri: "like-123" };
    const mockApi = {
      createLikeRecord: async () => mockLike,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.addLike(testPost);

    const storedPost = dataStore.$posts.get(testPost.uri);
    assertEquals(storedPost.viewer.like, "like-123");
    assertEquals(storedPost.likeCount, 6);

    const patchedPost = applyPostPatches(patchStore, storedPost);
    assertEquals(patchedPost, storedPost);
  });

  it("should handle concurrent like operations", async () => {
    const mockApi = {
      createLikeRecord: async () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ uri: "like-uri" }), 50),
        ),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise1 = mutations.addLike(testPost);
    const promise2 = mutations.addLike(testPost);

    const patchedPost = applyPostPatches(patchStore, testPost);
    assertEquals(patchedPost.likeCount, 7);

    await Promise.all([promise1, promise2]);
  });
});

t.describe("removeLike", (it) => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    likeCount: 6,
    viewer: { like: "existing-like-uri" },
  };

  it("should add optimistic patch immediately", () => {
    const mockApi = {
      deleteLikeRecord: async () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        }),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.removeLike(testPost);

    const patchedPost = applyPostPatches(patchStore, testPost);
    assertEquals(patchedPost.viewer.like, null);
    assertEquals(patchedPost.likeCount, 5);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteLikeRecord: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeLike(testPost);

    const storedPost = dataStore.$posts.get(testPost.uri);
    assertEquals(storedPost.viewer.like, null);
    assertEquals(storedPost.likeCount, 5);

    const patchedPost = applyPostPatches(patchStore, storedPost);
    assertEquals(patchedPost, storedPost);
  });
});

t.describe("followProfile", (it) => {
  const testProfile = {
    uri: "did:test:profile",
    did: "did:test:profile",
    handle: "test.user",
    followersCount: 10,
    viewer: { following: null },
  };

  it("should add optimistic patch immediately", () => {
    const mockApi = {
      createFollowRecord: async () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ uri: "follow-uri" }), 100);
        }),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.followProfile(testProfile);

    const patchedProfile = patchStore.applyProfilePatches(testProfile);
    assertEquals(patchedProfile.viewer.following, "fake following");
    assertEquals(patchedProfile.followersCount, 11);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockFollow = { uri: "follow-123" };
    const mockApi = {
      createFollowRecord: async () => mockFollow,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.followProfile(testProfile);

    const storedProfile = dataStore.$profiles.get(testProfile.did);
    assertEquals(storedProfile.viewer.following, "follow-123");
    assertEquals(storedProfile.followersCount, 11);

    const patchedProfile = patchStore.applyProfilePatches(storedProfile);
    assertEquals(patchedProfile, storedProfile);
  });
});

t.describe("unfollowProfile", (it) => {
  const testProfile = {
    uri: "did:test:profile",
    did: "did:test:profile",
    handle: "test.user",
    followersCount: 10,
    viewer: { following: "existing-follow-uri" },
  };

  it("should add optimistic patch immediately", () => {
    const mockApi = {
      deleteFollowRecord: async () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        }),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.unfollowProfile(testProfile);

    const patchedProfile = patchStore.applyProfilePatches(testProfile);
    assertEquals(patchedProfile.viewer.following, null);
    assertEquals(patchedProfile.followersCount, 9);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteFollowRecord: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unfollowProfile(testProfile);

    const storedProfile = dataStore.$profiles.get(testProfile.did);
    assertEquals(storedProfile.viewer.following, null);
    assertEquals(storedProfile.followersCount, 9);

    const patchedProfile = patchStore.applyProfilePatches(storedProfile);
    assertEquals(patchedProfile, storedProfile);
  });
});

t.describe("subscribeLabeler", (it) => {
  const testProfile = {
    did: "did:test:labeler",
    handle: "labeler.test",
  };
  const testLabelerInfo = {
    creator: { did: "did:test:labeler" },
    policies: { labelValueDefinitions: [] },
  };

  it("should add optimistic preference patch immediately", () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        subscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.subscribeLabeler(testProfile, testLabelerInfo);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "subscribeLabeler");
    assertEquals(patches[0].body.did, testProfile.did);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        subscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.subscribeLabeler(testProfile, testLabelerInfo);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });

  it("should remove patch even on error", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        subscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        throw new Error("API error");
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let errorThrown = false;
    try {
      await mutations.subscribeLabeler(testProfile, testLabelerInfo);
    } catch (e) {
      errorThrown = true;
    }

    assertEquals(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });
});

t.describe("unsubscribeLabeler", (it) => {
  const testProfile = {
    did: "did:test:labeler",
    handle: "labeler.test",
  };

  it("should add optimistic preference patch immediately", () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        unsubscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.unsubscribeLabeler(testProfile);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "unsubscribeLabeler");
    assertEquals(patches[0].body.did, testProfile.did);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        unsubscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unsubscribeLabeler(testProfile);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });

  it("should remove patch even on error", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        unsubscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        throw new Error("API error");
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let errorThrown = false;
    try {
      await mutations.unsubscribeLabeler(testProfile);
    } catch (e) {
      errorThrown = true;
    }

    assertEquals(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });
});

t.describe("updateLabelerSetting", (it) => {
  const labelerDid = "did:test:labeler";
  const label = "nsfw";
  const visibility = "warn";

  it("should add optimistic preference patch immediately", () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        setContentLabelPref: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.updateLabelerSetting({ labelerDid, label, visibility });

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "setContentLabelPref");
    assertEquals(patches[0].body.label, label);
    assertEquals(patches[0].body.visibility, visibility);
    assertEquals(patches[0].body.labelerDid, labelerDid);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        setContentLabelPref: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateLabelerSetting({ labelerDid, label, visibility });

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });

  it("should remove patch even on error", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        setContentLabelPref: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        throw new Error("API error");
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let errorThrown = false;
    try {
      await mutations.updateLabelerSetting({ labelerDid, label, visibility });
    } catch (e) {
      errorThrown = true;
    }

    assertEquals(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 0);
  });

  it("should call setContentLabelPref with correct parameters", async () => {
    let setContentLabelPrefCalledWith = null;
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        setContentLabelPref: (params) => {
          setContentLabelPrefCalledWith = params;
          return Preferences.createLoggedOutPreferences();
        },
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateLabelerSetting({ labelerDid, label, visibility });

    assertEquals(setContentLabelPrefCalledWith.labelerDid, labelerDid);
    assertEquals(setContentLabelPrefCalledWith.label, label);
    assertEquals(setContentLabelPrefCalledWith.visibility, visibility);
  });
});

t.describe("Error Handling and Edge Cases", (it) => {
  it("should handle multiple mutations on same resource", async () => {
    const post = {
      uri: "post1",
      likeCount: 5,
      viewer: { like: null },
    };

    const mockApi = {
      createLikeRecord: async () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ uri: "like1" }), 50),
        ),
      deleteLikeRecord: async () =>
        new Promise((resolve) => setTimeout(resolve, 75)),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const likePromise = mutations.addLike(post);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const unlikePromise = mutations.removeLike({
      ...post,
      likeCount: 6,
      viewer: { like: "like1" },
    });

    const patchedPost = applyPostPatches(patchStore, post);
    assertEquals(patchedPost.likeCount, 5);

    await Promise.all([likePromise, unlikePromise]);
  });

  it("should handle API methods that return undefined", async () => {
    const post = { uri: "post1", likeCount: 5, viewer: { like: "like1" } };

    const mockApi = {
      deleteLikeRecord: async () => undefined,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeLike(post);

    const storedPost = dataStore.$posts.get(post.uri);
    assertEquals(storedPost.viewer.like, null);
  });
});

t.describe("addMutedWord", (it) => {
  it("should call updatePreferences with new muted word", async () => {
    let updatedPreferences = null;
    const mockPreferencesProvider = {
      requirePreferences: () => new Preferences([], []),
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.addMutedWord({
      value: "testword",
      targets: ["content", "tag"],
      actorTarget: "all",
    });

    const words = updatedPreferences.getMutedWords();
    assertEquals(words.length, 1);
    assertEquals(words[0].value, "testword");
    assertEquals(words[0].targets.length, 2);
    assertEquals(words[0].actorTarget, "all");
  });

  it("should pass expiresAt through to preferences", async () => {
    let updatedPreferences = null;
    const mockPreferencesProvider = {
      requirePreferences: () => new Preferences([], []),
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const expiresAt = "2026-05-01T00:00:00.000Z";
    await mutations.addMutedWord({
      value: "temp",
      targets: ["tag"],
      actorTarget: "exclude-following",
      expiresAt,
    });

    const words = updatedPreferences.getMutedWords();
    assertEquals(words[0].expiresAt, expiresAt);
    assertEquals(words[0].actorTarget, "exclude-following");
  });
});

t.describe("removeMutedWord", (it) => {
  it("should call updatePreferences with word removed", async () => {
    let updatedPreferences = null;
    const existingPrefs = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#mutedWordsPref",
          items: [
            {
              id: "word-1",
              value: "remove-me",
              targets: ["content"],
              actorTarget: "all",
            },
            {
              id: "word-2",
              value: "keep-me",
              targets: ["tag"],
              actorTarget: "all",
            },
          ],
        },
      ],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => existingPrefs,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeMutedWord("word-1");

    const words = updatedPreferences.getMutedWords();
    assertEquals(words.length, 1);
    assertEquals(words[0].value, "keep-me");
  });
});

t.describe("updateProfile", (it) => {
  const testProfile = {
    did: "did:plc:test123",
    displayName: "Old Name",
    description: "Old bio",
    avatar: "https://example.com/avatar.jpg",
    banner: "https://example.com/banner.jpg",
    viewer: {},
  };

  function createMutationsWithMockApi(mockApi) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(testProfile.did, testProfile);
    dataStore.$currentUser.set(testProfile);
    return {
      mutations: new Mutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
      ),
      dataStore,
      patchStore,
    };
  }

  function makeMockApi(overrides = {}) {
    return {
      getProfileRecord: async () => ({ value: {}, cid: "cid123" }),
      putProfileRecord: async () => ({}),
      uploadBlob: async () => ({
        ref: { $link: "blob-link" },
        mimeType: "image/jpeg",
        size: 100,
      }),
      getProfile: async (did) => ({
        did,
        displayName: "Fetched Name",
        description: "Fetched bio",
        viewer: {},
      }),
      ...overrides,
    };
  }

  it("should call getProfileRecord and putProfileRecord", async () => {
    let getRecordCalled = false;
    let putRecordCalled = false;
    let putRecordArgs = null;
    const mockApi = makeMockApi({
      getProfileRecord: async () => {
        getRecordCalled = true;
        return {
          value: { displayName: "Old Name", description: "Old bio" },
          cid: "cid123",
        };
      },
      putProfileRecord: async (record, swapRecord) => {
        putRecordCalled = true;
        putRecordArgs = { record, swapRecord };
        return {};
      },
    });

    const { mutations } = createMutationsWithMockApi(mockApi);
    await mutations.updateProfile(testProfile, {
      displayName: "New Name",
      description: "New bio",
    });

    assertEquals(getRecordCalled, true);
    assertEquals(putRecordCalled, true);
    assertEquals(putRecordArgs.record.displayName, "New Name");
    assertEquals(putRecordArgs.record.description, "New bio");
    assertEquals(putRecordArgs.swapRecord, "cid123");
  });

  it("should upload avatar blob when provided", async () => {
    let uploadBlobCalled = false;
    const mockApi = makeMockApi({
      uploadBlob: async () => {
        uploadBlobCalled = true;
        return {
          ref: { $link: "avatar-blob" },
          mimeType: "image/jpeg",
          size: 100,
        };
      },
    });

    const { mutations } = createMutationsWithMockApi(mockApi);
    const fakeBlob = new Blob(["test"], { type: "image/jpeg" });
    await mutations.updateProfile(testProfile, {
      displayName: "Test",
      description: "Test",
      avatarBlob: fakeBlob,
    });

    assertEquals(uploadBlobCalled, true);
  });

  it("should upload banner blob when provided", async () => {
    let uploadBlobCallCount = 0;
    const mockApi = makeMockApi({
      uploadBlob: async () => {
        uploadBlobCallCount++;
        return {
          ref: { $link: "blob-link" },
          mimeType: "image/jpeg",
          size: 100,
        };
      },
    });

    const { mutations } = createMutationsWithMockApi(mockApi);
    const fakeBlob = new Blob(["test"], { type: "image/jpeg" });
    await mutations.updateProfile(testProfile, {
      displayName: "Test",
      description: "Test",
      bannerBlob: fakeBlob,
    });

    assertEquals(uploadBlobCallCount, 1);
  });

  it("should update dataStore with the fetched profile on success", async () => {
    const mockApi = makeMockApi({
      getProfile: async (did) => ({
        did,
        displayName: "Updated Name",
        description: "Updated bio",
        avatar: "https://example.com/new-avatar.jpg",
        viewer: {},
      }),
    });

    const { mutations, dataStore } = createMutationsWithMockApi(mockApi);
    await mutations.updateProfile(testProfile, {
      displayName: "Updated Name",
      description: "Updated bio",
    });

    const updatedProfile = dataStore.$profiles.get(testProfile.did);
    assertEquals(updatedProfile.displayName, "Updated Name");
    assertEquals(updatedProfile.description, "Updated bio");
    assertEquals(updatedProfile.avatar, "https://example.com/new-avatar.jpg");
  });

  it("should fetch profile with labelers after updating", async () => {
    let getProfileArgs = null;
    const mockApi = makeMockApi({
      getProfile: async (did, options) => {
        getProfileArgs = { did, options };
        return {
          did,
          displayName: "Fetched",
          description: "Fetched",
          viewer: {},
        };
      },
    });

    const { mutations } = createMutationsWithMockApi(mockApi);
    await mutations.updateProfile(testProfile, {
      displayName: "New Name",
      description: "New bio",
    });

    assertEquals(getProfileArgs.did, testProfile.did);
    assertEquals(Array.isArray(getProfileArgs.options.labelers), true);
  });

  it("should rethrow non-400 errors from getProfileRecord", async () => {
    const mockApi = makeMockApi({
      getProfileRecord: async () => {
        throw { status: 500, message: "Internal Server Error" };
      },
    });

    const { mutations } = createMutationsWithMockApi(mockApi);
    try {
      await mutations.updateProfile(testProfile, {
        displayName: "New Name",
        description: "New bio",
      });
      throw new Error("Expected updateProfile to throw");
    } catch (error) {
      assertEquals(error.status, 500);
    }
  });

  it("should update currentUser when editing own profile", async () => {
    const mockApi = makeMockApi({
      getProfile: async (did) => ({
        did,
        displayName: "Updated User",
        description: "Updated bio",
        viewer: {},
      }),
    });

    const { mutations, dataStore } = createMutationsWithMockApi(mockApi);
    await mutations.updateProfile(testProfile, {
      displayName: "Updated User",
      description: "Updated bio",
    });

    const currentUser = dataStore.$currentUser.get();
    assertEquals(currentUser.displayName, "Updated User");
  });
});

t.describe("pinPost", (it) => {
  const testUser = {
    did: "did:plc:user",
    handle: "user.test",
    viewer: {},
  };
  const testPost = {
    uri: "at://did:plc:user/app.bsky.feed.post/abc",
    cid: "cid-abc",
    author: testUser,
    record: { text: "hi" },
  };

  function setup(mockApi, { pinnedPost = null, authorFeed = null } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set({ ...testUser, pinnedPost });
    if (authorFeed) {
      dataStore.$authorFeeds.set(`${testUser.did}-posts`, authorFeed);
    }
    const derived = makeDerived(dataStore, patchStore, mockPreferencesProvider);
    return {
      mutations: new Mutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
      ),
      dataStore,
      patchStore,
      derived,
    };
  }

  it("should set pinnedPost on currentUser and call putProfileRecord", async () => {
    let putRecordArgs = null;
    const mockApi = {
      getProfileRecord: async () => ({
        value: { displayName: "Me" },
        cid: "cid-profile",
      }),
      putProfileRecord: async (record, swapRecord) => {
        putRecordArgs = { record, swapRecord };
        return {};
      },
    };
    const { mutations, dataStore } = setup(mockApi);

    await mutations.pinPost(testPost);

    assertEquals(dataStore.$currentUser.get().pinnedPost.uri, testPost.uri);
    assertEquals(dataStore.$currentUser.get().pinnedPost.cid, testPost.cid);
    assertEquals(putRecordArgs.record.pinnedPost.uri, testPost.uri);
    assertEquals(putRecordArgs.record.pinnedPost.cid, testPost.cid);
    assertEquals(putRecordArgs.record.displayName, "Me");
    assertEquals(putRecordArgs.swapRecord, "cid-profile");
  });

  it("should pin in the author feed after server success", async () => {
    const otherItem = {
      post: { uri: "at://did:plc:user/app.bsky.feed.post/other" },
    };
    const targetItem = { post: testPost };
    const mockApi = {
      getProfileRecord: async () => ({ value: {}, cid: "cid-profile" }),
      putProfileRecord: async () => ({}),
    };
    const { mutations, dataStore } = setup(mockApi, {
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });

    await mutations.pinPost(testPost);

    const feed = dataStore.$authorFeeds.get(`${testUser.did}-posts`).feed;
    assertEquals(feed[0].post.uri, testPost.uri);
    assertEquals(feed[0].reason.$type, "app.bsky.feed.defs#reasonPin");
    assertEquals(feed.length, 2);
  });

  it("should optimistically patch currentUser and author feed while in flight", async () => {
    const otherPost = {
      uri: "at://did:plc:user/app.bsky.feed.post/other",
      cid: "cid-other",
      author: testUser,
      record: { text: "other" },
    };
    const otherItem = { post: otherPost };
    const targetItem = { post: testPost };
    let putResolve;
    const putPromise = new Promise((resolve) => {
      putResolve = resolve;
    });
    const mockApi = {
      getProfileRecord: async () => ({ value: {}, cid: "cid-profile" }),
      putProfileRecord: () => putPromise,
    };
    const { mutations, derived, dataStore } = setup(mockApi, {
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });
    dataStore.$posts.set(otherPost.uri, otherPost);
    dataStore.$posts.set(testPost.uri, testPost);

    const promise = mutations.pinPost(testPost);
    // Yield so the patches apply before we inspect them.
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(derived.$currentUser.get().pinnedPost.uri, testPost.uri);
    const inFlightFeed = derived.$hydratedAuthorFeeds.get(
      `${testUser.did}-posts`,
    ).feed;
    assertEquals(inFlightFeed[0].post.uri, testPost.uri);
    assertEquals(inFlightFeed[0].reason.$type, "app.bsky.feed.defs#reasonPin");

    putResolve({});
    await promise;

    // After success, dataStore matches the previously-patched view.
    assertEquals(derived.$currentUser.get().pinnedPost.uri, testPost.uri);
  });

  it("should revert to original state on failure", async () => {
    const otherPost = {
      uri: "at://did:plc:user/app.bsky.feed.post/other",
      cid: "cid-other",
      author: testUser,
      record: { text: "other" },
    };
    const otherItem = { post: otherPost };
    const targetItem = { post: testPost };
    const mockApi = {
      getProfileRecord: async () => ({ value: {}, cid: "cid-profile" }),
      putProfileRecord: async () => {
        throw new Error("server error");
      },
    };
    const previousPinned = {
      uri: "at://did:plc:user/app.bsky.feed.post/old",
      cid: "cid-old",
    };
    const { mutations, dataStore, derived } = setup(mockApi, {
      pinnedPost: previousPinned,
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });
    dataStore.$posts.set(otherPost.uri, otherPost);
    dataStore.$posts.set(testPost.uri, testPost);

    let threw = false;
    try {
      await mutations.pinPost(testPost);
    } catch (e) {
      threw = true;
    }
    assertEquals(threw, true);
    // Patches removed; derived reflect original dataStore.
    assertEquals(derived.$currentUser.get().pinnedPost.uri, previousPinned.uri);
    const feed = derived.$hydratedAuthorFeeds.get(`${testUser.did}-posts`).feed;
    assertEquals(feed[0].post.uri, otherItem.post.uri);
    // dataStore unchanged.
    assertEquals(
      dataStore.$currentUser.get().pinnedPost.uri,
      previousPinned.uri,
    );
  });
});

t.describe("unpinPost", (it) => {
  const testUser = {
    did: "did:plc:user",
    handle: "user.test",
    viewer: {},
  };
  const testPost = {
    uri: "at://did:plc:user/app.bsky.feed.post/abc",
    cid: "cid-abc",
    author: testUser,
    record: { text: "hi" },
  };

  function setup(mockApi, { pinnedPost, authorFeed = null } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set({ ...testUser, pinnedPost });
    if (authorFeed) {
      dataStore.$authorFeeds.set(`${testUser.did}-posts`, authorFeed);
    }
    return {
      mutations: new Mutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
      ),
      dataStore,
    };
  }

  it("should clear pinnedPost on currentUser and putProfileRecord without it", async () => {
    let putRecordArgs = null;
    const mockApi = {
      getProfileRecord: async () => ({
        value: {
          displayName: "Me",
          pinnedPost: { uri: testPost.uri, cid: testPost.cid },
        },
        cid: "cid-profile",
      }),
      putProfileRecord: async (record, swapRecord) => {
        putRecordArgs = { record, swapRecord };
        return {};
      },
    };
    const { mutations, dataStore } = setup(mockApi, {
      pinnedPost: { uri: testPost.uri, cid: testPost.cid },
    });

    await mutations.unpinPost(testPost);

    assertEquals(dataStore.$currentUser.get().pinnedPost, undefined);
    assertEquals("pinnedPost" in putRecordArgs.record, false);
    assertEquals(putRecordArgs.record.displayName, "Me");
  });

  it("should be a no-op when a different post is pinned", async () => {
    let putCalled = false;
    const mockApi = {
      getProfileRecord: async () => ({ value: {}, cid: "cid-profile" }),
      putProfileRecord: async () => {
        putCalled = true;
        return {};
      },
    };
    const otherPinned = {
      uri: "at://did:plc:user/app.bsky.feed.post/other",
      cid: "cid-other",
    };
    const { mutations, dataStore } = setup(mockApi, {
      pinnedPost: otherPinned,
    });

    await mutations.unpinPost(testPost);

    assertEquals(putCalled, false);
    assertEquals(dataStore.$currentUser.get().pinnedPost.uri, otherPinned.uri);
  });
});

t.describe("muteProfile", (it) => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { muteActor: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("should set viewer.muted on the profile", async () => {
    const { mutations, dataStore } = setup();
    await mutations.muteProfile(profile);
    assertEquals(dataStore.$profiles.get(profile.did).viewer.muted, true);
  });

  it("should prepend muted profile to the cached list", async () => {
    const { mutations, dataStore } = setup();
    const existing = { did: "did:plc:other", viewer: { muted: true } };
    dataStore.$mutedProfiles.set({ mutes: [existing], cursor: "abc" });

    await mutations.muteProfile(profile);

    const stored = dataStore.$mutedProfiles.get();
    assertEquals(stored.mutes.length, 2);
    assertEquals(stored.mutes[0].did, profile.did);
    assertEquals(stored.mutes[0].viewer.muted, true);
    assertEquals(stored.mutes[1].did, existing.did);
    assertEquals(stored.cursor, "abc");
  });

  it("should not duplicate when already present in the cached list", async () => {
    const { mutations, dataStore } = setup();
    dataStore.$mutedProfiles.set({
      mutes: [{ ...profile, viewer: { muted: true } }],
      cursor: null,
    });

    await mutations.muteProfile(profile);

    assertEquals(dataStore.$mutedProfiles.get().mutes.length, 1);
  });

  it("should not initialize the cached list if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.muteProfile(profile);
    assertEquals(dataStore.$mutedProfiles.get(), null);
  });
});

t.describe("unmuteProfile", (it) => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: { muted: true },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { unmuteActor: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("should clear viewer.muted on the profile", async () => {
    const { mutations, dataStore } = setup();
    await mutations.unmuteProfile(profile);
    assertEquals(dataStore.$profiles.get(profile.did).viewer.muted, false);
  });

  it("should remove profile from the cached list", async () => {
    const { mutations, dataStore } = setup();
    const other = { did: "did:plc:other", viewer: { muted: true } };
    dataStore.$mutedProfiles.set({
      mutes: [profile, other],
      cursor: "abc",
    });

    await mutations.unmuteProfile(profile);

    const stored = dataStore.$mutedProfiles.get();
    assertEquals(stored.mutes.length, 1);
    assertEquals(stored.mutes[0].did, other.did);
    assertEquals(stored.cursor, "abc");
  });

  it("should be a no-op on the cached list when not present", async () => {
    const { mutations, dataStore } = setup();
    const other = { did: "did:plc:other", viewer: { muted: true } };
    dataStore.$mutedProfiles.set({ mutes: [other], cursor: null });

    await mutations.unmuteProfile(profile);

    assertEquals(dataStore.$mutedProfiles.get().mutes.length, 1);
  });
});

t.describe("blockProfile", (it) => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };
  const blockUri = "at://did:plc:me/app.bsky.graph.block/123";

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { blockActor: async () => ({ uri: blockUri }), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("should set viewer.blocking on the profile", async () => {
    const { mutations, dataStore } = setup();
    await mutations.blockProfile(profile);
    assertEquals(
      dataStore.$profiles.get(profile.did).viewer.blocking,
      blockUri,
    );
  });

  it("should prepend blocked profile to the cached list", async () => {
    const { mutations, dataStore } = setup();
    const existing = {
      did: "did:plc:other",
      viewer: { blocking: "at://existing-block" },
    };
    dataStore.$blockedProfiles.set({ blocks: [existing], cursor: "abc" });

    await mutations.blockProfile(profile);

    const stored = dataStore.$blockedProfiles.get();
    assertEquals(stored.blocks.length, 2);
    assertEquals(stored.blocks[0].did, profile.did);
    assertEquals(stored.blocks[0].viewer.blocking, blockUri);
    assertEquals(stored.blocks[1].did, existing.did);
    assertEquals(stored.cursor, "abc");
  });

  it("should not duplicate when already present in the cached list", async () => {
    const { mutations, dataStore } = setup();
    dataStore.$blockedProfiles.set({
      blocks: [{ ...profile, viewer: { blocking: blockUri } }],
      cursor: null,
    });

    await mutations.blockProfile(profile);

    assertEquals(dataStore.$blockedProfiles.get().blocks.length, 1);
  });

  it("should not initialize the cached list if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.blockProfile(profile);
    assertEquals(dataStore.$blockedProfiles.get(), null);
  });

  it("should update author viewer.blocking on cached posts by that author", async () => {
    const { mutations, dataStore } = setup();
    const post = {
      uri: "at://did:plc:target/app.bsky.feed.post/1",
      author: { did: profile.did, viewer: {} },
    };
    const otherPost = {
      uri: "at://did:plc:someone/app.bsky.feed.post/1",
      author: { did: "did:plc:someone", viewer: {} },
    };
    dataStore.$posts.set(post.uri, post);
    dataStore.$posts.set(otherPost.uri, otherPost);

    await mutations.blockProfile(profile);

    assertEquals(
      dataStore.$posts.get(post.uri).author.viewer.blocking,
      blockUri,
    );
    assertEquals(
      dataStore.$posts.get(otherPost.uri).author.viewer.blocking,
      undefined,
    );
  });
});

t.describe("unblockProfile", (it) => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/123" },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { unblockActor: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("should clear viewer.blocking on the profile", async () => {
    const { mutations, dataStore } = setup();
    await mutations.unblockProfile(profile);
    assertEquals(dataStore.$profiles.get(profile.did).viewer.blocking, null);
  });

  it("should remove profile from the cached list", async () => {
    const { mutations, dataStore } = setup();
    const other = {
      did: "did:plc:other",
      viewer: { blocking: "at://other-block" },
    };
    dataStore.$blockedProfiles.set({
      blocks: [profile, other],
      cursor: "abc",
    });

    await mutations.unblockProfile(profile);

    const stored = dataStore.$blockedProfiles.get();
    assertEquals(stored.blocks.length, 1);
    assertEquals(stored.blocks[0].did, other.did);
    assertEquals(stored.cursor, "abc");
  });

  it("should be a no-op on the cached list when not present", async () => {
    const { mutations, dataStore } = setup();
    const other = {
      did: "did:plc:other",
      viewer: { blocking: "at://other-block" },
    };
    dataStore.$blockedProfiles.set({ blocks: [other], cursor: null });

    await mutations.unblockProfile(profile);

    assertEquals(dataStore.$blockedProfiles.get().blocks.length, 1);
  });

  it("should clear author viewer.blocking on cached posts by that author", async () => {
    const { mutations, dataStore } = setup();
    const post = {
      uri: "at://did:plc:target/app.bsky.feed.post/1",
      author: { did: profile.did, viewer: { blocking: "at://old" } },
    };
    dataStore.$posts.set(post.uri, post);

    await mutations.unblockProfile(profile);

    assertEquals(dataStore.$posts.get(post.uri).author.viewer.blocking, null);
  });
});

t.describe("addBookmark", (it) => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    bookmarkCount: 2,
    viewer: { bookmarked: false },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { createBookmark: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add optimistic patch immediately", () => {
    const { mutations, patchStore } = setup({
      createBookmark: () => new Promise((resolve) => setTimeout(resolve, 100)),
    });
    mutations.addBookmark(testPost);
    const patched = applyPostPatches(patchStore, testPost);
    assertEquals(patched.viewer.bookmarked, true);
    assertEquals(patched.bookmarkCount, 3);
  });

  it("should update dataStore and remove patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.addBookmark(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assertEquals(stored.viewer.bookmarked, true);
    assertEquals(stored.bookmarkCount, 3);
    assertEquals(applyPostPatches(patchStore, stored), stored);
  });

  it("should prepend post to the cached bookmarks feed", async () => {
    const { mutations, dataStore } = setup();
    const existingItem = {
      post: { uri: "at://did:test/app.bsky.feed.post/other" },
    };
    dataStore.$bookmarks.set({ feed: [existingItem], cursor: "abc" });

    await mutations.addBookmark(testPost);

    const bookmarks = dataStore.$bookmarks.get();
    assertEquals(bookmarks.feed.length, 2);
    assertEquals(bookmarks.feed[0].post.uri, testPost.uri);
    assertEquals(bookmarks.feed[1].post.uri, existingItem.post.uri);
    assertEquals(bookmarks.cursor, "abc");
  });

  it("should not initialize the bookmarks feed if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.addBookmark(testPost);
    assertEquals(dataStore.$bookmarks.get(), null);
  });
});

t.describe("removeBookmark", (it) => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    bookmarkCount: 3,
    viewer: { bookmarked: true },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { deleteBookmark: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add optimistic patch immediately", () => {
    const { mutations, patchStore } = setup({
      deleteBookmark: () => new Promise((resolve) => setTimeout(resolve, 100)),
    });
    mutations.removeBookmark(testPost);
    const patched = applyPostPatches(patchStore, testPost);
    assertEquals(patched.viewer.bookmarked, false);
    assertEquals(patched.bookmarkCount, 2);
  });

  it("should update dataStore and remove patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.removeBookmark(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assertEquals(stored.viewer.bookmarked, false);
    assertEquals(stored.bookmarkCount, 2);
    assertEquals(applyPostPatches(patchStore, stored), stored);
  });

  it("should remove post from the cached bookmarks feed", async () => {
    const { mutations, dataStore } = setup();
    const otherItem = {
      post: { uri: "at://did:test/app.bsky.feed.post/other" },
    };
    dataStore.$bookmarks.set({
      feed: [{ post: testPost }, otherItem],
      cursor: "abc",
    });

    await mutations.removeBookmark(testPost);

    const bookmarks = dataStore.$bookmarks.get();
    assertEquals(bookmarks.feed.length, 1);
    assertEquals(bookmarks.feed[0].post.uri, otherItem.post.uri);
    assertEquals(bookmarks.cursor, "abc");
  });
});

t.describe("createRepost", (it) => {
  const currentUser = {
    did: "did:plc:me",
    handle: "me.test",
    viewer: {},
  };
  const testPost = {
    uri: "at://did:plc:author/app.bsky.feed.post/1",
    cid: "cid-1",
    author: { did: "did:plc:author", viewer: {} },
    repostCount: 4,
    viewer: { repost: null },
  };

  function setup(mockApi = {}, { authorFeed } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set(currentUser);
    if (authorFeed) {
      dataStore.$authorFeeds.set(`${currentUser.did}-posts`, authorFeed);
    }
    const mutations = new Mutations(
      {
        createRepostRecord: async () => ({
          uri: "at://did:plc:me/app.bsky.feed.repost/abc",
          cid: "repost-cid",
        }),
        ...mockApi,
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add optimistic patch immediately", () => {
    const { mutations, patchStore } = setup({
      createRepostRecord: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ uri: "x", cid: "y" }), 100),
        ),
    });
    mutations.createRepost(testPost);
    const patched = applyPostPatches(patchStore, testPost);
    assertEquals(patched.repostCount, 5);
    assertEquals(patched.viewer.repost, "fake repost");
  });

  it("should update dataStore with repost uri and incremented count", async () => {
    const { mutations, dataStore } = setup();
    await mutations.createRepost(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assertEquals(
      stored.viewer.repost,
      "at://did:plc:me/app.bsky.feed.repost/abc",
    );
    assertEquals(stored.repostCount, 5);
  });

  it("should add a reasonRepost feed item to the current user's author feed", async () => {
    const { mutations, dataStore } = setup(
      {},
      { authorFeed: { feed: [], cursor: "c1" } },
    );
    await mutations.createRepost(testPost);
    const feed = dataStore.$authorFeeds.get(`${currentUser.did}-posts`);
    assertEquals(feed.feed.length, 1);
    assertEquals(feed.feed[0].post.uri, testPost.uri);
    assertEquals(feed.feed[0].reason.$type, "app.bsky.feed.defs#reasonRepost");
    assertEquals(feed.feed[0].reason.by.did, currentUser.did);
    assertEquals(
      feed.feed[0].reason.uri,
      "at://did:plc:me/app.bsky.feed.repost/abc",
    );
    assertEquals(feed.cursor, "c1");
  });
});

t.describe("deleteRepost", (it) => {
  const currentUser = {
    did: "did:plc:me",
    handle: "me.test",
    viewer: {},
  };
  const repostUri = "at://did:plc:me/app.bsky.feed.repost/abc";
  const testPost = {
    uri: "at://did:plc:author/app.bsky.feed.post/1",
    cid: "cid-1",
    author: { did: "did:plc:author", viewer: {} },
    repostCount: 5,
    viewer: { repost: repostUri },
  };

  function setup(mockApi = {}, { authorFeed } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set(currentUser);
    if (authorFeed) {
      dataStore.$authorFeeds.set(`${currentUser.did}-posts`, authorFeed);
    }
    const mutations = new Mutations(
      { deleteRepostRecord: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add optimistic patch immediately", () => {
    const { mutations, patchStore } = setup({
      deleteRepostRecord: () =>
        new Promise((resolve) => setTimeout(resolve, 100)),
    });
    mutations.deleteRepost(testPost);
    const patched = applyPostPatches(patchStore, testPost);
    assertEquals(patched.repostCount, 4);
    assertEquals(patched.viewer.repost, null);
  });

  it("should update dataStore clearing repost uri and decrementing count", async () => {
    const { mutations, dataStore } = setup();
    await mutations.deleteRepost(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assertEquals(stored.viewer.repost, null);
    assertEquals(stored.repostCount, 4);
  });

  it("should remove the matching repost feed item from the author feed", async () => {
    const matchingItem = {
      post: testPost,
      reason: {
        $type: "app.bsky.feed.defs#reasonRepost",
        uri: repostUri,
      },
    };
    const otherItem = {
      post: {
        uri: "at://did:plc:other/app.bsky.feed.post/2",
      },
    };
    const { mutations, dataStore } = setup(
      {},
      { authorFeed: { feed: [matchingItem, otherItem], cursor: "c1" } },
    );

    await mutations.deleteRepost(testPost);

    const feed = dataStore.$authorFeeds.get(`${currentUser.did}-posts`);
    assertEquals(feed.feed.length, 1);
    assertEquals(feed.feed[0].post.uri, otherItem.post.uri);
    assertEquals(feed.cursor, "c1");
  });
});

t.describe("pinFeed", (it) => {
  const feedUri = "at://did:plc:feed/app.bsky.feed.generator/cool";

  function setupWithPreferences(preferencesObj) {
    let updatedPreferences = null;
    const preferences = new Preferences(preferencesObj, []);
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return {
      mutations,
      patchStore,
      getUpdatedPreferences: () => updatedPreferences,
    };
  }

  it("should append a pinned saved-feed entry when not previously saved", async () => {
    const { mutations, getUpdatedPreferences } = setupWithPreferences([
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [],
      },
    ]);
    await mutations.pinFeed(feedUri);
    const pinned = getUpdatedPreferences().getPinnedFeeds();
    assertEquals(pinned.length, 1);
    assertEquals(pinned[0].value, feedUri);
    assertEquals(pinned[0].pinned, true);
  });

  it("should pin an existing saved-feed entry without duplicating it", async () => {
    const { mutations, getUpdatedPreferences } = setupWithPreferences([
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [
          { id: "1", value: feedUri, type: "feed", pinned: false },
          {
            id: "2",
            value: "at://did:plc:feed/app.bsky.feed.generator/other",
            type: "feed",
            pinned: true,
          },
        ],
      },
    ]);
    await mutations.pinFeed(feedUri);
    const updated = getUpdatedPreferences();
    const allItems = updated.obj[0].items;
    assertEquals(allItems.length, 2);
    assertEquals(updated.isFeedPinned(feedUri), true);
  });

  it("should add an optimistic patch and remove it on success", async () => {
    let updateResolve;
    const updatePromise = new Promise((resolve) => {
      updateResolve = resolve;
    });
    const preferences = new Preferences(
      [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: () => updatePromise,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.pinFeed(feedUri);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "pinFeed");
    assertEquals(patches[0].body.feedUri, feedUri);

    updateResolve();
    await promise;
    assertEquals(patchStore.$preferencePatches.get().length, 0);
  });
});

t.describe("unpinFeed", (it) => {
  const feedUri = "at://did:plc:feed/app.bsky.feed.generator/cool";

  it("should clear the pinned flag on the saved-feed entry", async () => {
    let updatedPreferences = null;
    const preferences = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [{ id: "1", value: feedUri, type: "feed", pinned: true }],
        },
      ],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unpinFeed(feedUri);
    assertEquals(updatedPreferences.isFeedPinned(feedUri), false);
    assertEquals(updatedPreferences.obj[0].items.length, 1);
  });

  it("should add an optimistic patch and remove it on success", async () => {
    let updateResolve;
    const updatePromise = new Promise((resolve) => {
      updateResolve = resolve;
    });
    const preferences = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [{ id: "1", value: feedUri, type: "feed", pinned: true }],
        },
      ],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: () => updatePromise,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.unpinFeed(feedUri);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "unpinFeed");
    assertEquals(patches[0].body.feedUri, feedUri);

    updateResolve();
    await promise;
    assertEquals(patchStore.$preferencePatches.get().length, 0);
  });
});

t.describe("hidePost", (it) => {
  const testPost = { uri: "at://did:plc:author/app.bsky.feed.post/1" };

  it("should write a preference adding the post to the hidden list", async () => {
    let updatedPreferences = null;
    const preferences = new Preferences([], []);
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.hidePost(testPost);

    assertEquals(updatedPreferences.isPostHidden(testPost.uri), true);
  });

  it("should add an optimistic post patch and remove it on success", async () => {
    let updateResolve;
    const updatePromise = new Promise((resolve) => {
      updateResolve = resolve;
    });
    const preferences = new Preferences([], []);
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: () => updatePromise,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.hidePost(testPost);
    const patches = patchStore.$postPatches.get(testPost.uri) || [];
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "hidePost");

    updateResolve();
    await promise;
    assertEquals((patchStore.$postPatches.get(testPost.uri) || []).length, 0);
  });
});

t.describe("updateMutedWord", (it) => {
  it("should call updatePreferences with the word updated", async () => {
    let updatedPreferences = null;
    const existingPrefs = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#mutedWordsPref",
          items: [
            {
              id: "word-1",
              value: "old-value",
              targets: ["content"],
              actorTarget: "all",
            },
          ],
        },
      ],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => existingPrefs,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateMutedWord("word-1", {
      value: "new-value",
      targets: ["tag"],
    });

    const words = updatedPreferences.getMutedWords();
    assertEquals(words.length, 1);
    assertEquals(words[0].value, "new-value");
    assertEquals(words[0].targets[0], "tag");
    assertEquals(words[0].actorTarget, "all");
  });
});

t.describe("updatePostNotificationSubscription", (it) => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };

  it("should set viewer.activitySubscription on the profile", async () => {
    const subscription = { post: true, reply: false };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let calledWith = null;
    const mutations = new Mutations(
      {
        putActivitySubscription: async (did, sub) => {
          calledWith = { did, sub };
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updatePostNotificationSubscription(profile, subscription);

    assertEquals(calledWith.did, profile.did);
    assertEquals(calledWith.sub, subscription);
    assertEquals(
      dataStore.$profiles.get(profile.did).viewer.activitySubscription,
      subscription,
    );
  });

  it("should remove the patch on failure and rethrow", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      {
        putActivitySubscription: async () => {
          throw new Error("api error");
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let threw = false;
    try {
      await mutations.updatePostNotificationSubscription(profile, {
        post: true,
      });
    } catch (e) {
      threw = true;
    }
    assertEquals(threw, true);
    assertEquals(patchStore._getProfilePatches(profile.did).length, 0);
  });
});

t.describe("createPost", (it) => {
  const currentUserDid = "did:plc:me";
  const newPostUri = `at://${currentUserDid}/app.bsky.feed.post/new`;

  function setup({ replyPostThread, authorFeed, replyAuthorFeed } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    const fullPost = {
      uri: newPostUri,
      cid: "cid-new",
      author: { did: currentUserDid, viewer: {} },
      record: { text: "hello" },
      viewer: {},
    };
    mutations.postCreator = {
      createPost: async () => fullPost,
    };
    if (replyPostThread) {
      dataStore.$postThreads.set(replyPostThread.post.uri, replyPostThread);
    }
    if (authorFeed) {
      dataStore.$authorFeeds.set(`${currentUserDid}-posts`, authorFeed);
    }
    if (replyAuthorFeed) {
      dataStore.$authorFeeds.set(`${currentUserDid}-replies`, replyAuthorFeed);
    }
    return { mutations, dataStore, fullPost };
  }

  it("should store the new post and mark priorityReply", async () => {
    const { mutations, dataStore } = setup();
    const result = await mutations.createPost({ postText: "hello" });
    assertEquals(result.uri, newPostUri);
    const stored = dataStore.$posts.get(newPostUri);
    assertEquals(stored.uri, newPostUri);
    assertEquals(stored.viewer.priorityReply, true);
  });

  it("should add the new post to the author posts feed when loaded", async () => {
    const { mutations, dataStore } = setup({
      authorFeed: { feed: [], cursor: "c1" },
    });
    await mutations.createPost({ postText: "hello" });
    const feed = dataStore.$authorFeeds.get(`${currentUserDid}-posts`);
    assertEquals(feed.feed.length, 1);
    assertEquals(feed.feed[0].post.uri, newPostUri);
    assertEquals(feed.cursor, "c1");
  });

  it("should prepend the reply to the parent's post thread when present", async () => {
    const replyTo = {
      uri: "at://did:plc:other/app.bsky.feed.post/parent",
      cid: "cid-parent",
    };
    const replyRoot = replyTo;
    const replyPostThread = {
      post: replyTo,
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "at://did:plc:other/app.bsky.feed.post/existing" },
          replies: [],
        },
      ],
    };
    const { mutations, dataStore } = setup({
      replyPostThread,
      replyAuthorFeed: { feed: [], cursor: "c1" },
    });

    await mutations.createPost({ postText: "hi", replyTo, replyRoot });

    const updatedThread = dataStore.$postThreads.get(replyTo.uri);
    assertEquals(updatedThread.replies.length, 2);
    assertEquals(updatedThread.replies[0].post.uri, newPostUri);
    const repliesFeed = dataStore.$authorFeeds.get(`${currentUserDid}-replies`);
    assertEquals(repliesFeed.feed.length, 1);
    assertEquals(repliesFeed.feed[0].post.uri, newPostUri);
  });
});

t.describe("deletePost", (it) => {
  it("should call api.deletePost and replace the stored post with a not-found post", async () => {
    const post = {
      uri: "at://did:plc:me/app.bsky.feed.post/abc",
      cid: "cid-abc",
    };
    let apiCalledWith = null;
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$posts.set(post.uri, { ...post, record: { text: "hi" } });
    const mutations = new Mutations(
      {
        deletePost: async (passed) => {
          apiCalledWith = passed;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.deletePost(post);

    assertEquals(apiCalledWith, post);
    const stored = dataStore.$posts.get(post.uri);
    assertEquals(stored.uri, post.uri);
    assertEquals(stored.$type, "app.bsky.feed.defs#notFoundPost");
  });
});

t.describe("createMessage", (it) => {
  const convoId = "convo-1";
  const sentMessage = {
    id: "msg-1",
    text: "hello",
    sender: { did: "did:plc:me" },
  };

  function setup({ convoMessages, convo } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convoMessages) {
      dataStore.$convoMessages.set(convoId, convoMessages);
    }
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = new Mutations(
      { sendMessage: async () => sentMessage },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("should store the new message and return it", async () => {
    const { mutations, dataStore } = setup();
    const result = await mutations.createMessage(convoId, { text: "hello" });
    assertEquals(result, sentMessage);
    assertEquals(dataStore.$messages.get(sentMessage.id), sentMessage);
  });

  it("should prepend the message to the cached convo messages", async () => {
    const existingMessage = { id: "msg-old", text: "earlier" };
    const { mutations, dataStore } = setup({
      convoMessages: { messages: [existingMessage], cursor: "c1" },
    });
    await mutations.createMessage(convoId, { text: "hello" });
    const stored = dataStore.$convoMessages.get(convoId);
    assertEquals(stored.messages.length, 2);
    assertEquals(stored.messages[0].id, sentMessage.id);
    assertEquals(stored.messages[1].id, existingMessage.id);
    assertEquals(stored.cursor, "c1");
  });

  it("should update the convo's lastMessage", async () => {
    const convo = { id: convoId, unreadCount: 0 };
    const { mutations, dataStore } = setup({ convo });
    await mutations.createMessage(convoId, { text: "hello" });
    const stored = dataStore.$convos.get(convoId);
    assertEquals(stored.lastMessage.id, sentMessage.id);
    assertEquals(stored.lastMessage.$type, "chat.bsky.convo.defs#messageView");
  });
});

t.describe("acceptConvo", (it) => {
  const convo = { id: "convo-1", status: "request" };

  function setup({ convoList } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convoList) {
      dataStore.$convoList.set(convoList);
    }
    let acceptCalledWith = null;
    const mutations = new Mutations(
      {
        acceptConvo: async (id) => {
          acceptCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, getAcceptArg: () => acceptCalledWith };
  }

  it("should set the convo status to accepted in the store", async () => {
    const { mutations, dataStore, getAcceptArg } = setup();
    const result = await mutations.acceptConvo(convo);
    assertEquals(getAcceptArg(), convo.id);
    assertEquals(result.status, "accepted");
    assertEquals(dataStore.$convos.get(convo.id).status, "accepted");
  });

  it("should update the matching convo in the convo list", async () => {
    const otherConvo = { id: "convo-2", status: "accepted" };
    const { mutations, dataStore } = setup({
      convoList: [convo, otherConvo],
    });
    await mutations.acceptConvo(convo);
    const list = dataStore.$convoList.get();
    assertEquals(list.length, 2);
    assertEquals(list.find((c) => c.id === convo.id).status, "accepted");
    assertEquals(list.find((c) => c.id === otherConvo.id).status, "accepted");
  });
});

t.describe("rejectConvo", (it) => {
  const convo = { id: "convo-1", status: "request" };

  it("should clear the convo and remove it from the convo list", async () => {
    const otherConvo = { id: "convo-2", status: "accepted" };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    dataStore.$convoList.set([convo, otherConvo]);
    let leaveCalledWith = null;
    const mutations = new Mutations(
      {
        leaveConvo: async (id) => {
          leaveCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.rejectConvo(convo);

    assertEquals(leaveCalledWith, convo.id);
    // Mutations sets the convo signal to null on reject (was `undefined` pre-refactor).
    assertEquals(dataStore.$convos.get(convo.id), null);
    const list = dataStore.$convoList.get();
    assertEquals(list.length, 1);
    assertEquals(list[0].id, otherConvo.id);
  });
});

t.describe("markConvoAsRead", (it) => {
  it("should call api.markConvoAsRead and zero the unread count", async () => {
    const convoId = "convo-1";
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convoId, { id: convoId, unreadCount: 4 });
    let calledWith = null;
    const mutations = new Mutations(
      {
        markConvoAsRead: async (id) => {
          calledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.markConvoAsRead(convoId);

    assertEquals(calledWith, convoId);
    assertEquals(dataStore.$convos.get(convoId).unreadCount, 0);
  });

  it("should not throw when the convo is not cached", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      { markConvoAsRead: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    await mutations.markConvoAsRead("missing");
    // SignalMap returns null for uninitialized keys (was `undefined` pre-refactor).
    assertEquals(dataStore.$convos.get("missing"), null);
  });
});

t.describe("addMessageReaction", (it) => {
  const convoId = "convo-1";
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";
  const emoji = "👍";
  const updatedMessage = {
    id: messageId,
    reactions: [{ value: emoji, sender: { did: currentUserDid } }],
  };

  function setup({ convo } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = new Mutations(
      { addMessageReaction: async () => updatedMessage },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add an optimistic patch with the reaction", () => {
    const { mutations, patchStore } = setup();
    mutations.addMessageReaction(convoId, messageId, emoji, currentUserDid);
    const patches = patchStore._getMessagePatches(messageId);
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "addReaction");
    assertEquals(patches[0].body.reaction.value, emoji);
    assertEquals(patches[0].body.reaction.sender.did, currentUserDid);
  });

  it("should store the returned message and clear the patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.addMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    assertEquals(dataStore.$messages.get(messageId), updatedMessage);
    assertEquals(patchStore._getMessagePatches(messageId).length, 0);
  });

  it("should update the convo's lastReaction when the convo is cached", async () => {
    const { mutations, dataStore } = setup({
      convo: { id: convoId, unreadCount: 0 },
    });
    await mutations.addMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    const convo = dataStore.$convos.get(convoId);
    assertEquals(
      convo.lastReaction.$type,
      "chat.bsky.convo.defs#messageAndReactionView",
    );
    assertEquals(convo.lastReaction.message.id, messageId);
    assertEquals(convo.lastReaction.reaction.value, emoji);
  });
});

t.describe("removeMessageReaction", (it) => {
  const convoId = "convo-1";
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";
  const emoji = "👍";
  const updatedMessage = { id: messageId, reactions: [] };

  function setup({ convo } = {}) {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = new Mutations(
      { removeMessageReaction: async () => updatedMessage },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    return { mutations, dataStore, patchStore };
  }

  it("should add an optimistic removeReaction patch", () => {
    const { mutations, patchStore } = setup();
    mutations.removeMessageReaction(convoId, messageId, emoji, currentUserDid);
    const patches = patchStore._getMessagePatches(messageId);
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "removeReaction");
    assertEquals(patches[0].body.value, emoji);
    assertEquals(patches[0].body.currentUserDid, currentUserDid);
  });

  it("should store the returned message and clear the patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.removeMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    assertEquals(dataStore.$messages.get(messageId), updatedMessage);
    assertEquals(patchStore._getMessagePatches(messageId).length, 0);
  });

  it("should clear the convo's lastReaction when the convo is cached", async () => {
    const { mutations, dataStore } = setup({
      convo: {
        id: convoId,
        lastReaction: { existing: true },
      },
    });
    await mutations.removeMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    assertEquals(dataStore.$convos.get(convoId).lastReaction, null);
  });
});

t.describe("sendShowLessInteraction", (it) => {
  const postURI = "at://did:plc:author/app.bsky.feed.post/1";
  const feedContext = "ctx";
  const feedProxyUrl = "https://feed.example/xrpc";

  it("should append the interaction to the dataStore (empty list branch)", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let sendArgs = null;
    const mutations = new Mutations(
      {
        sendInteractions: async (interactions, proxy) => {
          sendArgs = { interactions, proxy };
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(postURI, feedContext, feedProxyUrl);

    const stored = dataStore.$showLessInteractions.get();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].item, postURI);
    assertEquals(stored[0].event, "app.bsky.feed.defs#requestLess");
    assertEquals(stored[0].feedContext, feedContext);
    assertEquals(sendArgs.interactions.length, 1);
    assertEquals(sendArgs.interactions[0].item, postURI);
    assertEquals(sendArgs.proxy, feedProxyUrl);
  });

  it("should append to an existing list (non-empty branch)", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$showLessInteractions.set([{ item: "existing", event: "x" }]);
    const mutations = new Mutations(
      { sendInteractions: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(postURI, feedContext, feedProxyUrl);

    const stored = dataStore.$showLessInteractions.get();
    assertEquals(stored.length, 2);
    assertEquals(stored[1].item, postURI);
  });
});

t.describe("sendShowMoreInteraction", (it) => {
  const postURI = "at://did:plc:author/app.bsky.feed.post/1";
  const feedContext = "ctx";
  const feedProxyUrl = "https://feed.example/xrpc";

  it("should append the interaction to the dataStore (empty list branch)", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let sendArgs = null;
    const mutations = new Mutations(
      {
        sendInteractions: async (interactions, proxy) => {
          sendArgs = { interactions, proxy };
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowMoreInteraction(postURI, feedContext, feedProxyUrl);

    const stored = dataStore.$showMoreInteractions.get();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].item, postURI);
    assertEquals(stored[0].event, "app.bsky.feed.defs#requestMore");
    assertEquals(stored[0].feedContext, feedContext);
    assertEquals(sendArgs.interactions[0].item, postURI);
    assertEquals(sendArgs.proxy, feedProxyUrl);
  });

  it("should append to an existing list (non-empty branch)", async () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$showMoreInteractions.set([{ item: "existing", event: "x" }]);
    const mutations = new Mutations(
      { sendInteractions: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowMoreInteraction(postURI, feedContext, feedProxyUrl);

    const stored = dataStore.$showMoreInteractions.get();
    assertEquals(stored.length, 2);
    assertEquals(stored[1].item, postURI);
  });
});

t.describe("pinList", (it) => {
  const listUri = "at://did:test/app.bsky.graph.list/abc";

  function makeMockProvider({ updatePreferences } = {}) {
    const pinFeedCalls = [];
    return {
      pinFeedCalls,
      provider: {
        requirePreferences: () => ({
          pinFeed: (feedUri, type) => {
            pinFeedCalls.push({ feedUri, type });
            return Preferences.createLoggedOutPreferences();
          },
        }),
        updatePreferences: updatePreferences ?? (async () => {}),
      },
    };
  }

  it("should add optimistic patch with entryType 'list'", () => {
    const { provider } = makeMockProvider({
      updatePreferences: async () =>
        new Promise((resolve) => setTimeout(resolve, 100)),
    });
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    mutations.pinList(listUri);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "pinFeed");
    assertEquals(patches[0].body.feedUri, listUri);
    assertEquals(patches[0].body.entryType, "list");
  });

  it("should call preferences.pinFeed with type 'list'", async () => {
    const { provider, pinFeedCalls } = makeMockProvider();
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    await mutations.pinList(listUri);

    assertEquals(pinFeedCalls.length, 1);
    assertEquals(pinFeedCalls[0].feedUri, listUri);
    assertEquals(pinFeedCalls[0].type, "list");
  });

  it("should remove patch after successful update", async () => {
    const { provider } = makeMockProvider();
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    await mutations.pinList(listUri);

    assertEquals(patchStore.$preferencePatches.get().length, 0);
  });

  it("should remove patch even on error", async () => {
    const { provider } = makeMockProvider({
      updatePreferences: async () => {
        throw new Error("API error");
      },
    });
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    let errorThrown = false;
    try {
      await mutations.pinList(listUri);
    } catch (e) {
      errorThrown = true;
    }

    assertEquals(errorThrown, true);
    assertEquals(patchStore.$preferencePatches.get().length, 0);
  });
});

t.describe("pinFeed entryType", (it) => {
  it("should add optimistic patch with entryType 'feed'", () => {
    const feedUri = "at://did:test/app.bsky.feed.generator/xyz";
    const preferences = new Preferences(
      [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: () =>
        new Promise((resolve) => setTimeout(resolve, 100)),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.pinFeed(feedUri);

    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.entryType, "feed");
  });
});

t.describe("unpinList", (it) => {
  const listUri = "at://did:test/app.bsky.graph.list/abc";

  it("should call preferences.unpinFeed with the list URI", async () => {
    const unpinCalls = [];
    const provider = {
      requirePreferences: () => ({
        unpinFeed: (uri) => {
          unpinCalls.push(uri);
          return Preferences.createLoggedOutPreferences();
        },
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    await mutations.unpinList(listUri);

    assertEquals(unpinCalls.length, 1);
    assertEquals(unpinCalls[0], listUri);
  });

  it("should add and remove an unpinFeed patch", async () => {
    let updateResolve;
    const updatePromise = new Promise((resolve) => {
      updateResolve = resolve;
    });
    const provider = {
      requirePreferences: () => ({
        unpinFeed: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: () => updatePromise,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore(dataStore);
    const mutations = new Mutations({}, dataStore, patchStore, provider);

    const promise = mutations.unpinList(listUri);
    const patches = patchStore.$preferencePatches.get();
    assertEquals(patches.length, 1);
    assertEquals(patches[0].body.type, "unpinFeed");
    assertEquals(patches[0].body.feedUri, listUri);

    updateResolve();
    await promise;
    assertEquals(patchStore.$preferencePatches.get().length, 0);
  });
});

await t.run();
