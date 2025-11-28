import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PatchStore } from "../../src/js/dataLayer/patchStore.js";

const t = new TestSuite("PatchStore");

t.describe("Post Patches - Patch Management", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    viewer: { like: null },
  };

  it("should add a post patch and return a patch ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addPostPatch(postURI, { type: "addLike" });
    assertEquals(typeof patchId, "number");
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
    const patchedPost = patchStore.applyPostPatches(basePost);
    assertEquals(patchedPost.viewer.like, "fake like");

    // Remove patch
    patchStore.removePostPatch(postURI, patchId);

    // Verify patch is removed
    const unpatchedPost = patchStore.applyPostPatches(basePost);
    assertEquals(unpatchedPost.viewer.like, null);
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
    assertEquals(errorThrown, false);
  });
});

t.describe("Post Patches - Like Patches", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const basePost = {
    uri: postURI,
    likeCount: 5,
    viewer: { like: null },
  };

  it("should apply addLike patch correctly", () => {
    const patchStore = new PatchStore();
    patchStore.addPostPatch(postURI, { type: "addLike" });
    const result = patchStore.applyPostPatches(basePost);

    assertEquals(result.viewer.like, "fake like");
    assertEquals(result.likeCount, 6);
    assertEquals(result.uri, postURI);
  });

  it("should apply removeLike patch correctly", () => {
    const patchStore = new PatchStore();
    const likedPost = {
      ...basePost,
      likeCount: 6,
      viewer: { like: "some-like-uri" },
    };

    patchStore.addPostPatch(postURI, { type: "removeLike" });
    const result = patchStore.applyPostPatches(likedPost);

    assertEquals(result.viewer.like, null);
    assertEquals(result.likeCount, 5);
  });

  it("should apply multiple patches in order", () => {
    const patchStore = new PatchStore();
    // Add like, then remove like
    patchStore.addPostPatch(postURI, { type: "addLike" });
    patchStore.addPostPatch(postURI, { type: "removeLike" });

    const result = patchStore.applyPostPatches(basePost);

    assertEquals(result.viewer.like, null);
    assertEquals(result.likeCount, 5); // +1 -1 = 0, so 5 + 0 = 5
  });

  it("should preserve original post when no patches exist", () => {
    const patchStore = new PatchStore();
    const result = patchStore.applyPostPatches(basePost);
    assertEquals(result, basePost);
    assert(result !== basePost); // Should be a copy
  });
});

t.describe("Post Patches - Error Handling", (it) => {
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
      patchStore.applyPostPatches(basePost);
    } catch (e) {
      errorThrown = true;
      errorMessage = e.message;
    }
    assertEquals(errorThrown, true);
    assert(errorMessage.includes("Unknown patch type"));
  });
});

t.describe("Profile Patches - Patch Management", (it) => {
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
    assertEquals(typeof patchId, "number");
    assert(patchId >= 0);
  });

  it("should remove a profile patch by ID", () => {
    const patchStore = new PatchStore();
    const patchId = patchStore.addProfilePatch(profileDID, {
      type: "followProfile",
    });

    // Verify patch exists
    const patchedProfile = patchStore.applyProfilePatches(baseProfile);
    assertEquals(patchedProfile.viewer.following, "fake following");

    // Remove patch
    patchStore.removeProfilePatch(profileDID, patchId);

    // Verify patch is removed
    const unpatchedProfile = patchStore.applyProfilePatches(baseProfile);
    assertEquals(unpatchedProfile.viewer.following, null);
  });
});

t.describe("Profile Patches - Follow Patches", (it) => {
  const profileDID = "did:test:profile";
  const baseProfile = {
    did: profileDID,
    viewer: { following: null },
  };

  it("should apply followProfile patch correctly", () => {
    const patchStore = new PatchStore();
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    const result = patchStore.applyProfilePatches(baseProfile);

    assertEquals(result.viewer.following, "fake following");
    assertEquals(result.did, profileDID);
  });

  it("should apply unfollowProfile patch correctly", () => {
    const patchStore = new PatchStore();
    const followedProfile = {
      ...baseProfile,
      viewer: { following: "some-follow-uri" },
    };

    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });
    const result = patchStore.applyProfilePatches(followedProfile);

    assertEquals(result.viewer.following, null);
  });

  it("should apply multiple profile patches in order", () => {
    const patchStore = new PatchStore();
    // Follow, then unfollow
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    patchStore.addProfilePatch(profileDID, { type: "unfollowProfile" });

    const result = patchStore.applyProfilePatches(baseProfile);
    assertEquals(result.viewer.following, null);
  });
});

t.describe("Profile Patches - Error Handling", (it) => {
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
    assertEquals(errorThrown, true);
    assert(errorMessage.includes("Unknown patch type"));
  });
});

t.describe("UUID Generation", (it) => {
  it("should generate sequential IDs", () => {
    const patchStore = new PatchStore();
    const id1 = patchStore.addPostPatch("post1", { type: "addLike" });
    const id2 = patchStore.addPostPatch("post2", { type: "addLike" });
    const id3 = patchStore.addProfilePatch("profile1", {
      type: "followProfile",
    });

    assertEquals(id2, id1 + 1);
    assertEquals(id3, id2 + 1);
  });
});

t.describe("Patch Isolation", (it) => {
  it("should isolate patches between different posts", () => {
    const patchStore = new PatchStore();
    const post1URI = "post1";
    const post2URI = "post2";
    const basePost1 = { uri: post1URI, likeCount: 5, viewer: { like: null } };
    const basePost2 = { uri: post2URI, likeCount: 10, viewer: { like: null } };

    patchStore.addPostPatch(post1URI, { type: "addLike" });

    const result1 = patchStore.applyPostPatches(basePost1);
    const result2 = patchStore.applyPostPatches(basePost2);

    assertEquals(result1.likeCount, 6);
    assertEquals(result2.likeCount, 10); // Unchanged
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

    assertEquals(result1.viewer.following, "fake following");
    assertEquals(result2.viewer.following, null); // Unchanged
  });
});

await t.run();
