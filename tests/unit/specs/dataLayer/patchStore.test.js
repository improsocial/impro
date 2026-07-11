import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PatchStore } from "/js/dataLayer/patchStore.js";

// applyPostPatches now requires the patches array explicitly. This helper
// fetches the current patches for a post URI and applies them.
function applyPostPatches(patchStore, post) {
  const patches = patchStore.$postPatches.get(post.uri) || [];
  return patchStore.applyPostPatches(post, patches);
}

describe("Post Patches - Patch Management", () => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    viewer: { like: null },
  };

  it("should add a post patch and return a patch ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addPostPatch(postURI, { type: "addLike" });
    assert.deepEqual(typeof patchId, "number");
    assert(patchId >= 0);
  });

  it("should generate unique patch IDs", () => {
    const patchStore = new PatchStore();
    const id1 = patchStore.addPostPatch(postURI, { type: "addLike" });
    const id2 = patchStore.addPostPatch(postURI, { type: "removeLike" });
    assert(id1 !== id2);
  });

  it("should remove a post patch by ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addPostPatch(postURI, { type: "addLike" });

    // Verify patch exists
    const patchedPost = applyPostPatches(patchStore, basePost);
    assert.deepEqual(patchedPost.viewer.like, "fake like");

    // Remove patch
    patchStore.removePostPatch(postURI, patchId);

    // Verify patch is removed
    const unpatchedPost = applyPostPatches(patchStore, basePost);
    assert.deepEqual(unpatchedPost.viewer.like, null);
  });

  it("should handle removing non-existent patch ID gracefully", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "addLike" });
    let errorThrown = false;
    try {
      patchStore.removePostPatch(postURI, 999);
    } catch (e) {
      errorThrown = true;
    }
    assert.deepEqual(errorThrown, false);
  });
});

describe("Post Patches - Like Patches", () => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    viewer: { like: null },
  };

  it("should apply addLike patch correctly", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "addLike" });
    const result = applyPostPatches(patchStore, basePost);

    assert.deepEqual(result.viewer.like, "fake like");
    assert.deepEqual(result.likeCount, 6);
    assert.deepEqual(result.uri, postURI);
  });

  it("should apply removeLike patch correctly", () => {
    const patchStore = new PatchStore();
    const likedPost = {
      ...basePost,
      likeCount: 6,
      viewer: { like: "some-like-uri" },
    };

    patchStore.addPostPatch(postURI, { type: "removeLike" });
    const result = applyPostPatches(patchStore, likedPost);

    assert.deepEqual(result.viewer.like, null);
    assert.deepEqual(result.likeCount, 5);
  });

  it("should apply multiple patches in order", () => {
    const patchStore = new PatchStore();
    // Add like, then remove like
    patchStore.addPostPatch(postURI, { type: "addLike" });
    patchStore.addPostPatch(postURI, { type: "removeLike" });

    const result = applyPostPatches(patchStore, basePost);

    assert.deepEqual(result.viewer.like, null);
    assert.deepEqual(result.likeCount, 5); // +1 -1 = 0, so 5 + 0 = 5
  });

  it("should preserve original post when no patches exist", () => {
    const patchStore = new PatchStore();
    const result = applyPostPatches(patchStore, basePost);
    assert.deepEqual(result, basePost);
    assert(result !== basePost); // Should be a copy
  });
});

describe("Post Patches - Error Handling", () => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    viewer: { like: null },
  };

  it("should throw error for unknown patch type", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "unknownPatch" });

    let errorThrown = false;
    let errorMessage = "";
    try {
      applyPostPatches(patchStore, basePost);
    } catch (e) {
      errorThrown = true;
      errorMessage = e.message;
    }
    assert.deepEqual(errorThrown, true);
    assert(errorMessage.includes("Unknown patch type"));
  });
});

describe("Profile Patches - Patch Management", () => {
  const profileDID = "did:test:profile";
  const baseProfile = {
    did: profileDID,
    viewer: { following: null },
  };

  it("should add a profile patch and return a patch ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addProfilePatch(profileDID, {
      type: "followProfile",
    });
    assert.deepEqual(typeof patchId, "number");
    assert(patchId >= 0);
  });

  it("should remove a profile patch by ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addProfilePatch(profileDID, {
      type: "followProfile",
    });

    // Verify patch exists
    const patchedProfile = patchStore.applyProfilePatches(baseProfile);
    assert.deepEqual(patchedProfile.viewer.following, "fake following");

    // Remove patch
    patchStore.removeProfilePatch(profileDID, patchId);

    // Verify patch is removed
    const unpatchedProfile = patchStore.applyProfilePatches(baseProfile);
    assert.deepEqual(unpatchedProfile.viewer.following, null);
  });
});

describe("Profile Patches - Follow Patches", () => {
  const profileDID = "did:test:profile";
  const baseProfile = {
    did: profileDID,
    viewer: { following: null },
  };

  it("should apply followProfile patch correctly", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    const result = patchStore.applyProfilePatches(baseProfile);

    assert.deepEqual(result.viewer.following, "fake following");
    assert.deepEqual(result.did, profileDID);
  });

  it("should apply unfollowProfile patch correctly", () => {
    const patchStore = new PatchStore();
    const followedProfile = {
      ...baseProfile,
      viewer: { following: "some-follow-uri" },
    };

    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });
    const result = patchStore.applyProfilePatches(followedProfile);

    assert.deepEqual(result.viewer.following, null);
  });

  it("should apply multiple profile patches in order", () => {
    const patchStore = new PatchStore();
    // Follow, then unfollow
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });

    const result = patchStore.applyProfilePatches(baseProfile);
    assert.deepEqual(result.viewer.following, null);
  });
});

describe("Profile Patches - Error Handling", () => {
  const profileDID = "did:test:profile";
  const baseProfile = {
    did: profileDID,
    viewer: { following: null },
  };

  it("should throw error for unknown profile patch type", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "unknownPatch" });

    let errorThrown = false;
    let errorMessage = "";
    try {
      patchStore.applyProfilePatches(baseProfile);
    } catch (e) {
      errorThrown = true;
      errorMessage = e.message;
    }
    assert.deepEqual(errorThrown, true);
    assert(errorMessage.includes("Unknown patch type"));
  });
});

describe("UUID Generation", () => {
  it("should generate sequential IDs", () => {
    const patchStore = new PatchStore();
    const id1 = patchStore.addPostPatch("post1", { type: "addLike" });
    const id2 = patchStore.addPostPatch("post2", { type: "addLike" });
    const id3 = patchStore.addProfilePatch("profile1", {
      type: "followProfile",
    });

    assert.deepEqual(id2, id1 + 1);
    assert.deepEqual(id3, id2 + 1);
  });
});

describe("Patch Isolation", () => {
  it("should isolate patches between different posts", () => {
    const patchStore = new PatchStore();
    const post1URI = "post1";
    const post2URI = "post2";
    const basePost1 = { uri: post1URI, likeCount: 5, viewer: { like: null } };
    const basePost2 = { uri: post2URI, likeCount: 10, viewer: { like: null } };

    patchStore.addPostPatch(post1URI, { type: "addLike" });

    const result1 = applyPostPatches(patchStore, basePost1);
    const result2 = applyPostPatches(patchStore, basePost2);

    assert.deepEqual(result1.likeCount, 6);
    assert.deepEqual(result2.likeCount, 10); // Unchanged
  });

  it("should isolate patches between different profiles", () => {
    const patchStore = new PatchStore();
    const profile1URI = "profile1";
    const profile2URI = "profile2";
    const baseProfile1 = { did: profile1URI, viewer: { following: null } };
    const baseProfile2 = { did: profile2URI, viewer: { following: null } };

    patchStore.addProfilePatch(profile1URI, { type: "followProfile" });

    const result1 = patchStore.applyProfilePatches(baseProfile1);
    const result2 = patchStore.applyProfilePatches(baseProfile2);

    assert.deepEqual(result1.viewer.following, "fake following");
    assert.deepEqual(result2.viewer.following, null); // Unchanged
  });
});

describe("Preference Patches - Labeler Patches", () => {
  it("should apply subscribeLabeler patch correctly", () => {
    const patchStore = new PatchStore();
    const labelerDid = "did:plc:testlabeler";
    const labelerInfo = {
      creator: { did: labelerDid },
      policies: { labelValueDefinitions: [] },
    };

    // Create a mock preferences object with subscribeLabeler method
    const mockPreferences = {
      clone: () => mockPreferences,
      subscribeLabeler: (did, info) => ({
        ...mockPreferences,
        _subscribedLabeler: did,
        _labelerInfo: info,
      }),
    };

    patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: labelerDid,
      labelerInfo,
    });
    const result = patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(result._subscribedLabeler, labelerDid);
    assert.deepEqual(result._labelerInfo, labelerInfo);
  });

  it("should apply unsubscribeLabeler patch correctly", () => {
    const patchStore = new PatchStore();
    const labelerDid = "did:plc:testlabeler";

    // Create a mock preferences object with unsubscribeLabeler method
    const mockPreferences = {
      clone: () => mockPreferences,
      unsubscribeLabeler: (did) => ({
        ...mockPreferences,
        _unsubscribedLabeler: did,
      }),
    };

    patchStore.addPreferencePatch({
      type: "unsubscribeLabeler",
      did: labelerDid,
    });
    const result = patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(result._unsubscribedLabeler, labelerDid);
  });

  it("should apply multiple labeler patches in order", () => {
    const patchStore = new PatchStore();
    const labelerDid1 = "did:plc:labeler1";
    const labelerDid2 = "did:plc:labeler2";
    const labelerInfo1 = {
      creator: { did: labelerDid1 },
      policies: { labelValueDefinitions: [] },
    };
    const labelerInfo2 = {
      creator: { did: labelerDid2 },
      policies: { labelValueDefinitions: [] },
    };

    // Track calls in order
    const calls = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      subscribeLabeler: (did, info) => {
        calls.push({ type: "subscribe", did, info });
        return mockPreferences;
      },
      unsubscribeLabeler: (did) => {
        calls.push({ type: "unsubscribe", did });
        return mockPreferences;
      },
    };

    patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: labelerDid1,
      labelerInfo: labelerInfo1,
    });
    patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: labelerDid2,
      labelerInfo: labelerInfo2,
    });
    patchStore.addPreferencePatch({
      type: "unsubscribeLabeler",
      did: labelerDid1,
    });

    patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(calls.length, 3);
    assert.deepEqual(calls[0].type, "subscribe");
    assert.deepEqual(calls[0].did, labelerDid1);
    assert.deepEqual(calls[1].type, "subscribe");
    assert.deepEqual(calls[1].did, labelerDid2);
    assert.deepEqual(calls[2], { type: "unsubscribe", did: labelerDid1 });
  });
});

describe("Preference Patches - Pin Feed Patches", () => {
  it("should forward entryType to preferences.pinFeed", () => {
    const patchStore = new PatchStore();
    const calls = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      pinFeed: (feedUri, type) => {
        calls.push({ feedUri, type });
        return mockPreferences;
      },
    };

    patchStore.addPreferencePatch({
      type: "pinFeed",
      feedUri: "at://did:test/app.bsky.graph.list/abc",
      entryType: "list",
    });
    patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(calls.length, 1);
    assert.deepEqual(calls[0].feedUri, "at://did:test/app.bsky.graph.list/abc");
    assert.deepEqual(calls[0].type, "list");
  });

  it("should pass entryType undefined when patch omits it (default 'feed' applies)", () => {
    const patchStore = new PatchStore();
    const calls = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      pinFeed: (feedUri, type) => {
        calls.push({ feedUri, type });
        return mockPreferences;
      },
    };

    patchStore.addPreferencePatch({
      type: "pinFeed",
      feedUri: "at://did:test/app.bsky.feed.generator/xyz",
    });
    patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(calls.length, 1);
    assert.deepEqual(calls[0].type, undefined);
  });
});

describe("Preference Patches - Patch Management", () => {
  it("should add and remove preference patches", () => {
    const patchStore = new PatchStore();

    const patchId1 = patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: "did:test1",
    });
    const patchId2 = patchStore.addPreferencePatch({
      type: "unsubscribeLabeler",
      did: "did:test2",
    });

    assert.deepEqual(patchStore.$preferencePatches.get().length, 2);

    patchStore.removePreferencePatch(patchId1);
    assert.deepEqual(patchStore.$preferencePatches.get().length, 1);
    assert.deepEqual(
      patchStore.$preferencePatches.get()[0].body.type,
      "unsubscribeLabeler",
    );

    patchStore.removePreferencePatch(patchId2);
    assert.deepEqual(patchStore.$preferencePatches.get().length, 0);
  });

  it("should generate unique IDs for preference patches", () => {
    const patchStore = new PatchStore();

    const id1 = patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: "did:test1",
    });
    const id2 = patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: "did:test2",
    });

    assert(id1 !== id2);
  });
});

describe("Preference Patches - Content Label Patches", () => {
  it("should apply setContentLabelPref patch correctly", () => {
    const patchStore = new PatchStore();
    const labelerDid = "did:plc:testlabeler";
    const label = "nsfw";
    const visibility = "warn";

    // Create a mock preferences object with setContentLabelPref method
    const mockPreferences = {
      clone: () => mockPreferences,
      setContentLabelPref: (params) => ({
        ...mockPreferences,
        _contentLabelPref: params,
      }),
    };

    patchStore.addPreferencePatch({
      type: "setContentLabelPref",
      label,
      visibility,
      labelerDid,
    });
    const result = patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(result._contentLabelPref.label, label);
    assert.deepEqual(result._contentLabelPref.visibility, visibility);
    assert.deepEqual(result._contentLabelPref.labelerDid, labelerDid);
  });

  it("should apply multiple content label patches in order", () => {
    const patchStore = new PatchStore();
    const labelerDid = "did:plc:testlabeler";

    // Track calls in order
    const calls = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      setContentLabelPref: (params) => {
        calls.push(params);
        return mockPreferences;
      },
    };

    patchStore.addPreferencePatch({
      type: "setContentLabelPref",
      label: "nsfw",
      visibility: "warn",
      labelerDid,
    });
    patchStore.addPreferencePatch({
      type: "setContentLabelPref",
      label: "gore",
      visibility: "hide",
      labelerDid,
    });

    patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(calls.length, 2);
    assert.deepEqual(calls[0].label, "nsfw");
    assert.deepEqual(calls[0].visibility, "warn");
    assert.deepEqual(calls[1].label, "gore");
    assert.deepEqual(calls[1].visibility, "hide");
  });

  it("should mix content label patches with labeler patches", () => {
    const patchStore = new PatchStore();
    const labelerDid = "did:plc:testlabeler";
    const labelerInfo = {
      creator: { did: labelerDid },
      policies: { labelValueDefinitions: [] },
    };

    const calls = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      subscribeLabeler: (did, info) => {
        calls.push({ type: "subscribe", did, info });
        return mockPreferences;
      },
      setContentLabelPref: (params) => {
        calls.push({ type: "setContentLabelPref", ...params });
        return mockPreferences;
      },
    };

    patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: labelerDid,
      labelerInfo,
    });
    patchStore.addPreferencePatch({
      type: "setContentLabelPref",
      label: "nsfw",
      visibility: "warn",
      labelerDid,
    });

    patchStore.applyPreferencePatches(mockPreferences);

    assert.deepEqual(calls.length, 2);
    assert.deepEqual(calls[0].type, "subscribe");
    assert.deepEqual(calls[0].did, labelerDid);
    assert.deepEqual(calls[1].type, "setContentLabelPref");
    assert.deepEqual(calls[1].label, "nsfw");
  });
});

describe("Current User Patches", () => {
  const baseUser = { did: "did:plc:me", handle: "me.test" };

  it("should overlay pinnedPost via setPinnedPost", () => {
    const patchStore = new PatchStore();
    patchStore.addCurrentUserPatch({
      type: "setPinnedPost",
      pinnedPost: { uri: "at://x/y/1", cid: "c1" },
    });
    const patched = patchStore.applyCurrentUserPatches(baseUser);
    assert.deepEqual(patched.pinnedPost.uri, "at://x/y/1");
  });

  it("should remove pinnedPost via clearPinnedPost", () => {
    const patchStore = new PatchStore();
    patchStore.addCurrentUserPatch({ type: "clearPinnedPost" });
    const user = { ...baseUser, pinnedPost: { uri: "at://x/y/1", cid: "c1" } };
    const patched = patchStore.applyCurrentUserPatches(user);
    assert.deepEqual(patched.pinnedPost, undefined);
  });

  it("should return null user unchanged", () => {
    const patchStore = new PatchStore();
    patchStore.addCurrentUserPatch({ type: "clearPinnedPost" });
    assert.deepEqual(patchStore.applyCurrentUserPatches(null), null);
  });

  it("should drop the patch after remove", () => {
    const patchStore = new PatchStore();
    const id = patchStore.addCurrentUserPatch({
      type: "setPinnedPost",
      pinnedPost: { uri: "at://x/y/1", cid: "c1" },
    });
    patchStore.removeCurrentUserPatch(id);
    const patched = patchStore.applyCurrentUserPatches(baseUser);
    assert.deepEqual(patched.pinnedPost, undefined);
  });
});

describe("Author Feed Patches", () => {
  const feedURI = "did:plc:me-posts";
  const targetPost = {
    uri: "at://did:plc:me/app.bsky.feed.post/p1",
    cid: "c1",
  };

  it("should pin a post in the feed via pinPost", () => {
    const patchStore = new PatchStore();
    const feed = {
      feed: [{ post: { uri: "at://other" } }, { post: targetPost }],
      cursor: "x",
    };
    patchStore.addAuthorFeedPatch(feedURI, {
      type: "pinPost",
      post: targetPost,
    });
    const patched = patchStore.applyAuthorFeedPatches(feedURI, feed);
    assert.deepEqual(patched.feed[0].post.uri, targetPost.uri);
    assert.deepEqual(
      patched.feed[0].reason.$type,
      "app.bsky.feed.defs#reasonPin",
    );
    assert.deepEqual(patched.feed.length, 2);
    assert.deepEqual(patched.cursor, "x");
  });

  it("should clear the pin reason on the item via unpinPost", () => {
    const patchStore = new PatchStore();
    const feed = {
      feed: [
        {
          post: targetPost,
          reason: { $type: "app.bsky.feed.defs#reasonPin" },
        },
      ],
      cursor: "x",
    };
    patchStore.addAuthorFeedPatch(feedURI, {
      type: "unpinPost",
      post: targetPost,
    });
    const patched = patchStore.applyAuthorFeedPatches(feedURI, feed);
    assert.deepEqual(patched.feed.length, 1);
    assert.deepEqual(patched.feed[0].post.uri, targetPost.uri);
    assert.deepEqual(patched.feed[0].reason, undefined);
  });

  it("should return null feed unchanged", () => {
    const patchStore = new PatchStore();
    patchStore.addAuthorFeedPatch(feedURI, {
      type: "pinPost",
      post: targetPost,
    });
    assert.deepEqual(patchStore.applyAuthorFeedPatches(feedURI, null), null);
  });

  it("should drop the patch after remove", () => {
    const patchStore = new PatchStore();
    const id = patchStore.addAuthorFeedPatch(feedURI, {
      type: "pinPost",
      post: targetPost,
    });
    patchStore.removeAuthorFeedPatch(feedURI, id);
    const feed = { feed: [{ post: targetPost }], cursor: "" };
    const patched = patchStore.applyAuthorFeedPatches(feedURI, feed);
    assert.deepEqual(patched.feed[0].reason, undefined);
  });
});
