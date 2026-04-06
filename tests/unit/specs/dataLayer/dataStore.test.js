import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { DataStore } from "/js/dataLayer/dataStore.js";

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

  it("should emit setPost event when setting post", () => {
    const dataStore = new DataStore();
    let setPostEmitted = false;

    dataStore.on("setPost", (post) => {
      setPostEmitted = true;
      assertEquals(post, testPost);
    });

    dataStore.setPost(postURI, testPost);
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

t.describe("Quoted Post Caching", (it) => {
  it("should cache quoted posts when setting posts with record embeds", () => {
    const dataStore = new DataStore();
    const quotedPostUri = "at://did:plc:456/app.bsky.feed.post/quoted";
    const post = {
      uri: "at://did:plc:123/app.bsky.feed.post/main",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewRecord",
          uri: quotedPostUri,
          cid: "cid-quoted",
          author: { did: "did:plc:456", handle: "quoted.user" },
          value: { text: "I am quoted" },
          embeds: [],
          labels: [],
          likeCount: 10,
          replyCount: 1,
          repostCount: 2,
          quoteCount: 0,
          indexedAt: "2024-01-01T00:00:00Z",
        },
      },
    };

    dataStore.setPosts([post]);

    assertEquals(dataStore.hasPost(quotedPostUri), true);
    const cached = dataStore.getPost(quotedPostUri);
    assertEquals(cached.uri, quotedPostUri);
    assertEquals(cached.record, post.embed.record.value);
    assertEquals(cached.author.handle, "quoted.user");
    assertEquals(cached.likeCount, 10);
  });

  it("should cache quoted posts from recordWithMedia embeds", () => {
    const dataStore = new DataStore();
    const quotedPostUri = "at://did:plc:456/app.bsky.feed.post/quoted";
    const post = {
      uri: "at://did:plc:123/app.bsky.feed.post/main",
      embed: {
        $type: "app.bsky.embed.recordWithMedia#view",
        media: { $type: "app.bsky.embed.images#view", images: [] },
        record: {
          record: {
            $type: "app.bsky.embed.record#viewRecord",
            uri: quotedPostUri,
            cid: "cid-quoted",
            author: { did: "did:plc:456" },
            value: { text: "Quoted with media" },
            indexedAt: "2024-01-01T00:00:00Z",
          },
        },
      },
    };

    dataStore.setPosts([post]);

    assertEquals(dataStore.hasPost(quotedPostUri), true);
    assertEquals(
      dataStore.getPost(quotedPostUri).record.text,
      "Quoted with media",
    );
  });

  it("should not overwrite an existing post with quoted post data", () => {
    const dataStore = new DataStore();
    const quotedPostUri = "at://did:plc:456/app.bsky.feed.post/quoted";
    const existingPost = {
      uri: quotedPostUri,
      author: { did: "did:plc:456" },
      record: { text: "I am quoted" },
      viewer: { like: "at://did:plc:123/app.bsky.feed.like/abc" },
    };
    dataStore.setPost(quotedPostUri, existingPost);

    const postWithQuote = {
      uri: "at://did:plc:123/app.bsky.feed.post/main",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewRecord",
          uri: quotedPostUri,
          cid: "cid-quoted",
          author: { did: "did:plc:456" },
          value: { text: "I am quoted" },
          indexedAt: "2024-01-01T00:00:00Z",
        },
      },
    };

    dataStore.setPosts([postWithQuote]);

    const cached = dataStore.getPost(quotedPostUri);
    assertEquals(cached.viewer.like, "at://did:plc:123/app.bsky.feed.like/abc");
  });

  it("should not cache blocked or non-viewRecord quoted posts", () => {
    const dataStore = new DataStore();
    const post = {
      uri: "at://did:plc:123/app.bsky.feed.post/main",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewBlocked",
          uri: "at://did:plc:456/app.bsky.feed.post/blocked",
        },
      },
    };

    dataStore.setPosts([post]);

    assertEquals(
      dataStore.hasPost("at://did:plc:456/app.bsky.feed.post/blocked"),
      false,
    );
  });

  it("should not cache when post has no embed", () => {
    const dataStore = new DataStore();
    const post = {
      uri: "at://did:plc:123/app.bsky.feed.post/main",
      record: { text: "No embed" },
    };

    dataStore.setPosts([post]);

    assertEquals(dataStore.hasPost(post.uri), true);
    assertEquals(dataStore.getAllPosts().length, 1);
  });
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

t.describe("PostThreadOther Management", (it) => {
  const postURI = "at://did:test/app.bsky.feed.post/thread";
  const testPostThreadOther = [
    { uri: "at://did:plc:reply1/app.bsky.feed.post/reply1" },
    { uri: "at://did:plc:reply2/app.bsky.feed.post/reply2" },
  ];

  it("should set and get a post thread other", () => {
    const dataStore = new DataStore();
    dataStore.setPostThreadOther(postURI, testPostThreadOther);
    assertEquals(dataStore.getPostThreadOther(postURI), testPostThreadOther);
  });

  it("should check if post thread other exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasPostThreadOther(postURI), false);
    dataStore.setPostThreadOther(postURI, testPostThreadOther);
    assertEquals(dataStore.hasPostThreadOther(postURI), true);
  });

  it("should clear post thread other", () => {
    const dataStore = new DataStore();
    dataStore.setPostThreadOther(postURI, testPostThreadOther);
    assertEquals(dataStore.hasPostThreadOther(postURI), true);

    dataStore.clearPostThreadOther(postURI);
    assertEquals(dataStore.hasPostThreadOther(postURI), false);
    assertEquals(dataStore.getPostThreadOther(postURI), undefined);
  });

  it("should handle empty post thread other", () => {
    const dataStore = new DataStore();
    dataStore.setPostThreadOther(postURI, []);
    assertEquals(dataStore.hasPostThreadOther(postURI), true);
    assertEquals(dataStore.getPostThreadOther(postURI), []);
  });
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

    dataStore.on("setPost", () => {
      listener1Called = true;
    });
    dataStore.on("setPost", () => {
      listener2Called = true;
    });

    dataStore.setPost("test", { uri: "test" });

    assertEquals(listener1Called, true);
    assertEquals(listener2Called, true);
  });
});

t.describe("Labeler Info Management", (it) => {
  const labelerDid = "did:plc:testlabeler";
  const testLabelerInfo = {
    uri: "at://did:plc:testlabeler/app.bsky.labeler.service/self",
    creator: { did: labelerDid, handle: "labeler.test" },
    policies: {
      labelValueDefinitions: [
        { identifier: "nsfw", locales: [{ lang: "en", name: "NSFW" }] },
      ],
    },
  };

  it("should set and get labeler info", () => {
    const dataStore = new DataStore();
    dataStore.setLabelerInfo(labelerDid, testLabelerInfo);
    assertEquals(dataStore.getLabelerInfo(labelerDid), testLabelerInfo);
  });

  it("should check if labeler info exists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasLabelerInfo(labelerDid), false);
    dataStore.setLabelerInfo(labelerDid, testLabelerInfo);
    assertEquals(dataStore.hasLabelerInfo(labelerDid), true);
  });

  it("should return undefined for non-existent labeler info", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.getLabelerInfo(labelerDid), undefined);
  });

  it("should clear labeler info", () => {
    const dataStore = new DataStore();
    dataStore.setLabelerInfo(labelerDid, testLabelerInfo);
    assertEquals(dataStore.hasLabelerInfo(labelerDid), true);

    dataStore.clearLabelerInfo(labelerDid);
    assertEquals(dataStore.hasLabelerInfo(labelerDid), false);
    assertEquals(dataStore.getLabelerInfo(labelerDid), undefined);
  });

  it("should handle multiple labelers independently", () => {
    const dataStore = new DataStore();
    const labeler1Did = "did:plc:labeler1";
    const labeler2Did = "did:plc:labeler2";
    const labeler1Info = { ...testLabelerInfo, creator: { did: labeler1Did } };
    const labeler2Info = { ...testLabelerInfo, creator: { did: labeler2Did } };

    dataStore.setLabelerInfo(labeler1Did, labeler1Info);
    dataStore.setLabelerInfo(labeler2Did, labeler2Info);

    assertEquals(dataStore.getLabelerInfo(labeler1Did), labeler1Info);
    assertEquals(dataStore.getLabelerInfo(labeler2Did), labeler2Info);

    dataStore.clearLabelerInfo(labeler1Did);
    assertEquals(dataStore.hasLabelerInfo(labeler1Did), false);
    assertEquals(dataStore.hasLabelerInfo(labeler2Did), true);
  });
});

await t.run();
