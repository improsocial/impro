import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Mutations } from "/js/dataLayer/mutations.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";
import { DraftMediaStore } from "/js/drafts.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { StatusStore } from "/js/dataLayer/requests.js";
import { QueryStore } from "/js/dataLayer/queryStore.js";
import {
  actorListsQueryKey,
  authorFeedQueryKey,
  blockedProfilesQueryKey,
  bookmarksQueryKey,
  convoListQueryKey,
  convoMessagesQueryKey,
  convoRequestListQueryKey,
  listMembersQueryKey,
  listsWithMembershipQueryKey,
  mutedProfilesQueryKey,
  pinnedItemsQueryKey,
  postThreadOtherQueryKey,
  postThreadQueryKey,
} from "/js/dataLayer/queryKeys.js";
import { Derived } from "/js/dataLayer/derived.js";
import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { CDN_URL } from "/js/config.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const mockIdentityResolver = {
  resolveHandle: async () => null,
};

function seedPinnedItems(queryStore, items) {
  queryStore.replacePages(pinnedItemsQueryKey(), { items, cursor: null });
}

function makeMutations(
  api,
  dataStore,
  patchStore,
  preferencesProvider,
  queryStore = new QueryStore(),
) {
  return new Mutations(
    api,
    dataStore,
    patchStore,
    preferencesProvider,
    mockIdentityResolver,
    new DraftMediaStore("test-media"),
    queryStore,
  );
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
  queryStore = new QueryStore(),
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
    new HiddenFeedItemsStore(),
    isAuthenticated,
    new DraftMediaStore("test-media"),
    new StatusStore(),
    queryStore,
  );
}

describe("addLike", () => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    likeCount: 5,
    viewer: { like: null },
  };

  it("should add optimistic patch immediately", () => {
    const mockApi = {
      createLikeRecord: async () => ({ uri: "like-uri" }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.addLike(testPost);

    const patchedPost = applyPostPatches(patchStore, testPost);
    assert.deepEqual(patchedPost.viewer.like, "fake like");
    assert.deepEqual(patchedPost.likeCount, 6);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockLike = { uri: "like-123" };
    const mockApi = {
      createLikeRecord: async () => mockLike,
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.addLike(testPost);

    const storedPost = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(storedPost.viewer.like, "like-123");
    assert.deepEqual(storedPost.likeCount, 6);

    const patchedPost = applyPostPatches(patchStore, storedPost);
    assert.deepEqual(patchedPost, storedPost);
  });

  it("should only count once across concurrent like operations", async () => {
    const mockApi = {
      createLikeRecord: async () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ uri: "like-uri" }), 50),
        ),
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise1 = mutations.addLike(testPost);
    const promise2 = mutations.addLike(testPost);

    // The second patch is a no-op because the first already applied the like.
    const patchedPost = applyPostPatches(patchStore, testPost);
    assert.deepEqual(patchedPost.likeCount, 6);
    assert.deepEqual(patchedPost.viewer.like, "fake like");

    await Promise.all([promise1, promise2]);
  });

  it("should not double-count when a refresh lands while the like is in flight", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockApi = {
      createLikeRecord: async () => {
        // Simulate a feed refresh delivering the server state (like already
        // applied) before the mutation's own commit runs.
        dataStore.$posts.set(testPost.uri, {
          ...testPost,
          likeCount: 6,
          viewer: { like: "server-like-uri" },
        });
        return { uri: "like-123" };
      },
    };
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.addLike(testPost);

    const storedPost = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(storedPost.likeCount, 6);
    assert.deepEqual(storedPost.viewer.like, "server-like-uri");
    assert.deepEqual(patchStore.$patchedPosts.get(testPost.uri).likeCount, 6);
  });
});

describe("removeLike", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.removeLike(testPost);

    const patchedPost = applyPostPatches(patchStore, testPost);
    assert.deepEqual(patchedPost.viewer.like, null);
    assert.deepEqual(patchedPost.likeCount, 5);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteLikeRecord: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeLike(testPost);

    const storedPost = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(storedPost.viewer.like, null);
    assert.deepEqual(storedPost.likeCount, 5);

    const patchedPost = applyPostPatches(patchStore, storedPost);
    assert.deepEqual(patchedPost, storedPost);
  });
});

describe("followProfile", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.followProfile(testProfile);

    const patchedProfile = patchStore.applyProfilePatches(testProfile);
    assert.deepEqual(patchedProfile.viewer.following, "fake following");
    assert.deepEqual(patchedProfile.followersCount, 11);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockFollow = { uri: "follow-123" };
    const mockApi = {
      createFollowRecord: async () => mockFollow,
    };
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$detailedProfiles.set(testProfile.did, testProfile);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.followProfile(testProfile);

    const storedProfile = dataStore.$profiles.get(testProfile.did);
    assert.deepEqual(storedProfile.viewer.following, "follow-123");

    const storedDetailed = dataStore.$detailedProfiles.get(testProfile.did);
    assert.deepEqual(storedDetailed.viewer.following, "follow-123");
    assert.deepEqual(storedDetailed.followersCount, 11);

    const patchedProfile = patchStore.applyProfilePatches(storedProfile);
    assert.deepEqual(patchedProfile, storedProfile);
  });
});

describe("unfollowProfile", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.unfollowProfile(testProfile);

    const patchedProfile = patchStore.applyProfilePatches(testProfile);
    assert.deepEqual(patchedProfile.viewer.following, null);
    assert.deepEqual(patchedProfile.followersCount, 9);
  });

  it("should update dataStore and remove patch on success", async () => {
    const mockApi = {
      deleteFollowRecord: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$detailedProfiles.set(testProfile.did, testProfile);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unfollowProfile(testProfile);

    const storedProfile = dataStore.$profiles.get(testProfile.did);
    assert.deepEqual(storedProfile.viewer.following, null);

    const storedDetailed = dataStore.$detailedProfiles.get(testProfile.did);
    assert.deepEqual(storedDetailed.viewer.following, null);
    assert.deepEqual(storedDetailed.followersCount, 9);

    const patchedProfile = patchStore.applyProfilePatches(storedProfile);
    assert.deepEqual(patchedProfile, storedProfile);
  });
});

describe("subscribeLabeler", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.subscribeLabeler(testProfile, testLabelerInfo);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "subscribeLabeler");
    assert.deepEqual(patches[0].body.did, testProfile.did);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        subscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.subscribeLabeler(testProfile, testLabelerInfo);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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

    assert.deepEqual(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
  });
});

describe("unsubscribeLabeler", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.unsubscribeLabeler(testProfile);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "unsubscribeLabeler");
    assert.deepEqual(patches[0].body.did, testProfile.did);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        unsubscribeLabeler: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unsubscribeLabeler(testProfile);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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

    assert.deepEqual(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
  });
});

describe("updateLabelerSetting", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.updateLabelerSetting({ labelerDid, label, visibility });

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "setContentLabelPref");
    assert.deepEqual(patches[0].body.label, label);
    assert.deepEqual(patches[0].body.visibility, visibility);
    assert.deepEqual(patches[0].body.labelerDid, labelerDid);
  });

  it("should remove patch after successful update", async () => {
    const mockPreferencesProvider = {
      requirePreferences: () => ({
        setContentLabelPref: () => Preferences.createLoggedOutPreferences(),
      }),
      updatePreferences: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateLabelerSetting({ labelerDid, label, visibility });

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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

    assert.deepEqual(errorThrown, true);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 0);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.updateLabelerSetting({ labelerDid, label, visibility });

    assert.deepEqual(setContentLabelPrefCalledWith.labelerDid, labelerDid);
    assert.deepEqual(setContentLabelPrefCalledWith.label, label);
    assert.deepEqual(setContentLabelPrefCalledWith.visibility, visibility);
  });
});

describe("Error Handling and Edge Cases", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(patchedPost.likeCount, 5);

    await Promise.all([likePromise, unlikePromise]);
  });

  it("should handle API methods that return undefined", async () => {
    const post = { uri: "post1", likeCount: 5, viewer: { like: "like1" } };

    const mockApi = {
      deleteLikeRecord: async () => undefined,
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeLike(post);

    const storedPost = dataStore.$posts.get(post.uri);
    assert.deepEqual(storedPost.viewer.like, null);
  });
});

describe("addMutedWord", () => {
  it("should call updatePreferences with new muted word", async () => {
    let updatedPreferences = null;
    const mockPreferencesProvider = {
      requirePreferences: () => new Preferences([], []),
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].value, "testword");
    assert.deepEqual(words[0].targets.length, 2);
    assert.deepEqual(words[0].actorTarget, "all");
  });

  it("should pass expiresAt through to preferences", async () => {
    let updatedPreferences = null;
    const mockPreferencesProvider = {
      requirePreferences: () => new Preferences([], []),
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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
    assert.deepEqual(words[0].expiresAt, expiresAt);
    assert.deepEqual(words[0].actorTarget, "exclude-following");
  });
});

describe("removeMutedWord", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeMutedWord("word-1");

    const words = updatedPreferences.getMutedWords();
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].value, "keep-me");
  });
});

describe("updateProfile", () => {
  const testProfile = {
    did: "did:plc:test123",
    displayName: "Old Name",
    description: "Old bio",
    avatar: "https://example.com/avatar.jpg",
    banner: "https://example.com/banner.jpg",
    viewer: {},
  };

  function createMutationsWithMockApi(mockApi) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(testProfile.did, testProfile);
    dataStore.$currentUser.set(testProfile);
    return {
      mutations: makeMutations(
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

    assert.deepEqual(getRecordCalled, true);
    assert.deepEqual(putRecordCalled, true);
    assert.deepEqual(putRecordArgs.record.displayName, "New Name");
    assert.deepEqual(putRecordArgs.record.description, "New bio");
    assert.deepEqual(putRecordArgs.swapRecord, "cid123");
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

    assert.deepEqual(uploadBlobCalled, true);
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

    assert.deepEqual(uploadBlobCallCount, 1);
  });

  it("patches $profiles in place with the new displayName and description", async () => {
    // The appview lags briefly after putRecord, so we patch locally rather
    // than round-tripping through getProfile (which can return stale data).
    const { mutations, dataStore } = createMutationsWithMockApi(makeMockApi());
    await mutations.updateProfile(testProfile, {
      displayName: "Patched Name",
      description: "Patched bio",
    });

    const updatedProfile = dataStore.$profiles.get(testProfile.did);
    assert.deepEqual(updatedProfile.displayName, "Patched Name");
    assert.deepEqual(updatedProfile.description, "Patched bio");
    // Non-patched fields survive.
    assert.deepEqual(updatedProfile.did, testProfile.did);
  });

  it("sets the local avatar and banner to CDN URLs built from the uploaded refs", async () => {
    let uploadCallIndex = 0;
    const mockApi = makeMockApi({
      uploadBlob: async () => {
        uploadCallIndex++;
        return {
          ref: { $link: `bafkreiblob${uploadCallIndex}` },
          mimeType: "image/jpeg",
          size: 100,
        };
      },
    });

    const { mutations, dataStore } = createMutationsWithMockApi(mockApi);
    await mutations.updateProfile(testProfile, {
      displayName: "Name",
      description: "Bio",
      avatarBlob: new Blob(["a"], { type: "image/jpeg" }),
      bannerBlob: new Blob(["b"], { type: "image/jpeg" }),
    });

    const updatedProfile = dataStore.$profiles.get(testProfile.did);
    assert.match(
      updatedProfile.avatar,
      new RegExp(
        `^${escapeRegExp(CDN_URL)}/img/avatar/plain/did:plc:test123/bafkreiblob\\d+@jpeg$`,
      ),
    );
    assert.match(
      updatedProfile.banner,
      new RegExp(
        `^${escapeRegExp(CDN_URL)}/img/banner/plain/did:plc:test123/bafkreiblob\\d+@jpeg$`,
      ),
    );
  });

  it("clears the local avatar and banner when removeAvatar/removeBanner are true", async () => {
    const { mutations, dataStore } = createMutationsWithMockApi(makeMockApi());
    await mutations.updateProfile(testProfile, {
      displayName: "Name",
      description: "Bio",
      removeAvatar: true,
      removeBanner: true,
    });

    const updatedProfile = dataStore.$profiles.get(testProfile.did);
    assert.equal(updatedProfile.avatar, "");
    assert.equal(updatedProfile.banner, "");
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
      assert.deepEqual(error.status, 500);
    }
  });

  it("should update currentUser when editing own profile", async () => {
    const { mutations, dataStore } = createMutationsWithMockApi(makeMockApi());
    await mutations.updateProfile(testProfile, {
      displayName: "Updated User",
      description: "Updated bio",
    });

    const currentUser = dataStore.$currentUser.get();
    assert.deepEqual(currentUser.displayName, "Updated User");
    assert.deepEqual(currentUser.description, "Updated bio");
  });
});

describe("pinPost", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const queryStore = new QueryStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set({ ...testUser, pinnedPost });
    if (authorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: testUser.did, feedType: "posts" }),
        { pages: [{ items: authorFeed.feed, cursor: authorFeed.cursor }] },
      );
    }
    const derived = makeDerived(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      true,
      queryStore,
    );
    return {
      mutations: makeMutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
        queryStore,
      ),
      dataStore,
      patchStore,
      derived,
      queryStore,
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

    assert.deepEqual(dataStore.$currentUser.get().pinnedPost.uri, testPost.uri);
    assert.deepEqual(dataStore.$currentUser.get().pinnedPost.cid, testPost.cid);
    assert.deepEqual(putRecordArgs.record.pinnedPost.uri, testPost.uri);
    assert.deepEqual(putRecordArgs.record.pinnedPost.cid, testPost.cid);
    assert.deepEqual(putRecordArgs.record.displayName, "Me");
    assert.deepEqual(putRecordArgs.swapRecord, "cid-profile");
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
    const { mutations, queryStore } = setup(mockApi, {
      authorFeed: { feed: [otherItem, targetItem], cursor: "" },
    });

    await mutations.pinPost(testPost);

    const feed = queryStore.getItems(
      authorFeedQueryKey({ did: testUser.did, feedType: "posts" }),
    );
    assert.deepEqual(feed[0].post.uri, testPost.uri);
    assert.deepEqual(feed[0].reason.$type, "app.bsky.feed.defs#reasonPin");
    assert.deepEqual(feed.length, 2);
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

    assert.deepEqual(derived.$currentUser.get().pinnedPost.uri, testPost.uri);
    const inFlightFeed = derived.$hydratedAuthorFeeds.get(
      `${testUser.did}-posts`,
    ).feed;
    assert.deepEqual(inFlightFeed[0].post.uri, testPost.uri);
    assert.deepEqual(
      inFlightFeed[0].reason.$type,
      "app.bsky.feed.defs#reasonPin",
    );

    putResolve({});
    await promise;

    // After success, dataStore matches the previously-patched view.
    assert.deepEqual(derived.$currentUser.get().pinnedPost.uri, testPost.uri);
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
    assert.deepEqual(threw, true);
    // Patches removed; derived reflect original dataStore.
    assert.deepEqual(
      derived.$currentUser.get().pinnedPost.uri,
      previousPinned.uri,
    );
    const feed = derived.$hydratedAuthorFeeds.get(`${testUser.did}-posts`).feed;
    assert.deepEqual(feed[0].post.uri, otherItem.post.uri);
    // dataStore unchanged.
    assert.deepEqual(
      dataStore.$currentUser.get().pinnedPost.uri,
      previousPinned.uri,
    );
  });
});

describe("unpinPost", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const queryStore = new QueryStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set({ ...testUser, pinnedPost });
    if (authorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: testUser.did, feedType: "posts" }),
        { pages: [{ items: authorFeed.feed, cursor: authorFeed.cursor }] },
      );
    }
    return {
      mutations: makeMutations(
        mockApi,
        dataStore,
        patchStore,
        mockPreferencesProvider,
        queryStore,
      ),
      dataStore,
      queryStore,
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

    assert.deepEqual(dataStore.$currentUser.get().pinnedPost, undefined);
    assert.deepEqual("pinnedPost" in putRecordArgs.record, false);
    assert.deepEqual(putRecordArgs.record.displayName, "Me");
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

    assert.deepEqual(putCalled, false);
    assert.deepEqual(
      dataStore.$currentUser.get().pinnedPost.uri,
      otherPinned.uri,
    );
  });
});

describe("muteProfile", () => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(dataStore.$profiles.get(profile.did).viewer.muted, true);
  });

  it("should prepend muted profile to the cached list", async () => {
    const { mutations, dataStore } = setup();
    const existingDid = "did:plc:other";
    mutations.queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: [existingDid], cursor: "abc" }],
    });

    await mutations.muteProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(mutedProfilesQueryKey()), [
      profile.did,
      existingDid,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(mutedProfilesQueryKey()),
      "abc",
    );
  });

  it("should not duplicate when already present in the cached list", async () => {
    const { mutations, dataStore } = setup();
    mutations.queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: [profile.did], cursor: null }],
    });

    await mutations.muteProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(mutedProfilesQueryKey()), [
      profile.did,
    ]);
  });

  it("should not initialize the cached list if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.muteProfile(profile);
    assert.deepEqual(mutations.queryStore.get(mutedProfilesQueryKey()), null);
  });
});

describe("unmuteProfile", () => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: { muted: true },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(dataStore.$profiles.get(profile.did).viewer.muted, false);
  });

  it("should remove profile from the cached list", async () => {
    const { mutations, dataStore } = setup();
    const otherDid = "did:plc:other";
    mutations.queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: [profile.did, otherDid], cursor: "abc" }],
    });

    await mutations.unmuteProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(mutedProfilesQueryKey()), [
      otherDid,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(mutedProfilesQueryKey()),
      "abc",
    );
  });

  it("should be a no-op on the cached list when not present", async () => {
    const { mutations, dataStore } = setup();
    const otherDid = "did:plc:other";
    mutations.queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: [otherDid], cursor: null }],
    });

    await mutations.unmuteProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(mutedProfilesQueryKey()), [
      otherDid,
    ]);
  });
});

describe("blockProfile", () => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };
  const blockUri = "at://did:plc:me/app.bsky.graph.block/123";

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(
      dataStore.$profiles.get(profile.did).viewer.blocking,
      blockUri,
    );
  });

  it("should prepend blocked profile to the cached list", async () => {
    const { mutations, dataStore } = setup();
    const existingDid = "did:plc:other";
    mutations.queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: [existingDid], cursor: "abc" }],
    });

    await mutations.blockProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(blockedProfilesQueryKey()), [
      profile.did,
      existingDid,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(blockedProfilesQueryKey()),
      "abc",
    );
  });

  it("should not duplicate when already present in the cached list", async () => {
    const { mutations, dataStore } = setup();
    mutations.queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: [profile.did], cursor: null }],
    });

    await mutations.blockProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(blockedProfilesQueryKey()), [
      profile.did,
    ]);
  });

  it("should not initialize the cached list if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.blockProfile(profile);
    assert.deepEqual(mutations.queryStore.get(blockedProfilesQueryKey()), null);
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

    assert.deepEqual(
      dataStore.$posts.get(post.uri).author.viewer.blocking,
      blockUri,
    );
    assert.deepEqual(
      dataStore.$posts.get(otherPost.uri).author.viewer.blocking,
      undefined,
    );
  });
});

describe("unblockProfile", () => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: { blocking: "at://did:plc:me/app.bsky.graph.block/123" },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(
      dataStore.$profiles.get(profile.did).viewer.blocking,
      null,
    );
  });

  it("should remove profile from the cached list", async () => {
    const { mutations, dataStore } = setup();
    const otherDid = "did:plc:other";
    mutations.queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: [profile.did, otherDid], cursor: "abc" }],
    });

    await mutations.unblockProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(blockedProfilesQueryKey()), [
      otherDid,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(blockedProfilesQueryKey()),
      "abc",
    );
  });

  it("should be a no-op on the cached list when not present", async () => {
    const { mutations, dataStore } = setup();
    const otherDid = "did:plc:other";
    mutations.queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: [otherDid], cursor: null }],
    });

    await mutations.unblockProfile(profile);

    assert.deepEqual(mutations.queryStore.getItems(blockedProfilesQueryKey()), [
      otherDid,
    ]);
  });

  it("should clear author viewer.blocking on cached posts by that author", async () => {
    const { mutations, dataStore } = setup();
    const post = {
      uri: "at://did:plc:target/app.bsky.feed.post/1",
      author: { did: profile.did, viewer: { blocking: "at://old" } },
    };
    dataStore.$posts.set(post.uri, post);

    await mutations.unblockProfile(profile);

    assert.deepEqual(
      dataStore.$posts.get(post.uri).author.viewer.blocking,
      null,
    );
  });
});

describe("addBookmark", () => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    bookmarkCount: 2,
    viewer: { bookmarked: false },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(patched.viewer.bookmarked, true);
    assert.deepEqual(patched.bookmarkCount, 3);
  });

  it("should update dataStore and remove patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.addBookmark(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(stored.viewer.bookmarked, true);
    assert.deepEqual(stored.bookmarkCount, 3);
    assert.deepEqual(applyPostPatches(patchStore, stored), stored);
  });

  it("should prepend post to the cached bookmarks feed", async () => {
    const { mutations, dataStore } = setup();
    const existingUri = "at://did:test/app.bsky.feed.post/other";
    mutations.queryStore.set(bookmarksQueryKey(), {
      pages: [{ items: [existingUri], cursor: "abc" }],
    });

    await mutations.addBookmark(testPost);

    assert.deepEqual(mutations.queryStore.getItems(bookmarksQueryKey()), [
      testPost.uri,
      existingUri,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(bookmarksQueryKey()),
      "abc",
    );
  });

  it("should not initialize the bookmarks feed if it was not loaded", async () => {
    const { mutations, dataStore } = setup();
    await mutations.addBookmark(testPost);
    assert.deepEqual(mutations.queryStore.get(bookmarksQueryKey()), null);
  });
});

describe("removeBookmark", () => {
  const testPost = {
    uri: "at://did:test/app.bsky.feed.post/test",
    bookmarkCount: 3,
    viewer: { bookmarked: true },
  };

  function setup(mockApi = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(patched.viewer.bookmarked, false);
    assert.deepEqual(patched.bookmarkCount, 2);
  });

  it("should update dataStore and remove patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.removeBookmark(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(stored.viewer.bookmarked, false);
    assert.deepEqual(stored.bookmarkCount, 2);
    assert.deepEqual(applyPostPatches(patchStore, stored), stored);
  });

  it("should remove post from the cached bookmarks feed", async () => {
    const { mutations, dataStore } = setup();
    const otherUri = "at://did:test/app.bsky.feed.post/other";
    mutations.queryStore.set(bookmarksQueryKey(), {
      pages: [{ items: [testPost.uri, otherUri], cursor: "abc" }],
    });

    await mutations.removeBookmark(testPost);

    assert.deepEqual(mutations.queryStore.getItems(bookmarksQueryKey()), [
      otherUri,
    ]);
    assert.deepEqual(
      mutations.queryStore.getNextCursor(bookmarksQueryKey()),
      "abc",
    );
  });
});

describe("createRepost", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const queryStore = new QueryStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set(currentUser);
    if (authorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: currentUser.did, feedType: "posts" }),
        { pages: [{ items: authorFeed.feed, cursor: authorFeed.cursor }] },
      );
    }
    const mutations = makeMutations(
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
      queryStore,
    );
    return { mutations, dataStore, patchStore, queryStore };
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
    assert.deepEqual(patched.repostCount, 5);
    assert.deepEqual(patched.viewer.repost, "fake repost");
  });

  it("should update dataStore with repost uri and incremented count", async () => {
    const { mutations, dataStore } = setup();
    await mutations.createRepost(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(
      stored.viewer.repost,
      "at://did:plc:me/app.bsky.feed.repost/abc",
    );
    assert.deepEqual(stored.repostCount, 5);
  });

  it("should add a reasonRepost feed item to the current user's author feed", async () => {
    const { mutations, queryStore } = setup(
      {},
      { authorFeed: { feed: [], cursor: "c1" } },
    );
    await mutations.createRepost(testPost);
    const queryKey = authorFeedQueryKey({
      did: currentUser.did,
      feedType: "posts",
    });
    const feedItems = queryStore.getItems(queryKey);
    assert.deepEqual(feedItems.length, 1);
    assert.deepEqual(feedItems[0].post.uri, testPost.uri);
    assert.deepEqual(
      feedItems[0].reason.$type,
      "app.bsky.feed.defs#reasonRepost",
    );
    assert.deepEqual(feedItems[0].reason.by.did, currentUser.did);
    assert.deepEqual(
      feedItems[0].reason.uri,
      "at://did:plc:me/app.bsky.feed.repost/abc",
    );
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c1");
  });

  it("should not add a duplicate feed item when the feed already has the repost", async () => {
    // A refresh-delivered reasonRepost may omit the optional uri field.
    const existingItem = {
      post: { uri: testPost.uri },
      reason: {
        $type: "app.bsky.feed.defs#reasonRepost",
        by: currentUser,
        indexedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    const { mutations, queryStore } = setup(
      {},
      { authorFeed: { feed: [existingItem], cursor: "c1" } },
    );
    await mutations.createRepost(testPost);
    const feedItems = queryStore.getItems(
      authorFeedQueryKey({ did: currentUser.did, feedType: "posts" }),
    );
    assert.deepEqual(feedItems.length, 1);
    assert.deepEqual(feedItems[0], existingItem);
  });
});

describe("deleteRepost", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const queryStore = new QueryStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$currentUser.set(currentUser);
    if (authorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: currentUser.did, feedType: "posts" }),
        { pages: [{ items: authorFeed.feed, cursor: authorFeed.cursor }] },
      );
    }
    const mutations = makeMutations(
      { deleteRepostRecord: async () => ({}), ...mockApi },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    return { mutations, dataStore, patchStore, queryStore };
  }

  it("should add optimistic patch immediately", () => {
    const { mutations, patchStore } = setup({
      deleteRepostRecord: () =>
        new Promise((resolve) => setTimeout(resolve, 100)),
    });
    mutations.deleteRepost(testPost);
    const patched = applyPostPatches(patchStore, testPost);
    assert.deepEqual(patched.repostCount, 4);
    assert.deepEqual(patched.viewer.repost, null);
  });

  it("should update dataStore clearing repost uri and decrementing count", async () => {
    const { mutations, dataStore } = setup();
    await mutations.deleteRepost(testPost);
    const stored = dataStore.$posts.get(testPost.uri);
    assert.deepEqual(stored.viewer.repost, null);
    assert.deepEqual(stored.repostCount, 4);
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
    const { mutations, queryStore } = setup(
      {},
      { authorFeed: { feed: [matchingItem, otherItem], cursor: "c1" } },
    );

    await mutations.deleteRepost(testPost);

    const queryKey = authorFeedQueryKey({
      did: currentUser.did,
      feedType: "posts",
    });
    const feedItems = queryStore.getItems(queryKey);
    assert.deepEqual(feedItems.length, 1);
    assert.deepEqual(feedItems[0].post.uri, otherItem.post.uri);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c1");
  });
});

describe("pinFeed", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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
    assert.deepEqual(pinned.length, 1);
    assert.deepEqual(pinned[0].value, feedUri);
    assert.deepEqual(pinned[0].pinned, true);
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
    assert.deepEqual(allItems.length, 2);
    assert.deepEqual(updated.isFeedPinned(feedUri), true);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.pinFeed(feedUri);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "pinFeed");
    assert.deepEqual(patches[0].body.feedUri, feedUri);

    updateResolve();
    await promise;
    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });
});

describe("unpinFeed", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.unpinFeed(feedUri);
    assert.deepEqual(updatedPreferences.isFeedPinned(feedUri), false);
    assert.deepEqual(updatedPreferences.obj[0].items.length, 1);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.unpinFeed(feedUri);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "unpinFeed");
    assert.deepEqual(patches[0].body.feedUri, feedUri);

    updateResolve();
    await promise;
    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });
});

describe("setPinnedItems", () => {
  const feedA = "at://did:plc:x/app.bsky.feed.generator/a";
  const feedB = "at://did:plc:x/app.bsky.feed.generator/b";
  const listA = "at://did:plc:x/app.bsky.graph.list/a";

  function setup({ preloadPinnedItems = true } = {}) {
    let updatedPreferences = null;
    let resolveUpdate;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });
    const preferences = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [
            {
              id: "1",
              value: "following",
              type: "timeline",
              pinned: true,
            },
            { id: "2", value: feedA, type: "feed", pinned: true },
            { id: "3", value: listA, type: "list", pinned: true },
            { id: "4", value: feedB, type: "feed", pinned: false },
          ],
        },
      ],
      [],
    );
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async (prefs) => {
        updatedPreferences = prefs;
        await updatePromise;
      },
    };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    if (preloadPinnedItems) {
      seedPinnedItems(queryStore, [
        { type: "timeline", data: { uri: "following" } },
        { type: "feed", data: { uri: feedA } },
        { type: "list", data: { uri: listA } },
      ]);
    }
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    return {
      mutations,
      patchStore,
      dataStore,
      resolveUpdate,
      getUpdatedPreferences: () => updatedPreferences,
    };
  }

  it("does not touch $pinnedItems until the network round-trip resolves", async () => {
    const { mutations, dataStore, resolveUpdate } = setup();
    const before = mutations.queryStore
      .getItems(pinnedItemsQueryKey())
      .map((it) => (it.type === "timeline" ? "following" : it.data.uri));
    const promise = mutations.setPinnedItems([listA, "following", feedA]);
    const during = mutations.queryStore
      .getItems(pinnedItemsQueryKey())
      .map((it) => (it.type === "timeline" ? "following" : it.data.uri));
    assert.deepEqual(during, before);
    resolveUpdate();
    await promise;
    const after = mutations.queryStore
      .getItems(pinnedItemsQueryKey())
      .map((it) => (it.type === "timeline" ? "following" : it.data.uri));
    assert.deepEqual(after, [listA, "following", feedA]);
  });

  it("sends the reordered preferences to updatePreferences", async () => {
    const { mutations, resolveUpdate, getUpdatedPreferences } = setup();
    const promise = mutations.setPinnedItems([feedA, listA, "following"]);
    resolveUpdate();
    await promise;
    const items = getUpdatedPreferences().obj[0].items;
    assert.deepEqual(
      items.map((it) => it.value),
      [feedA, listA, "following", feedB],
    );
  });

  it("leaves $pinnedItems untouched when updatePreferences rejects", async () => {
    const preferences = new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [
            { id: "1", value: feedA, type: "feed", pinned: true },
            { id: "2", value: listA, type: "list", pinned: true },
          ],
        },
      ],
      [],
    );
    const error = new Error("network");
    const mockPreferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async () => {
        throw error;
      },
    };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    seedPinnedItems(queryStore, [
      { type: "feed", data: { uri: feedA } },
      { type: "list", data: { uri: listA } },
    ]);
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(
        () => mutations.setPinnedItems([listA, feedA]),
        (err) => err === error,
      );
    } finally {
      console.error = originalConsoleError;
    }
    const after = queryStore
      .getItems(pinnedItemsQueryKey())
      .map((it) => it.data.uri);
    assert.deepEqual(after, [feedA, listA]);
  });
});

describe("hidePost", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.hidePost(testPost);

    assert.deepEqual(updatedPreferences.isPostHidden(testPost.uri), true);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    const promise = mutations.hidePost(testPost);
    const patches = patchStore.$postPatches.get(testPost.uri) || [];
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "hidePost");

    updateResolve();
    await promise;
    assert.deepEqual(
      (patchStore.$postPatches.get(testPost.uri) || []).length,
      0,
    );
  });
});

describe("updateMutedWord", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
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
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].value, "new-value");
    assert.deepEqual(words[0].targets[0], "tag");
    assert.deepEqual(words[0].actorTarget, "all");
  });
});

describe("updatePostNotificationSubscription", () => {
  const profile = {
    did: "did:plc:target",
    handle: "target.bsky.social",
    viewer: {},
  };

  it("should set viewer.activitySubscription on the profile", async () => {
    const subscription = { post: true, reply: false };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let calledWith = null;
    const mutations = makeMutations(
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

    assert.deepEqual(calledWith.did, profile.did);
    assert.deepEqual(calledWith.sub, subscription);
    assert.deepEqual(
      dataStore.$profiles.get(profile.did).viewer.activitySubscription,
      subscription,
    );
  });

  it("should remove the patch on failure and rethrow", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
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
    assert.deepEqual(threw, true);
    assert.deepEqual(patchStore._getProfilePatches(profile.did).length, 0);
  });
});

describe("createThread", () => {
  const currentUserDid = "did:plc:me";
  const newPostUri = `at://${currentUserDid}/app.bsky.feed.post/new`;

  function setup({ replyPostThread, authorFeed, replyAuthorFeed } = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const queryStore = new QueryStore();
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    const fullPost = {
      uri: newPostUri,
      cid: "cid-new",
      author: { did: currentUserDid, viewer: {} },
      record: { text: "hello" },
      viewer: {},
    };
    mutations.postCreator = {
      createThread: async () => ({
        uris: [fullPost.uri],
        posts: [fullPost],
      }),
    };
    if (replyPostThread) {
      mutations.queryStore.setValue(
        postThreadQueryKey({ uri: replyPostThread.post.uri }),
        replyPostThread,
      );
    }
    if (authorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: currentUserDid, feedType: "posts" }),
        { pages: [{ items: authorFeed.feed, cursor: authorFeed.cursor }] },
      );
    }
    if (replyAuthorFeed) {
      queryStore.set(
        authorFeedQueryKey({ did: currentUserDid, feedType: "replies" }),
        {
          pages: [
            { items: replyAuthorFeed.feed, cursor: replyAuthorFeed.cursor },
          ],
        },
      );
    }
    return { mutations, dataStore, fullPost, queryStore };
  }

  it("should store the new post and mark priorityReply", async () => {
    const { mutations, dataStore } = setup();
    const result = await mutations.createThread({
      posts: [{ postText: "hello" }],
    });
    assert.deepEqual(result.uris, [newPostUri]);
    const stored = dataStore.$posts.get(newPostUri);
    assert.deepEqual(stored.uri, newPostUri);
    assert.deepEqual(stored.viewer.priorityReply, true);
  });

  it("should add the new post to the author posts feed when loaded", async () => {
    const { mutations, queryStore } = setup({
      authorFeed: { feed: [], cursor: "c1" },
    });
    await mutations.createThread({ posts: [{ postText: "hello" }] });
    const queryKey = authorFeedQueryKey({
      did: currentUserDid,
      feedType: "posts",
    });
    const feedItems = queryStore.getItems(queryKey);
    assert.deepEqual(feedItems.length, 1);
    assert.deepEqual(feedItems[0].post.uri, newPostUri);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c1");
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
    const { mutations, dataStore, queryStore } = setup({
      replyPostThread,
      replyAuthorFeed: { feed: [], cursor: "c1" },
    });

    await mutations.createThread({
      posts: [{ postText: "hi" }],
      replyTo,
      replyRoot,
    });

    const updatedThread = mutations.queryStore.getValue(
      postThreadQueryKey({ uri: replyTo.uri }),
    );
    assert.deepEqual(updatedThread.replies.length, 2);
    assert.deepEqual(updatedThread.replies[0].post.uri, newPostUri);
    const repliesFeedItems = queryStore.getItems(
      authorFeedQueryKey({ did: currentUserDid, feedType: "replies" }),
    );
    assert.deepEqual(repliesFeedItems.length, 1);
    assert.deepEqual(repliesFeedItems[0].post.uri, newPostUri);
  });

  it("still resolves with uris when the app view fetch fails, without mutating stores", async () => {
    const { mutations, dataStore, queryStore } = setup({
      authorFeed: { feed: [], cursor: "c1" },
    });
    mutations.postCreator = {
      createThread: async () => ({
        uris: [newPostUri],
        posts: null,
      }),
    };

    const result = await mutations.createThread({
      posts: [{ postText: "hello" }],
    });

    assert.deepEqual(result.uris, [newPostUri]);
    assert.deepEqual(result.posts, null);
    assert.deepEqual(dataStore.$posts.get(newPostUri), null);
    const feedItems = queryStore.getItems(
      authorFeedQueryKey({ did: currentUserDid, feedType: "posts" }),
    );
    assert.deepEqual(feedItems.length, 0);
  });
});

describe("deletePost", () => {
  it("should call api.deletePost and replace the stored post with a not-found post", async () => {
    const post = {
      uri: "at://did:plc:me/app.bsky.feed.post/abc",
      cid: "cid-abc",
    };
    let apiCalledWith = null;
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$posts.set(post.uri, { ...post, record: { text: "hi" } });
    const mutations = makeMutations(
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

    assert.deepEqual(apiCalledWith, post);
    const stored = dataStore.$posts.get(post.uri);
    assert.deepEqual(stored.uri, post.uri);
    assert.deepEqual(stored.$type, "app.bsky.feed.defs#notFoundPost");
  });
});

describe("createMessage", () => {
  const convoId = "convo-1";
  const sentMessage = {
    id: "msg-1",
    text: "hello",
    sender: { did: "did:plc:me" },
  };

  function setup({ convoMessages, convo } = {}) {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convoMessages) {
      queryStore.set(convoMessagesQueryKey({ convoId }), {
        pages: [
          {
            items: convoMessages.messages.map((message) => message.id),
            cursor: convoMessages.cursor,
          },
        ],
      });
    }
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = makeMutations(
      { sendMessage: async () => sentMessage },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    return { mutations, dataStore, queryStore };
  }

  it("should store the new message and return it", async () => {
    const { mutations, dataStore } = setup();
    const result = await mutations.createMessage(convoId, { text: "hello" });
    assert.deepEqual(result, sentMessage);
    assert.deepEqual(dataStore.$messages.get(sentMessage.id), sentMessage);
  });

  it("should prepend the message to the cached convo messages", async () => {
    const existingMessage = { id: "msg-old", text: "earlier" };
    const { mutations, queryStore } = setup({
      convoMessages: { messages: [existingMessage], cursor: "c1" },
    });
    await mutations.createMessage(convoId, { text: "hello" });
    const key = convoMessagesQueryKey({ convoId });
    assert.deepEqual(queryStore.getItems(key), [
      sentMessage.id,
      existingMessage.id,
    ]);
    assert.deepEqual(queryStore.getNextCursor(key), "c1");
  });

  it("should update the convo's lastMessage", async () => {
    const convo = { id: convoId, unreadCount: 0 };
    const { mutations, dataStore } = setup({ convo });
    await mutations.createMessage(convoId, { text: "hello" });
    const stored = dataStore.$convos.get(convoId);
    assert.deepEqual(stored.lastMessage.id, sentMessage.id);
    assert.deepEqual(
      stored.lastMessage.$type,
      "chat.bsky.convo.defs#messageView",
    );
  });

  it("should pass replyTo to the api", async () => {
    let apiCalledWith = null;
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      {
        sendMessage: async (id, body) => {
          apiCalledWith = body;
          return sentMessage;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    await mutations.createMessage(convoId, {
      text: "hello",
      replyTo: { messageId: "msg-target" },
    });
    assert.deepEqual(apiCalledWith.replyTo.messageId, "msg-target");
  });

  it("should pass embed to the api", async () => {
    let apiCalledWith = null;
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      {
        sendMessage: async (id, body) => {
          apiCalledWith = body;
          return sentMessage;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    const embed = {
      $type: "app.bsky.embed.record",
      record: { uri: "at://did:plc:abc/app.bsky.feed.post/3abc", cid: "cid1" },
    };
    await mutations.createMessage(convoId, { text: "hello", embed });
    assert.deepEqual(apiCalledWith.embed, embed);
  });

  it("should propagate the raw error on send failure", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      {
        sendMessage: async () => {
          throw new Error("block between recipient and sender");
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    let caught = null;
    try {
      await mutations.createMessage(convoId, { text: "hello" });
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.message, "block between recipient and sender");
  });
});

describe("acceptConvo", () => {
  const convo = { id: "convo-1", status: "request" };

  function setup({ convoList, convoRequestList } = {}) {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convoList) {
      queryStore.set(convoListQueryKey(), {
        pages: [
          {
            items: convoList.map((listConvo) => listConvo.id),
            cursor: "list-cursor",
          },
        ],
      });
    }
    if (convoRequestList) {
      queryStore.set(convoRequestListQueryKey(), {
        pages: [
          {
            items: convoRequestList.map((listConvo) => listConvo.id),
            cursor: "request-cursor",
          },
        ],
      });
    }
    let acceptCalledWith = null;
    const mutations = makeMutations(
      {
        acceptConvo: async (id) => {
          acceptCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );
    return {
      mutations,
      dataStore,
      queryStore,
      getAcceptArg: () => acceptCalledWith,
    };
  }

  it("should set the convo status to accepted in the store", async () => {
    const { mutations, dataStore, getAcceptArg } = setup();
    const result = await mutations.acceptConvo(convo);
    assert.deepEqual(getAcceptArg(), convo.id);
    assert.deepEqual(result.status, "accepted");
    assert.deepEqual(dataStore.$convos.get(convo.id).status, "accepted");
  });

  it("should update the matching convo in the convo list", async () => {
    const otherConvo = { id: "convo-2", status: "accepted" };
    const { mutations, dataStore, queryStore } = setup({
      convoList: [convo, otherConvo],
    });
    dataStore.$convos.set(otherConvo.id, otherConvo);
    await mutations.acceptConvo(convo);
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      convo.id,
      otherConvo.id,
    ]);
    assert.deepEqual(dataStore.$convos.get(convo.id).status, "accepted");
    assert.deepEqual(
      queryStore.getNextCursor(convoListQueryKey()),
      "list-cursor",
    );
  });

  it("should remove the convo from the request list", async () => {
    const otherRequest = { id: "convo-3", status: "request" };
    const { mutations, queryStore } = setup({
      convoRequestList: [convo, otherRequest],
    });
    await mutations.acceptConvo(convo);
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      otherRequest.id,
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "request-cursor",
    );
  });

  it("should add the convo to the convo list when not already present", async () => {
    const otherConvo = { id: "convo-2", status: "accepted" };
    const { mutations, dataStore, queryStore } = setup({
      convoList: [otherConvo],
    });
    await mutations.acceptConvo(convo);
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      convo.id,
      otherConvo.id,
    ]);
    assert.deepEqual(dataStore.$convos.get(convo.id).status, "accepted");
  });
});

describe("rejectConvo", () => {
  const convo = { id: "convo-1", status: "request" };

  it("should clear the convo, call api.leaveConvo, and remove it from the request list only", async () => {
    const otherAccepted = { id: "convo-2", status: "accepted" };
    const otherRequest = { id: "convo-3", status: "request" };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: [otherAccepted.id], cursor: "list-cursor" }],
    });
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: [convo.id, otherRequest.id], cursor: "request-cursor" }],
    });
    let leaveCalledWith = null;
    const mutations = makeMutations(
      {
        leaveConvo: async (id) => {
          leaveCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await mutations.rejectConvo(convo);

    assert.deepEqual(leaveCalledWith, convo.id);
    assert.deepEqual(dataStore.$convos.get(convo.id), null);
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      otherRequest.id,
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "request-cursor",
    );
    // Accepted list must not be touched by rejectConvo.
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      otherAccepted.id,
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoListQueryKey()),
      "list-cursor",
    );
  });
});

describe("leaveConvo", () => {
  const convo = { id: "convo-1", status: "accepted" };

  it("should clear the convo, call api.leaveConvo, and remove it from the accepted list only", async () => {
    const otherAccepted = { id: "convo-2", status: "accepted" };
    const otherRequest = { id: "convo-3", status: "request" };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: [convo.id, otherAccepted.id], cursor: "list-cursor" }],
    });
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: [otherRequest.id], cursor: "request-cursor" }],
    });
    let leaveCalledWith = null;
    const mutations = makeMutations(
      {
        leaveConvo: async (id) => {
          leaveCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await mutations.leaveConvo(convo);

    assert.deepEqual(leaveCalledWith, convo.id);
    assert.deepEqual(dataStore.$convos.get(convo.id), null);
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      otherAccepted.id,
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoListQueryKey()),
      "list-cursor",
    );
    // Request list must not be touched by leaveConvo.
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      otherRequest.id,
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "request-cursor",
    );
  });

  it("should leave the store unchanged when api.leaveConvo throws", async () => {
    const otherAccepted = { id: "convo-2", status: "accepted" };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: [convo.id, otherAccepted.id], cursor: "list-cursor" }],
    });
    const mutations = makeMutations(
      {
        leaveConvo: async () => {
          throw new Error("boom");
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await assert.rejects(() => mutations.leaveConvo(convo));

    assert.deepEqual(dataStore.$convos.get(convo.id), convo);
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      convo.id,
      otherAccepted.id,
    ]);
  });
});

describe("setConvoMuted", () => {
  const convo = { id: "convo-1", muted: false };

  it("should optimistically patch, then write to dataStore and clear the patch on success", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    let muteCalledWith = null;
    let patchDuringApi = null;
    const mutations = makeMutations(
      {
        muteConvo: async (id) => {
          muteCalledWith = id;
          patchDuringApi = patchStore.$patchedConvos.get(convo.id);
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.setConvoMuted(convo, true);

    assert.deepEqual(muteCalledWith, convo.id);
    // While the API call was in flight the patched view was already muted.
    assert.deepEqual(patchDuringApi.muted, true);
    // On success the dataStore is updated and the patch is cleared.
    assert.deepEqual(dataStore.$convos.get(convo.id).muted, true);
    assert.deepEqual(patchStore.$convoPatches.get(convo.id), []);
  });

  it("should call api.unmuteConvo when muted=false", async () => {
    const mutedConvo = { id: "convo-1", muted: true };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(mutedConvo.id, mutedConvo);
    let unmuteCalledWith = null;
    const mutations = makeMutations(
      {
        unmuteConvo: async (id) => {
          unmuteCalledWith = id;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.setConvoMuted(mutedConvo, false);

    assert.deepEqual(unmuteCalledWith, mutedConvo.id);
    assert.deepEqual(dataStore.$convos.get(mutedConvo.id).muted, false);
  });

  it("should revert the optimistic patch and leave the dataStore unchanged when the api throws", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    const mutations = makeMutations(
      {
        muteConvo: async () => {
          throw new Error("boom");
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await assert.rejects(() => mutations.setConvoMuted(convo, true));

    assert.deepEqual(dataStore.$convos.get(convo.id).muted, false);
    assert.deepEqual(patchStore.$convoPatches.get(convo.id), []);
    assert.deepEqual(patchStore.$patchedConvos.get(convo.id).muted, false);
  });

  it("should not write to dataStore if the underlying convo was cleared during the api call", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convo.id, convo);
    const mutations = makeMutations(
      {
        muteConvo: async () => {
          dataStore.$convos.set(convo.id, null);
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.setConvoMuted(convo, true);

    assert.deepEqual(dataStore.$convos.get(convo.id), null);
    assert.deepEqual(patchStore.$convoPatches.get(convo.id), []);
  });
});

describe("markConvoAsRead", () => {
  it("should call api.markConvoAsRead and zero the unread count", async () => {
    const convoId = "convo-1";
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convoId, { id: convoId, unreadCount: 4 });
    let calledWith = null;
    const mutations = makeMutations(
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

    assert.deepEqual(calledWith, convoId);
    assert.deepEqual(dataStore.$convos.get(convoId).unreadCount, 0);
  });

  it("should not throw when the convo is not cached", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      { markConvoAsRead: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    await mutations.markConvoAsRead("missing");
    // SignalMap returns null for uninitialized keys (was `undefined` pre-refactor).
    assert.deepEqual(dataStore.$convos.get("missing"), null);
  });

  it("should not call the api when the convo has no unread messages", async () => {
    const convoId = "convo-read";
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$convos.set(convoId, { id: convoId, unreadCount: 0 });
    let callCount = 0;
    const mutations = makeMutations(
      {
        markConvoAsRead: async () => {
          callCount++;
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.markConvoAsRead(convoId);

    assert.deepEqual(callCount, 0);
  });
});

describe("addMessageReaction", () => {
  const convoId = "convo-1";
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";
  const emoji = "👍";
  const updatedMessage = {
    id: messageId,
    reactions: [{ value: emoji, sender: { did: currentUserDid } }],
  };

  function setup({ convo } = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = makeMutations(
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
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "addReaction");
    assert.deepEqual(patches[0].body.reaction.value, emoji);
    assert.deepEqual(patches[0].body.reaction.sender.did, currentUserDid);
  });

  it("should store the returned message and clear the patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.addMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    assert.deepEqual(dataStore.$messages.get(messageId), updatedMessage);
    assert.deepEqual(patchStore._getMessagePatches(messageId).length, 0);
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
    assert.deepEqual(
      convo.lastReaction.$type,
      "chat.bsky.convo.defs#messageAndReactionView",
    );
    assert.deepEqual(convo.lastReaction.message.id, messageId);
    assert.deepEqual(convo.lastReaction.reaction.value, emoji);
  });
});

describe("removeMessageReaction", () => {
  const convoId = "convo-1";
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";
  const emoji = "👍";
  const updatedMessage = { id: messageId, reactions: [] };

  function setup({ convo } = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    if (convo) {
      dataStore.$convos.set(convoId, convo);
    }
    const mutations = makeMutations(
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
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "removeReaction");
    assert.deepEqual(patches[0].body.value, emoji);
    assert.deepEqual(patches[0].body.currentUserDid, currentUserDid);
  });

  it("should store the returned message and clear the patch on success", async () => {
    const { mutations, dataStore, patchStore } = setup();
    await mutations.removeMessageReaction(
      convoId,
      messageId,
      emoji,
      currentUserDid,
    );
    assert.deepEqual(dataStore.$messages.get(messageId), updatedMessage);
    assert.deepEqual(patchStore._getMessagePatches(messageId).length, 0);
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
    assert.deepEqual(dataStore.$convos.get(convoId).lastReaction, null);
  });
});

describe("sendShowLessInteraction", () => {
  const postURI = "at://did:plc:author/app.bsky.feed.post/1";
  const feedUri = "at://did:plc:feedgen/app.bsky.feed.generator/cool";
  const feedContext = "ctx";
  const feedProxyUrl = "https://feed.example/xrpc";

  it("should append the interaction to the dataStore (empty list branch)", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let sendArgs = null;
    const mutations = makeMutations(
      {
        sendInteractions: async (interactions, proxy) => {
          sendArgs = { interactions, proxy };
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(
      postURI,
      feedUri,
      feedContext,
      feedProxyUrl,
    );

    const stored = dataStore.$showLessInteractions.get(feedUri);
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0].item, postURI);
    assert.deepEqual(stored[0].event, "app.bsky.feed.defs#requestLess");
    assert.deepEqual(stored[0].feedContext, feedContext);
    assert.deepEqual(sendArgs.interactions.length, 1);
    assert.deepEqual(sendArgs.interactions[0].item, postURI);
    assert.deepEqual(sendArgs.proxy, feedProxyUrl);
  });

  it("should append to an existing list (non-empty branch)", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$showLessInteractions.set(feedUri, [
      { item: "existing", event: "x" },
    ]);
    const mutations = makeMutations(
      { sendInteractions: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(
      postURI,
      feedUri,
      feedContext,
      feedProxyUrl,
    );

    const stored = dataStore.$showLessInteractions.get(feedUri);
    assert.deepEqual(stored.length, 2);
    assert.deepEqual(stored[1].item, postURI);
  });

  it("should key stored interactions by feed", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      { sendInteractions: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );
    const otherFeedUri = "at://did:plc:feedgen/app.bsky.feed.generator/other";

    await mutations.sendShowLessInteraction(
      postURI,
      feedUri,
      feedContext,
      feedProxyUrl,
    );

    assert.deepEqual(dataStore.$showLessInteractions.get(feedUri).length, 1);
    assert.deepEqual(dataStore.$showLessInteractions.get(otherFeedUri), null);
  });

  it("should omit feedContext when null but keep an empty string", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const sentInteractions = [];
    const mutations = makeMutations(
      {
        sendInteractions: async (interactions) => {
          sentInteractions.push(...interactions);
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(
      postURI,
      feedUri,
      null,
      feedProxyUrl,
    );
    await mutations.sendShowLessInteraction(postURI, feedUri, "", feedProxyUrl);

    assert.deepEqual(sentInteractions, [
      { item: postURI, event: "app.bsky.feed.defs#requestLess" },
      {
        item: postURI,
        event: "app.bsky.feed.defs#requestLess",
        feedContext: "",
      },
    ]);
  });

  it("should store but not send when there is no feed proxy url", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const sentInteractions = [];
    const mutations = makeMutations(
      {
        sendInteractions: async (interactions) => {
          sentInteractions.push(...interactions);
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowLessInteraction(postURI, feedUri, null, null);

    assert.deepEqual(sentInteractions, []);
    assert.deepEqual(dataStore.$showLessInteractions.get(feedUri).length, 1);
  });
});

describe("sendShowMoreInteraction", () => {
  const postURI = "at://did:plc:author/app.bsky.feed.post/1";
  const feedUri = "at://did:plc:feedgen/app.bsky.feed.generator/cool";
  const feedContext = "ctx";
  const feedProxyUrl = "https://feed.example/xrpc";

  it("should append the interaction to the dataStore (empty list branch)", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    let sendArgs = null;
    const mutations = makeMutations(
      {
        sendInteractions: async (interactions, proxy) => {
          sendArgs = { interactions, proxy };
        },
      },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowMoreInteraction(
      postURI,
      feedUri,
      feedContext,
      feedProxyUrl,
    );

    const stored = dataStore.$showMoreInteractions.get(feedUri);
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0].item, postURI);
    assert.deepEqual(stored[0].event, "app.bsky.feed.defs#requestMore");
    assert.deepEqual(stored[0].feedContext, feedContext);
    assert.deepEqual(sendArgs.interactions[0].item, postURI);
    assert.deepEqual(sendArgs.proxy, feedProxyUrl);
  });

  it("should append to an existing list (non-empty branch)", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$showMoreInteractions.set(feedUri, [
      { item: "existing", event: "x" },
    ]);
    const mutations = makeMutations(
      { sendInteractions: async () => {} },
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.sendShowMoreInteraction(
      postURI,
      feedUri,
      feedContext,
      feedProxyUrl,
    );

    const stored = dataStore.$showMoreInteractions.get(feedUri);
    assert.deepEqual(stored.length, 2);
    assert.deepEqual(stored[1].item, postURI);
  });
});

describe("pinList", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    mutations.pinList(listUri);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "pinFeed");
    assert.deepEqual(patches[0].body.feedUri, listUri);
    assert.deepEqual(patches[0].body.entryType, "list");
  });

  it("should call preferences.pinFeed with type 'list'", async () => {
    const { provider, pinFeedCalls } = makeMockProvider();
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    await mutations.pinList(listUri);

    assert.deepEqual(pinFeedCalls.length, 1);
    assert.deepEqual(pinFeedCalls[0].feedUri, listUri);
    assert.deepEqual(pinFeedCalls[0].type, "list");
  });

  it("should remove patch after successful update", async () => {
    const { provider } = makeMockProvider();
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    await mutations.pinList(listUri);

    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });

  it("should remove patch even on error", async () => {
    const { provider } = makeMockProvider({
      updatePreferences: async () => {
        throw new Error("API error");
      },
    });
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    let errorThrown = false;
    try {
      await mutations.pinList(listUri);
    } catch (e) {
      errorThrown = true;
    }

    assert.deepEqual(errorThrown, true);
    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });
});

describe("pinFeed entryType", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations(
      {},
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    mutations.pinFeed(feedUri);

    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.entryType, "feed");
  });
});

describe("unpinList", () => {
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    await mutations.unpinList(listUri);

    assert.deepEqual(unpinCalls.length, 1);
    assert.deepEqual(unpinCalls[0], listUri);
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
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mutations = makeMutations({}, dataStore, patchStore, provider);

    const promise = mutations.unpinList(listUri);
    const patches = patchStore.$preferencePatches.get();
    assert.deepEqual(patches.length, 1);
    assert.deepEqual(patches[0].body.type, "unpinFeed");
    assert.deepEqual(patches[0].body.feedUri, listUri);

    updateResolve();
    await promise;
    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });
});

describe("addProfileToList", () => {
  const testProfile = {
    did: "did:test:profile",
    handle: "test.user",
  };
  const testList = {
    uri: "at://did:test:owner/app.bsky.graph.list/abc",
    name: "Test List",
  };

  it("should add the membership after the API call succeeds", async () => {
    const mockApi = {
      createListItemRecord: async () => ({ uri: "listitem-real-uri" }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.addProfileToList(testProfile, testList);

    assert.deepEqual(
      dataStore.$listItemUris.get(testList.uri).get(testProfile.did),
      "listitem-real-uri",
    );
  });

  it("should leave the lists-with-membership query untouched when it is not loaded", async () => {
    const mockApi = {
      createListItemRecord: async () => ({ uri: "listitem-real-uri" }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await mutations.addProfileToList(testProfile, testList);

    assert.deepEqual(
      queryStore.getItems(
        listsWithMembershipQueryKey({ did: testProfile.did }),
      ),
      null,
    );
  });

  it("should prepend the profile to a cached list-members entry when present", async () => {
    const mockApi = {
      createListItemRecord: async () => ({ uri: "listitem-real-uri" }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(listMembersQueryKey({ listUri: testList.uri }), {
      pages: [{ items: ["did:test:other"], cursor: null }],
    });
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await mutations.addProfileToList(testProfile, testList);

    assert.deepEqual(
      queryStore.getItems(listMembersQueryKey({ listUri: testList.uri })),
      [testProfile.did, "did:test:other"],
    );
    assert.deepEqual(
      dataStore.$listItemUris.get(testList.uri).get(testProfile.did),
      "listitem-real-uri",
    );
  });

  it("should not touch state when the API call fails", async () => {
    const mockApi = {
      createListItemRecord: async () => {
        throw new Error("nope");
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let caught = null;
    try {
      await mutations.addProfileToList(testProfile, testList);
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught.message, "nope");
    assert.deepEqual(dataStore.$listItemUris.get(testList.uri) ?? null, null);
  });
});

describe("removeProfileFromList", () => {
  const testProfile = {
    did: "did:test:profile",
    handle: "test.user",
  };
  const testList = {
    uri: "at://did:test:owner/app.bsky.graph.list/abc",
    name: "Test List",
  };
  const membershipUri = "at://did:test:viewer/app.bsky.graph.listitem/xyz";

  it("should remove the membership after the API call succeeds", async () => {
    const mockApi = {
      deleteListItemRecord: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    dataStore.setListItemUri(testList.uri, testProfile.did, membershipUri);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeProfileFromList(testProfile, testList, membershipUri);

    assert.deepEqual(
      dataStore.$listItemUris.get(testList.uri).has(testProfile.did),
      false,
    );
  });

  it("should leave the membership map untouched when nothing is cached for the list", async () => {
    const mockApi = {
      deleteListItemRecord: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    await mutations.removeProfileFromList(testProfile, testList, membershipUri);

    assert.deepEqual(dataStore.$listItemUris.get(testList.uri) ?? null, null);
  });

  it("should remove the profile from a cached list-members entry", async () => {
    const mockApi = {
      deleteListItemRecord: async () => {},
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(listMembersQueryKey({ listUri: testList.uri }), {
      pages: [{ items: [testProfile.did, "did:test:other"], cursor: null }],
    });
    dataStore.setListItemUris(testList.uri, [
      { uri: membershipUri, subject: { did: testProfile.did } },
      { uri: "listitem-other-uri", subject: { did: "did:test:other" } },
    ]);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
      queryStore,
    );

    await mutations.removeProfileFromList(testProfile, testList, membershipUri);

    assert.deepEqual(
      mutations.queryStore.getItems(
        listMembersQueryKey({ listUri: testList.uri }),
      ),
      ["did:test:other"],
    );
    assert.deepEqual(
      dataStore.$listItemUris.get(testList.uri).has(testProfile.did),
      false,
    );
  });

  it("should leave state unchanged when the API call fails", async () => {
    const mockApi = {
      deleteListItemRecord: async () => {
        throw new Error("boom");
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    dataStore.setListItemUri(testList.uri, testProfile.did, membershipUri);
    const patchStore = new PatchStore(dataStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      mockPreferencesProvider,
    );

    let caught = null;
    try {
      await mutations.removeProfileFromList(
        testProfile,
        testList,
        membershipUri,
      );
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught.message, "boom");
    assert.deepEqual(
      dataStore.$listItemUris.get(testList.uri).get(testProfile.did),
      membershipUri,
    );
  });
});

describe("$detailedProfiles mirroring", () => {
  const targetDid = "did:plc:target";
  const baseProfile = {
    did: targetDid,
    handle: "target.bsky.social",
    followersCount: 10,
    viewer: {},
  };
  // Detailed shape — superset, with fields that the basic profile won't carry.
  const detailedSeed = {
    ...baseProfile,
    description: "Detailed bio",
    pinnedPost: { uri: "at://pinned" },
  };

  function setup(mockApi, { seedDetailed = true } = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const preferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(targetDid, baseProfile);
    if (seedDetailed) {
      dataStore.$detailedProfiles.set(targetDid, detailedSeed);
    }
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      preferencesProvider,
    );
    return { mutations, dataStore };
  }

  it("updateProfile patches both $profiles and $detailedProfiles in place", async () => {
    const mockApi = {
      getProfileRecord: async () => ({ value: {}, cid: "cid" }),
      putProfileRecord: async () => ({}),
    };
    const { mutations, dataStore } = setup(mockApi);
    await mutations.updateProfile(baseProfile, {
      displayName: "Updated Name",
      description: "Updated bio",
    });
    const patchedBasic = dataStore.$profiles.get(targetDid);
    assert.deepEqual(patchedBasic.displayName, "Updated Name");
    assert.deepEqual(patchedBasic.description, "Updated bio");
    assert.deepEqual(patchedBasic.followersCount, 10);
    // Detailed-only fields survive on the detailed entry.
    const patchedDetailed = dataStore.$detailedProfiles.get(targetDid);
    assert.deepEqual(patchedDetailed.displayName, "Updated Name");
    assert.deepEqual(patchedDetailed.description, "Updated bio");
    assert.deepEqual(patchedDetailed.pinnedPost.uri, "at://pinned");
  });

  it("followProfile mirrors viewer.following and count into $detailedProfiles", async () => {
    const mockApi = {
      createFollowRecord: async () => ({ uri: "at://follow" }),
    };
    const { mutations, dataStore } = setup(mockApi);
    await mutations.followProfile(baseProfile);
    const detailed = dataStore.$detailedProfiles.get(targetDid);
    assert.deepEqual(detailed.viewer.following, "at://follow");
    assert.deepEqual(detailed.followersCount, 11);
    // Preserves detailed-only fields like description/pinnedPost.
    assert.deepEqual(detailed.description, "Detailed bio");
    assert.deepEqual(detailed.pinnedPost.uri, "at://pinned");
  });

  it("followProfile does not seed $detailedProfiles when no entry exists", async () => {
    const mockApi = {
      createFollowRecord: async () => ({ uri: "at://follow" }),
    };
    const { mutations, dataStore } = setup(mockApi, { seedDetailed: false });
    await mutations.followProfile(baseProfile);
    assert.deepEqual(dataStore.$detailedProfiles.get(targetDid), null);
  });

  it("unfollowProfile mirrors viewer.following=null and decremented count", async () => {
    const seedFollowed = { ...detailedSeed, viewer: { following: "at://x" } };
    const mockApi = { deleteFollowRecord: async () => {} };
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const preferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(targetDid, {
      ...baseProfile,
      viewer: { following: "at://x" },
    });
    dataStore.$detailedProfiles.set(targetDid, seedFollowed);
    const mutations = makeMutations(
      mockApi,
      dataStore,
      patchStore,
      preferencesProvider,
    );
    await mutations.unfollowProfile({
      ...baseProfile,
      viewer: { following: "at://x" },
    });
    const detailed = dataStore.$detailedProfiles.get(targetDid);
    assert.deepEqual(detailed.viewer.following, null);
    assert.deepEqual(detailed.followersCount, 9);
    assert.deepEqual(detailed.pinnedPost.uri, "at://pinned");
  });

  it("muteProfile mirrors viewer.muted=true into $detailedProfiles", async () => {
    const { mutations, dataStore } = setup({ muteActor: async () => ({}) });
    await mutations.muteProfile(baseProfile);
    assert.deepEqual(
      dataStore.$detailedProfiles.get(targetDid).viewer.muted,
      true,
    );
  });

  it("unmuteProfile mirrors viewer.muted=false into $detailedProfiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const preferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(targetDid, {
      ...baseProfile,
      viewer: { muted: true },
    });
    dataStore.$detailedProfiles.set(targetDid, {
      ...detailedSeed,
      viewer: { muted: true },
    });
    const mutations = makeMutations(
      { unmuteActor: async () => ({}) },
      dataStore,
      patchStore,
      preferencesProvider,
    );
    await mutations.unmuteProfile({
      ...baseProfile,
      viewer: { muted: true },
    });
    assert.deepEqual(
      dataStore.$detailedProfiles.get(targetDid).viewer.muted,
      false,
    );
  });

  it("blockProfile mirrors viewer.blocking into $detailedProfiles", async () => {
    const { mutations, dataStore } = setup({
      blockActor: async () => ({ uri: "at://block" }),
    });
    await mutations.blockProfile(baseProfile);
    assert.deepEqual(
      dataStore.$detailedProfiles.get(targetDid).viewer.blocking,
      "at://block",
    );
  });

  it("unblockProfile mirrors viewer.blocking=null into $detailedProfiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const preferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$profiles.set(targetDid, {
      ...baseProfile,
      viewer: { blocking: "at://block" },
    });
    dataStore.$detailedProfiles.set(targetDid, {
      ...detailedSeed,
      viewer: { blocking: "at://block" },
    });
    const mutations = makeMutations(
      { unblockActor: async () => {} },
      dataStore,
      patchStore,
      preferencesProvider,
    );
    await mutations.unblockProfile({
      ...baseProfile,
      viewer: { blocking: "at://block" },
    });
    assert.deepEqual(
      dataStore.$detailedProfiles.get(targetDid).viewer.blocking,
      null,
    );
  });

  it("updatePostNotificationSubscription mirrors viewer.activitySubscription", async () => {
    const subscription = { post: true, reply: false };
    const { mutations, dataStore } = setup({
      putActivitySubscription: async () => ({}),
    });
    await mutations.updatePostNotificationSubscription(
      baseProfile,
      subscription,
    );
    assert.deepEqual(
      dataStore.$detailedProfiles.get(targetDid).viewer.activitySubscription,
      subscription,
    );
  });
});

describe("updateList", () => {
  const listUri = "at://did:plc:test123/app.bsky.graph.list/mylist";
  const testList = {
    uri: listUri,
    cid: "listcid",
    name: "Old Name",
    description: "Old description",
    purpose: "app.bsky.graph.defs#curatelist",
    creator: { did: "did:plc:test123", handle: "test.bsky.social" },
    viewer: {},
  };

  function setup(overrides = {}) {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    const preferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    dataStore.$lists.set(listUri, testList);
    const api = {
      getListRecord: async () => ({
        value: {
          purpose: "app.bsky.graph.defs#curatelist",
          name: "Old Name",
          description: "Old description",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        cid: "listcid",
      }),
      putListRecord: async () => ({}),
      uploadBlob: async () => ({
        ref: { $link: "list-avatar-blob" },
        mimeType: "image/jpeg",
        size: 100,
      }),
      ...overrides,
    };
    return {
      api,
      dataStore,
      mutations: makeMutations(api, dataStore, patchStore, preferencesProvider),
    };
  }

  it("puts the record with merged fields and the swapCid from getListRecord", async () => {
    let putArgs = null;
    const { mutations } = setup({
      putListRecord: async (rkey, record, swapCid) => {
        putArgs = { rkey, record, swapCid };
        return {};
      },
    });

    await mutations.updateList(testList, {
      name: "New Name",
      description: "New description",
    });

    assert.equal(putArgs.rkey, "mylist");
    assert.equal(putArgs.record.name, "New Name");
    assert.equal(putArgs.record.description, "New description");
    assert.equal(putArgs.record.purpose, "app.bsky.graph.defs#curatelist");
    assert.equal(putArgs.record.createdAt, "2024-01-01T00:00:00.000Z");
    assert.equal(putArgs.swapCid, "listcid");
  });

  it("uploads and sets the avatar blob when provided", async () => {
    let uploadCalled = false;
    let putRecord = null;
    const { mutations } = setup({
      uploadBlob: async () => {
        uploadCalled = true;
        return {
          ref: { $link: "avatar-blob" },
          mimeType: "image/jpeg",
          size: 100,
        };
      },
      putListRecord: async (rkey, record) => {
        putRecord = record;
        return {};
      },
    });

    await mutations.updateList(testList, {
      name: "Name",
      description: "Desc",
      avatarBlob: new Blob(["x"], { type: "image/jpeg" }),
    });

    assert.equal(uploadCalled, true);
    assert.deepEqual(putRecord.avatar, {
      ref: { $link: "avatar-blob" },
      mimeType: "image/jpeg",
      size: 100,
    });
  });

  it("strips stale descriptionFacets from the put record when description changes", async () => {
    let putRecord = null;
    const { mutations } = setup({
      getListRecord: async () => ({
        value: {
          purpose: "app.bsky.graph.defs#curatelist",
          name: "Old Name",
          description: "Old description",
          descriptionFacets: [
            { index: { byteStart: 0, byteEnd: 3 }, features: [] },
          ],
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        cid: "listcid",
      }),
      putListRecord: async (rkey, record) => {
        putRecord = record;
        return {};
      },
    });

    await mutations.updateList(testList, {
      name: "Old Name",
      description: "Totally different text",
    });

    assert.equal("descriptionFacets" in putRecord, false);
  });

  it("clears local descriptionFacets when description changes", async () => {
    const { mutations, dataStore } = setup();
    dataStore.$lists.set(listUri, {
      ...testList,
      descriptionFacets: [
        { index: { byteStart: 0, byteEnd: 3 }, features: [] },
      ],
    });

    await mutations.updateList(testList, {
      name: "Old Name",
      description: "Totally different text",
    });

    assert.deepEqual(dataStore.$lists.get(listUri).descriptionFacets, []);
  });

  it("deletes the avatar from the record when removeAvatar is true", async () => {
    let putRecord = null;
    const { mutations } = setup({
      getListRecord: async () => ({
        value: {
          purpose: "app.bsky.graph.defs#curatelist",
          name: "Old Name",
          description: "Old description",
          avatar: { ref: { $link: "existing-avatar" } },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        cid: "listcid",
      }),
      putListRecord: async (rkey, record) => {
        putRecord = record;
        return {};
      },
    });

    await mutations.updateList(testList, {
      name: "Name",
      description: "Desc",
      removeAvatar: true,
    });

    assert.equal("avatar" in putRecord, false);
  });

  it("patches dataStore.$lists in place with the new name and description", async () => {
    // The appview lags briefly after putRecord, so we patch locally rather
    // than round-tripping through getList (which can return stale data).
    const { mutations, dataStore } = setup();

    await mutations.updateList(testList, {
      name: "Patched Name",
      description: "Patched description",
    });

    const updated = dataStore.$lists.get(listUri);
    assert.equal(updated.name, "Patched Name");
    assert.equal(updated.description, "Patched description");
    // Non-patched fields survive.
    assert.equal(updated.uri, listUri);
    assert.equal(updated.purpose, "app.bsky.graph.defs#curatelist");
  });

  it("sets the local avatar to a CDN URL built from the uploaded blob ref", async () => {
    const { mutations, dataStore } = setup({
      uploadBlob: async () => ({
        ref: { $link: "bafkreiavatarcid" },
        mimeType: "image/jpeg",
        size: 100,
      }),
    });

    await mutations.updateList(testList, {
      name: "Name",
      description: "Desc",
      avatarBlob: new Blob(["x"], { type: "image/jpeg" }),
    });

    assert.equal(
      dataStore.$lists.get(listUri).avatar,
      `${CDN_URL}/img/avatar/plain/did:plc:test123/bafkreiavatarcid@jpeg`,
    );
  });

  it("clears the local avatar when removeAvatar is true", async () => {
    const { mutations, dataStore } = setup();
    dataStore.$lists.set(listUri, {
      ...testList,
      avatar: "https://example.com/list-avatar.jpg",
    });

    await mutations.updateList(testList, {
      name: "Name",
      description: "Desc",
      removeAvatar: true,
    });

    assert.equal(dataStore.$lists.get(listUri).avatar, "");
  });
});

describe("deleteList", () => {
  const listUri = "at://did:plc:test123/app.bsky.graph.list/mylist";
  const otherListUri = "at://did:plc:test123/app.bsky.graph.list/other";
  const testList = {
    uri: listUri,
    cid: "listcid",
    name: "My List",
    purpose: "app.bsky.graph.defs#curatelist",
    creator: { did: "did:plc:test123", handle: "test.bsky.social" },
    viewer: {},
  };

  function setup({ listItems = [], overrides = {} } = {}) {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const patchStore = new PatchStore(dataStore);
    const preferences = Preferences.createLoggedOutPreferences();
    const preferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async () => {},
    };
    dataStore.$lists.set(listUri, testList);
    const api = {
      getListItems: async () => ({ records: listItems, cursor: "" }),
      applyWrites: async () => ({}),
      ...overrides,
    };
    return {
      api,
      dataStore,
      preferencesProvider,
      mutations: makeMutations(
        api,
        dataStore,
        patchStore,
        preferencesProvider,
        queryStore,
      ),
    };
  }

  it("deletes the list record via applyWrites and clears the local list", async () => {
    const writesCalls = [];
    const { mutations, dataStore } = setup({
      overrides: {
        applyWrites: async (writes) => {
          writesCalls.push(writes);
          return {};
        },
      },
    });

    await mutations.deleteList(testList);

    assert.equal(writesCalls.length, 1);
    assert.deepEqual(writesCalls[0], [
      {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.graph.list",
        rkey: "mylist",
      },
    ]);
    assert.equal(dataStore.$lists.get(listUri), null);
  });

  it("also deletes listitems belonging to this list, ignoring items in other lists", async () => {
    const writesCalls = [];
    const listItems = [
      {
        uri: "at://did:plc:test123/app.bsky.graph.listitem/keep",
        value: { list: otherListUri },
      },
      {
        uri: "at://did:plc:test123/app.bsky.graph.listitem/item1",
        value: { list: listUri },
      },
      {
        uri: "at://did:plc:test123/app.bsky.graph.listitem/item2",
        value: { list: listUri },
      },
    ];
    const { mutations } = setup({
      listItems,
      overrides: {
        applyWrites: async (writes) => {
          writesCalls.push(writes);
          return {};
        },
      },
    });

    await mutations.deleteList(testList);

    const flat = writesCalls.flat();
    const deletedRkeys = flat
      .filter((w) => w.collection === "app.bsky.graph.listitem")
      .map((w) => w.rkey);
    assert.deepEqual(deletedRkeys.sort(), ["item1", "item2"]);
    assert.equal(
      flat.filter((w) => w.collection === "app.bsky.graph.list").length,
      1,
    );
  });

  it("chunks applyWrites into batches of 10", async () => {
    const listItems = Array.from({ length: 25 }, (_, i) => ({
      uri: `at://did:plc:test123/app.bsky.graph.listitem/item${i}`,
      value: { list: listUri },
    }));
    const writesCalls = [];
    const { mutations } = setup({
      listItems,
      overrides: {
        applyWrites: async (writes) => {
          writesCalls.push(writes);
          return {};
        },
      },
    });

    await mutations.deleteList(testList);

    // 25 items + 1 list record = 26 writes → 10, 10, 6
    assert.deepEqual(
      writesCalls.map((c) => c.length),
      [10, 10, 6],
    );
  });

  it("clears cached list members for the deleted list", async () => {
    const { mutations, dataStore } = setup();
    mutations.queryStore.set(listMembersQueryKey({ listUri }), {
      pages: [{ items: ["did:plc:m1"], cursor: null }],
    });
    dataStore.setListItemUris(listUri, [
      { uri: "at://x", subject: { did: "did:plc:m1" } },
    ]);

    await mutations.deleteList(testList);

    assert.equal(
      mutations.queryStore.getItems(listMembersQueryKey({ listUri })),
      null,
    );
    assert.equal(dataStore.$listItemUris.get(listUri), null);
  });

  it("removes the list from the creator's actor lists query", async () => {
    const { mutations } = setup();
    const queryKey = actorListsQueryKey({ did: testList.creator.did });
    mutations.queryStore.set(queryKey, {
      pages: [{ items: [listUri, otherListUri], cursor: null }],
    });

    await mutations.deleteList(testList);

    assert.deepEqual(mutations.queryStore.getItems(queryKey), [otherListUri]);
  });

  it("removes the list from every loaded lists-with-membership query", async () => {
    const { mutations } = setup();
    const memberKey = listsWithMembershipQueryKey({ did: "did:plc:member1" });
    const untouchedKey = listsWithMembershipQueryKey({
      did: "did:plc:untouched",
    });
    mutations.queryStore.set(memberKey, {
      pages: [{ items: [listUri, otherListUri], cursor: null }],
    });
    mutations.queryStore.set(untouchedKey, {
      pages: [{ items: [otherListUri], cursor: null }],
    });

    await mutations.deleteList(testList);

    assert.deepEqual(mutations.queryStore.getItems(memberKey), [otherListUri]);
    // Unrelated entries are untouched.
    assert.deepEqual(mutations.queryStore.getItems(untouchedKey), [
      otherListUri,
    ]);
  });

  it("removes the list from $pinnedItems if present", async () => {
    const { mutations, dataStore } = setup();
    seedPinnedItems(mutations.queryStore, [
      { type: "timeline", data: { uri: "following" } },
      { type: "list", data: { uri: listUri, displayName: "My List" } },
      { type: "list", data: { uri: otherListUri, displayName: "Other" } },
    ]);

    await mutations.deleteList(testList);

    assert.deepEqual(
      mutations.queryStore
        .getItems(pinnedItemsQueryKey())
        .map((item) => item.data.uri),
      ["following", otherListUri],
    );
  });

  it("unpins the list if it was pinned", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const patchStore = new PatchStore(dataStore);
    let preferences = Preferences.createLoggedOutPreferences().pinFeed(
      listUri,
      "list",
    );
    const updateCalls = [];
    const preferencesProvider = {
      requirePreferences: () => preferences,
      updatePreferences: async (next) => {
        updateCalls.push(next);
        preferences = next;
      },
    };
    dataStore.$lists.set(listUri, testList);
    const api = {
      getListItems: async () => ({ records: [], cursor: "" }),
      applyWrites: async () => ({}),
    };
    const mutations = makeMutations(
      api,
      dataStore,
      patchStore,
      preferencesProvider,
    );

    assert.equal(preferences.isFeedPinned(listUri), true);
    await mutations.deleteList(testList);

    assert.equal(updateCalls.length, 1);
    assert.equal(preferences.isFeedPinned(listUri), false);
  });
});

describe("setSelectedFeedUri", () => {
  it("should set the selection", () => {
    const dataStore = new DataStore(createSessionState(null));
    const mutations = makeMutations({}, dataStore, new PatchStore(), {});
    mutations.setSelectedFeedUri("following");
    assert.deepEqual(dataStore.$selectedFeedUri.get(), "following");
    mutations.setSelectedFeedUri(null);
    assert.deepEqual(dataStore.$selectedFeedUri.get(), null);
  });
});
