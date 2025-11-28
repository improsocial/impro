import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { DataStore } from "../../src/js/dataLayer/dataStore.js";

const t = new TestSuite("DataStore");

t.describe("Feed Management", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";
  const testFeed = {
    feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
    cursor: "cursor123",
  };

  it("should set and get a feed", () => {
    const dataStore = new DataStore();
    dataStore.setFeed(feedURI, testFeed);
    assertEquals(dataStore.getFeed(feedURI), testFeed);
  });

  it("should check if feed exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasFeed(feedURI), false);
    dataStore.setFeed(feedURI, testFeed);
    assertEquals(dataStore.hasFeed(feedURI), true);
  });

  // Skipping async event test - requires callback support
});

t.describe("Post Management", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/test";
  const testPost = {
    uri: postURI,
    author: { handle: "test.user", did: "did:test" },
    record: { text: "Test post" },
  };

  it("should set and get a post", () => {
    const dataStore = new DataStore();
    dataStore.setPost(postURI, testPost);
    assertEquals(dataStore.getPost(postURI), testPost);
  });

  it("should check if post exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasPost(postURI), false);
    dataStore.setPost(postURI, testPost);
    assertEquals(dataStore.hasPost(postURI), true);
  });

  it("should emit update and setPost events when setting post", () => {
    const dataStore = new DataStore();
    let updateEmitted = false;
    let setPostEmitted = false;

    dataStore.on("update", () => {
      updateEmitted = true;
    });

    dataStore.on("setPost", (post) => {
      setPostEmitted = true;
      assertEquals(post, testPost);
    });

    dataStore.setPost(postURI, testPost);
    assertEquals(updateEmitted, true);
    assertEquals(setPostEmitted, true);
  });

  it("should set multiple posts", () => {
    const dataStore = new DataStore();
    const posts = [
      { uri: "post1", content: "First post" },
      { uri: "post2", content: "Second post" },
    ];

    dataStore.setPosts(posts);

    assertEquals(dataStore.hasPost("post1"), true);
    assertEquals(dataStore.hasPost("post2"), true);
  });

  it("should clear a post", () => {
    const dataStore = new DataStore();
    dataStore.setPost(postURI, testPost);
    assertEquals(dataStore.hasPost(postURI), true);

    dataStore.clearPost(postURI);
    assertEquals(dataStore.hasPost(postURI), false);
    assertEquals(dataStore.getPost(postURI), undefined);
  });

  // Skipping async event test - requires callback support
});

t.describe("PostThread Management", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/thread";
  const testPostThread = {
    post: { uri: postURI },
    replies: [],
    parent: null,
  };

  it("should set and get a post thread", () => {
    const dataStore = new DataStore();
    dataStore.setPostThread(postURI, testPostThread);
    assertEquals(dataStore.getPostThread(postURI), testPostThread);
  });

  it("should check if post thread exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasPostThread(postURI), false);
    dataStore.setPostThread(postURI, testPostThread);
    assertEquals(dataStore.hasPostThread(postURI), true);
  });

  // Skipping async event test - requires callback support
});

t.describe("Profile Management", (it) => {
  const profileDid = "did:test:profile";
  const testProfile = {
    did: profileDid,
    handle: "test.profile",
    displayName: "Test Profile",
  };

  it("should set and get a profile", () => {
    const dataStore = new DataStore();
    dataStore.setProfile(profileDid, testProfile);
    assertEquals(dataStore.getProfile(profileDid), testProfile);
  });

  it("should check if profile exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasProfile(profileDid), false);
    dataStore.setProfile(profileDid, testProfile);
    assertEquals(dataStore.hasProfile(profileDid), true);
  });
});

t.describe("Event Handling", (it) => {
  it("should handle multiple event listeners", () => {
    const dataStore = new DataStore();
    let listener1Called = false;
    let listener2Called = false;

    dataStore.on("update", () => {
      listener1Called = true;
    });
    dataStore.on("update", () => {
      listener2Called = true;
    });

    dataStore.setPost("test", { uri: "test" });

    assertEquals(listener1Called, true);
    assertEquals(listener2Called, true);
  });
});

await t.run();
