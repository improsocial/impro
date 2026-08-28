import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PatchStore } from "/js/dataLayer/patchStore.js";

// The appliers require the patches array explicitly. These helpers fetch the
// current patches for a key and apply them.
function applyPostPatches(patchStore, post) {
  const patches = patchStore.$postPatches.get(post.uri) || [];
  return patchStore.applyPostPatches(post, patches);
}

function applyProfilePatchesForDid(patchStore, profile) {
  const patches = patchStore.$profilePatches.get(profile.did) || [];
  return patchStore.applyProfilePatches(profile, patches);
}

function applyMessagePatchesForId(patchStore, message) {
  const patches = patchStore.$messagePatches.get(message.id) || [];
  return patchStore.applyMessagePatches(message, patches);
}

function applyConvoPatchesForId(patchStore, convo) {
  const patches = patchStore.$convoPatches.get(convo.id) || [];
  return patchStore.applyConvoPatches(convo, patches);
}

function applyPreferencePatchesAll(patchStore, preferences) {
  return patchStore.applyPreferencePatches(
    preferences,
    patchStore.$preferencePatches.get(),
  );
}

function applyCurrentUserPatchesAll(patchStore, user) {
  return patchStore.applyCurrentUserPatches(
    user,
    patchStore.$currentUserPatches.get(),
  );
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
    const patchedProfile = applyProfilePatchesForDid(patchStore, baseProfile);
    assert.deepEqual(patchedProfile.viewer.following, "fake following");

    // Remove patch
    patchStore.removeProfilePatch(profileDID, patchId);

    // Verify patch is removed
    const unpatchedProfile = applyProfilePatchesForDid(patchStore, baseProfile);
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
    const result = applyProfilePatchesForDid(patchStore, baseProfile);

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
    const result = applyProfilePatchesForDid(patchStore, followedProfile);

    assert.deepEqual(result.viewer.following, null);
  });

  it("should apply multiple profile patches in order", () => {
    const patchStore = new PatchStore();
    // Follow, then unfollow
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });

    const result = applyProfilePatchesForDid(patchStore, baseProfile);
    assert.deepEqual(result.viewer.following, null);
  });
});

describe("Profile Patches - hasPendingProfilePatch", () => {
  const profileDID = "did:test:profile";

  it("returns false when no patches exist for the profile", () => {
    const patchStore = new PatchStore();
    assert.deepEqual(
      patchStore.hasPendingProfilePatch(profileDID, "followProfile"),
      false,
    );
  });

  it("returns true when a matching patch type exists", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    assert.deepEqual(
      patchStore.hasPendingProfilePatch(profileDID, "followProfile"),
      true,
    );
  });

  it("returns false when only non-matching patch types exist", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "muteProfile" });
    assert.deepEqual(
      patchStore.hasPendingProfilePatch(profileDID, "followProfile"),
      false,
    );
  });

  it("accepts an array of types and matches any of them", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });
    assert.deepEqual(
      patchStore.hasPendingProfilePatch(profileDID, [
        "followProfile",
        "unfollowProfile",
      ]),
      true,
    );
  });

  it("isolates pending state between profiles", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    assert.deepEqual(
      patchStore.hasPendingProfilePatch("did:test:other", "followProfile"),
      false,
    );
  });

  it("returns false after the matching patch is removed", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addProfilePatch(profileDID, {
      type: "followProfile",
    });
    patchStore.removeProfilePatch(profileDID, patchId);
    assert.deepEqual(
      patchStore.hasPendingProfilePatch(profileDID, "followProfile"),
      false,
    );
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
      applyProfilePatchesForDid(patchStore, baseProfile);
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

    const result1 = applyProfilePatchesForDid(patchStore, baseProfile1);
    const result2 = applyProfilePatchesForDid(patchStore, baseProfile2);

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
    const result = applyPreferencePatchesAll(patchStore, mockPreferences);

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
    const result = applyPreferencePatchesAll(patchStore, mockPreferences);

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

    applyPreferencePatchesAll(patchStore, mockPreferences);

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
    applyPreferencePatchesAll(patchStore, mockPreferences);

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
    applyPreferencePatchesAll(patchStore, mockPreferences);

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
    const result = applyPreferencePatchesAll(patchStore, mockPreferences);

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

    applyPreferencePatchesAll(patchStore, mockPreferences);

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

    applyPreferencePatchesAll(patchStore, mockPreferences);

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
    const patched = applyCurrentUserPatchesAll(patchStore, baseUser);
    assert.deepEqual(patched.pinnedPost.uri, "at://x/y/1");
  });

  it("should remove pinnedPost via clearPinnedPost", () => {
    const patchStore = new PatchStore();
    patchStore.addCurrentUserPatch({ type: "clearPinnedPost" });
    const user = { ...baseUser, pinnedPost: { uri: "at://x/y/1", cid: "c1" } };
    const patched = applyCurrentUserPatchesAll(patchStore, user);
    assert.deepEqual(patched.pinnedPost, undefined);
  });

  it("should return null user unchanged", () => {
    const patchStore = new PatchStore();
    patchStore.addCurrentUserPatch({ type: "clearPinnedPost" });
    assert.deepEqual(applyCurrentUserPatchesAll(patchStore, null), null);
  });

  it("should drop the patch after remove", () => {
    const patchStore = new PatchStore();
    const id = patchStore.addCurrentUserPatch({
      type: "setPinnedPost",
      pinnedPost: { uri: "at://x/y/1", cid: "c1" },
    });
    patchStore.removeCurrentUserPatch(id);
    const patched = applyCurrentUserPatchesAll(patchStore, baseUser);
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

describe("Convo Patches - Patch Management", () => {
  const convoId = "convo-1";
  const baseConvo = { id: convoId, muted: false };

  it("should add a convo patch and return a patch ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addConvoPatch(convoId, {
      type: "setConvoMuted",
      muted: true,
    });
    assert.deepEqual(typeof patchId, "number");
    assert(patchId >= 0);
  });

  it("should generate unique patch IDs across convos", () => {
    const patchStore = new PatchStore();
    const id1 = patchStore.addConvoPatch(convoId, {
      type: "setConvoMuted",
      muted: true,
    });
    const id2 = patchStore.addConvoPatch("convo-2", {
      type: "setConvoMuted",
      muted: true,
    });
    assert(id1 !== id2);
  });

  it("should remove a convo patch by ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addConvoPatch(convoId, {
      type: "setConvoMuted",
      muted: true,
    });

    const patched = applyConvoPatchesForId(patchStore, baseConvo);
    assert.deepEqual(patched.muted, true);

    patchStore.removeConvoPatch(convoId, patchId);

    const unpatched = applyConvoPatchesForId(patchStore, baseConvo);
    assert.deepEqual(unpatched.muted, false);
  });

  it("should handle removing a non-existent patch ID gracefully", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: true });
    let errorThrown = false;
    try {
      patchStore.removeConvoPatch(convoId, 999);
    } catch (e) {
      errorThrown = true;
    }
    assert.deepEqual(errorThrown, false);
  });
});

describe("Convo Patches - setConvoMuted", () => {
  const convoId = "convo-1";

  it("should apply setConvoMuted(true) to a previously unmuted convo", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: true });
    const patched = applyConvoPatchesForId(patchStore, {
      id: convoId,
      muted: false,
    });
    assert.deepEqual(patched.muted, true);
    assert.deepEqual(patched.id, convoId);
  });

  it("should apply setConvoMuted(false) to a previously muted convo", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: false });
    const patched = applyConvoPatchesForId(patchStore, {
      id: convoId,
      muted: true,
    });
    assert.deepEqual(patched.muted, false);
  });

  it("should apply patches in order (last one wins)", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: true });
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: false });
    const patched = applyConvoPatchesForId(patchStore, {
      id: convoId,
      muted: false,
    });
    assert.deepEqual(patched.muted, false);
  });

  it("should preserve unrelated convo fields", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch(convoId, { type: "setConvoMuted", muted: true });
    const patched = applyConvoPatchesForId(patchStore, {
      id: convoId,
      muted: false,
      rev: "rev-1",
      unreadCount: 3,
      members: [{ did: "did:plc:a" }],
    });
    assert.deepEqual(patched.rev, "rev-1");
    assert.deepEqual(patched.unreadCount, 3);
    assert.deepEqual(patched.members, [{ did: "did:plc:a" }]);
  });

  it("should return the convo unchanged when no patches exist", () => {
    const patchStore = new PatchStore();
    const convo = { id: convoId, muted: false };
    const patched = applyConvoPatchesForId(patchStore, convo);
    assert.deepEqual(patched, convo);
  });
});

describe("Convo Patches - Error Handling", () => {
  it("should throw for an unknown convo patch type", () => {
    const patchStore = new PatchStore();
    patchStore.addConvoPatch("convo-1", { type: "unknownConvoPatch" });
    assert.throws(() =>
      applyConvoPatchesForId(patchStore, { id: "convo-1", muted: false }),
    );
  });
});

describe("Post Patches - Reposts, Bookmarks, HidePost", () => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    repostCount: 2,
    bookmarkCount: 1,
    viewer: { like: null, repost: null, bookmarked: false, isHidden: false },
  };

  it("should apply createRepost / deleteRepost patches", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "createRepost" });
    let result = applyPostPatches(patchStore, basePost);
    assert.deepEqual(result.viewer.repost, "fake repost");
    assert.deepEqual(result.repostCount, 3);

    patchStore.addPostPatch(postURI, { type: "deleteRepost" });
    result = applyPostPatches(patchStore, basePost);
    assert.deepEqual(result.viewer.repost, null);
    assert.deepEqual(result.repostCount, 2);
  });

  it("should apply addBookmark / removeBookmark patches", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "addBookmark" });
    let result = applyPostPatches(patchStore, basePost);
    assert.deepEqual(result.viewer.bookmarked, true);
    assert.deepEqual(result.bookmarkCount, 2);

    const bookmarkedPost = {
      ...basePost,
      viewer: { ...basePost.viewer, bookmarked: true },
      bookmarkCount: 2,
    };
    const patchStore2 = new PatchStore();
    patchStore2.addPostPatch(postURI, { type: "removeBookmark" });
    result = applyPostPatches(patchStore2, bookmarkedPost);
    assert.deepEqual(result.viewer.bookmarked, false);
    assert.deepEqual(result.bookmarkCount, 1);
  });

  it("should apply hidePost patch", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "hidePost" });
    const result = applyPostPatches(patchStore, basePost);
    assert.deepEqual(result.viewer.isHidden, true);
  });
});

describe("Profile Patches - Mute/Block/NotificationSubscription", () => {
  const did = "did:plc:test";
  const baseProfile = {
    did,
    followersCount: 5,
    viewer: {
      muted: false,
      blocking: null,
      following: null,
      activitySubscription: null,
    },
  };

  it("should apply muteProfile / unmuteProfile patches", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(did, { type: "muteProfile" });
    let result = applyProfilePatchesForDid(patchStore, baseProfile);
    assert.deepEqual(result.viewer.muted, true);

    const patchStore2 = new PatchStore();
    patchStore2.addProfilePatch(did, { type: "unmuteProfile" });
    result = applyProfilePatchesForDid(patchStore2, {
      ...baseProfile,
      viewer: { ...baseProfile.viewer, muted: true },
    });
    assert.deepEqual(result.viewer.muted, false);
  });

  it("should apply blockProfile / unblockProfile patches", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(did, { type: "blockProfile" });
    let result = applyProfilePatchesForDid(patchStore, baseProfile);
    assert.deepEqual(result.viewer.blocking, "fake blocking");

    const patchStore2 = new PatchStore();
    patchStore2.addProfilePatch(did, { type: "unblockProfile" });
    result = applyProfilePatchesForDid(patchStore2, {
      ...baseProfile,
      viewer: { ...baseProfile.viewer, blocking: "some-block-uri" },
    });
    assert.deepEqual(result.viewer.blocking, null);
  });

  it("should apply updatePostNotificationSubscription patch", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(did, {
      type: "updatePostNotificationSubscription",
      activitySubscription: { post: true, reply: false },
    });
    const result = applyProfilePatchesForDid(patchStore, baseProfile);
    assert.deepEqual(result.viewer.activitySubscription, {
      post: true,
      reply: false,
    });
  });
});

describe("Message Patches", () => {
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";
  const otherDid = "did:plc:other";
  const baseMessage = {
    id: messageId,
    reactions: [],
  };

  it("should add and remove a message patch by ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: { sender: { did: currentUserDid }, value: "👍" },
    });
    assert.deepEqual(typeof patchId, "number");

    let patched = applyMessagePatchesForId(patchStore, baseMessage);
    assert.deepEqual(patched.reactions.length, 1);
    assert.deepEqual(patched.reactions[0].value, "👍");

    patchStore.removeMessagePatch(messageId, patchId);
    patched = applyMessagePatchesForId(patchStore, baseMessage);
    assert.deepEqual(patched.reactions.length, 0);
  });

  it("should apply removeReaction patch for the current user's reaction", () => {
    const patchStore = new PatchStore();
    const messageWithReaction = {
      id: messageId,
      reactions: [{ sender: { did: currentUserDid }, value: "👍" }],
    };
    patchStore.addMessagePatch(messageId, {
      type: "removeReaction",
      currentUserDid,
      value: "👍",
    });
    const patched = applyMessagePatchesForId(patchStore, messageWithReaction);
    assert.deepEqual(patched.reactions.length, 0);
  });

  it("should keep other users' matching reactions and the user's other-emoji reactions when removing one reaction", () => {
    const patchStore = new PatchStore();
    const messageWithReactions = {
      id: messageId,
      reactions: [
        { sender: { did: currentUserDid }, value: "👍" },
        { sender: { did: otherDid }, value: "👍" },
        { sender: { did: currentUserDid }, value: "❤️" },
      ],
    };
    patchStore.addMessagePatch(messageId, {
      type: "removeReaction",
      currentUserDid,
      value: "👍",
    });
    const patched = applyMessagePatchesForId(patchStore, messageWithReactions);
    const surviving = patched.reactions.map(
      (reaction) => `${reaction.sender.did}:${reaction.value}`,
    );
    assert.deepEqual(surviving, [`${otherDid}:👍`, `${currentUserDid}:❤️`]);
  });

  it("should throw for an unknown message patch type", () => {
    const patchStore = new PatchStore();
    patchStore.addMessagePatch(messageId, { type: "nope" });
    assert.throws(() => applyMessagePatchesForId(patchStore, baseMessage));
  });

  it("should not mutate the input message", () => {
    const patchStore = new PatchStore();
    patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: { sender: { did: currentUserDid }, value: "🎉" },
    });
    const patched = applyMessagePatchesForId(patchStore, baseMessage);
    assert.deepEqual(patched.reactions.length, 1);
    assert.deepEqual(baseMessage.reactions, []);
  });
});

describe("Preference Patches - unpinFeed", () => {
  it("should apply unpinFeed by delegating to preferences.unpinFeed", () => {
    const patchStore = new PatchStore();
    const seen = [];
    const mockPreferences = {
      clone: () => mockPreferences,
      unpinFeed: (feedUri) => {
        seen.push(feedUri);
        return { after: feedUri };
      },
    };
    patchStore.addPreferencePatch({
      type: "unpinFeed",
      feedUri: "at://feed/1",
    });
    const result = applyPreferencePatchesAll(patchStore, mockPreferences);
    assert.deepEqual(seen, ["at://feed/1"]);
    assert.deepEqual(result, { after: "at://feed/1" });
  });
});

describe("Author Feed Patches - pinPost apply", () => {
  const feedURI = "did:plc:author-posts";
  const targetPost = { uri: "at://did:plc:author/app.bsky.feed.post/x" };
  const otherPost = { uri: "at://did:plc:author/app.bsky.feed.post/y" };

  it("should prepend the pinned post with a reasonPin marker", () => {
    const patchStore = new PatchStore();
    patchStore.addAuthorFeedPatch(feedURI, {
      type: "pinPost",
      post: targetPost,
    });
    const feed = {
      feed: [{ post: otherPost }, { post: targetPost }],
      cursor: "c",
    };
    const patched = patchStore.applyAuthorFeedPatches(feedURI, feed);
    assert.deepEqual(patched.feed[0].post.uri, targetPost.uri);
    assert.deepEqual(
      patched.feed[0].reason?.$type,
      "app.bsky.feed.defs#reasonPin",
    );
    // Second entry is the other post; the original targetPost occurrence is dropped.
    assert.deepEqual(patched.feed.length, 2);
    assert.deepEqual(patched.feed[1].post.uri, otherPost.uri);
    assert.deepEqual(patched.cursor, "c");
  });
});

describe("Post Patches - convergence", () => {
  const postURI = "at://did:test/app.bsky.feed.post/test";

  it("should no-op addLike on a post that already reflects the like", () => {
    const patchStore = new PatchStore();
    const likedPost = {
      uri: postURI,
      likeCount: 6,
      viewer: { like: "server-like-uri" },
    };
    patchStore.addPostPatch(postURI, { type: "addLike" });
    const result = applyPostPatches(patchStore, likedPost);
    assert.deepEqual(result.likeCount, 6);
    assert.deepEqual(result.viewer.like, "server-like-uri");
  });

  it("should no-op removeLike on a post without a like", () => {
    const patchStore = new PatchStore();
    const post = { uri: postURI, likeCount: 5, viewer: { like: null } };
    patchStore.addPostPatch(postURI, { type: "removeLike" });
    const result = applyPostPatches(patchStore, post);
    assert.deepEqual(result.likeCount, 5);
    assert.deepEqual(result.viewer.like, null);
  });

  it("should no-op createRepost on a post that already reflects the repost", () => {
    const patchStore = new PatchStore();
    const repostedPost = {
      uri: postURI,
      repostCount: 3,
      viewer: { repost: "server-repost-uri" },
    };
    patchStore.addPostPatch(postURI, { type: "createRepost" });
    const result = applyPostPatches(patchStore, repostedPost);
    assert.deepEqual(result.repostCount, 3);
    assert.deepEqual(result.viewer.repost, "server-repost-uri");
  });

  it("should no-op deleteRepost on a post without a repost", () => {
    const patchStore = new PatchStore();
    const post = { uri: postURI, repostCount: 2, viewer: { repost: null } };
    patchStore.addPostPatch(postURI, { type: "deleteRepost" });
    const result = applyPostPatches(patchStore, post);
    assert.deepEqual(result.repostCount, 2);
  });

  it("should no-op addBookmark / removeBookmark when already converged", () => {
    const patchStore = new PatchStore();
    const bookmarkedPost = {
      uri: postURI,
      bookmarkCount: 2,
      viewer: { bookmarked: true },
    };
    patchStore.addPostPatch(postURI, { type: "addBookmark" });
    let result = applyPostPatches(patchStore, bookmarkedPost);
    assert.deepEqual(result.bookmarkCount, 2);

    const plainPost = {
      uri: postURI,
      bookmarkCount: 1,
      viewer: { bookmarked: false },
    };
    const patchStore2 = new PatchStore();
    patchStore2.addPostPatch(postURI, { type: "removeBookmark" });
    result = applyPostPatches(patchStore2, plainPost);
    assert.deepEqual(result.bookmarkCount, 1);
  });

  it("should not double-apply when a canonical refresh lands while the patch is installed", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "addLike" });
    const stalePost = { uri: postURI, likeCount: 5, viewer: { like: null } };
    assert.deepEqual(applyPostPatches(patchStore, stalePost).likeCount, 6);

    // Refresh delivers the server state with the like already applied.
    const refreshedPost = {
      uri: postURI,
      likeCount: 6,
      viewer: { like: "server-like-uri" },
    };
    const patched = applyPostPatches(patchStore, refreshedPost);
    assert.deepEqual(patched.likeCount, 6);
    assert.deepEqual(patched.viewer.like, "server-like-uri");
  });
});

describe("Profile Patches - convergence", () => {
  const did = "did:plc:test";

  it("should no-op followProfile on an already-followed profile", () => {
    const patchStore = new PatchStore();
    const followedProfile = {
      did,
      followersCount: 11,
      viewer: { following: "server-follow-uri" },
    };
    patchStore.addProfilePatch(did, { type: "followProfile" });
    const result = applyProfilePatchesForDid(patchStore, followedProfile);
    assert.deepEqual(result.followersCount, 11);
    assert.deepEqual(result.viewer.following, "server-follow-uri");
  });

  it("should no-op unfollowProfile on a profile without a follow", () => {
    const patchStore = new PatchStore();
    const profile = { did, followersCount: 10, viewer: { following: null } };
    patchStore.addProfilePatch(did, { type: "unfollowProfile" });
    const result = applyProfilePatchesForDid(patchStore, profile);
    assert.deepEqual(result.followersCount, 10);
  });

  it("should no-op blockProfile / unblockProfile when already converged", () => {
    const patchStore = new PatchStore();
    const blockedProfile = {
      did,
      viewer: { blocking: "server-block-uri" },
    };
    patchStore.addProfilePatch(did, { type: "blockProfile" });
    let result = applyProfilePatchesForDid(patchStore, blockedProfile);
    assert.deepEqual(result.viewer.blocking, "server-block-uri");

    const patchStore2 = new PatchStore();
    const plainProfile = { did, viewer: { blocking: null } };
    patchStore2.addProfilePatch(did, { type: "unblockProfile" });
    result = applyProfilePatchesForDid(patchStore2, plainProfile);
    assert.deepEqual(result.viewer.blocking, null);
  });
});

describe("Message Patches - convergence", () => {
  const messageId = "msg-1";
  const currentUserDid = "did:plc:me";

  it("should not duplicate a reaction the canonical message already carries", () => {
    const patchStore = new PatchStore();
    // The canonical reaction carries a full sender profile; the optimistic
    // one only has the did.
    const messageWithReaction = {
      id: messageId,
      reactions: [
        {
          sender: { did: currentUserDid, handle: "me.test", displayName: "Me" },
          value: "👍",
        },
      ],
    };
    patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: { sender: { did: currentUserDid }, value: "👍" },
    });
    const patched = applyMessagePatchesForId(patchStore, messageWithReaction);
    assert.deepEqual(patched.reactions.length, 1);
    assert.deepEqual(patched.reactions[0].sender.handle, "me.test");
  });

  it("should still add a reaction when only the emoji or sender differs", () => {
    const patchStore = new PatchStore();
    const messageWithReaction = {
      id: messageId,
      reactions: [{ sender: { did: "did:plc:other" }, value: "👍" }],
    };
    patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: { sender: { did: currentUserDid }, value: "👍" },
    });
    patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: { sender: { did: currentUserDid }, value: "❤️" },
    });
    const patched = applyMessagePatchesForId(patchStore, messageWithReaction);
    assert.deepEqual(patched.reactions.length, 3);
  });
});
