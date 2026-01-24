import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { Mutations } from "../../../src/js/dataLayer/mutations.js";
import { DataStore } from "../../../src/js/dataLayer/dataStore.js";
import { PatchStore } from "../../../src/js/dataLayer/patchStore.js";
import { Preferences } from "../../../src/js/preferences.js";

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
    mutations.subscribeLabeler(testProfile);

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

    await mutations.subscribeLabeler(testProfile);

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
      await mutations.subscribeLabeler(testProfile);
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

await t.run();
