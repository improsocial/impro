import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Selectors } from "../../src/js/dataLayer/selectors.js";
import { DataStore } from "../../src/js/dataLayer/dataStore.js";
import { PatchStore } from "../../src/js/dataLayer/patchStore.js";

const t = new TestSuite("Selectors");

t.describe("getFeed", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getFeed(feedURI);
    assertEquals(result, null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    // Set up test data
    const rawFeed = {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "cursor123",
    };

    const post1 = { uri: "post1", content: "First post", likeCount: 5 };
    const post2 = { uri: "post2", content: "Second post", likeCount: 10 };

    dataStore.setFeed(feedURI, rawFeed);
    dataStore.setPost("post1", post1);
    dataStore.setPost("post2", post2);

    const result = selectors.getFeed(feedURI);

    assertEquals(result, {
      feed: [{ post: post1 }, { post: post2 }],
      cursor: "cursor123",
    });
  });

  it("should apply patches to posts in feed", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawFeed = {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor123",
    };

    const post1 = {
      uri: "post1",
      content: "Test post",
      likeCount: 5,
      viewer: { like: null },
    };

    dataStore.setFeed(feedURI, rawFeed);
    dataStore.setPost("post1", post1);
    patchStore.addPostPatch("post1", { type: "addLike" });

    const result = selectors.getFeed(feedURI);

    assertEquals(result.feed[0].post.likeCount, 6);
    assertEquals(result.feed[0].post.viewer.like, "fake like");
  });
});

t.describe("getPostThread", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/thread";

  it("should return null when post thread does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getPostThread(postURI);
    assertEquals(result, null);
  });

  it("should hydrate and return a simple post thread", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawThread = {
      post: { uri: postURI },
      replies: [],
    };

    const mainPost = { uri: postURI, content: "Main thread post" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, mainPost);

    const result = selectors.getPostThread(postURI);

    assertEquals(result, {
      post: mainPost,
      replies: [],
    });
  });

  it("should hydrate post thread with replies", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawThread = {
      post: { uri: postURI },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1" },
          otherData: "preserved",
        },
      ],
    };

    const mainPost = { uri: postURI, content: "Main post" };
    const replyPost = { uri: "reply1", content: "Reply post" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, mainPost);
    dataStore.setPost("reply1", replyPost);

    const result = selectors.getPostThread(postURI);

    assertEquals(result.post, mainPost);
    assertEquals(result.replies[0], {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: replyPost,
      otherData: "preserved",
    });
  });

  it("should hydrate post thread with parent", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawThread = {
      post: { uri: postURI },
      replies: [],
      parent: {
        post: { uri: "parent1" },
        parentData: "preserved",
      },
    };

    const mainPost = { uri: postURI, content: "Reply post" };
    const parentPost = { uri: "parent1", content: "Parent post" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, mainPost);
    dataStore.setPost("parent1", parentPost);

    const result = selectors.getPostThread(postURI);

    assertEquals(result.post, mainPost);
    assertEquals(result.parent, {
      post: parentPost,
      parentData: "preserved",
    });
  });

  it("should apply patches to thread posts", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawThread = {
      post: { uri: postURI },
      replies: [],
    };

    const mainPost = {
      uri: postURI,
      content: "Main post",
      likeCount: 5,
      viewer: { like: null },
    };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, mainPost);
    patchStore.addPostPatch(postURI, { type: "addLike" });

    const result = selectors.getPostThread(postURI);

    assertEquals(result.post.likeCount, 6);
    assertEquals(result.post.viewer.like, "fake like");
  });

  it("should preserve non-threadViewPost replies unchanged", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const rawThread = {
      post: { uri: postURI },
      replies: [
        {
          $type: "app.bsky.feed.defs#notThreadViewPost",
          someOtherData: "should be preserved",
        },
      ],
    };

    const mainPost = { uri: postURI, content: "Main post" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, mainPost);

    const result = selectors.getPostThread(postURI);

    assertEquals(result.replies[0], {
      $type: "app.bsky.feed.defs#notThreadViewPost",
      someOtherData: "should be preserved",
    });
  });
});

t.describe("getPost", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const testPost = {
    uri: postURI,
    content: "Test post",
    likeCount: 5,
    viewer: { like: null },
  };

  it("should return null when post does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getPost(postURI);
    assertEquals(result, null);
  });

  it("should return post with patches applied", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    dataStore.setPost(postURI, testPost);
    patchStore.addPostPatch(postURI, { type: "addLike" });

    const result = selectors.getPost(postURI);

    assertEquals(result.likeCount, 6);
    assertEquals(result.viewer.like, "fake like");
    assertEquals(result.uri, postURI);
  });

  it("should return post without patches when no patches exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    dataStore.setPost(postURI, testPost);

    const result = selectors.getPost(postURI);

    assertEquals(result, testPost);
    assert(result !== testPost); // Should be a copy due to patch application
  });

  it("should return null when optional post missing", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getPost("nonExistentPost", { require: false });
    assertEquals(result, null);
  });

  it("should return null when post missing and require not specified", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getPost("nonExistentPost");
    assertEquals(result, null);
  });
});

t.describe("getProfile", (it) => {
  const profileDID = "did:test:profile";
  const testProfile = {
    did: profileDID,
    handle: "test.profile",
    displayName: "Test Profile",
    viewer: { following: null },
  };

  it("should return null when profile does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    const result = selectors.getProfile(profileDID);
    assertEquals(result, null);
  });

  it("should return profile with patches applied", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    dataStore.setProfile(profileDID, testProfile);
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });

    const result = selectors.getProfile(profileDID);

    assertEquals(result.viewer.following, "fake following");
    assertEquals(result.did, profileDID);
  });

  it("should return profile without patches when no patches exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    dataStore.setProfile(profileDID, testProfile);

    const result = selectors.getProfile(profileDID);

    assertEquals(result, testProfile);
    assert(result !== testProfile); // Should be a copy due to patch application
  });
});

t.describe("Integration with DataStore and PatchStore", (it) => {
  it("should work with multiple data types and patches", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const selectors = new Selectors(dataStore, patchStore);

    // Set up data
    const feedURI = "feed1";
    const postURI = "post1";
    const profileDID = "profile1";

    const rawFeed = { feed: [{ post: { uri: postURI } }], cursor: "123" };
    const post = { uri: postURI, likeCount: 5, viewer: { like: null } };
    const profile = { did: profileDID, viewer: { following: null } };

    dataStore.setFeed(feedURI, rawFeed);
    dataStore.setPost(postURI, post);
    dataStore.setProfile(profileDID, profile);

    // Add patches
    patchStore.addPostPatch(postURI, { type: "addLike" });
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });

    // Test all selectors
    const feedResult = selectors.getFeed(feedURI);
    const postResult = selectors.getPost(postURI);
    const profileResult = selectors.getProfile(profileDID);

    assertEquals(feedResult.feed[0].post.likeCount, 6);
    assertEquals(postResult.likeCount, 6);
    assertEquals(profileResult.viewer.following, "fake following");
  });
});

await t.run();
