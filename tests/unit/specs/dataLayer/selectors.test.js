import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Selectors } from "/js/dataLayer/selectors.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Preferences } from "/js/preferences.js";

const t = new TestSuite("Selectors");

t.describe("getFeed", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should return null when feed does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getFeed(feedURI);
    assertEquals(result, null);
  });

  it("should hydrate and return a feed with posts", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getPostThread(postURI);
    assertEquals(result, null);
  });

  it("should return null when postThreadOther does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const rawThread = {
      post: { uri: postURI },
      replies: [],
    };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPost(postURI, { uri: postURI });

    const result = selectors.getPostThread(postURI);
    assertEquals(result, null);
  });

  it("should hydrate and return a simple post thread", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const rawThread = {
      post: { uri: postURI },
      replies: [],
    };

    const mainPost = { uri: postURI, content: "Main thread post" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPostThreadOther(postURI, []);
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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    dataStore.setPostThreadOther(postURI, []);
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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    dataStore.setPostThreadOther(postURI, []);
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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    dataStore.setPostThreadOther(postURI, []);
    dataStore.setPost(postURI, mainPost);
    patchStore.addPostPatch(postURI, { type: "addLike" });

    const result = selectors.getPostThread(postURI);

    assertEquals(result.post.likeCount, 6);
    assertEquals(result.post.viewer.like, "fake like");
  });

  it("should mark replies as isHidden when their URI is in postThreadOther", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const rawThread = {
      post: { uri: postURI },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1" },
          replies: [],
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply2" },
          replies: [],
        },
      ],
    };

    const mainPost = { uri: postURI, content: "Main post" };
    const replyPost1 = { uri: "reply1", content: "Hidden reply" };
    const replyPost2 = { uri: "reply2", content: "Normal reply" };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPostThreadOther(postURI, [{ uri: "reply1" }]);
    dataStore.setPost(postURI, mainPost);
    dataStore.setPost("reply1", replyPost1);
    dataStore.setPost("reply2", replyPost2);

    const result = selectors.getPostThread(postURI);

    assertEquals(result.replies[0].post.isHidden, true);
    assertEquals(result.replies[1].post.isHidden, undefined);
  });

  it("should mark nested replies as isHidden when their URI is in postThreadOther", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const rawThread = {
      post: { uri: postURI },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1" },
          replies: [
            {
              $type: "app.bsky.feed.defs#threadViewPost",
              post: { uri: "nested1" },
              replies: [],
            },
          ],
        },
      ],
    };

    dataStore.setPostThread(postURI, rawThread);
    dataStore.setPostThreadOther(postURI, [{ uri: "nested1" }]);
    dataStore.setPost(postURI, { uri: postURI });
    dataStore.setPost("reply1", { uri: "reply1" });
    dataStore.setPost("nested1", { uri: "nested1" });

    const result = selectors.getPostThread(postURI);

    assertEquals(result.replies[0].post.isHidden, undefined);
    assertEquals(result.replies[0].replies[0].post.isHidden, true);
  });

  it("should preserve non-threadViewPost replies unchanged", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    dataStore.setPostThreadOther(postURI, []);
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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    dataStore.setPost(postURI, testPost);

    const result = selectors.getPost(postURI);

    assertEquals(result, testPost);
    assert(result !== testPost); // Should be a copy due to patch application
  });

  it("should return null when optional post missing", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getPost("nonExistentPost", { require: false });
    assertEquals(result, null);
  });

  it("should return null when post missing and require not specified", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

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

t.describe("getLabelerInfo", (it) => {
  const labelerDid = "did:plc:testlabeler";
  const testLabelerInfo = {
    uri: `at://${labelerDid}/app.bsky.labeler.service/self`,
    creator: { did: labelerDid, handle: "labeler.test" },
    policies: {
      labelValueDefinitions: [
        { identifier: "nsfw", locales: [{ lang: "en", name: "NSFW" }] },
      ],
    },
  };

  it("should return labeler info from dataStore", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    dataStore.setLabelerInfo(labelerDid, testLabelerInfo);

    const result = selectors.getLabelerInfo(labelerDid);
    assertEquals(result, testLabelerInfo);
  });

  it("should return undefined when labeler info does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getLabelerInfo(labelerDid);
    assertEquals(result, undefined);
  });
});

t.describe("getLabelerSettings", (it) => {
  const labelerDid = "did:plc:testlabeler";

  it("should return labeler settings from preferences", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();

    const contentLabelPrefs = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid,
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "gore",
        labelerDid: labelerDid,
        visibility: "hide",
      },
    ];

    const mockPreferences = new Preferences(contentLabelPrefs, []);
    const mockPreferencesProvider = {
      requirePreferences: () => mockPreferences,
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getLabelerSettings(labelerDid);

    assertEquals(result.length, 2);
    assertEquals(result[0].label, "nsfw");
    assertEquals(result[0].visibility, "warn");
    assertEquals(result[1].label, "gore");
    assertEquals(result[1].visibility, "hide");
  });

  it("should return empty array when no labeler settings exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();

    const mockPreferences = new Preferences([], []);
    const mockPreferencesProvider = {
      requirePreferences: () => mockPreferences,
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getLabelerSettings(labelerDid);
    assertEquals(result.length, 0);
  });

  it("should only return settings for the specified labeler", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();

    const otherLabelerDid = "did:plc:otherlabeler";
    const contentLabelPrefs = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid,
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "spam",
        labelerDid: otherLabelerDid,
        visibility: "hide",
      },
    ];

    const mockPreferences = new Preferences(contentLabelPrefs, []);
    const mockPreferencesProvider = {
      requirePreferences: () => mockPreferences,
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const result = selectors.getLabelerSettings(labelerDid);

    assertEquals(result.length, 1);
    assertEquals(result[0].label, "nsfw");
    assertEquals(result[0].labelerDid, labelerDid);
  });
});

t.describe("getAuthorFeed (replies)", (it) => {
  const did = "did:test:alice";
  const feedURI = `${did}-replies`;

  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should keep replies authored by the user", () => {
    const dataStore = new DataStore();
    const replyPost = { uri: "post1", author: { did } };
    const parentPost = { uri: "parent1", author: { did } };
    const rootPost = { uri: "root1", author: { did } };

    dataStore.setAuthorFeed(feedURI, {
      feed: [
        {
          post: { uri: "post1" },
          reply: {
            root: { uri: "root1" },
            parent: { uri: "parent1" },
          },
        },
      ],
      cursor: "c",
    });
    dataStore.setPost("post1", replyPost);
    dataStore.setPost("parent1", parentPost);
    dataStore.setPost("root1", rootPost);

    const result = makeSelectors(dataStore).getAuthorFeed(did, "replies");

    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].post.uri, "post1");
  });

  it("should drop top-level posts (no reply)", () => {
    const dataStore = new DataStore();
    dataStore.setAuthorFeed(feedURI, {
      feed: [{ post: { uri: "post1" } }],
      cursor: "c",
    });
    dataStore.setPost("post1", { uri: "post1", author: { did } });

    const result = makeSelectors(dataStore).getAuthorFeed(did, "replies");

    assertEquals(result.feed.length, 0);
  });

  it("should drop reposts even if the reposted post is itself a reply", () => {
    const dataStore = new DataStore();
    dataStore.setAuthorFeed(feedURI, {
      feed: [
        {
          post: { uri: "post1" },
          reason: { $type: "app.bsky.feed.defs#reasonRepost" },
          reply: {
            root: { uri: "root1" },
            parent: { uri: "parent1" },
          },
        },
      ],
      cursor: "c",
    });
    dataStore.setPost("post1", { uri: "post1", author: { did: "did:other" } });
    dataStore.setPost("parent1", {
      uri: "parent1",
      author: { did: "did:other" },
    });
    dataStore.setPost("root1", {
      uri: "root1",
      author: { did: "did:other" },
    });

    const result = makeSelectors(dataStore).getAuthorFeed(did, "replies");

    assertEquals(result.feed.length, 0);
  });
});

t.describe("getNotifications", (it) => {
  let dataStore;
  let selectors;

  function makeSelectors(store) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(store, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when no notifications exist", () => {
    dataStore = new DataStore();
    selectors = makeSelectors(dataStore);
    assertEquals(selectors.getNotifications(), null);
  });

  it("should attach subject post for like notifications", () => {
    dataStore = new DataStore();
    const subjectPost = { uri: "subjectPost", content: "liked post" };
    dataStore.setPost("subjectPost", subjectPost);
    dataStore.setNotifications([
      {
        reason: "like",
        reasonSubject: "subjectPost",
        uri: "notif1",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result.length, 1);
    assertEquals(result[0].subject, subjectPost);
  });

  it("should fall back to unavailable post for like when subject missing", () => {
    dataStore = new DataStore();
    dataStore.setNotifications([
      {
        reason: "like",
        reasonSubject: "missingSubject",
        uri: "notif1",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(
      result[0].subject.$type,
      "social.impro.feed.defs#unavailablePost",
    );
    assertEquals(result[0].subject.uri, "missingSubject");
  });

  it("should attach subject post for repost notifications", () => {
    dataStore = new DataStore();
    const subjectPost = { uri: "rpSubject", content: "reposted" };
    dataStore.setPost("rpSubject", subjectPost);
    dataStore.setNotifications([
      {
        reason: "repost",
        reasonSubject: "rpSubject",
        uri: "notif2",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].subject, subjectPost);
  });

  it("should attach subject post for like-via-repost notifications", () => {
    dataStore = new DataStore();
    const subjectPost = { uri: "viaSubject", content: "via repost" };
    dataStore.setPost("viaSubject", subjectPost);
    dataStore.setNotifications([
      {
        reason: "like-via-repost",
        record: { subject: { uri: "viaSubject" } },
        uri: "notif3",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].subject, subjectPost);
  });

  it("should fall back to unavailable post for like-via-repost when missing", () => {
    dataStore = new DataStore();
    dataStore.setNotifications([
      {
        reason: "repost-via-repost",
        record: { subject: { uri: "missingVia" } },
        uri: "notif4",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(
      result[0].subject.$type,
      "social.impro.feed.defs#unavailablePost",
    );
    assertEquals(result[0].subject.uri, "missingVia");
  });

  it("should attach post and parentPost for reply notifications", () => {
    dataStore = new DataStore();
    const replyPost = { uri: "replyUri", content: "the reply" };
    const parentPost = { uri: "parentUri", content: "the parent" };
    dataStore.setPost("replyUri", replyPost);
    dataStore.setPost("parentUri", parentPost);
    dataStore.setNotifications([
      {
        reason: "reply",
        uri: "replyUri",
        record: { reply: { parent: { uri: "parentUri" } } },
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].post, replyPost);
    assertEquals(result[0].parentPost, parentPost);
  });

  it("should attach post for mention notifications without parent", () => {
    dataStore = new DataStore();
    const mentionPost = { uri: "mentionUri", content: "mention" };
    dataStore.setPost("mentionUri", mentionPost);
    dataStore.setNotifications([
      {
        reason: "mention",
        uri: "mentionUri",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].post, mentionPost);
    assertEquals(result[0].parentPost, null);
  });

  it("should attach post and parentPost for quote notifications", () => {
    dataStore = new DataStore();
    const quotePost = { uri: "quoteUri", content: "quote" };
    const parentPost = { uri: "parentUri", content: "parent" };
    dataStore.setPost("quoteUri", quotePost);
    dataStore.setPost("parentUri", parentPost);
    dataStore.setNotifications([
      {
        reason: "quote",
        uri: "quoteUri",
        record: { reply: { parent: { uri: "parentUri" } } },
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].post, quotePost);
    assertEquals(result[0].parentPost, parentPost);
  });

  it("should attach reasonSubject post for subscribed-post notifications", () => {
    dataStore = new DataStore();
    const subPost = { uri: "subUri", content: "subscribed" };
    dataStore.setPost("subUri", subPost);
    dataStore.setNotifications([
      {
        reason: "subscribed-post",
        uri: "subUri",
      },
    ]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0].reasonSubject, subPost);
  });

  it("should pass follow notifications through unchanged", () => {
    dataStore = new DataStore();
    const followNotification = {
      reason: "follow",
      uri: "followUri",
      author: { did: "did:test:follower" },
    };
    dataStore.setNotifications([followNotification]);
    selectors = makeSelectors(dataStore);

    const result = selectors.getNotifications();
    assertEquals(result[0], followNotification);
  });
});

t.describe("getMentionNotifications", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when none exist", () => {
    const dataStore = new DataStore();
    assertEquals(makeSelectors(dataStore).getMentionNotifications(), null);
  });

  it("should attach post and parentPost for reply mentions", () => {
    const dataStore = new DataStore();
    const replyPost = { uri: "rUri", content: "reply" };
    const parentPost = { uri: "pUri", content: "parent" };
    dataStore.setPost("rUri", replyPost);
    dataStore.setPost("pUri", parentPost);
    dataStore.setMentionNotifications([
      {
        reason: "reply",
        uri: "rUri",
        record: { reply: { parent: { uri: "pUri" } } },
      },
    ]);

    const result = makeSelectors(dataStore).getMentionNotifications();
    assertEquals(result[0].post, replyPost);
    assertEquals(result[0].parentPost, parentPost);
  });

  it("should attach post for mention without parent", () => {
    const dataStore = new DataStore();
    const post = { uri: "mUri", content: "m" };
    dataStore.setPost("mUri", post);
    dataStore.setMentionNotifications([{ reason: "mention", uri: "mUri" }]);

    const result = makeSelectors(dataStore).getMentionNotifications();
    assertEquals(result[0].post, post);
    assertEquals(result[0].parentPost, null);
  });

  it("should pass non-reply/mention/quote notifications through unchanged", () => {
    const dataStore = new DataStore();
    const followNotif = { reason: "follow", uri: "fUri" };
    dataStore.setMentionNotifications([followNotif]);

    const result = makeSelectors(dataStore).getMentionNotifications();
    assertEquals(result[0], followNotif);
  });
});

t.describe("getConvoList", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when convo list is missing", () => {
    const dataStore = new DataStore();
    assertEquals(makeSelectors(dataStore).getConvoList(), null);
  });

  it("should sort convos by last interaction descending", () => {
    const dataStore = new DataStore();
    const olderConvo = {
      id: "convoOld",
      members: [],
      lastMessage: {
        $type: "chat.bsky.convo.defs#messageView",
        sentAt: "2024-01-01T00:00:00Z",
      },
    };
    const newerConvo = {
      id: "convoNew",
      members: [],
      lastMessage: {
        $type: "chat.bsky.convo.defs#messageView",
        sentAt: "2024-06-01T00:00:00Z",
      },
    };
    dataStore.setConvo("convoOld", olderConvo);
    dataStore.setConvo("convoNew", newerConvo);
    dataStore.setConvoList([{ id: "convoOld" }, { id: "convoNew" }]);

    const result = makeSelectors(dataStore).getConvoList();
    assertEquals(result.length, 2);
    assertEquals(result[0].id, "convoNew");
    assertEquals(result[1].id, "convoOld");
  });

  it("should hydrate convos via getConvo", () => {
    const dataStore = new DataStore();
    const fullConvo = {
      id: "convo1",
      members: [{ did: "did:test:a" }, { did: "did:test:b" }],
      lastMessage: {
        $type: "chat.bsky.convo.defs#messageView",
        sentAt: "2024-01-01T00:00:00Z",
      },
    };
    dataStore.setConvo("convo1", fullConvo);
    dataStore.setConvoList([{ id: "convo1" }]);

    const result = makeSelectors(dataStore).getConvoList();
    assertEquals(result[0], fullConvo);
  });
});

t.describe("getConvoForProfile", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when no convo with the profile exists", () => {
    const dataStore = new DataStore();
    dataStore.setConvo("convo1", {
      id: "convo1",
      members: [{ did: "did:test:a" }, { did: "did:test:b" }],
    });
    const result =
      makeSelectors(dataStore).getConvoForProfile("did:test:other");
    assertEquals(result, null);
  });

  it("should return the matching two-member convo", () => {
    const dataStore = new DataStore();
    const convo = {
      id: "convo1",
      members: [{ did: "did:test:self" }, { did: "did:test:friend" }],
    };
    dataStore.setConvo("convo1", convo);
    const result =
      makeSelectors(dataStore).getConvoForProfile("did:test:friend");
    assertEquals(result, convo);
  });

  it("should ignore group convos with more than two members", () => {
    const dataStore = new DataStore();
    dataStore.setConvo("groupConvo", {
      id: "groupConvo",
      members: [
        { did: "did:test:a" },
        { did: "did:test:b" },
        { did: "did:test:c" },
      ],
    });
    const result = makeSelectors(dataStore).getConvoForProfile("did:test:b");
    assertEquals(result, null);
  });

  it("should return null when there are no convos at all", () => {
    const dataStore = new DataStore();
    const result = makeSelectors(dataStore).getConvoForProfile("did:test:any");
    assertEquals(result, null);
  });
});

t.describe("getBookmarks", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when bookmarks are missing", () => {
    const dataStore = new DataStore();
    assertEquals(makeSelectors(dataStore).getBookmarks(), null);
  });

  it("should hydrate bookmarked posts via getPost", () => {
    const dataStore = new DataStore();
    const post = { uri: "bm1", content: "bookmarked" };
    dataStore.setPost("bm1", post);
    dataStore.setBookmarks({
      feed: [{ post: { uri: "bm1" } }],
      cursor: "c1",
    });

    const result = makeSelectors(dataStore).getBookmarks();
    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].post, post);
    assertEquals(result.cursor, "c1");
  });

  it("should attach parentAuthor when bookmarked post is a reply", () => {
    const dataStore = new DataStore();
    const parentPost = {
      uri: "parentUri",
      author: { did: "did:test:parent", handle: "parent.test" },
    };
    const replyPost = {
      uri: "replyUri",
      record: { reply: { parent: { uri: "parentUri" } } },
    };
    dataStore.setPost("parentUri", parentPost);
    dataStore.setPost("replyUri", replyPost);
    dataStore.setBookmarks({
      feed: [{ post: { uri: "replyUri" } }],
      cursor: null,
    });

    const result = makeSelectors(dataStore).getBookmarks();
    assertEquals(
      result.feed[0].post.record.reply.parentAuthor,
      parentPost.author,
    );
  });

  it("should filter out bookmarks for blocked posts", () => {
    const dataStore = new DataStore();
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blockedUri",
      author: { did: "did:test:blocked", viewer: { blockedBy: true } },
    };
    const okPost = { uri: "okUri", content: "ok" };
    dataStore.setPost("blockedUri", blockedPost);
    dataStore.setPost("okUri", okPost);
    dataStore.setBookmarks({
      feed: [{ post: { uri: "blockedUri" } }, { post: { uri: "okUri" } }],
      cursor: null,
    });

    const result = makeSelectors(dataStore).getBookmarks();
    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].post, okPost);
  });
});

t.describe("getAuthorFeed (non-replies)", (it) => {
  const did = "did:test:alice";

  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should return null when feed is missing", () => {
    const dataStore = new DataStore();
    const result = makeSelectors(dataStore).getAuthorFeed(did, "posts");
    assertEquals(result, null);
  });

  it("should keep top-level posts in posts feed", () => {
    const dataStore = new DataStore();
    const post = { uri: "post1", author: { did } };
    dataStore.setAuthorFeed(`${did}-posts`, {
      feed: [{ post: { uri: "post1" } }],
      cursor: "c",
    });
    dataStore.setPost("post1", post);

    const result = makeSelectors(dataStore).getAuthorFeed(did, "posts");
    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].post, post);
  });

  it("should keep replies in posts feed (no replies-only filter)", () => {
    const dataStore = new DataStore();
    const replyPost = { uri: "post1", author: { did } };
    const parentPost = { uri: "parent1", author: { did } };
    const rootPost = { uri: "root1", author: { did } };
    dataStore.setAuthorFeed(`${did}-posts`, {
      feed: [
        {
          post: { uri: "post1" },
          reply: {
            root: { uri: "root1" },
            parent: { uri: "parent1" },
          },
        },
      ],
      cursor: "c",
    });
    dataStore.setPost("post1", replyPost);
    dataStore.setPost("parent1", parentPost);
    dataStore.setPost("root1", rootPost);

    const result = makeSelectors(dataStore).getAuthorFeed(did, "posts");
    assertEquals(result.feed.length, 1);
    assertEquals(result.feed[0].reply.root, rootPost);
    assertEquals(result.feed[0].reply.parent, parentPost);
  });

  it("should preserve reason on reposts", () => {
    const dataStore = new DataStore();
    const repostedPost = { uri: "post1", author: { did: "did:other" } };
    dataStore.setAuthorFeed(`${did}-posts`, {
      feed: [
        {
          post: { uri: "post1" },
          reason: { $type: "app.bsky.feed.defs#reasonRepost" },
        },
      ],
      cursor: "c",
    });
    dataStore.setPost("post1", repostedPost);

    const result = makeSelectors(dataStore).getAuthorFeed(did, "posts");
    assertEquals(result.feed.length, 1);
    assertEquals(
      result.feed[0].reason.$type,
      "app.bsky.feed.defs#reasonRepost",
    );
  });

  it("should pass through cursor", () => {
    const dataStore = new DataStore();
    dataStore.setAuthorFeed(`${did}-posts`, {
      feed: [],
      cursor: "next-page-cursor",
    });
    const result = makeSelectors(dataStore).getAuthorFeed(did, "posts");
    assertEquals(result.cursor, "next-page-cursor");
  });
});

t.describe("filterAuthorRepliesFeed", (it) => {
  function makeSelectors() {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should keep items that have a reply and no reason", () => {
    const selectors = makeSelectors();
    const reply = { post: { uri: "p1" }, reply: { root: {}, parent: {} } };
    const result = selectors.filterAuthorRepliesFeed({
      feed: [reply],
      cursor: "c",
    });
    assertEquals(result.feed, [reply]);
    assertEquals(result.cursor, "c");
  });

  it("should drop items without a reply", () => {
    const selectors = makeSelectors();
    const result = selectors.filterAuthorRepliesFeed({
      feed: [{ post: { uri: "p1" } }],
      cursor: null,
    });
    assertEquals(result.feed.length, 0);
  });

  it("should drop items that have a reason (e.g. reposts) even if reply present", () => {
    const selectors = makeSelectors();
    const item = {
      post: { uri: "p1" },
      reply: { root: {}, parent: {} },
      reason: { $type: "app.bsky.feed.defs#reasonRepost" },
    };
    const result = selectors.filterAuthorRepliesFeed({
      feed: [item],
      cursor: null,
    });
    assertEquals(result.feed.length, 0);
  });

  it("should preserve cursor when filtering", () => {
    const selectors = makeSelectors();
    const result = selectors.filterAuthorRepliesFeed({
      feed: [],
      cursor: "abc",
    });
    assertEquals(result.cursor, "abc");
  });
});

t.describe("hydratePostThread (direct)", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should hydrate the root post via getPost", () => {
    const dataStore = new DataStore();
    const mainPost = { uri: "mainUri", content: "main" };
    dataStore.setPost("mainUri", mainPost);
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThread(
      { post: { uri: "mainUri" }, replies: [] },
      [],
    );
    assertEquals(result.post, mainPost);
    assertEquals(result.replies, []);
  });

  it("should mark the root post hidden when its uri is in hiddenReplyUris", () => {
    const dataStore = new DataStore();
    dataStore.setPost("mainUri", { uri: "mainUri", content: "main" });
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThread(
      { post: { uri: "mainUri" }, replies: [] },
      ["mainUri"],
    );
    assertEquals(result.post.isHidden, true);
  });

  it("should recursively hydrate nested threadViewPost replies", () => {
    const dataStore = new DataStore();
    dataStore.setPost("mainUri", { uri: "mainUri" });
    dataStore.setPost("childUri", { uri: "childUri", content: "child" });
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThread(
      {
        post: { uri: "mainUri" },
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: { uri: "childUri" },
            replies: [],
          },
        ],
      },
      [],
    );
    assertEquals(result.replies[0].post.uri, "childUri");
    assertEquals(result.replies[0].post.content, "child");
  });

  it("should pass non-threadViewPost replies through unchanged", () => {
    const dataStore = new DataStore();
    dataStore.setPost("mainUri", { uri: "mainUri" });
    const selectors = makeSelectors(dataStore);
    const otherReply = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: "missingUri",
    };
    const result = selectors.hydratePostThread(
      { post: { uri: "mainUri" }, replies: [otherReply] },
      [],
    );
    assertEquals(result.replies[0], otherReply);
  });

  it("should return blocked post unchanged when blocking user", () => {
    const dataStore = new DataStore();
    const blockedThread = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blockedUri",
      author: { did: "did:test:b", viewer: { blockedBy: true } },
    };
    const selectors = makeSelectors(dataStore);
    const result = selectors.hydratePostThread(blockedThread, []);
    assertEquals(result, blockedThread);
  });
});

t.describe("hydratePostThreadParent (direct)", (it) => {
  function makeSelectors(dataStore) {
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    return new Selectors(dataStore, patchStore, mockPreferencesProvider, false);
  }

  it("should hydrate a simple parent via getPost", () => {
    const dataStore = new DataStore();
    const parentPost = { uri: "parentUri", content: "parent" };
    dataStore.setPost("parentUri", parentPost);
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThreadParent({
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: "parentUri" },
    });
    assertEquals(result.post, parentPost);
    assertEquals(result.$type, "app.bsky.feed.defs#threadViewPost");
  });

  it("should walk up the parent chain recursively", () => {
    const dataStore = new DataStore();
    dataStore.setPost("parentUri", { uri: "parentUri", content: "parent" });
    dataStore.setPost("grandUri", { uri: "grandUri", content: "grand" });
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThreadParent({
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: "parentUri" },
      parent: {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: { uri: "grandUri" },
      },
    });
    assertEquals(result.post.uri, "parentUri");
    assertEquals(result.parent.post.uri, "grandUri");
  });

  it("should return an unavailable post when parent uri is marked unavailable", () => {
    const dataStore = new DataStore();
    dataStore.setUnavailablePost("missingParent", { uri: "missingParent" });
    const selectors = makeSelectors(dataStore);

    const result = selectors.hydratePostThreadParent({
      $type: "app.bsky.feed.defs#threadViewPost",
      post: { uri: "missingParent" },
      uri: "missingParent",
    });
    assertEquals(result.$type, "social.impro.feed.defs#unavailablePost");
    assertEquals(result.uri, "missingParent");
  });

  it("should return blocked parent unchanged when blocking user", () => {
    const dataStore = new DataStore();
    const blockedParent = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "blockedParent",
      author: { did: "did:test:b", viewer: { blockedBy: true } },
    };
    const selectors = makeSelectors(dataStore);
    const result = selectors.hydratePostThreadParent(blockedParent);
    assertEquals(result, blockedParent);
  });

  it("should return non-threadViewPost parent unchanged", () => {
    const dataStore = new DataStore();
    const selectors = makeSelectors(dataStore);
    const notFoundParent = {
      $type: "app.bsky.feed.defs#notFoundPost",
      uri: "missingUri",
    };
    const result = selectors.hydratePostThreadParent(notFoundParent);
    assertEquals(result, notFoundParent);
  });
});

t.describe("getPost muted-word marking", (it) => {
  it("should mark post viewer.hasMutedWord when text contains a muted word", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    let preferences = Preferences.createLoggedOutPreferences();
    preferences = preferences.addMutedWord({
      value: "spoiler",
      targets: ["content"],
      actorTarget: "all",
      expiresAt: null,
    });
    const mockPreferencesProvider = { requirePreferences: () => preferences };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const post = {
      uri: "mutedPost",
      record: { text: "this is a spoiler about the show" },
      viewer: {},
    };
    dataStore.setPost("mutedPost", post);

    const result = selectors.getPost("mutedPost");
    assertEquals(result.viewer.hasMutedWord, true);
  });

  it("should not mark posts that don't match a muted word", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    let preferences = Preferences.createLoggedOutPreferences();
    preferences = preferences.addMutedWord({
      value: "spoiler",
      targets: ["content"],
      actorTarget: "all",
      expiresAt: null,
    });
    const mockPreferencesProvider = { requirePreferences: () => preferences };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const post = {
      uri: "okPost",
      record: { text: "this is fine" },
      viewer: {},
    };
    dataStore.setPost("okPost", post);

    const result = selectors.getPost("okPost");
    assertEquals(result.viewer.hasMutedWord, undefined);
  });
});

t.describe("getPost hidden-post marking", (it) => {
  it("should mark post viewer.isHidden when uri is in hidden posts preference", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    let preferences = Preferences.createLoggedOutPreferences();
    preferences = preferences.hidePost("hiddenUri");
    const mockPreferencesProvider = { requirePreferences: () => preferences };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const post = { uri: "hiddenUri", viewer: {} };
    dataStore.setPost("hiddenUri", post);

    const result = selectors.getPost("hiddenUri");
    assertEquals(result.viewer.isHidden, true);
  });

  it("should leave viewer.isHidden unset for non-hidden posts", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const preferences = Preferences.createLoggedOutPreferences();
    const mockPreferencesProvider = { requirePreferences: () => preferences };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const post = { uri: "visibleUri", viewer: {} };
    dataStore.setPost("visibleUri", post);

    const result = selectors.getPost("visibleUri");
    assertEquals(result.viewer.isHidden, undefined);
  });
});

t.describe("getPost label handling", (it) => {
  it("should not attach badgeLabels/contentLabel/mediaLabel for unlabeled posts", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const selectors = new Selectors(
      dataStore,
      patchStore,
      mockPreferencesProvider,
      false,
    );

    const post = { uri: "plainUri", viewer: {} };
    dataStore.setPost("plainUri", post);

    const result = selectors.getPost("plainUri");
    assertEquals(result.badgeLabels, undefined);
    assertEquals(result.contentLabel, undefined);
    assertEquals(result.mediaLabel, undefined);
  });
});

await t.run();
