import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Selectors } from "/js/dataLayer/selectors.js";
import { Preferences } from "/js/preferences.js";

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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.addLike(testPost);

    // Check that patch was applied immediately
    const patchedPost = patchStore.applyPostPatches(testPost);
    assertEquals(patchedPost.viewer.like, "fake like");
    assertEquals(patchedPost.likeCount, 6);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockLike = { uri: "like-123" };
    const mockApi = {
      createLikeRecord: async () => mockLike,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
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

    // Check that post was updated in store
    const storedPost = dataStore.getPost(testPost.uri);
    assertEquals(storedPost.viewer.like, "like-123");
    assertEquals(storedPost.likeCount, 6);

    // Check that patch was removed
    const patchedPost = patchStore.applyPostPatches(storedPost);
    assertEquals(patchedPost, storedPost); // No patches applied
  });

  it("should handle concurrent like operations", async () => {
    const mockApi = {
      createLikeRecord: async () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ uri: "like-uri" }), 50),
        ),
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start two concurrent operations
    const promise1 = mutations.addLike(testPost);
    const promise2 = mutations.addLike(testPost);

    // Both should apply patches
    const patchedPost = patchStore.applyPostPatches(testPost);
    assertEquals(patchedPost.likeCount, 7); // +2 likes

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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.removeLike(testPost);

    // Check that patch was applied immediately
    const patchedPost = patchStore.applyPostPatches(testPost);
    assertEquals(patchedPost.viewer.like, null);
    assertEquals(patchedPost.likeCount, 5);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteLikeRecord: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
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

    // Check that post was updated in store
    const storedPost = dataStore.getPost(testPost.uri);
    assertEquals(storedPost.viewer.like, null);
    assertEquals(storedPost.likeCount, 5);

    // Check that patch was removed
    const patchedPost = patchStore.applyPostPatches(storedPost);
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.followProfile(testProfile);

    // Check that patch was applied immediately
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
    const patchStore = new PatchStore();
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

    // Check that profile was updated in store
    const storedProfile = dataStore.getProfile(testProfile.did);
    assertEquals(storedProfile.viewer.following, "follow-123");
    assertEquals(storedProfile.followersCount, 11);

    // Check that patch was removed
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.unfollowProfile(testProfile);

    // Check that patch was applied immediately
    const patchedProfile = patchStore.applyProfilePatches(testProfile);
    assertEquals(patchedProfile.viewer.following, null);
    assertEquals(patchedProfile.followersCount, 9);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteFollowRecord: async () => {},
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
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

    // Check that profile was updated in store
    const storedProfile = dataStore.getProfile(testProfile.did);
    assertEquals(storedProfile.viewer.following, null);
    assertEquals(storedProfile.followersCount, 9);

    // Check that patch was removed
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
    let updateCalled = false;
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        subscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        updateCalled = true;
      },
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.subscribeLabeler(testProfile, testLabelerInfo);

    // Check that patch was applied immediately (before API call completes)
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.subscribeLabeler(testProfile, testLabelerInfo);

    // Check that patch was removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
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
    // Patch should still be removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.unsubscribeLabeler(testProfile);

    // Check that patch was applied immediately
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unsubscribeLabeler(testProfile);

    // Check that patch was removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
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
    // Patch should still be removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start the mutation
    mutations.updateLabelerSetting({ labelerDid, label, visibility });

    // Check that patch was applied immediately
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
    const mutations = new Mutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateLabelerSetting({ labelerDid, label, visibility });

    // Check that patch was removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
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
    // Patch should still be removed
    const patches = patchStore._getPreferencePatches();
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
    const patchStore = new PatchStore();
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = new Mutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    // Start like, then unlike before like completes
    const likePromise = mutations.addLike(post);

    // Add a small delay to ensure the like patch is added first
    await new Promise((resolve) => setTimeout(resolve, 10));

    const unlikePromise = mutations.removeLike({
      ...post,
      likeCount: 6,
      viewer: { like: "like1" },
    });

    // Both patches should be active
    const patchedPost = patchStore.applyPostPatches(post);
    assertEquals(patchedPost.likeCount, 5); // +1 -1 = 0, so 5

    await Promise.all([likePromise, unlikePromise]);
  });

  it("should handle API methods that return undefined", async () => {
    const post = { uri: "post1", likeCount: 5, viewer: { like: "like1" } };

    const mockApi = {
      deleteLikeRecord: async () => undefined,
    };
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
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

    const storedPost = dataStore.getPost(post.uri);
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
    const patchStore = new PatchStore();
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
    const patchStore = new PatchStore();
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
    const patchStore = new PatchStore();
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.setProfile(testProfile.did, testProfile);
    dataStore.setCurrentUser(testProfile);
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

    const updatedProfile = dataStore.getProfile(testProfile.did);
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

    const currentUser = dataStore.getCurrentUser();
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.setCurrentUser({ ...testUser, pinnedPost });
    if (authorFeed) {
      dataStore.setAuthorFeed(`${testUser.did}-posts`, authorFeed);
    }
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      true,
    );
    return {
      mutations: new Mutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
      ),
      dataStore,
      patchStore,
      selectors,
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

    assertEquals(dataStore.getCurrentUser().pinnedPost.uri, testPost.uri);
    assertEquals(dataStore.getCurrentUser().pinnedPost.cid, testPost.cid);
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

    const feed = dataStore.getAuthorFeed(`${testUser.did}-posts`).feed;
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
    const { mutations, selectors, dataStore } = setup(mockApi, {
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });
    dataStore.setPost(otherPost.uri, otherPost);
    dataStore.setPost(testPost.uri, testPost);

    const promise = mutations.pinPost(testPost);
    // Yield so the patches apply before we inspect them.
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(selectors.getCurrentUser().pinnedPost.uri, testPost.uri);
    const inFlightFeed = selectors.getAuthorFeed(testUser.did, "posts").feed;
    assertEquals(inFlightFeed[0].post.uri, testPost.uri);
    assertEquals(inFlightFeed[0].reason.$type, "app.bsky.feed.defs#reasonPin");

    putResolve({});
    await promise;

    // After success, dataStore matches the previously-patched view.
    assertEquals(selectors.getCurrentUser().pinnedPost.uri, testPost.uri);
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
    const { mutations, dataStore, selectors } = setup(mockApi, {
      pinnedPost: previousPinned,
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });
    dataStore.setPost(otherPost.uri, otherPost);
    dataStore.setPost(testPost.uri, testPost);

    let threw = false;
    try {
      await mutations.pinPost(testPost);
    } catch (e) {
      threw = true;
    }
    assertEquals(threw, true);
    // Patches removed; selectors reflect original dataStore.
    assertEquals(selectors.getCurrentUser().pinnedPost.uri, previousPinned.uri);
    const feed = selectors.getAuthorFeed(testUser.did, "posts").feed;
    assertEquals(feed[0].post.uri, otherItem.post.uri);
    // dataStore unchanged.
    assertEquals(dataStore.getCurrentUser().pinnedPost.uri, previousPinned.uri);
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
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.setCurrentUser({ ...testUser, pinnedPost });
    if (authorFeed) {
      dataStore.setAuthorFeed(`${testUser.did}-posts`, authorFeed);
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

    assertEquals(dataStore.getCurrentUser().pinnedPost, undefined);
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
    assertEquals(dataStore.getCurrentUser().pinnedPost.uri, otherPinned.uri);
  });
});

await t.run();
