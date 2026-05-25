import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { EventEmitter } from "/js/eventEmitter.js";

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

  it("should emit post:${uri} on the shared event bus when set", () => {
    const events = new EventEmitter();
    const dataStore = new DataStore(events);
    let fired = false;
    events.on(`post:${postURI}`, () => {
      fired = true;
    });
    dataStore.setPost(postURI, testPost);
    assertEquals(fired, true);
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

t.describe("Muted Profiles Management", (it) => {
  const mutedList = {
    mutes: [{ did: "did:plc:a", handle: "a.bsky.social" }],
    cursor: "next",
  };

  it("should return null before any muted profiles are set", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasMutedProfiles(), false);
    assertEquals(dataStore.getMutedProfiles(), null);
  });

  it("should set and get muted profiles", () => {
    const dataStore = new DataStore();
    dataStore.setMutedProfiles(mutedList);
    assertEquals(dataStore.hasMutedProfiles(), true);
    assertEquals(dataStore.getMutedProfiles(), mutedList);
  });

  it("should clear muted profiles", () => {
    const dataStore = new DataStore();
    dataStore.setMutedProfiles(mutedList);
    dataStore.clearMutedProfiles();
    assertEquals(dataStore.hasMutedProfiles(), false);
    assertEquals(dataStore.getMutedProfiles(), null);
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

t.describe("Blocked Profiles Management", (it) => {
  const blockedList = {
    blocks: [{ did: "did:plc:b", handle: "b.bsky.social" }],
    cursor: "next",
  };

  it("should return null before any blocked profiles are set", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasBlockedProfiles(), false);
    assertEquals(dataStore.getBlockedProfiles(), null);
  });

  it("should set and get blocked profiles", () => {
    const dataStore = new DataStore();
    dataStore.setBlockedProfiles(blockedList);
    assertEquals(dataStore.hasBlockedProfiles(), true);
    assertEquals(dataStore.getBlockedProfiles(), blockedList);
  });

  it("should clear blocked profiles", () => {
    const dataStore = new DataStore();
    dataStore.setBlockedProfiles(blockedList);
    dataStore.clearBlockedProfiles();
    assertEquals(dataStore.hasBlockedProfiles(), false);
    assertEquals(dataStore.getBlockedProfiles(), null);
  });
});

t.describe("Notifications Management", (it) => {
  const notifications = [{ uri: "at://did:test/notif/1", reason: "like" }];

  it("should return null before notifications are set", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasNotifications(), false);
    assertEquals(dataStore.getNotifications(), null);
  });

  it("should set and get notifications", () => {
    const dataStore = new DataStore();
    dataStore.setNotifications(notifications);
    assertEquals(dataStore.hasNotifications(), true);
    assertEquals(dataStore.getNotifications(), notifications);
  });

  it("should clear notifications without clearing the cursor", () => {
    const dataStore = new DataStore();
    dataStore.setNotifications(notifications);
    dataStore.setNotificationCursor("cursor-1");
    dataStore.clearNotifications();
    assertEquals(dataStore.hasNotifications(), false);
    assertEquals(dataStore.getNotifications(), null);
    assertEquals(dataStore.hasNotificationCursor(), true);
    assertEquals(dataStore.getNotificationCursor(), "cursor-1");
  });

  it("should set and clear the notification cursor independently", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasNotificationCursor(), false);
    dataStore.setNotificationCursor("cursor-2");
    assertEquals(dataStore.hasNotificationCursor(), true);
    assertEquals(dataStore.getNotificationCursor(), "cursor-2");
    dataStore.clearNotificationCursor();
    assertEquals(dataStore.hasNotificationCursor(), false);
    assertEquals(dataStore.getNotificationCursor(), null);
  });

  it("should emit setNotifications event", () => {
    const dataStore = new DataStore();
    let emitted = null;
    dataStore.on("setNotifications", (value) => {
      emitted = value;
    });
    dataStore.setNotifications(notifications);
    assertEquals(emitted, notifications);
  });
});

t.describe("Mention Notifications Management", (it) => {
  const mentions = [{ uri: "at://did:test/notif/mention", reason: "mention" }];

  it("should default to undefined before being set", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.getMentionNotifications(), null);
    assertEquals(dataStore.getMentionNotificationCursor(), null);
  });

  it("should set and get mention notifications", () => {
    const dataStore = new DataStore();
    dataStore.setMentionNotifications(mentions);
    assertEquals(dataStore.getMentionNotifications(), mentions);
  });

  it("should clear mention notifications without clearing cursor", () => {
    const dataStore = new DataStore();
    dataStore.setMentionNotifications(mentions);
    dataStore.setMentionNotificationCursor("m-cursor");
    dataStore.clearMentionNotifications();
    assertEquals(dataStore.getMentionNotifications(), null);
    assertEquals(dataStore.getMentionNotificationCursor(), "m-cursor");
  });

  it("should set the mention notification cursor", () => {
    const dataStore = new DataStore();
    dataStore.setMentionNotificationCursor("m-cursor-2");
    assertEquals(dataStore.getMentionNotificationCursor(), "m-cursor-2");
  });
});

t.describe("ConvoList Management", (it) => {
  const convos = [{ id: "convo-1" }, { id: "convo-2" }];

  it("should return null before convo list is set", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasConvoList(), false);
    assertEquals(dataStore.getConvoList(), null);
  });

  it("should set and get the convo list", () => {
    const dataStore = new DataStore();
    dataStore.setConvoList(convos);
    assertEquals(dataStore.hasConvoList(), true);
    assertEquals(dataStore.getConvoList(), convos);
  });

  it("should clear the convo list without clearing the cursor", () => {
    const dataStore = new DataStore();
    dataStore.setConvoList(convos);
    dataStore.setConvoListCursor("c-cursor");
    dataStore.clearConvoList();
    assertEquals(dataStore.hasConvoList(), false);
    assertEquals(dataStore.getConvoList(), null);
    assertEquals(dataStore.hasConvoListCursor(), true);
    assertEquals(dataStore.getConvoListCursor(), "c-cursor");
  });

  it("should set and clear the convo list cursor independently", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasConvoListCursor(), false);
    dataStore.setConvoListCursor("c-cursor-2");
    assertEquals(dataStore.hasConvoListCursor(), true);
    assertEquals(dataStore.getConvoListCursor(), "c-cursor-2");
    dataStore.clearConvoListCursor();
    assertEquals(dataStore.hasConvoListCursor(), false);
    assertEquals(dataStore.getConvoListCursor(), null);
  });
});

t.describe("Convo Management", (it) => {
  const convoId = "convo-123";
  const convo = { id: convoId, members: [{ did: "did:plc:a" }] };

  it("should set, get, and check existence of a convo", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasConvo(convoId), false);
    dataStore.setConvo(convoId, convo);
    assertEquals(dataStore.hasConvo(convoId), true);
    assertEquals(dataStore.getConvo(convoId), convo);
  });

  it("should clear a convo", () => {
    const dataStore = new DataStore();
    dataStore.setConvo(convoId, convo);
    dataStore.clearConvo(convoId);
    assertEquals(dataStore.hasConvo(convoId), false);
    assertEquals(dataStore.getConvo(convoId), undefined);
  });

  it("should return all convos", () => {
    const dataStore = new DataStore();
    const convoA = { id: "a" };
    const convoB = { id: "b" };
    dataStore.setConvo("a", convoA);
    dataStore.setConvo("b", convoB);
    assertEquals(dataStore.getAllConvos(), [convoA, convoB]);
  });
});

t.describe("ConvoMessages and Message Mapping", (it) => {
  const convoId = "convo-xyz";
  const messageA = { id: "msg-1", text: "hello" };
  const messageB = { id: "msg-2", text: "world" };
  const payload = { messages: [messageA, messageB], cursor: "next" };

  it("should set and get convo messages", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasConvoMessages(convoId), false);
    assertEquals(dataStore.getConvoMessages(convoId), null);
    dataStore.setConvoMessages(convoId, payload);
    assertEquals(dataStore.hasConvoMessages(convoId), true);
    assertEquals(dataStore.getConvoMessages(convoId), payload);
  });

  it("should clear convo messages", () => {
    const dataStore = new DataStore();
    dataStore.setConvoMessages(convoId, payload);
    dataStore.clearConvoMessages(convoId);
    assertEquals(dataStore.hasConvoMessages(convoId), false);
    assertEquals(dataStore.getConvoMessages(convoId), null);
  });

  it("should set, get, and clear individual messages by id", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.hasMessage(messageA.id), false);
    dataStore.setMessage(messageA.id, messageA);
    assertEquals(dataStore.hasMessage(messageA.id), true);
    assertEquals(dataStore.getMessage(messageA.id), messageA);
    dataStore.clearMessage(messageA.id);
    assertEquals(dataStore.hasMessage(messageA.id), false);
    assertEquals(dataStore.getMessage(messageA.id), undefined);
  });

  it("should keep message ids isolated from convo messages buckets", () => {
    const dataStore = new DataStore();
    dataStore.setConvoMessages(convoId, payload);
    assertEquals(dataStore.hasMessage(messageA.id), false);
    dataStore.setMessage(messageA.id, messageA);
    assertEquals(dataStore.hasMessage(messageA.id), true);
    assertEquals(dataStore.hasConvoMessages(convoId), true);
  });
});

t.describe("ShowLess and ShowMore Interactions", (it) => {
  const interactionA = { item: "post-a", event: "less" };
  const interactionB = { item: "post-b", event: "less" };
  const interactionC = { item: "post-c", event: "more" };

  it("should start with empty interaction lists", () => {
    const dataStore = new DataStore();
    assertEquals(dataStore.getShowLessInteractions(), []);
    assertEquals(dataStore.getShowMoreInteractions(), []);
  });

  it("should append show-less interactions in order", () => {
    const dataStore = new DataStore();
    dataStore.addShowLessInteraction(interactionA);
    assertEquals(dataStore.getShowLessInteractions(), [interactionA]);
    dataStore.addShowLessInteraction(interactionB);
    assertEquals(dataStore.getShowLessInteractions(), [
      interactionA,
      interactionB,
    ]);
  });

  it("should append show-more interactions independently of show-less", () => {
    const dataStore = new DataStore();
    dataStore.addShowLessInteraction(interactionA);
    dataStore.addShowMoreInteraction(interactionC);
    assertEquals(dataStore.getShowLessInteractions(), [interactionA]);
    assertEquals(dataStore.getShowMoreInteractions(), [interactionC]);
  });
});

t.describe("setPosts bulk insert", (it) => {
  it("should insert multiple posts and emit setPost for each", () => {
    const dataStore = new DataStore();
    const emittedUris = [];
    dataStore.on("setPost", (post) => {
      emittedUris.push(post.uri);
    });
    const posts = [
      { uri: "at://did:test/app.bsky.feed.post/1", record: { text: "one" } },
      { uri: "at://did:test/app.bsky.feed.post/2", record: { text: "two" } },
      { uri: "at://did:test/app.bsky.feed.post/3", record: { text: "three" } },
    ];
    dataStore.setPosts(posts);
    posts.forEach((post) => {
      assertEquals(dataStore.hasPost(post.uri), true);
      assertEquals(dataStore.getPost(post.uri), post);
    });
    assertEquals(
      emittedUris,
      posts.map((post) => post.uri),
    );
  });

  it("should match setPost behavior when given a single post", () => {
    const dataStoreA = new DataStore();
    const dataStoreB = new DataStore();
    const post = {
      uri: "at://did:test/app.bsky.feed.post/solo",
      record: { text: "solo" },
    };
    dataStoreA.setPost(post.uri, post);
    dataStoreB.setPosts([post]);
    assertEquals(dataStoreA.getPost(post.uri), dataStoreB.getPost(post.uri));
    assertEquals(dataStoreA.getAllPosts(), dataStoreB.getAllPosts());
  });
});

t.describe("Event emission for set* methods", (it) => {
  it("should emit setNotifications when notifications are set", () => {
    const dataStore = new DataStore();
    let emitted = null;
    dataStore.on("setNotifications", (value) => {
      emitted = value;
    });
    const notifications = [{ uri: "at://did:test/notif/1" }];
    dataStore.setNotifications(notifications);
    assertEquals(emitted, notifications);
  });

  it("should emit setProfileSearchResults when profile search results are set", () => {
    const dataStore = new DataStore();
    let emitted = null;
    dataStore.on("setProfileSearchResults", (value) => {
      emitted = value;
    });
    const results = { actors: [{ did: "did:plc:a" }], cursor: "next" };
    dataStore.setProfileSearchResults(results);
    assertEquals(emitted, results);
  });

  it("should emit setFeedGenerator when a feed generator is set", () => {
    const dataStore = new DataStore();
    let emitted = null;
    dataStore.on("setFeedGenerator", (value) => {
      emitted = value;
    });
    const feedGenerator = {
      uri: "at://did:test/app.bsky.feed.generator/test",
      displayName: "Test",
    };
    dataStore.setFeedGenerator(feedGenerator.uri, feedGenerator);
    assertEquals(emitted, feedGenerator);
  });
});

t.describe("Trivial accessor pairs", (it) => {
  const accessors = [
    { name: "ProfileFollowers", key: "did:plc:a", value: { followers: [] } },
    { name: "ProfileFollows", key: "did:plc:b", value: { follows: [] } },
    { name: "ProfileChatStatus", key: "did:plc:c", value: { status: "all" } },
    {
      name: "PluginFilteredFeedItems",
      key: "at://did:test/app.bsky.feed.generator/x",
      value: { items: ["a", "b"] },
    },
    {
      name: "AuthorFeed",
      key: "at://did:test/app.bsky.feed.generator/author",
      value: { feed: [], cursor: null },
    },
    {
      name: "FeedGenerator",
      key: "at://did:test/app.bsky.feed.generator/fg",
      value: { uri: "at://did:test/app.bsky.feed.generator/fg" },
    },
    { name: "ActorFeeds", key: "did:plc:d", value: { feeds: [] } },
    { name: "HashtagFeed", key: "#test", value: { posts: [] } },
  ];

  for (const accessor of accessors) {
    it(`should has/get/set/clear ${accessor.name}`, () => {
      const dataStore = new DataStore();
      const hasFn = `has${accessor.name}`;
      const getFn = `get${accessor.name}`;
      const setFn = `set${accessor.name}`;
      const clearFn = `clear${accessor.name}`;
      assertEquals(dataStore[hasFn](accessor.key), false);
      assertEquals(dataStore[getFn](accessor.key), undefined);
      dataStore[setFn](accessor.key, accessor.value);
      assertEquals(dataStore[hasFn](accessor.key), true);
      assertEquals(dataStore[getFn](accessor.key), accessor.value);
      dataStore[clearFn](accessor.key);
      assertEquals(dataStore[hasFn](accessor.key), false);
      assertEquals(dataStore[getFn](accessor.key), undefined);
    });
  }

  it("should has/get/set/clear PinnedFeedGenerators (singleton)", () => {
    const dataStore = new DataStore();
    const value = [{ uri: "at://did:test/app.bsky.feed.generator/pinned" }];
    assertEquals(dataStore.hasPinnedFeedGenerators(), false);
    assertEquals(dataStore.getPinnedFeedGenerators(), null);
    dataStore.setPinnedFeedGenerators(value);
    assertEquals(dataStore.hasPinnedFeedGenerators(), true);
    assertEquals(dataStore.getPinnedFeedGenerators(), value);
    dataStore.clearPinnedFeedGenerators();
    assertEquals(dataStore.hasPinnedFeedGenerators(), false);
    assertEquals(dataStore.getPinnedFeedGenerators(), null);
  });
});

await t.run();
