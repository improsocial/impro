import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Requests } from "/js/dataLayer/requests.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";
import { DraftMediaStore } from "/js/drafts.js";
import { Preferences } from "/js/preferences.js";
import { ApiError } from "/js/api.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { QueryStore } from "/js/dataLayer/queryStore.js";
import {
  actorFeedsQueryKey,
  actorListsQueryKey,
  authorFeedQueryKey,
  blockedProfilesQueryKey,
  bookmarksQueryKey,
  chatRecipientSearchQueryKey,
  convoListQueryKey,
  convoMembersQueryKey,
  convoMessagesQueryKey,
  convoRequestListQueryKey,
  detailedProfileRequestKey,
  draftsQueryKey,
  feedQueryKey,
  feedSearchQueryKey,
  hashtagFeedQueryKey,
  knownFollowersQueryKey,
  listMembersQueryKey,
  listsWithMembershipQueryKey,
  mentionNotificationsQueryKey,
  mutedProfilesQueryKey,
  notificationsQueryKey,
  pinnedItemsQueryKey,
  postLikesQueryKey,
  postQuotesQueryKey,
  postRepostsQueryKey,
  postSearchLatestQueryKey,
  postSearchTopQueryKey,
  postThreadOtherQueryKey,
  postThreadQueryKey,
  profileFollowersQueryKey,
  profileFollowsQueryKey,
  profileSearchQueryKey,
  searchTypeaheadQueryKey,
  sidebarSearchTypeaheadQueryKey,
} from "/js/dataLayer/queryKeys.js";

const stubConstellation = { getLinks: async () => [] };

function createRequests(
  api,
  dataStore,
  preferencesProvider,
  events = null,
  queryStore = new QueryStore(),
) {
  return new Requests(
    api,
    dataStore,
    preferencesProvider,
    new DraftMediaStore("test-media"),
    events ?? new EventEmitter(),
    stubConstellation,
    queryStore,
  );
}

describe("loadPostThread", () => {
  const postURI = "at://did:test/app.bsky.feed.post/thread";

  it("should load and store post thread", async () => {
    const mockPostThread = {
      post: { uri: postURI, content: "Main post" },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
      ],
    };

    const mockPostThreadOther = [{ uri: "reply1" }];

    const normalizedPosts = [
      { uri: postURI, content: "Main post" },
      { uri: "reply1", content: "Reply 1" },
    ];

    const mockApi = {
      getPostThread: async () => mockPostThread,
      getPostThreadOther: async () => mockPostThreadOther,
    };

    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    // Check thread was stored
    assert.deepEqual(
      requests.queryStore.getValue(postThreadQueryKey({ uri: postURI })),
      mockPostThread,
    );

    // Check postThreadOther was stored
    assert.deepEqual(
      requests.queryStore.getValue(postThreadOtherQueryKey({ uri: postURI })),
      mockPostThreadOther,
    );

    // Check posts were stored
    assert.deepEqual(dataStore.$posts.get(postURI), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("reply1"), normalizedPosts[1]);
  });

  it("should handle empty post thread", async () => {
    const emptyPostThread = {
      post: { uri: postURI, content: "Lonely post" },
      replies: [],
    };

    const normalizedPosts = [{ uri: postURI, content: "Lonely post" }];

    const mockApi = {
      getPostThread: async () => emptyPostThread,
      getPostThreadOther: async () => [],
    };

    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    assert.deepEqual(
      requests.queryStore.getValue(postThreadQueryKey({ uri: postURI })),
      emptyPostThread,
    );
    assert.deepEqual(
      requests.queryStore.getValue(postThreadOtherQueryKey({ uri: postURI })),
      [],
    );
    assert.deepEqual(dataStore.$posts.get(postURI), normalizedPosts[0]);
  });
});

describe("loadNextFeedPage", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  it("should load initial feed page", async () => {
    const mockFeed = {
      feed: [{ post: { uri: "post1" } }, { post: { uri: "post2" } }],
      cursor: "cursor123",
    };

    const normalizedPosts = [{ uri: "post1" }, { uri: "post2" }];

    const mockApi = {
      getFeed: async () => mockFeed,
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    // Check feed was stored
    const queryKey = feedQueryKey({ uri: feedURI });
    assert.deepEqual(requests.queryStore.getItems(queryKey), mockFeed.feed);
    assert.deepEqual(requests.queryStore.getNextCursor(queryKey), "cursor123");

    // Check posts were stored
    assert.deepEqual(dataStore.$posts.get("post1"), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("post2"), normalizedPosts[1]);
  });

  it("should append to existing feed", async () => {
    const dataStore = new DataStore(createSessionState(null));

    // Set up existing feed
    const existingFeed = {
      feed: [{ post: { uri: "post1" } }],
      cursor: "cursor1",
    };
    const queryStore = new QueryStore();
    const queryKey = feedQueryKey({ uri: feedURI });
    queryStore.set(queryKey, {
      pages: [{ items: existingFeed.feed, cursor: existingFeed.cursor }],
    });

    // New page
    const newPage = {
      feed: [{ post: { uri: "post2" } }, { post: { uri: "post3" } }],
      cursor: "cursor2",
    };

    const normalizedPosts = [{ uri: "post2" }, { uri: "post3" }];

    const mockApi = {
      getFeed: async () => newPage,
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    // Check feed was appended
    const storedItems = queryStore.getItems(queryKey);
    assert.deepEqual(storedItems.length, 3);
    assert.deepEqual(storedItems[0], { post: { uri: "post1" } });
    assert.deepEqual(storedItems[1], { post: { uri: "post2" } });
    assert.deepEqual(storedItems[2], { post: { uri: "post3" } });
    assert.deepEqual(queryStore.getNextCursor(queryKey), "cursor2");

    // Check new posts were stored
    assert.deepEqual(dataStore.$posts.get("post2"), normalizedPosts[0]);
    assert.deepEqual(dataStore.$posts.get("post3"), normalizedPosts[1]);
  });

  it("should discard a stale page when a reload lands mid-flight", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const queryKey = feedQueryKey({ uri: feedURI });
    queryStore.set(queryKey, {
      pages: [{ items: [{ post: { uri: "post1" } }], cursor: "cursor1" }],
    });

    const reloadedFeed = {
      feed: [{ post: { uri: "post9" } }],
      cursor: "cursor9",
    };
    const mockApi = {
      getFeed: async () => {
        // Simulate a reload finishing while this page request is in flight
        queryStore.replacePages(queryKey, {
          items: reloadedFeed.feed,
          cursor: reloadedFeed.cursor,
        });
        return { feed: [{ post: { uri: "post2" } }], cursor: "cursor2" };
      },
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    assert.deepEqual(queryStore.getItems(queryKey), reloadedFeed.feed);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "cursor9");
  });

  it("should emit feedLoaded with the reload flag", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(feedQueryKey({ uri: feedURI }), {
      pages: [{ items: [{ post: { uri: "post1" } }], cursor: "cursor1" }],
    });

    const mockApi = {
      getFeed: async () => ({ feed: [], cursor: "end" }),
    };
    const events = new EventEmitter();
    const capturedReloads = [];
    events.on("feedLoaded", ({ reload }) => capturedReloads.push(reload));
    const requests = createRequests(
      mockApi,
      dataStore,
      { requirePreferences: () => Preferences.createLoggedOutPreferences() },
      events,
      queryStore,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });
    await requests.loadNextFeedPage(
      {
        type: "feed",
        uri: feedURI,
      },
      { reload: true },
    );

    assert.deepEqual(capturedReloads, [false, true]);
  });

  it("should handle empty feed", async () => {
    const emptyFeed = {
      feed: [],
      cursor: "end",
    };

    const mockApi = {
      getFeed: async () => emptyFeed,
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    const queryKey = feedQueryKey({ uri: feedURI });
    assert.deepEqual(requests.queryStore.getItems(queryKey), []);
    assert.deepEqual(requests.queryStore.getNextCursor(queryKey), "end");
  });

  it("should handle feed with reply context", async () => {
    const feedWithReplies = {
      feed: [
        {
          post: { uri: "post1" },
          reply: {
            root: { $type: "app.bsky.feed.defs#postView", uri: "root1" },
            parent: { $type: "app.bsky.feed.defs#postView", uri: "parent1" },
          },
        },
      ],
      cursor: "cursor123",
    };

    const normalizedPosts = [
      { uri: "post1", content: "Reply post" },
      { uri: "root1", content: "Root post" },
      { uri: "parent1", content: "Parent post" },
    ];

    const mockApi = {
      getFeed: async () => feedWithReplies,
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadNextFeedPage({ type: "feed", uri: feedURI });

    assert.deepEqual(
      requests.queryStore.getItems(feedQueryKey({ uri: feedURI })),
      feedWithReplies.feed,
    );
    assert.deepEqual(dataStore.$posts.get("post1").uri, normalizedPosts[0].uri);
    assert.deepEqual(dataStore.$posts.get("root1").uri, normalizedPosts[1].uri);
    assert.deepEqual(
      dataStore.$posts.get("parent1").uri,
      normalizedPosts[2].uri,
    );
  });
});

describe("loadDetailedProfile", () => {
  const profileDID = "did:test:profile";

  it("should load and store profile", async () => {
    const mockProfile = {
      did: profileDID,
      handle: "test.user",
      displayName: "Test User",
      description: "A test user",
    };

    const mockApi = {
      getProfile: async () => mockProfile,
    };

    const dataStore = new DataStore(createSessionState(null));

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadDetailedProfile(profileDID);

    // Check profile was stored
    assert.deepEqual(dataStore.$profiles.get(profileDID), mockProfile);
  });

  it("should handle profile updates", async () => {
    const dataStore = new DataStore(createSessionState(null));

    // Load initial profile
    const initialProfile = {
      did: profileDID,
      handle: "old.handle",
      displayName: "Old Name",
    };

    const mockApi = {
      getProfile: async () => initialProfile,
    };

    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadDetailedProfile(profileDID);

    assert.deepEqual(dataStore.$profiles.get(profileDID), initialProfile);

    // Load updated profile
    const updatedProfile = {
      did: profileDID,
      handle: "new.handle",
      displayName: "New Name",
    };

    mockApi.getProfile = async () => updatedProfile;

    await requests.loadDetailedProfile(profileDID);

    assert.deepEqual(dataStore.$profiles.get(profileDID), updatedProfile);
  });
});

describe("loadPosts", () => {
  it("loads and stores each post by uri", async () => {
    const postA = { uri: "at://a", content: "A" };
    const postB = { uri: "at://b", content: "B" };
    let calledWith = null;

    const mockApi = {
      getPosts: async (uris) => {
        calledWith = uris;
        return [postA, postB];
      },
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPosts(["at://a", "at://b"]);

    assert.deepEqual(calledWith, ["at://a", "at://b"]);
    assert.deepEqual(dataStore.$posts.get("at://a"), postA);
    assert.deepEqual(dataStore.$posts.get("at://b"), postB);
  });

  it("does not call api when uris is empty", async () => {
    let called = false;
    const mockApi = {
      getPosts: async () => {
        called = true;
        return [];
      },
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadPosts([]);

    assert.deepEqual(called, false);
  });
});

describe("loadLabelerInfo", () => {
  const labelerDid = "did:plc:testlabeler";

  it("should load and store labeler info", async () => {
    const mockLabelerInfo = {
      uri: `at://${labelerDid}/app.bsky.labeler.service/self`,
      creator: { did: labelerDid, handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          { identifier: "nsfw", locales: [{ lang: "en", name: "NSFW" }] },
        ],
      },
    };

    const mockApi = {
      getLabeler: async () => mockLabelerInfo,
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);

    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), mockLabelerInfo);
  });

  it("should call api.getLabeler with correct DID", async () => {
    let calledWithDid = null;
    const mockApi = {
      getLabeler: async (did) => {
        calledWithDid = did;
        return { creator: { did } };
      },
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);

    assert.deepEqual(calledWithDid, labelerDid);
  });

  it("should overwrite existing labeler info on reload", async () => {
    const initialInfo = {
      creator: { did: labelerDid, handle: "old.handle" },
      policies: { labelValueDefinitions: [] },
    };
    const updatedInfo = {
      creator: { did: labelerDid, handle: "new.handle" },
      policies: {
        labelValueDefinitions: [{ identifier: "test" }],
      },
    };

    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };

    let currentInfo = initialInfo;
    const mockApi = {
      getLabeler: async () => currentInfo,
    };

    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );

    await requests.loadLabelerInfo(labelerDid);
    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), initialInfo);

    currentInfo = updatedInfo;
    await requests.loadLabelerInfo(labelerDid);
    assert.deepEqual(dataStore.$labelerInfo.get(labelerDid), updatedInfo);
  });
});

describe("loadMutedProfiles", () => {
  it("should store muted profiles on first load", async () => {
    const res = {
      mutes: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
      cursor: "next",
    };
    const mockApi = { getMutes: async () => res };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadMutedProfiles();

    assert.deepEqual(queryStore.getItems(mutedProfilesQueryKey()), [
      "did:plc:a",
      "did:plc:b",
    ]);
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
    assert.deepEqual(dataStore.$profiles.get("did:plc:b"), {
      did: "did:plc:b",
    });
  });

  it("should append paginated muted profiles when cursor is provided", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: ["did:plc:a"], cursor: "page2" }],
    });

    const mockApi = {
      getMutes: async () => ({
        mutes: [{ did: "did:plc:b" }],
        cursor: undefined,
      }),
    };
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadMutedProfiles();

    assert.deepEqual(queryStore.getItems(mutedProfilesQueryKey()), [
      "did:plc:a",
      "did:plc:b",
    ]);
  });

  it("should pass cursor through to the api", async () => {
    let capturedCursor;
    const mockApi = {
      getMutes: async ({ cursor }) => {
        capturedCursor = cursor;
        return { mutes: [], cursor: undefined };
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(mutedProfilesQueryKey(), {
      pages: [{ items: [], cursor: "abc" }],
    });
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
      null,
      queryStore,
    );

    await requests.loadMutedProfiles();
    assert.deepEqual(capturedCursor, "abc");
  });

  it("should discard a page whose cursor no longer matches the slot", () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const existing = { pages: [{ items: ["did:plc:a"], cursor: "page3" }] };
    queryStore.set(mutedProfilesQueryKey(), existing);

    // A page fetched from page2 landing after the slot moved on to page3.
    const written = queryStore.appendPage(
      mutedProfilesQueryKey(),
      { items: ["did:plc:b"], cursor: "page4" },
      { requestCursor: "page2" },
    );

    assert.deepEqual(written, false);
    assert.deepEqual(queryStore.get(mutedProfilesQueryKey()), existing);
  });
});

function makeRequests(
  api,
  dataStore = new DataStore(createSessionState(null)),
  preferences,
  queryStore = new QueryStore(),
) {
  const provider = {
    requirePreferences: () =>
      preferences ?? Preferences.createLoggedOutPreferences(),
  };
  return createRequests(api, dataStore, provider, null, queryStore);
}

describe("loadBlockedProfiles", () => {
  it("should store blocked profiles on first load", async () => {
    const res = {
      blocks: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
      cursor: "next",
    };
    const mockApi = { getBlocks: async () => res };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBlockedProfiles();

    assert.deepEqual(queryStore.getItems(blockedProfilesQueryKey()), [
      "did:plc:a",
      "did:plc:b",
    ]);
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
    assert.deepEqual(dataStore.$profiles.get("did:plc:b"), {
      did: "did:plc:b",
    });
  });

  it("should append paginated blocked profiles when cursor is provided", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: ["did:plc:a"], cursor: "page2" }],
    });

    const mockApi = {
      getBlocks: async () => ({
        blocks: [{ did: "did:plc:b" }],
        cursor: undefined,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBlockedProfiles();

    assert.deepEqual(queryStore.getItems(blockedProfilesQueryKey()), [
      "did:plc:a",
      "did:plc:b",
    ]);
  });

  it("should pass cursor through to the api", async () => {
    let capturedCursor;
    const mockApi = {
      getBlocks: async ({ cursor }) => {
        capturedCursor = cursor;
        return { blocks: [], cursor: undefined };
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(blockedProfilesQueryKey(), {
      pages: [{ items: [], cursor: "abc" }],
    });
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBlockedProfiles();
    assert.deepEqual(capturedCursor, "abc");
  });
});

describe("loadNextAuthorFeedPage", () => {
  const did = "did:plc:author";
  const postsQueryKey = authorFeedQueryKey({ did, feedType: "posts" });

  it("should call getAuthorFeed with posts filter for posts feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (calledDid, params) => {
        capturedParams = { did: calledDid, ...params };
        return { feed: [{ post: { uri: "p1" } }], cursor: "c1" };
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNextAuthorFeedPage({ did, feedType: "posts" });

    assert.deepEqual(capturedParams.did, did);
    assert.deepEqual(capturedParams.filter, "posts_and_author_threads");
    assert.deepEqual(capturedParams.includePins, true);
    assert.deepEqual(capturedParams.cursor, "");
    assert.deepEqual(queryStore.getItems(postsQueryKey), [
      { post: { uri: "p1" } },
    ]);
  });

  it("should use posts_with_replies filter for replies feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedParams = params;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage({ did, feedType: "replies" });

    assert.deepEqual(capturedParams.filter, "posts_with_replies");
    assert.deepEqual(capturedParams.includePins, false);
  });

  it("should use posts_with_media filter for media feedType", async () => {
    let capturedParams;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedParams = params;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage({ did, feedType: "media" });

    assert.deepEqual(capturedParams.filter, "posts_with_media");
    assert.deepEqual(capturedParams.includePins, false);
  });

  it("should call getActorLikes for likes feedType", async () => {
    let actorLikesCalled = false;
    let authorFeedCalled = false;
    const mockApi = {
      getActorLikes: async () => {
        actorLikesCalled = true;
        return { feed: [], cursor: null };
      },
      getAuthorFeed: async () => {
        authorFeedCalled = true;
        return { feed: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadNextAuthorFeedPage({ did, feedType: "likes" });

    assert.deepEqual(actorLikesCalled, true);
    assert.deepEqual(authorFeedCalled, false);
  });

  it("should append to existing feed", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(postsQueryKey, {
      pages: [{ items: [{ post: { uri: "old1" } }], cursor: "c1" }],
    });

    let capturedCursor;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedCursor = params.cursor;
        return { feed: [{ post: { uri: "new1" } }], cursor: "c2" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNextAuthorFeedPage({ did, feedType: "posts" });

    assert.deepEqual(capturedCursor, "c1");
    const items = queryStore.getItems(postsQueryKey);
    assert.deepEqual(items.length, 2);
    assert.deepEqual(items[0].post.uri, "old1");
    assert.deepEqual(items[1].post.uri, "new1");
    assert.deepEqual(queryStore.getNextCursor(postsQueryKey), "c2");
  });

  it("should reset cursor and replace feed on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(postsQueryKey, {
      pages: [{ items: [{ post: { uri: "old1" } }], cursor: "c1" }],
    });

    let capturedCursor;
    const mockApi = {
      getAuthorFeed: async (_did, params) => {
        capturedCursor = params.cursor;
        return { feed: [{ post: { uri: "new1" } }], cursor: "c2" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNextAuthorFeedPage(
      {
        did,
        feedType: "posts",
      },
      { reload: true },
    );

    assert.deepEqual(capturedCursor, "");
    const items = queryStore.getItems(postsQueryKey);
    assert.deepEqual(items.length, 1);
    assert.deepEqual(items[0].post.uri, "new1");
  });

  it("should throw on unknown feed type", async () => {
    const mockApi = { getAuthorFeed: async () => ({ feed: [], cursor: null }) };
    const requests = makeRequests(mockApi);

    let caught = null;
    try {
      await requests.loadNextAuthorFeedPage({ did, feedType: "bogus" });
    } catch (error) {
      caught = error;
    }
    assert(caught !== null, "expected error for unknown feed type");
  });
});

describe("loadPostSearchLatest", () => {
  const queryKey = postSearchLatestQueryKey({ query: "hello" });

  it("should store post uris from a fresh search", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchLatest({ query: "hello" });

    assert.deepEqual(queryStore.getItems(queryKey), ["p1"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$posts.get("p1").uri, "p1");
  });

  it("should request the latest sort", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let capturedSort;
    const mockApi = {
      searchPosts: async (_query, { sort }) => {
        capturedSort = sort;
        return { posts: [], cursor: null };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchLatest({ query: "hello" });

    assert.deepEqual(capturedSort, "latest");
  });

  it("should load reply parents alongside the results", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let capturedParentUris;
    const mockApi = {
      searchPosts: async () => ({
        posts: [
          {
            uri: "p1",
            record: { reply: { parent: { uri: "parent1" } } },
          },
        ],
        cursor: null,
      }),
      getPosts: async (uris) => {
        capturedParentUris = uris;
        return [{ uri: "parent1", record: {} }];
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchLatest({ query: "hello" });

    assert.deepEqual(capturedParentUris, ["parent1"]);
    assert.deepEqual(queryStore.getItems(queryKey), ["p1"]);
    assert.deepEqual(dataStore.$posts.get("parent1").uri, "parent1");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["p1"], cursor: "c1" }] });
    let capturedCursor;
    const mockApi = {
      searchPosts: async (_query, { cursor }) => {
        capturedCursor = cursor;
        return { posts: [{ uri: "p2", record: {} }], cursor: "c2" };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchLatest({ query: "hello" });

    assert.deepEqual(capturedCursor, "c1");
    assert.deepEqual(queryStore.getItems(queryKey), ["p1", "p2"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["p1"], cursor: "c1" }] });
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p2", record: {} }],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchLatest({ query: "hello" }, { reload: true });

    assert.deepEqual(queryStore.getItems(queryKey), ["p2"]);
  });

  it("should keep a slow response for an earlier term out of the current term's slot", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let releaseFirst;
    const firstResponse = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const mockApi = {
      searchPosts: async (query) => {
        if (query === "ab") {
          await firstResponse;
          return { posts: [{ uri: "stale", record: {} }], cursor: null };
        }
        return { posts: [{ uri: "fresh", record: {} }], cursor: null };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const staleCall = requests.loadPostSearchLatest({ query: "ab" });
    await requests.loadPostSearchLatest({ query: "abc" });
    releaseFirst();
    await staleCall;

    assert.deepEqual(
      queryStore.getItems(postSearchLatestQueryKey({ query: "abc" })),
      ["fresh"],
    );
    assert.deepEqual(
      queryStore.getItems(postSearchLatestQueryKey({ query: "ab" })),
      ["stale"],
    );
  });

  it("should store an empty page when the response has no posts array", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({ cursor: null }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchLatest({ query: "hello" });

    assert.deepEqual(queryStore.getItems(queryKey), []);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });
});

describe("loadPostSearchTop", () => {
  const queryKey = postSearchTopQueryKey({ query: "hello" });

  it("should store post uris from a fresh search", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchTop({ query: "hello" });

    assert.deepEqual(queryStore.getItems(queryKey), ["p1"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$posts.get("p1").uri, "p1");
  });

  it("should request the top sort", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let capturedSort;
    const mockApi = {
      searchPosts: async (_query, { sort }) => {
        capturedSort = sort;
        return { posts: [], cursor: null };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPostSearchTop({ query: "hello" });

    assert.deepEqual(capturedSort, "top");
  });

  it("should load reply parents alongside the results", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let capturedParentUris;
    const mockApi = {
      searchPosts: async () => ({
        posts: [
          {
            uri: "p1",
            record: { reply: { parent: { uri: "parent1" } } },
          },
        ],
        cursor: null,
      }),
      getPosts: async (uris) => {
        capturedParentUris = uris;
        return [{ uri: "parent1", record: {} }];
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchTop({ query: "hello" });

    assert.deepEqual(capturedParentUris, ["parent1"]);
    assert.deepEqual(queryStore.getItems(queryKey), ["p1"]);
    assert.deepEqual(dataStore.$posts.get("parent1").uri, "parent1");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["p1"], cursor: "c1" }] });
    let capturedCursor;
    const mockApi = {
      searchPosts: async (_query, { cursor }) => {
        capturedCursor = cursor;
        return { posts: [{ uri: "p2", record: {} }], cursor: "c2" };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchTop({ query: "hello" });

    assert.deepEqual(capturedCursor, "c1");
    assert.deepEqual(queryStore.getItems(queryKey), ["p1", "p2"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["p1"], cursor: "c1" }] });
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p2", record: {} }],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchTop({ query: "hello" }, { reload: true });

    assert.deepEqual(queryStore.getItems(queryKey), ["p2"]);
  });

  it("should keep a slow response for an earlier term out of the current term's slot", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let releaseFirst;
    const firstResponse = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const mockApi = {
      searchPosts: async (query) => {
        if (query === "ab") {
          await firstResponse;
          return { posts: [{ uri: "stale", record: {} }], cursor: null };
        }
        return { posts: [{ uri: "fresh", record: {} }], cursor: null };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const staleCall = requests.loadPostSearchTop({ query: "ab" });
    await requests.loadPostSearchTop({ query: "abc" });
    releaseFirst();
    await staleCall;

    assert.deepEqual(
      queryStore.getItems(postSearchTopQueryKey({ query: "abc" })),
      ["fresh"],
    );
    assert.deepEqual(
      queryStore.getItems(postSearchTopQueryKey({ query: "ab" })),
      ["stale"],
    );
  });

  it("should store an empty page when the response has no posts array", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({ cursor: null }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostSearchTop({ query: "hello" });

    assert.deepEqual(queryStore.getItems(queryKey), []);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });
});

describe("loadProfileSearch", () => {
  it("should store the result dids under the query's key and hydrate profiles", async () => {
    const mockApi = {
      searchProfiles: async () => ({
        actors: [{ did: "did:plc:a" }],
        cursor: "next",
      }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileSearch({ query: "alice" });

    const queryKey = profileSearchQueryKey({ query: "alice" });
    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:a"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
  });

  it("should append the next page for the same query", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const queryKey = profileSearchQueryKey({ query: "query" });
    queryStore.set(queryKey, {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      searchProfiles: async (query, { cursor }) => {
        assert.deepEqual(cursor, "c1");
        return { actors: [{ did: "did:plc:b" }], cursor: "c2" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileSearch({ query: "query" });

    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:a", "did:plc:b"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c2");
  });

  it("should replace the pages for the same query on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const queryKey = profileSearchQueryKey({ query: "query" });
    queryStore.set(queryKey, {
      pages: [{ items: ["did:plc:old"], cursor: "c1" }],
    });
    const mockApi = {
      searchProfiles: async () => ({
        actors: [{ did: "did:plc:new" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileSearch({ query: "query" }, { reload: true });

    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:new"]);
  });

  it("should keep results for different queries in separate slots", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let resolveStale;
    const stalePromise = new Promise((resolve) => {
      resolveStale = resolve;
    });
    const mockApi = {
      searchProfiles: async (query) => {
        if (query === "ab") {
          await stalePromise;
          return { actors: [{ did: "did:plc:stale" }], cursor: null };
        }
        return { actors: [{ did: "did:plc:fresh" }], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const inFlight = requests.loadProfileSearch({ query: "ab" });
    await requests.loadProfileSearch({ query: "abc" });
    resolveStale();
    await inFlight;

    assert.deepEqual(
      queryStore.getItems(profileSearchQueryKey({ query: "abc" })),
      ["did:plc:fresh"],
    );
    assert.deepEqual(
      queryStore.getItems(profileSearchQueryKey({ query: "ab" })),
      ["did:plc:stale"],
    );
  });

  it("should return null for a query that was never searched", () => {
    const queryStore = new QueryStore();

    assert.deepEqual(
      queryStore.getItems(profileSearchQueryKey({ query: "" })),
      null,
    );
  });
});

describe("loadChatRecipientSearch", () => {
  it("should store the search result dids under the query key", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchProfilesTypeahead: async () => ({
        actors: [{ did: "did:plc:a" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadChatRecipientSearch({ query: "alice" });

    assert.deepEqual(
      queryStore.getItems(chatRecipientSearchQueryKey({ query: "alice" })),
      ["did:plc:a"],
    );
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
  });

  it("should keep each query term in its own slot", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchProfilesTypeahead: async (query) => ({
        actors: [{ did: `did:plc:${query}` }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadChatRecipientSearch({ query: "ab" });
    await requests.loadChatRecipientSearch({ query: "abc" });

    assert.deepEqual(
      queryStore.getItems(chatRecipientSearchQueryKey({ query: "ab" })),
      ["did:plc:ab"],
    );
    assert.deepEqual(
      queryStore.getItems(chatRecipientSearchQueryKey({ query: "abc" })),
      ["did:plc:abc"],
    );
  });

  it("should not let a late response for an old term overwrite the current one", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let resolveStale;
    const stalePromise = new Promise((resolve) => {
      resolveStale = resolve;
    });
    const mockApi = {
      searchProfilesTypeahead: async (query) => {
        if (query === "ab") {
          await stalePromise;
          return { actors: [{ did: "did:plc:stale" }] };
        }
        return { actors: [{ did: "did:plc:fresh" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const inFlight = requests.loadChatRecipientSearch({ query: "ab" });
    await requests.loadChatRecipientSearch({ query: "abc" });
    resolveStale();
    await inFlight;

    assert.deepEqual(
      queryStore.getItems(chatRecipientSearchQueryKey({ query: "abc" })),
      ["did:plc:fresh"],
    );
  });
});

describe("loadSearchTypeahead", () => {
  it("should store the results under the query's key and hydrate profiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchProfilesTypeahead: async () => ({
        actors: [{ did: "did:plc:a" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadSearchTypeahead({ query: "alice" });

    assert.deepEqual(
      queryStore.getItems(searchTypeaheadQueryKey({ query: "alice" })),
      ["did:plc:a"],
    );
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
  });

  it("should keep results for different queries in separate slots", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let resolveSearch;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const mockApi = {
      searchProfilesTypeahead: async (query) => {
        if (query === "stale") {
          await searchPromise;
          return { actors: [{ did: "did:plc:stale" }] };
        }
        return { actors: [{ did: "did:plc:fresh" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const inFlight = requests.loadSearchTypeahead({ query: "stale" });
    await requests.loadSearchTypeahead({ query: "fresh" });
    resolveSearch();
    await inFlight;

    assert.deepEqual(
      queryStore.getItems(searchTypeaheadQueryKey({ query: "fresh" })),
      ["did:plc:fresh"],
    );
    assert.deepEqual(
      queryStore.getItems(searchTypeaheadQueryKey({ query: "stale" })),
      ["did:plc:stale"],
    );
  });

  it("should return null for a query that was never searched", () => {
    const queryStore = new QueryStore();

    assert.deepEqual(
      queryStore.getItems(searchTypeaheadQueryKey({ query: "" })),
      null,
    );
  });
});

describe("loadSidebarSearchTypeahead", () => {
  it("should store the result dids under the query key and hydrate profiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchProfilesTypeahead: async () => ({
        actors: [{ did: "did:plc:a" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadSidebarSearchTypeahead({ query: "alice" });

    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "alice" })),
      ["did:plc:a"],
    );
    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), {
      did: "did:plc:a",
    });
  });

  it("should keep each query term in its own slot", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchProfilesTypeahead: async (query) => ({
        actors: [{ did: `did:plc:${query}` }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadSidebarSearchTypeahead({ query: "ab" });
    await requests.loadSidebarSearchTypeahead({ query: "abc" });

    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "ab" })),
      ["did:plc:ab"],
    );
    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "abc" })),
      ["did:plc:abc"],
    );
  });

  it("should not let a late response for an old term overwrite the current one", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let resolveStale;
    const stalePromise = new Promise((resolve) => {
      resolveStale = resolve;
    });
    const mockApi = {
      searchProfilesTypeahead: async (query) => {
        if (query === "ab") {
          await stalePromise;
          return { actors: [{ did: "did:plc:stale" }] };
        }
        return { actors: [{ did: "did:plc:fresh" }] };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    const inFlight = requests.loadSidebarSearchTypeahead({ query: "ab" });
    await requests.loadSidebarSearchTypeahead({ query: "abc" });
    resolveStale();
    await inFlight;

    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "abc" })),
      ["did:plc:fresh"],
    );
    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "ab" })),
      ["did:plc:stale"],
    );
  });

  it("should return null for a query that was never searched", () => {
    const queryStore = new QueryStore();

    assert.deepEqual(
      queryStore.getItems(sidebarSearchTypeaheadQueryKey({ query: "" })),
      null,
    );
  });
});

describe("loadFeedSearch", () => {
  const key = feedSearchQueryKey({ query: "news" });

  it("should store feed uris and cache feed generators", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchFeedGenerators: async () => ({
        feeds: [{ uri: "f1", displayName: "Feed One" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadFeedSearch({ query: "news" });

    assert.deepEqual(queryStore.getItems(key), ["f1"]);
    assert.deepEqual(queryStore.getNextCursor(key), "next");
    assert.deepEqual(
      dataStore.$feedGenerators.get("f1").displayName,
      "Feed One",
    );
  });

  it("should keep results for different queries in separate slots", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchFeedGenerators: async (query) => ({
        feeds: [{ uri: `${query}-feed` }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadFeedSearch({ query: "news" });
    await requests.loadFeedSearch({ query: "art" });

    assert.deepEqual(queryStore.getItems(key), ["news-feed"]);
    assert.deepEqual(
      queryStore.getItems(feedSearchQueryKey({ query: "art" })),
      ["art-feed"],
    );
  });

  it("should append the next page", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, { pages: [{ items: ["f1"], cursor: "c1" }] });
    const mockApi = {
      searchFeedGenerators: async () => ({
        feeds: [{ uri: "f2" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadFeedSearch({ query: "news" });

    assert.deepEqual(queryStore.getItems(key), ["f1", "f2"]);
    assert.deepEqual(queryStore.getNextCursor(key), "c2");
  });

  it("should replace pages on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, { pages: [{ items: ["old"], cursor: null }] });
    const mockApi = {
      searchFeedGenerators: async () => ({
        feeds: [{ uri: "f1" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadFeedSearch({ query: "news" }, { reload: true });

    assert.deepEqual(queryStore.getItems(key), ["f1"]);
  });
});

describe("loadNotifications", () => {
  const key = notificationsQueryKey();

  it("should set notifications and cursor on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications();

    assert.deepEqual(queryStore.getItems(key).length, 1);
    assert.deepEqual(queryStore.getNextCursor(key), "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:liker"), {
      did: "did:plc:liker",
    });
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "like", uri: "n1" }], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [
            { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
          ],
          cursor: "page3",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications();

    assert.deepEqual(capturedCursor, "page2");
    assert.deepEqual(queryStore.getItems(key).length, 2);
    assert.deepEqual(queryStore.getNextCursor(key), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "like", uri: "n1" }], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      getNotifications: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          notifications: [
            { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
          ],
          cursor: "fresh",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications({}, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = queryStore.getItems(key);
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0].uri, "n2");
    assert.deepEqual(queryStore.getNextCursor(key), "fresh");
  });

  it("should capture seenAt on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-15T10:00:00.000Z",
    );
  });

  it("should overwrite the captured seenAt on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "like", uri: "n1" }], cursor: "page2" }],
    });
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
        ],
        cursor: "fresh",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications({}, { reload: true });

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-15T10:00:00.000Z",
    );
  });

  it("should not capture seenAt on subsequent pages", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "like", uri: "n1" }], cursor: "page2" }],
    });
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "follow", uri: "n2", author: { did: "did:plc:f" } },
        ],
        cursor: "page3",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications();

    assert.deepEqual(
      dataStore.$notificationsLastSeenAt.get(),
      "2025-01-14T10:00:00.000Z",
    );
  });

  it("should set seenAt to null when the response omits it", async () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$notificationsLastSeenAt.set("2025-01-14T10:00:00.000Z");
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "like", uri: "n1", author: { did: "did:plc:liker" } },
        ],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNotifications();

    assert.deepEqual(dataStore.$notificationsLastSeenAt.get(), null);
  });

  it("should discard a stale response when a reload lands mid-flight", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ uri: "n1", reason: "follow" }], cursor: "c1" }],
    });

    const reloaded = { pages: [{ items: [{ uri: "n9" }], cursor: "c9" }] };
    const mockApi = {
      getNotifications: async () => {
        // Simulate a reload finishing while this page request is in flight
        queryStore.set(key, reloaded);
        return {
          notifications: [
            { uri: "n2", reason: "follow", author: { did: "did:plc:f" } },
          ],
          cursor: "c2",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications();

    assert.deepEqual(queryStore.get(key), reloaded);
  });

  it("should discard a stale page when the list reaches its end mid-flight", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ uri: "n1", reason: "follow" }], cursor: "c1" }],
    });

    const fullyLoaded = {
      pages: [{ items: [{ uri: "n1" }, { uri: "n2" }], cursor: null }],
    };
    const mockApi = {
      getNotifications: async () => {
        // Simulate a duplicate page request landing first and exhausting the list
        queryStore.set(key, fullyLoaded);
        return {
          notifications: [
            { uri: "n2", reason: "follow", author: { did: "did:plc:f" } },
          ],
          cursor: null,
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadNotifications();

    assert.deepEqual(queryStore.get(key), fullyLoaded);
  });
});

describe("loadMentionNotifications", () => {
  const key = mentionNotificationsQueryKey();

  it("should request only mention reasons and store results", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let capturedReasons;
    const mockApi = {
      getNotifications: async ({ reasons }) => {
        capturedReasons = reasons;
        return {
          notifications: [
            { reason: "mention", uri: "n1", author: { did: "did:plc:m" } },
          ],
          cursor: "next",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(capturedReasons, ["mention", "reply", "quote"]);
    assert.deepEqual(queryStore.getItems(key).length, 1);
    assert.deepEqual(queryStore.getNextCursor(key), "next");
  });

  it("should not capture seenAt", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "mention", uri: "n1", author: { did: "did:plc:m" } },
        ],
        cursor: "next",
        seenAt: "2025-01-15T10:00:00.000Z",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(dataStore.$notificationsLastSeenAt.get(), null);
  });

  it("should append when cursor matches previous", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "mention", uri: "n1" }], cursor: "page2" }],
    });

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "reply", uri: "n2", author: { did: "did:plc:r" } },
        ],
        cursor: "page3",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadMentionNotifications();

    assert.deepEqual(queryStore.getItems(key).length, 2);
    assert.deepEqual(queryStore.getNextCursor(key), "page3");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(key, {
      pages: [{ items: [{ reason: "mention", uri: "n1" }], cursor: "page2" }],
    });

    const mockApi = {
      getNotifications: async () => ({
        notifications: [
          { reason: "quote", uri: "n2", author: { did: "did:plc:q" } },
        ],
        cursor: "fresh",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadMentionNotifications({}, { reload: true });

    const stored = queryStore.getItems(key);
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0].uri, "n2");
  });
});

describe("loadBookmarks end of list", () => {
  it("should distinguish nothing-loaded from end-of-list", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const key = bookmarksQueryKey();
    assert.deepEqual(queryStore.getNextCursor(key), "");

    const requests = makeRequests(
      {
        getBookmarks: async () => ({
          bookmarks: [{ item: { uri: "a", record: {} } }],
          cursor: null,
        }),
        getPosts: async () => [],
      },
      dataStore,
      undefined,
      queryStore,
    );
    await requests.loadBookmarks({}, { reload: true });

    assert.deepEqual(queryStore.getNextCursor(key), null);
  });

  it("should make no request when asked for a page past the end", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let calls = 0;
    const requests = makeRequests(
      {
        getBookmarks: async () => {
          calls += 1;
          return {
            bookmarks: [{ item: { uri: "a", record: {} } }],
            cursor: null,
          };
        },
        getPosts: async () => [],
      },
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadBookmarks({}, { reload: true });
    await requests.loadBookmarks();
    await requests.loadBookmarks();

    assert.deepEqual(calls, 1);
    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["a"]);
    assert.deepEqual(queryStore.get(bookmarksQueryKey()).pages.length, 1);
  });

  it("should still allow a refetch from the top after reaching the end", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let calls = 0;
    const requests = makeRequests(
      {
        getBookmarks: async () => {
          calls += 1;
          return {
            bookmarks: [{ item: { uri: "a", record: {} } }],
            cursor: null,
          };
        },
        getPosts: async () => [],
      },
      dataStore,
    );

    await requests.loadBookmarks({}, { reload: true });
    await requests.loadBookmarks({}, { reload: true });

    assert.deepEqual(calls, 2);
  });
});

describe("loadBookmarks page refresh", () => {
  // A refetch replaces the collection: the cursor chain the later pages were
  // fetched from starts where the old first page ended, so it goes with it.
  function pagedApi(pagesByCursor) {
    return {
      getBookmarks: async ({ cursor }) => pagesByCursor[cursor],
      getPosts: async () => [],
    };
  }

  it("should discard later pages when the collection is refetched", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const pages = {
      "": { bookmarks: [{ item: { uri: "a", record: {} } }], cursor: "c1" },
      c1: { bookmarks: [{ item: { uri: "b", record: {} } }], cursor: "c2" },
    };
    const requests = makeRequests(
      pagedApi(pages),
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadBookmarks({}, { reload: true });
    await requests.loadBookmarks();
    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["a", "b"]);

    // A new bookmark has appeared at the head of the list server-side.
    pages[""] = {
      bookmarks: [
        { item: { uri: "new", record: {} } },
        { item: { uri: "a", record: {} } },
      ],
      cursor: "c1",
    };
    await requests.loadBookmarks({}, { reload: true });

    // The c1..c2 chain belonged to the old first page, so it goes with it.
    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["new", "a"]);
    assert.deepEqual(queryStore.getNextCursor(bookmarksQueryKey()), "c1");
  });

  it("should not strand an item that moves into the refetched first page", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const pages = {
      "": { bookmarks: [{ item: { uri: "a", record: {} } }], cursor: "c1" },
      c1: { bookmarks: [{ item: { uri: "b", record: {} } }], cursor: null },
    };
    const requests = makeRequests(
      pagedApi(pages),
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadBookmarks({}, { reload: true });
    await requests.loadBookmarks();

    // "b" slides up into the first page after a deletion above it.
    pages[""] = {
      bookmarks: [
        { item: { uri: "a", record: {} } },
        { item: { uri: "b", record: {} } },
      ],
      cursor: "c1",
    };
    await requests.loadBookmarks({}, { reload: true });

    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["a", "b"]);
  });

  it("should discard an append whose cursor no longer matches", () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(bookmarksQueryKey(), {
      pages: [{ items: ["a"], cursor: "current" }],
    });

    // A page load that started from a cursor the slot has since moved past.
    const written = queryStore.appendPage(
      bookmarksQueryKey(),
      { items: ["b"], cursor: "x" },
      { requestCursor: "stale" },
    );

    assert.deepEqual(written, false);
    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["a"]);
  });
});

describe("collectionQueryLoader", () => {
  const key = profileFollowersQueryKey({ did: "did:plc:a" });

  function makeLoader(fetchPage) {
    const requests = makeRequests({});
    const queryStore = requests.queryStore;
    const load = requests.collectionQueryLoader(() => key, fetchPage);
    return { requests, load, queries: requests.queryStore };
  }

  it("should request the stored cursor and write the page back under it", async () => {
    const seen = [];
    const { load, queries } = makeLoader(async (cursor) => {
      seen.push(cursor);
      return { items: ["b"], cursor: "c2" };
    });
    queries.set(key, { pages: [{ items: ["a"], cursor: "c1" }] });

    await load();

    assert.deepEqual(seen, ["c1"]);
    assert.deepEqual(queries.getItems(key), ["a", "b"]);
    assert.deepEqual(queries.getNextCursor(key), "c2");
  });

  it("should request an empty cursor on reload and drop later pages", async () => {
    const seen = [];
    const { load, queries } = makeLoader(async (cursor) => {
      seen.push(cursor);
      return { items: ["fresh"], cursor: "c1" };
    });
    queries.set(key, {
      pages: [
        { items: ["a"], cursor: "c1" },
        { items: ["b"], cursor: "c2" },
      ],
    });

    await load({}, { reload: true });

    assert.deepEqual(seen, [""]);
    assert.deepEqual(queries.getItems(key), ["fresh"]);
  });

  it("should not call the fetcher once the slot is at the end of the list", async () => {
    let called = 0;
    const { load, queries } = makeLoader(async () => {
      called += 1;
      return { items: ["b"], cursor: null };
    });
    queries.set(key, { pages: [{ items: ["a"], cursor: null }] });

    await load();

    assert.deepEqual(called, 0);
    assert.deepEqual(queries.getItems(key), ["a"]);
  });

  it("should still fetch from the top after the end of the list on reload", async () => {
    let called = 0;
    const { load, queries } = makeLoader(async () => {
      called += 1;
      return { items: ["fresh"], cursor: null };
    });
    queries.set(key, { pages: [{ items: ["a"], cursor: null }] });

    await load({}, { reload: true });

    assert.deepEqual(called, 1);
    assert.deepEqual(queries.getItems(key), ["fresh"]);
  });

  it("should pass the caller's params through to the fetcher", async () => {
    const seen = [];
    const { load } = makeLoader(async (cursor, params) => {
      seen.push(params);
      return { items: [], cursor: null };
    });

    await load({ did: "did:plc:a", limit: 7 });

    assert.deepEqual(seen, [{ did: "did:plc:a", limit: 7 }]);
  });

  it("should record a rejected fetch without writing a page", async () => {
    const { requests, load, queries } = makeLoader(async () => {
      throw new ApiError({ status: 500, statusText: "Oops" });
    });
    queries.set(key, { pages: [{ items: ["a"], cursor: "c1" }] });

    await load();

    assert.deepEqual(queries.getItems(key), ["a"]);
    assert(requests.getStatus(key).error !== null);
  });
});

describe("profileFollowers query slots", () => {
  // Two consumers of the same resource page independently while sharing one
  // copy of each profile entity.
  function pagedFollowersApi(pagesByCursor) {
    return {
      getFollowers: async (_did, { cursor }) => pagesByCursor[cursor ?? ""],
    };
  }

  it("should give each key its own cursor and item list", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(
      pagedFollowersApi({
        "": { followers: [{ did: "did:plc:1" }], cursor: "c1" },
        c1: { followers: [{ did: "did:plc:2" }], cursor: "c2" },
      }),
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadProfileFollowers({ did: "did:plc:a" });
    await requests.loadProfileFollowers({ did: "did:plc:a" });
    await requests.loadProfileFollowers({ did: "did:plc:b" });

    const keyA = profileFollowersQueryKey({ did: "did:plc:a" });
    const keyB = profileFollowersQueryKey({ did: "did:plc:b" });
    assert.deepEqual(queryStore.getItems(keyA), ["did:plc:1", "did:plc:2"]);
    assert.deepEqual(queryStore.getNextCursor(keyA), "c2");
    assert.deepEqual(queryStore.getItems(keyB), ["did:plc:1"]);
    assert.deepEqual(queryStore.getNextCursor(keyB), "c1");
  });

  it("should not let one key's reload reset another's pagination", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(
      pagedFollowersApi({
        "": { followers: [{ did: "did:plc:1" }], cursor: "c1" },
        c1: { followers: [{ did: "did:plc:2" }], cursor: "c2" },
      }),
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadProfileFollowers({ did: "did:plc:a" });
    await requests.loadProfileFollowers({ did: "did:plc:a" });
    await requests.loadProfileFollowers({ did: "did:plc:b" }, { reload: true });

    const keyA = profileFollowersQueryKey({ did: "did:plc:a" });
    assert.deepEqual(queryStore.getItems(keyA), ["did:plc:1", "did:plc:2"]);
    assert.deepEqual(queryStore.getNextCursor(keyA), "c2");
  });

  it("should share profile entities across keys", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const requests = makeRequests(
      pagedFollowersApi({
        "": {
          followers: [{ did: "did:plc:1", handle: "one.test" }],
          cursor: null,
        },
      }),
      dataStore,
      undefined,
      queryStore,
    );

    await requests.loadProfileFollowers({ did: "did:plc:a" });
    await requests.loadProfileFollowers({ did: "did:plc:b" });

    assert.deepEqual(dataStore.$profiles.get("did:plc:1").handle, "one.test");
    assert.deepEqual(
      queryStore.getItems(profileFollowersQueryKey({ did: "did:plc:a" })),
      ["did:plc:1"],
    );
    assert.deepEqual(
      queryStore.getItems(profileFollowersQueryKey({ did: "did:plc:b" })),
      ["did:plc:1"],
    );
  });

  it("should scope loading status per key", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const requests = makeRequests(
      {
        getFollowers: async () => {
          await gate;
          return { followers: [], cursor: null };
        },
      },
      dataStore,
    );

    const pending = requests.loadProfileFollowers({ did: "did:plc:a" });
    assert.deepEqual(
      requests.getStatus(profileFollowersQueryKey({ did: "did:plc:a" }))
        .loading,
      true,
    );
    assert.deepEqual(
      requests.getStatus(profileFollowersQueryKey({ did: "did:plc:b" }))
        .loading,
      false,
    );

    release();
    await pending;
  });
});

describe("loadBookmarks", () => {
  it("should set bookmarks on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getBookmarks: async () => ({
        bookmarks: [{ item: { uri: "post1", record: {} } }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBookmarks();

    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["post1"]);
    assert.deepEqual(queryStore.getNextCursor(bookmarksQueryKey()), "next");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(bookmarksQueryKey(), {
      pages: [{ items: ["post1"], cursor: "c1" }],
    });
    const mockApi = {
      getBookmarks: async () => ({
        bookmarks: [{ item: { uri: "post2", record: {} } }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBookmarks();

    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), [
      "post1",
      "post2",
    ]);
    assert.deepEqual(queryStore.getNextCursor(bookmarksQueryKey()), "c2");
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(bookmarksQueryKey(), {
      pages: [{ items: ["post1"], cursor: "c1" }],
    });

    let capturedCursor;
    const mockApi = {
      getBookmarks: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          bookmarks: [{ item: { uri: "post2", record: {} } }],
          cursor: "fresh",
        };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadBookmarks({}, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(bookmarksQueryKey()), ["post2"]);
  });
});

describe("loadProfileFollowers", () => {
  const profileDid = "did:plc:profile";

  it("should set followers on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const res = {
      followers: [{ did: "did:plc:a" }],
      cursor: "next",
    };
    const mockApi = { getFollowers: async () => res };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileFollowers({ did: profileDid });

    assert.deepEqual(
      queryStore.getItems(profileFollowersQueryKey({ did: profileDid })),
      ["did:plc:a"],
    );
  });

  it("should append followers when cursor is provided", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(profileFollowersQueryKey({ did: profileDid }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getFollowers: async () => ({
        followers: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileFollowers({ did: profileDid });

    assert.deepEqual(
      queryStore.getItems(profileFollowersQueryKey({ did: profileDid })),
      ["did:plc:a", "did:plc:b"],
    );
    assert.deepEqual(
      queryStore.getNextCursor(profileFollowersQueryKey({ did: profileDid })),
      "c2",
    );
  });
});

describe("loadProfileFollows", () => {
  const profileDid = "did:plc:profile";

  it("should set follows on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const res = { follows: [{ did: "did:plc:a" }], cursor: "next" };
    const mockApi = { getFollows: async () => res };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileFollows({ did: profileDid });

    assert.deepEqual(
      queryStore.getItems(profileFollowsQueryKey({ did: profileDid })),
      ["did:plc:a"],
    );
    assert.deepEqual(
      queryStore.getNextCursor(profileFollowsQueryKey({ did: profileDid })),
      "next",
    );
  });

  it("should append follows to the stored cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(profileFollowsQueryKey({ did: profileDid }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getFollows: async () => ({
        follows: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadProfileFollows({ did: profileDid });

    assert.deepEqual(
      queryStore.getItems(profileFollowsQueryKey({ did: profileDid })),
      ["did:plc:a", "did:plc:b"],
    );
    assert.deepEqual(
      queryStore.getNextCursor(profileFollowsQueryKey({ did: profileDid })),
      "c2",
    );
  });
});

describe("loadConvoList", () => {
  it("should set convo list and cache individual convos on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      listConvos: async () => ({
        convos: [
          { id: "c1", lastMessage: null },
          { id: "c2", lastMessage: null },
        ],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoList();

    assert.deepEqual(queryStore.getItems(convoListQueryKey()), ["c1", "c2"]);
    assert.deepEqual(dataStore.$convos.get("c1").id, "c1");
    assert.deepEqual(dataStore.$convos.get("c2").id, "c2");
    assert.deepEqual(queryStore.getNextCursor(convoListQueryKey()), "next");
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: ["c1"], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "c2" }], cursor: "page3" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoList();

    assert.deepEqual(capturedCursor, "page2");
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), ["c1", "c2"]);
    assert.deepEqual(queryStore.getNextCursor(convoListQueryKey()), "page3");
  });

  it("should drop convos already in the list when appending a page", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: ["c2", "c1"], cursor: "page2" }],
    });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "c2" }, { id: "c3" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoList();

    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      "c2",
      "c1",
      "c3",
    ]);
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: ["c1"], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "c2" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoList({}, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), ["c2"]);
    assert.deepEqual(queryStore.getNextCursor(convoListQueryKey()), "fresh");
  });
});

describe("loadConvoRequestList", () => {
  it("should request only request convos and cache them on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let capturedStatus;
    const mockApi = {
      listConvos: async ({ status }) => {
        capturedStatus = status;
        return {
          convos: [
            { id: "r1", status: "request", lastMessage: null },
            { id: "r2", status: "request", lastMessage: null },
          ],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(capturedStatus, "request");
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      "r1",
      "r2",
    ]);
    assert.deepEqual(dataStore.$convos.get("r1").id, "r1");
    assert.deepEqual(dataStore.$convos.get("r2").id, "r2");
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "next",
    );
  });

  it("should append when previous cursor matches", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: ["r1"], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return {
          convos: [{ id: "r2" }],
          cursor: "page3",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(capturedCursor, "page2");
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      "r1",
      "r2",
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "page3",
    );
  });

  it("should drop convos already in the list when appending a page", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: ["r2", "r1"], cursor: "page2" }],
    });

    const mockApi = {
      listConvos: async () => ({
        convos: [{ id: "r2" }, { id: "r3" }],
        cursor: "page3",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), [
      "r2",
      "r1",
      "r3",
    ]);
  });

  it("should reset cursor and replace on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: ["r1"], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      listConvos: async ({ cursor }) => {
        capturedCursor = cursor;
        return { convos: [{ id: "r2" }], cursor: "fresh" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoRequestList({}, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(convoRequestListQueryKey()), ["r2"]);
    assert.deepEqual(
      queryStore.getNextCursor(convoRequestListQueryKey()),
      "fresh",
    );
  });

  it("should not fetch again once the end of the list is reached", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(convoRequestListQueryKey(), {
      pages: [{ items: ["r1"], cursor: null }],
    });

    let calls = 0;
    const mockApi = {
      listConvos: async () => {
        calls += 1;
        return { convos: [], cursor: undefined };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoRequestList();

    assert.deepEqual(calls, 0);
  });
});

describe("loadConvo", () => {
  const convoId = "convo1";

  it("should store the convo and track status under a namespaced key", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const mockApi = {
      getConvo: async () => ({ convo: { id: convoId } }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvo(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).id, convoId);
    const status = requests.getStatus(Requests.convoRequestKey({ convoId }));
    assert.deepEqual(status.loading, false);
    assert.deepEqual(status.error, null);
  });

  it("should add the convo to the loaded convo list", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: ["other"], cursor: null }],
    });
    const mockApi = {
      getConvo: async () => ({ convo: { id: convoId, status: "accepted" } }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvo(convoId);

    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      convoId,
      "other",
    ]);
  });

  it("should record an ApiError under the namespaced key without rethrowing", async () => {
    const apiError = new ApiError({
      status: 400,
      statusText: "Bad Request",
      data: { error: "InvalidConvo" },
      headers: {},
      url: "/x",
    });
    const dataStore = new DataStore(createSessionState(null));
    const mockApi = {
      getConvo: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvo(convoId);

    const status = requests.getStatus(Requests.convoRequestKey({ convoId }));
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
    assert.deepEqual(dataStore.$convos.get(convoId), null);
  });
});

describe("loadConvoForProfile", () => {
  it("should store the convo and add it to the loaded convo list", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    queryStore.set(convoListQueryKey(), {
      pages: [{ items: ["other"], cursor: null }],
    });
    const mockApi = {
      getConvoForMembers: async () => ({
        convo: { id: "c-new", status: "accepted" },
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoForProfile("did:plc:alice");

    assert.deepEqual(dataStore.$convos.get("c-new").id, "c-new");
    assert.deepEqual(queryStore.getItems(convoListQueryKey()), [
      "c-new",
      "other",
    ]);
  });
});

describe("loadConvoMembers", () => {
  const convoId = "convo1";
  const queryKey = convoMembersQueryKey({ convoId });

  it("should store the first page with its cursor", async () => {
    const mockApi = {
      getConvoMembers: async () => ({
        members: [{ did: "did:plc:alice" }, { did: "did:plc:bob" }],
        cursor: "2",
      }),
    };
    const requests = makeRequests(mockApi);

    await requests.loadConvoMembers({ convoId });

    assert.deepEqual(
      requests.queryStore.getItems(queryKey).map((member) => member.did),
      ["did:plc:alice", "did:plc:bob"],
    );
    assert.deepEqual(requests.queryStore.getNextCursor(queryKey), "2");
  });

  it("should append the next page using the stored cursor", async () => {
    const capturedCursors = [];
    const pages = [
      { members: [{ did: "did:plc:alice" }], cursor: "1" },
      { members: [{ did: "did:plc:bob" }] },
    ];
    const mockApi = {
      getConvoMembers: async (id, { cursor }) => {
        capturedCursors.push(cursor);
        return pages.shift();
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadConvoMembers({ convoId });
    await requests.loadConvoMembers({ convoId });

    assert.deepEqual(capturedCursors, ["", "1"]);
    assert.deepEqual(
      requests.queryStore.getItems(queryKey).map((member) => member.did),
      ["did:plc:alice", "did:plc:bob"],
    );
    assert.deepEqual(requests.queryStore.getNextCursor(queryKey), null);
  });

  it("should overwrite the stored list on reload", async () => {
    const capturedCursors = [];
    const mockApi = {
      getConvoMembers: async (id, { cursor }) => {
        capturedCursors.push(cursor);
        return { members: [{ did: "did:plc:alice" }] };
      },
    };
    const requests = makeRequests(mockApi);
    requests.queryStore.set(queryKey, {
      pages: [{ items: [{ did: "did:plc:stale" }], cursor: "5" }],
    });

    await requests.loadConvoMembers({ convoId }, { reload: true });

    assert.deepEqual(capturedCursors, [""]);
    assert.deepEqual(
      requests.queryStore.getItems(queryKey).map((member) => member.did),
      ["did:plc:alice"],
    );
  });

  it("should record an ApiError under the query key without rethrowing", async () => {
    const apiError = new ApiError({
      status: 400,
      statusText: "Bad Request",
      data: { error: "InvalidConvo" },
      headers: {},
      url: "/x",
    });
    const mockApi = {
      getConvoMembers: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadConvoMembers({ convoId });

    const status = requests.getStatus(queryKey);
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
    assert.deepEqual(requests.queryStore.getItems(queryKey), null);
  });
});

describe("loadConvoMessages", () => {
  const convoId = "convo1";

  it("should set messages on first load", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const mockApi = {
      getMessages: async () => ({
        messages: [{ id: "m1" }, { id: "m2" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoMessages({ convoId });

    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 2);
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should append messages when prior cursor exists", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["m1"], cursor: "page2" }],
    });

    let calls = 0;
    const mockApi = {
      getMessages: async () => {
        calls += 1;
        if (calls === 1) {
          return { messages: [{ id: "m2" }], cursor: null };
        }
        return { messages: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoMessages({ convoId });

    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 2);
    assert.deepEqual(stored[0], "m1");
    assert.deepEqual(stored[1], "m2");
  });

  it("should reset on reload", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["old"], cursor: "page2" }],
    });

    let capturedCursor;
    const mockApi = {
      getMessages: async (_id, { cursor }) => {
        capturedCursor = cursor;
        return { messages: [{ id: "fresh" }], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadConvoMessages({ convoId }, { reload: true });

    assert.deepEqual(capturedCursor, "");
    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0], "fresh");
  });

  it("should store related profiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const mockApi = {
      getMessages: async () => ({
        messages: [{ id: "m1" }],
        cursor: null,
        relatedProfiles: [{ did: "did:plc:a", handle: "a.test" }],
      }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadConvoMessages({ convoId });

    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a.test");
  });
});

describe("pollConvoMessages", () => {
  const convoId = "convo1";
  const currentUserDid = "did:plc:me";
  const otherDid = "did:plc:other";

  const SYSTEM_MESSAGE_LOG_KINDS = [
    "logAddMember",
    "logRemoveMember",
    "logMemberJoin",
    "logMemberLeave",
    "logLockConvo",
    "logUnlockConvo",
    "logLockConvoPermanently",
    "logEditGroup",
    "logCreateJoinLink",
    "logEditJoinLink",
    "logEnableJoinLink",
    "logDisableJoinLink",
  ];

  let dataStore;
  let queryStore;

  beforeEach(() => {
    queryStore = new QueryStore();
    dataStore = new DataStore(createSessionState(null), queryStore);
    dataStore.$currentUser.set({ did: currentUserDid });
    dataStore.$convos.set(convoId, {
      id: convoId,
      members: [{ did: currentUserDid }, { did: otherDid }],
      kind: {
        $type: "chat.bsky.convo.defs#groupConvo",
        name: "Test Group",
        memberCount: 3,
        memberLimit: 10,
        lockStatus: "unlocked",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: [], cursor: null }],
    });
  });

  function makeMessageLog(messageId, senderDid) {
    return {
      $type: "chat.bsky.convo.defs#logCreateMessage",
      rev: "rev1",
      convoId,
      message: {
        $type: "chat.bsky.convo.defs#messageView",
        id: messageId,
        rev: "rev1",
        text: "hello",
        sender: { did: senderDid },
        sentAt: "2026-06-11T00:00:00.000Z",
      },
    };
  }

  function makeSystemLog(logKind, messageId, data = {}) {
    return {
      $type: `chat.bsky.convo.defs#${logKind}`,
      rev: "rev1",
      convoId,
      message: {
        $type: "chat.bsky.convo.defs#systemMessageView",
        id: messageId,
        rev: "rev1",
        sentAt: "2026-06-11T00:00:00.000Z",
        data,
      },
      relatedProfiles: [],
    };
  }

  function makeRequestsWithLogs(logs, cursor = "next") {
    const mockApi = { getChatLogs: async () => ({ logs, cursor }) };
    return makeRequests(mockApi, dataStore, undefined, queryStore);
  }

  it("should prepend messages from other senders and return the cursor", async () => {
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(
      queryStore.getItems(convoMessagesQueryKey({ convoId }))[0],
      "m1",
    );
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should ingest the current user's own messages when not already stored", async () => {
    const requests = makeRequestsWithLogs([
      makeMessageLog("m1", currentUserDid),
    ]);

    await requests.pollConvoMessages(convoId);

    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0], "m1");
    assert.deepEqual(dataStore.$messages.get("m1").id, "m1");
  });

  it("should dedupe the current user's own messages already in the store", async () => {
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["m1"], cursor: null }],
    });
    const requests = makeRequestsWithLogs([
      makeMessageLog("m1", currentUserDid),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(
      queryStore.getItems(convoMessagesQueryKey({ convoId })).length,
      1,
    );
  });

  it("should ingest every system-message log kind", async () => {
    const logs = SYSTEM_MESSAGE_LOG_KINDS.map((logKind, index) =>
      makeSystemLog(logKind, `sys${index}`),
    );
    const requests = makeRequestsWithLogs(logs);

    await requests.pollConvoMessages(convoId);

    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, SYSTEM_MESSAGE_LOG_KINDS.length);
    assert.deepEqual(dataStore.$messages.get("sys0").id, "sys0");
  });

  it("should store related profiles from logs", async () => {
    const log = makeSystemLog("logAddMember", "sys1", {
      member: { did: "did:plc:new" },
      addedBy: { did: otherDid },
    });
    log.relatedProfiles = [{ did: "did:plc:new", handle: "new.test" }];
    const requests = makeRequestsWithLogs([log]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$profiles.get("did:plc:new").handle, "new.test");
  });

  it("should not re-ingest an already-stored message", async () => {
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["m1"], cursor: null }],
    });
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(
      queryStore.getItems(convoMessagesQueryKey({ convoId })).length,
      1,
    );
  });

  it("should update lock status from lock log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logLockConvo", "sys1"),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.lockStatus, "locked");
  });

  it("should update the group name from edit-group log events", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logEditGroup", "sys1", {
        oldName: "Test Group",
        newName: "Renamed Group",
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.name, "Renamed Group");
  });

  it("should increment member count when members are added", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logAddMember", "sys1", {
        member: { did: "did:plc:new" },
        addedBy: { did: otherDid },
      }),
      makeSystemLog("logMemberJoin", "sys2", {
        member: { did: "did:plc:new2" },
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.memberCount, 5);
  });

  it("should decrement member count when members are removed", async () => {
    const requests = makeRequestsWithLogs([
      makeSystemLog("logMemberLeave", "sys1", {
        member: { did: otherDid },
      }),
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(dataStore.$convos.get(convoId).kind.memberCount, 2);
  });

  it("should remove a message when a logDeleteMessage event arrives", async () => {
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["m1", "m2"], cursor: null }],
    });
    dataStore.$messages.set("m1", { id: "m1" });
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logDeleteMessage",
        rev: "rev1",
        convoId,
        message: {
          $type: "chat.bsky.convo.defs#deletedMessageView",
          id: "m1",
          rev: "rev1",
          sender: { did: otherDid },
          sentAt: "2026-06-11T00:00:00.000Z",
        },
      },
    ]);

    await requests.pollConvoMessages(convoId);

    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(stored[0], "m2");
    assert.deepEqual(dataStore.$messages.get("m1"), null);
  });

  it("should ignore join-request log events", async () => {
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logIncomingJoinRequest",
        rev: "rev1",
        convoId,
        requestedBy: { did: "did:plc:new" },
      },
    ]);

    await requests.pollConvoMessages(convoId);

    assert.deepEqual(
      queryStore.getItems(convoMessagesQueryKey({ convoId })).length,
      0,
    );
  });

  it("should replace the stored message when an add-reaction log arrives", async () => {
    queryStore.set(convoMessagesQueryKey({ convoId }), {
      pages: [{ items: ["m1"], cursor: "keep" }],
    });
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logAddReaction",
        rev: "rev1",
        convoId,
        message: {
          id: "m1",
          text: "hi",
          reactions: [{ value: "👍", sender: { did: otherDid } }],
        },
        reaction: { value: "👍", sender: { did: otherDid } },
        relatedProfiles: [{ did: otherDid, handle: "other.test" }],
      },
    ]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    const stored = queryStore.getItems(convoMessagesQueryKey({ convoId }));
    assert.deepEqual(stored.length, 1);
    assert.deepEqual(
      queryStore.getNextCursor(convoMessagesQueryKey({ convoId })),
      "keep",
    );
    assert.deepEqual(dataStore.$messages.get("m1").reactions.length, 1);
    assert.deepEqual(dataStore.$profiles.get(otherDid).handle, "other.test");
  });

  it("should update only the message store when a remove-reaction log arrives for an unloaded convo", async () => {
    queryStore.$collections.delete(convoMessagesQueryKey({ convoId }));
    const requests = makeRequestsWithLogs([
      {
        $type: "chat.bsky.convo.defs#logRemoveReaction",
        rev: "rev1",
        convoId,
        message: { id: "m1", text: "hi", reactions: [] },
        reaction: { value: "👍", sender: { did: otherDid } },
      },
    ]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(dataStore.$messages.get("m1").reactions, []);
    assert.deepEqual(queryStore.get(convoMessagesQueryKey({ convoId })), null);
  });

  it("should stop and return the cursor when no messages data exists for the convo", async () => {
    queryStore.$collections.delete(convoMessagesQueryKey({ convoId }));
    const requests = makeRequestsWithLogs([makeMessageLog("m1", otherDid)]);

    const cursor = await requests.pollConvoMessages(convoId);

    assert.deepEqual(cursor, "next");
    assert.deepEqual(dataStore.$messages.get("m1"), null);
    assert.deepEqual(queryStore.get(convoMessagesQueryKey({ convoId })), null);
  });
});

describe("loadPostLikes", () => {
  const postUri = "at://did/post/1";

  it("should set likes on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const res = { likes: [{ actor: { did: "did:plc:a" } }], cursor: "next" };
    const mockApi = { getLikes: async () => res };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostLikes({ postUri });

    assert.deepEqual(queryStore.getItems(postLikesQueryKey({ postUri })), [
      "did:plc:a",
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(postLikesQueryKey({ postUri })),
      "next",
    );
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").did, "did:plc:a");
  });

  it("should append likes to the stored cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(postLikesQueryKey({ postUri }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getLikes: async () => ({
        likes: [{ actor: { did: "did:plc:b" } }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostLikes({ postUri });

    assert.deepEqual(queryStore.getItems(postLikesQueryKey({ postUri })), [
      "did:plc:a",
      "did:plc:b",
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(postLikesQueryKey({ postUri })),
      "c2",
    );
  });

  it("should replace the first page on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(postLikesQueryKey({ postUri }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getLikes: async () => ({
        likes: [{ actor: { did: "did:plc:b" } }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostLikes({ postUri }, { reload: true });

    assert.deepEqual(queryStore.getItems(postLikesQueryKey({ postUri })), [
      "did:plc:b",
    ]);
  });
});

describe("loadPostQuotes", () => {
  const postUri = "at://did/post/1";
  const queryKey = postQuotesQueryKey({ postUri });

  it("should set quotes on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getQuotes: async () => ({
        posts: [{ uri: "q1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostQuotes({ postUri });

    assert.deepEqual(queryStore.getItems(queryKey), ["q1"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
  });

  it("should append the next page from the stored cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: ["q1"], cursor: "c1" }],
    });
    const mockApi = {
      getQuotes: async () => ({
        posts: [{ uri: "q2", record: {} }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostQuotes({ postUri });

    assert.deepEqual(queryStore.getItems(queryKey), ["q1", "q2"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c2");
  });

  it("should refresh the first page on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: ["q1"], cursor: "c1" }],
    });
    const mockApi = {
      getQuotes: async () => ({
        posts: [{ uri: "q3", record: {} }],
        cursor: "c3",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostQuotes({ postUri }, { reload: true });

    assert.deepEqual(queryStore.getItems(queryKey), ["q3"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c3");
  });

  it("should load reply parents alongside the quotes", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    let requestedUris = null;
    const mockApi = {
      getQuotes: async () => ({
        posts: [
          {
            uri: "q1",
            record: { reply: { parent: { uri: "parent1" } } },
          },
        ],
        cursor: null,
      }),
      getPosts: async (uris) => {
        requestedUris = uris;
        return [{ uri: "parent1", record: {} }];
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostQuotes({ postUri });

    assert.deepEqual(requestedUris, ["parent1"]);
    assert.deepEqual(queryStore.getItems(queryKey), ["q1"]);
    assert(dataStore.$posts.get("parent1"));
  });
});

describe("loadPostReposts", () => {
  const postUri = "at://did/post/1";

  it("should set reposts on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getRepostedBy: async () => ({
        repostedBy: [{ did: "did:plc:a" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostReposts({ postUri });

    assert.deepEqual(queryStore.getItems(postRepostsQueryKey({ postUri })), [
      "did:plc:a",
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(postRepostsQueryKey({ postUri })),
      "next",
    );
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").did, "did:plc:a");
  });

  it("should append reposts to the stored cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(postRepostsQueryKey({ postUri }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getRepostedBy: async () => ({
        repostedBy: [{ did: "did:plc:b" }],
        cursor: "c2",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadPostReposts({ postUri });

    assert.deepEqual(queryStore.getItems(postRepostsQueryKey({ postUri })), [
      "did:plc:a",
      "did:plc:b",
    ]);
    assert.deepEqual(
      queryStore.getNextCursor(postRepostsQueryKey({ postUri })),
      "c2",
    );
  });
});

describe("loadActorFeeds", () => {
  const did = "did:plc:author";
  const queryKey = actorFeedsQueryKey({ did });

  it("should set actor feeds and cache feed generators on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getActorFeeds: async () => ({
        feeds: [{ uri: "f1", displayName: "F1" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadActorFeeds({ did });

    assert.deepEqual(queryStore.getItems(queryKey), ["f1"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$feedGenerators.get("f1").displayName, "F1");
  });

  it("should append on subsequent calls when cursor remains", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["f1"], cursor: "c1" }] });
    const mockApi = {
      getActorFeeds: async () => ({
        feeds: [{ uri: "f2" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadActorFeeds({ did });

    assert.deepEqual(queryStore.getItems(queryKey), ["f1", "f2"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });

  it("should short-circuit when there is no remaining cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["f1"], cursor: null }] });
    let called = false;
    const mockApi = {
      getActorFeeds: async () => {
        called = true;
        return { feeds: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadActorFeeds({ did });

    assert.deepEqual(called, false);
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["f1"], cursor: null }] });

    let capturedCursor;
    const mockApi = {
      getActorFeeds: async (_did, { cursor }) => {
        capturedCursor = cursor;
        return { feeds: [{ uri: "f2" }], cursor: "next" };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadActorFeeds({ did }, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(queryKey), ["f2"]);
  });
});

describe("loadListsWithMembershipForActor", () => {
  const actorDid = "did:plc:target";
  const queryKey = listsWithMembershipQueryKey({ did: actorDid });
  const list1 = { uri: "at://owner/app.bsky.graph.list/1", name: "L1" };
  const list2 = { uri: "at://owner/app.bsky.graph.list/2", name: "L2" };

  it("should store the first page keyed by actor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getListsWithMembership: async () => ({
        listsWithMembership: [
          { list: list1, listItem: { uri: "li1", subject: actorDid } },
          { list: list2 },
        ],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListsWithMembershipForActor({ did: actorDid });

    assert.deepEqual(queryStore.getItems(queryKey), [list1.uri, list2.uri]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$lists.get(list1.uri), list1);
    assert.deepEqual(
      dataStore.$listItemUris.get(list1.uri).get(actorDid),
      "li1",
    );
    assert.deepEqual(
      dataStore.$listItemUris.get(list2.uri)?.get(actorDid),
      undefined,
    );
  });

  it("should append the next page when called again with a cached cursor", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: [list1.uri], cursor: "c1" }],
    });
    let capturedCursor;
    const mockApi = {
      getListsWithMembership: async (_actor, { cursor }) => {
        capturedCursor = cursor;
        return {
          listsWithMembership: [{ list: list2 }],
          cursor: null,
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListsWithMembershipForActor({ did: actorDid });

    assert.deepEqual(capturedCursor, "c1");
    assert.deepEqual(queryStore.getItems(queryKey), [list1.uri, list2.uri]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });

  it("should short-circuit when fully loaded", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: [list1.uri], cursor: null }],
    });
    let called = false;
    const mockApi = {
      getListsWithMembership: async () => {
        called = true;
        return { listsWithMembership: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListsWithMembershipForActor({ did: actorDid });

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: [list1.uri], cursor: "c1" }],
    });
    let capturedCursor;
    const mockApi = {
      getListsWithMembership: async (_actor, { cursor }) => {
        capturedCursor = cursor;
        return {
          listsWithMembership: [{ list: list2 }],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListsWithMembershipForActor(
      {
        did: actorDid,
      },
      { reload: true },
    );

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(queryKey), [list2.uri]);
  });
});

describe("loadHashtagFeed", () => {
  const queryKey = hashtagFeedQueryKey({ hashtag: "foo", sort: "top" });

  it("should store hashtag feed post uris on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p1", record: {} }],
        cursor: "next",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadHashtagFeed({ hashtag: "foo", sort: "top" });

    assert.deepEqual(queryStore.getItems(queryKey), ["p1"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$posts.get("p1").uri, "p1");
  });

  it("should append on subsequent loads", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: ["p1"], cursor: "c1" }],
    });
    const mockApi = {
      searchPosts: async () => ({
        posts: [{ uri: "p2", record: {} }],
        cursor: "c2",
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadHashtagFeed({ hashtag: "foo", sort: "top" });

    assert.deepEqual(queryStore.getItems(queryKey), ["p1", "p2"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "c2");
  });

  it("should store an empty page when the response has no posts array", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async () => ({ cursor: null }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadHashtagFeed({ hashtag: "foo", sort: "top" });

    assert.deepEqual(queryStore.getItems(queryKey), []);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });

  it("should reset on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: ["p1"], cursor: "c1" }],
    });

    let capturedCursor;
    const mockApi = {
      searchPosts: async (_query, { cursor }) => {
        capturedCursor = cursor;
        return { posts: [{ uri: "p2", record: {} }], cursor: "fresh" };
      },
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadHashtagFeed(
      { hashtag: "foo", sort: "top" },
      { reload: true },
    );

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(queryKey), ["p2"]);
  });

  it("should key the query by sort", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      searchPosts: async (_query, { sort }) => ({
        posts: [{ uri: `p-${sort}`, record: {} }],
        cursor: null,
      }),
      getPosts: async () => [],
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadHashtagFeed({ hashtag: "foo", sort: "top" });
    await requests.loadHashtagFeed({ hashtag: "foo", sort: "latest" });

    assert.deepEqual(queryStore.getItems(queryKey), ["p-top"]);
    assert.deepEqual(
      queryStore.getItems(
        hashtagFeedQueryKey({ hashtag: "foo", sort: "latest" }),
      ),
      ["p-latest"],
    );
  });
});

describe("loadPinnedItems", () => {
  it("should fan out to getFeedGenerators and getList for pinned items and cache results", async () => {
    const preferences = {
      getPinnedFeeds: () => [
        { type: "feed", value: "at://did/feed/one" },
        { type: "feed", value: "at://did/feed/two" },
        { type: "list", value: "at://did/list/one" },
        { type: "timeline", value: "following" },
      ],
    };

    let capturedFeedUris;
    const capturedListUris = [];
    const mockApi = {
      getFeedGenerators: async (uris) => {
        capturedFeedUris = uris;
        return uris.map((uri) => ({ uri, displayName: `name-${uri}` }));
      },
      getList: async (uri) => {
        capturedListUris.push(uri);
        return { list: { uri, name: `list-${uri}` }, items: [], cursor: "" };
      },
    };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(
      mockApi,
      dataStore,
      provider,
      null,
      queryStore,
    );

    await requests.loadPinnedItems();

    assert.deepEqual(capturedFeedUris, [
      "at://did/feed/one",
      "at://did/feed/two",
    ]);
    assert.deepEqual(capturedListUris, ["at://did/list/one"]);
    const pinned = queryStore.getItems(pinnedItemsQueryKey());
    assert.deepEqual(pinned.length, 4);
    assert.deepEqual(pinned[0].type, "feed");
    assert.deepEqual(pinned[2].type, "list");
    assert.deepEqual(pinned[3].type, "timeline");
    assert.deepEqual(
      dataStore.$feedGenerators.get("at://did/feed/one").displayName,
      "name-at://did/feed/one",
    );
  });

  it("should skip the api call when no pinned feeds or lists", async () => {
    const preferences = {
      getPinnedFeeds: () => [{ type: "timeline", value: "following" }],
    };
    let feedsCalled = false;
    let listCalled = false;
    const mockApi = {
      getFeedGenerators: async () => {
        feedsCalled = true;
        return [];
      },
      getList: async () => {
        listCalled = true;
        return null;
      },
    };
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const provider = { requirePreferences: () => preferences };
    const requests = createRequests(
      mockApi,
      dataStore,
      provider,
      null,
      queryStore,
    );

    await requests.loadPinnedItems();

    assert.deepEqual(feedsCalled, false);
    assert.deepEqual(listCalled, false);
    const pinned = queryStore.getItems(pinnedItemsQueryKey());
    assert.deepEqual(pinned.length, 1);
    assert.deepEqual(pinned[0].type, "timeline");
  });
});

describe("registerLoader / getStatus", () => {
  it("should track loading start, end, and clear errors on success", async () => {
    const mockApi = { getMutes: async () => ({ mutes: [], cursor: null }) };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    const initialStatus = requests.getStatus(mutedProfilesQueryKey());
    assert.deepEqual(initialStatus.loading, false);
    assert.deepEqual(initialStatus.error, null);

    const promise = requests.loadMutedProfiles();
    assert.deepEqual(requests.getStatus(mutedProfilesQueryKey()).loading, true);
    await promise;

    const finalStatus = requests.getStatus(mutedProfilesQueryKey());
    assert.deepEqual(finalStatus.loading, false);
    assert.deepEqual(finalStatus.error, null);
  });

  it("should record ApiError and clear loading on error path", async () => {
    const apiError = new ApiError({
      status: 500,
      statusText: "Server Error",
      data: null,
      headers: {},
      url: "/x",
    });
    const mockApi = {
      getMutes: async () => {
        throw apiError;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMutedProfiles();

    const status = requests.getStatus(mutedProfilesQueryKey());
    assert.deepEqual(status.loading, false);
    assert(
      status.error === apiError,
      "expected status.error to be the ApiError",
    );
  });

  it("should record non-ApiErrors on the status store and rethrow them", async () => {
    const otherError = new TypeError("Failed to fetch");
    const mockApi = {
      getMutes: async () => {
        throw otherError;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    let caught = null;
    try {
      await requests.loadMutedProfiles();
    } catch (error) {
      caught = error;
    }
    assert(caught === otherError, "expected non-ApiError to propagate");
    const status = requests.getStatus(mutedProfilesQueryKey());
    assert.deepEqual(status.loading, false);
    assert(
      status.error === otherError,
      "expected status.error to be the network error",
    );
  });

  it("should clear a recorded error once a later request succeeds", async () => {
    let shouldFail = true;
    const mockApi = {
      getMutes: async () => {
        if (shouldFail) {
          throw new TypeError("Failed to fetch");
        }
        return { mutes: [], cursor: null };
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadMutedProfiles().catch(() => {});
    assert(requests.getStatus(mutedProfilesQueryKey()).error !== null);

    shouldFail = false;
    await requests.loadMutedProfiles();
    assert.deepEqual(requests.getStatus(mutedProfilesQueryKey()).error, null);
  });

  it("should namespace status by request id derived from arguments", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const mockApi = {
      getProfile: async (did) => ({ did, handle: "x" }),
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadDetailedProfile("did:plc:a");
    await requests.loadDetailedProfile("did:plc:b");

    assert.deepEqual(
      requests.getStatus(detailedProfileRequestKey({ did: "did:plc:a" })).error,
      null,
    );
    assert.deepEqual(
      requests.getStatus(detailedProfileRequestKey({ did: "did:plc:a" }))
        .loading,
      false,
    );
    assert.deepEqual(
      requests.getStatus(detailedProfileRequestKey({ did: "did:plc:b" }))
        .loading,
      false,
    );
  });
});

describe("in-flight request dedupe", () => {
  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("should coalesce concurrent calls with the same request id", async () => {
    const pending = deferred();
    let callCount = 0;
    const mockApi = {
      getProfile: async (did) => {
        callCount += 1;
        await pending.promise;
        return { did, handle: "alice.test" };
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    const first = requests.loadDetailedProfile("did:plc:a");
    const second = requests.loadDetailedProfile("did:plc:a");
    pending.resolve();
    await Promise.all([first, second]);

    assert.deepEqual(callCount, 1);
    assert.deepEqual(
      dataStore.$detailedProfiles.get("did:plc:a").handle,
      "alice.test",
    );
  });

  it("should keep loading true until the shared request settles", async () => {
    const pending = deferred();
    const mockApi = {
      getProfile: async (did) => {
        await pending.promise;
        return { did, handle: "alice.test" };
      },
    };
    const requests = makeRequests(mockApi);

    const first = requests.loadDetailedProfile("did:plc:a");
    const second = requests.loadDetailedProfile("did:plc:a");
    assert.deepEqual(
      requests.getStatus(detailedProfileRequestKey({ did: "did:plc:a" }))
        .loading,
      true,
    );

    pending.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(
      requests.getStatus(detailedProfileRequestKey({ did: "did:plc:a" }))
        .loading,
      false,
    );
  });

  it("should not coalesce calls with different request ids", async () => {
    const pending = deferred();
    let callCount = 0;
    const mockApi = {
      getProfile: async (did) => {
        callCount += 1;
        await pending.promise;
        return { did, handle: "x" };
      },
    };
    const requests = makeRequests(mockApi);

    const first = requests.loadDetailedProfile("did:plc:a");
    const second = requests.loadDetailedProfile("did:plc:b");
    pending.resolve();
    await Promise.all([first, second]);

    assert.deepEqual(callCount, 2);
  });

  it("should not cache across sequential calls", async () => {
    let callCount = 0;
    const mockApi = {
      getProfile: async (did) => {
        callCount += 1;
        return { did, handle: "x" };
      },
    };
    const requests = makeRequests(mockApi);

    await requests.loadDetailedProfile("did:plc:a");
    await requests.loadDetailedProfile("did:plc:a");

    assert.deepEqual(callCount, 2);
  });

  it("should share a rejection with every concurrent caller and allow a retry", async () => {
    const networkError = new TypeError("Failed to fetch");
    let callCount = 0;
    let shouldFail = true;
    const mockApi = {
      getProfile: async (did) => {
        callCount += 1;
        if (shouldFail) {
          throw networkError;
        }
        return { did, handle: "x" };
      },
    };
    const requests = makeRequests(mockApi);

    const first = requests.loadDetailedProfile("did:plc:a");
    const second = requests.loadDetailedProfile("did:plc:a");
    await assert.rejects(first, /Failed to fetch/);
    await assert.rejects(second, /Failed to fetch/);
    assert.deepEqual(callCount, 1);

    shouldFail = false;
    await requests.loadDetailedProfile("did:plc:a");
    assert.deepEqual(callCount, 2);
  });

  it("should leave loaders without dedupe enabled untouched", async () => {
    const pending = deferred();
    let callCount = 0;
    const mockApi = {
      getMutes: async () => {
        callCount += 1;
        await pending.promise;
        return { mutes: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi);

    const first = requests.loadMutedProfiles();
    const second = requests.loadMutedProfiles();
    pending.resolve();
    await Promise.all([first, second]);

    assert.deepEqual(callCount, 2);
  });
});

describe("_loadBlockedPosts", () => {
  const existingUri = "at://did:plc:blocked/app.bsky.feed.post/exists";
  const deletedUri = "at://did:plc:blocked/app.bsky.feed.post/gone";

  function setup({ getPosts = async () => [], getRecord }) {
    const mockApi = { getPosts, getRecord };
    const dataStore = new DataStore(createSessionState(null));
    const mockPreferencesProvider = {
      requirePreferences: () => Preferences.createLoggedOutPreferences(),
    };
    const requests = createRequests(
      mockApi,
      dataStore,
      mockPreferencesProvider,
    );
    return { requests, dataStore };
  }

  it("should mark a post unavailable when its record is confirmed deleted", async () => {
    const { requests, dataStore } = setup({
      getRecord: async (uri) => {
        if (uri === deletedUri) {
          throw new ApiError({
            status: 400,
            statusText: "Bad Request",
            data: { error: "RecordNotFound" },
            headers: {},
            url: "",
          });
        }
        return { uri, value: {} };
      },
    });
    await requests._loadBlockedPosts([existingUri, deletedUri]);
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
    assert(dataStore.$unavailablePosts.get(deletedUri) !== null);
    assert.deepEqual(
      dataStore.$unavailablePosts.get(deletedUri).uri,
      deletedUri,
    );
  });

  it("should not mark a post unavailable when the record probe fails for other reasons", async () => {
    const { requests, dataStore } = setup({
      getRecord: async () => {
        throw new TypeError("network down");
      },
    });
    await requests._loadBlockedPosts([existingUri]);
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
  });

  it("should not probe records for posts that getPosts returned", async () => {
    const { requests, dataStore } = setup({
      getPosts: async () => [{ uri: existingUri, record: { text: "hi" } }],
      getRecord: async () => {
        throw new Error("getRecord should not be called");
      },
    });
    await requests._loadBlockedPosts([existingUri]);
    assert.deepEqual(dataStore.$posts.get(existingUri).record.text, "hi");
    assert.deepEqual(dataStore.$unavailablePosts.get(existingUri), null);
  });
});

function makeRequestsWithConstellation(
  api,
  dataStore,
  constellation,
  queryStore = new QueryStore(),
) {
  return new Requests(
    api,
    dataStore,
    { requirePreferences: () => Preferences.createLoggedOutPreferences() },
    new DraftMediaStore("test-media"),
    new EventEmitter(),
    constellation,
    queryStore,
  );
}

describe("statusStore.$statuses", () => {
  it("should expose combined loading and error state per request id", async () => {
    const apiError = new ApiError({
      status: 500,
      statusText: "Server Error",
      data: null,
      headers: {},
      url: "/x",
    });
    const mockApi = {
      getMutes: async () => {
        throw apiError;
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );

    assert.deepEqual(
      requests.statusStore.$statuses.get(mutedProfilesQueryKey()),
      {
        loading: false,
        error: null,
      },
    );

    const promise = requests.loadMutedProfiles();
    assert.deepEqual(
      requests.statusStore.$statuses.get(mutedProfilesQueryKey()).loading,
      true,
    );
    await promise;

    const status = requests.statusStore.$statuses.get(mutedProfilesQueryKey());
    assert.deepEqual(status.loading, false);
    assert(status.error === apiError, "expected the recorded ApiError");
  });
});

describe("loadCurrentUser", () => {
  it("should resolve the session did and store the profile", async () => {
    const profile = { did: "did:plc:me", handle: "me.test" };
    let requestedDid = null;
    const mockApi = {
      getSession: async () => ({ did: "did:plc:me" }),
      getProfile: async (did) => {
        requestedDid = did;
        return profile;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadCurrentUser();

    assert.deepEqual(requestedDid, "did:plc:me");
    assert.deepEqual(dataStore.$currentUser.get(), profile);
  });

  it("should fall back to the profile record when getProfile fails", async () => {
    const mockApi = {
      getSession: async () => ({ did: "did:plc:me", handle: "me.test" }),
      getProfile: async () => {
        throw new ApiError({ status: 502, statusText: "Bad Gateway" });
      },
      getProfileRecord: async () => ({
        uri: "at://did:plc:me/app.bsky.actor.profile/self",
        value: { displayName: "Me" },
      }),
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadCurrentUser();

    const currentUser = dataStore.$currentUser.get();
    assert.deepEqual(currentUser.did, "did:plc:me");
    assert.deepEqual(currentUser.handle, "me.test");
    assert.deepEqual(currentUser.displayName, "Me");
    assert.deepEqual(currentUser.isPartial, true);
  });

  it("should fall back to a record-less profile when the user has no profile record", async () => {
    const mockApi = {
      getSession: async () => ({ did: "did:plc:me", handle: "me.test" }),
      getProfile: async () => {
        throw new ApiError({ status: 502, statusText: "Bad Gateway" });
      },
      getProfileRecord: async () => {
        throw new ApiError({
          status: 400,
          statusText: "Bad Request",
          data: { error: "RecordNotFound" },
        });
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadCurrentUser();

    const currentUser = dataStore.$currentUser.get();
    assert.deepEqual(currentUser.handle, "me.test");
    assert.deepEqual(currentUser.displayName, null);
    assert.deepEqual(currentUser.isPartial, true);
  });

  it("should rethrow when the profile record request fails for another reason", async () => {
    const recordError = new ApiError({ status: 500, statusText: "Oops" });
    const mockApi = {
      getSession: async () => ({ did: "did:plc:me", handle: "me.test" }),
      getProfile: async () => {
        throw new ApiError({ status: 502, statusText: "Bad Gateway" });
      },
      getProfileRecord: async () => {
        throw recordError;
      },
    };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await assert.rejects(() => requests.loadCurrentUser(), recordError);
    assert.deepEqual(dataStore.$currentUser.get(), null);
  });
});

describe("loadPost", () => {
  it("should load and store a single post", async () => {
    const post = { uri: "at://did:plc:a/app.bsky.feed.post/1", record: {} };
    const mockApi = { getPost: async () => post };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadPost(post.uri);

    assert.deepEqual(dataStore.$posts.get(post.uri), post);
  });
});

describe("loadPostThread with a blocked parent", () => {
  const rootUri = "at://did:plc:root/app.bsky.feed.post/root";
  const parentUri = "at://did:plc:blockedauthor/app.bsky.feed.post/parent";
  const postURI = "at://did:plc:viewer/app.bsky.feed.post/main";

  function makeMainPost() {
    return {
      uri: postURI,
      replyCount: 0,
      record: {
        reply: { root: { uri: rootUri }, parent: { uri: parentUri } },
      },
    };
  }

  function makeBlockedParent(viewer = {}) {
    return {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: parentUri,
      blocked: true,
      author: { did: "did:plc:blockedauthor", viewer },
    };
  }

  const parentPost = {
    uri: parentUri,
    author: { did: "did:plc:blockedauthor" },
    record: { reply: { root: { uri: rootUri }, parent: { uri: rootUri } } },
  };
  const rootPost = {
    uri: rootUri,
    author: { did: "did:plc:root" },
    record: {},
  };

  function makeApiWithPosts() {
    const postsByUri = new Map([
      [parentUri, parentPost],
      [rootUri, rootPost],
    ]);
    return {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) =>
        uris.map((uri) => postsByUri.get(uri)).filter(Boolean),
    };
  }

  it("should rebuild the parent chain from backlinks across blocked authors", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "parent",
        },
      ],
    };
    const requests = makeRequestsWithConstellation(
      makeApiWithPosts(),
      dataStore,
      constellation,
    );

    await requests.loadPostThread({ uri: postURI });

    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    assert.deepEqual(thread.parent.$type, "app.bsky.feed.defs#threadViewPost");
    assert.deepEqual(thread.parent.post.uri, parentUri);
    assert.deepEqual(thread.parent.parent.post.uri, rootUri);
    assert.deepEqual(thread.parent.parent.parent, null);
    assert.deepEqual(dataStore.$posts.get(parentUri), parentPost);
    assert.deepEqual(dataStore.$posts.get(rootUri), rootPost);
  });

  it("should walk through multiple loaded posts by the same blocked author", async () => {
    const grandparentUri =
      "at://did:plc:blockedauthor/app.bsky.feed.post/grandparent";
    const nearParentPost = {
      uri: parentUri,
      author: { did: "did:plc:blockedauthor" },
      record: {
        reply: { root: { uri: rootUri }, parent: { uri: grandparentUri } },
      },
    };
    const grandparentPost = {
      uri: grandparentUri,
      author: { did: "did:plc:blockedauthor" },
      record: { reply: { root: { uri: rootUri }, parent: { uri: rootUri } } },
    };
    const postsByUri = new Map([
      [parentUri, nearParentPost],
      [grandparentUri, grandparentPost],
      [rootUri, rootPost],
    ]);
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "parent",
        },
        {
          did: "did:plc:blockedauthor",
          collection: "app.bsky.feed.post",
          rkey: "grandparent",
        },
      ],
    };
    const mockApi = {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) =>
        uris.map((uri) => postsByUri.get(uri)).filter(Boolean),
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    assert.deepEqual(thread.parent.post.uri, parentUri);
    assert.deepEqual(thread.parent.parent.post.uri, grandparentUri);
    assert.deepEqual(thread.parent.parent.parent.post.uri, rootUri);
  });

  it("should rethrow non-abort backlink failures", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => {
        throw new TypeError("network down");
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: makeMainPost(),
        parent: makeBlockedParent(),
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await assert.rejects(
      requests.loadPostThread({ uri: postURI }),
      /network down/,
    );
  });

  it("should fall back to loading the blocked parent thread when the viewer is involved in the block", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    let constellationCalled = false;
    const constellation = {
      getLinks: async () => {
        constellationCalled = true;
        return [];
      },
    };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent({ blocking: "at://block" }),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    assert.deepEqual(constellationCalled, false);
    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });

  it("should fall back to loading the blocked parent thread when backlinks time out", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => {
        throw Object.assign(new Error("timed out"), { name: "AbortError" });
      },
    };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent(),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });

  it("should fall back to loading the blocked parent thread when backlinks yield no posts", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    // No backlinks by the blocked author — only the root gets appended
    const constellation = { getLinks: async () => [] };
    const parentThread = {
      post: { uri: parentUri, replyCount: 0 },
      replies: [],
    };
    const mockApi = {
      getPostThread: async (uri) => {
        if (uri === parentUri) return parentThread;
        return {
          post: makeMainPost(),
          parent: makeBlockedParent(),
          replies: [],
        };
      },
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    assert.deepEqual(thread.parent.post.uri, parentUri);
  });
});

describe("_loadBlockedReplies", () => {
  const postURI = "at://did:plc:op/app.bsky.feed.post/main";
  const replyUri = "at://did:plc:replier/app.bsky.feed.post/r1";
  const blockedReplyUri = "at://did:plc:blocker/app.bsky.feed.post/r2";

  it("should return an empty list when the thread has no post", async () => {
    const requests = makeRequests({}, new DataStore(createSessionState(null)));

    const replies = await requests._loadBlockedReplies({});

    assert.deepEqual(replies, []);
  });

  it("should keep the loaded replies when backlinks time out", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => {
        throw Object.assign(new Error("timed out"), { name: "AbortError" });
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 1, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    assert.deepEqual(
      requests.queryStore.getValue(postThreadQueryKey({ uri: postURI }))
        .replies,
      [],
    );
  });

  it("should rethrow non-abort backlink failures", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => {
        throw new TypeError("network down");
      },
    };
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 1, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await assert.rejects(
      requests.loadPostThread({ uri: postURI }),
      /network down/,
    );
  });

  it("should load missing replies from backlinks and mark them as blocked replies", async () => {
    const queryStore = new QueryStore();
    const dataStore = new DataStore(createSessionState(null), queryStore);
    const constellation = {
      getLinks: async () => [
        {
          did: "did:plc:replier",
          collection: "app.bsky.feed.post",
          rkey: "r1",
        },
        {
          did: "did:plc:blocker",
          collection: "app.bsky.feed.post",
          rkey: "r2",
        },
      ],
    };
    const replyPost = {
      uri: replyUri,
      author: { did: "did:plc:replier", viewer: {} },
      record: {},
    };
    const blockingReplyPost = {
      uri: blockedReplyUri,
      author: { did: "did:plc:blocker", viewer: { blockedBy: true } },
      record: {},
    };
    let requestedUris = null;
    const mockApi = {
      getPostThread: async () => ({
        post: { uri: postURI, replyCount: 2, record: {} },
        replies: [],
      }),
      getPostThreadOther: async () => [],
      getPosts: async (uris) => {
        requestedUris = uris;
        return [replyPost, blockingReplyPost];
      },
    };
    const requests = makeRequestsWithConstellation(
      mockApi,
      dataStore,
      constellation,
      queryStore,
    );

    await requests.loadPostThread({ uri: postURI });

    assert.deepEqual(requestedUris, [replyUri, blockedReplyUri]);
    const thread = requests.queryStore.getValue(
      postThreadQueryKey({ uri: postURI }),
    );
    // The reply from the author blocking the viewer is filtered out
    assert.deepEqual(thread.replies.length, 1);
    assert.deepEqual(thread.replies[0].post.uri, replyUri);
    assert.deepEqual(thread.replies[0].post.isBlockedReply, true);
    assert.deepEqual(dataStore.$posts.get(replyUri).isBlockedReply, true);
  });
});

describe("loadNextFeedPage feed types", () => {
  it("should use getFollowingFeed for the timeline type", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let called = false;
    const mockApi = {
      getFollowingFeed: async () => {
        called = true;
        return { feed: [{ post: { uri: "t1" } }], cursor: "c1" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextFeedPage({ type: "timeline", uri: "following" });

    assert.deepEqual(called, true);
    assert.deepEqual(
      requests.queryStore.getItems(feedQueryKey({ uri: "following" })).length,
      1,
    );
  });

  it("should use getListFeed for the list type", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const listUri = "at://did/app.bsky.graph.list/1";
    let requestedUri = null;
    const mockApi = {
      getListFeed: async (uri) => {
        requestedUri = uri;
        return { feed: [{ post: { uri: "l1" } }], cursor: "c1" };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadNextFeedPage({ type: "list", uri: listUri });

    assert.deepEqual(requestedUri, listUri);
    assert.deepEqual(
      requests.queryStore.getItems(feedQueryKey({ uri: listUri })).length,
      1,
    );
  });

  it("should reject on an unknown feed type", async () => {
    const requests = makeRequests({}, new DataStore(createSessionState(null)));

    await assert.rejects(
      requests.loadNextFeedPage({ type: "bogus", uri: "x" }),
      /Unknown pinned item type/,
    );
  });
});

describe("loadDetailedProfiles", () => {
  it("should store each profile in both profile maps", async () => {
    const profiles = [
      { did: "did:plc:a", handle: "a.test" },
      { did: "did:plc:b", handle: "b.test" },
    ];
    const mockApi = { getProfiles: async () => profiles };
    const dataStore = new DataStore(createSessionState(null));
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadDetailedProfiles(["did:plc:a", "did:plc:b"]);

    assert.deepEqual(dataStore.$profiles.get("did:plc:a"), profiles[0]);
    assert.deepEqual(dataStore.$detailedProfiles.get("did:plc:b"), profiles[1]);
  });

  it("should not call the api when dids is empty", async () => {
    let called = false;
    const mockApi = {
      getProfiles: async () => {
        called = true;
        return [];
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );

    await requests.loadDetailedProfiles([]);

    assert.deepEqual(called, false);
  });
});

describe("_loadJoinLinkPreviews", () => {
  it("should fetch distinct codes and store previews by code", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let requestedCodes = null;
    const mockApi = {
      isAuthenticated: true,
      getJoinLinkPreviews: async (codes) => {
        requestedCodes = codes;
        return {
          joinLinkPreviews: [
            { code: "abc", name: "Group" },
            { name: "no code" },
          ],
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests._loadJoinLinkPreviews(["abc", "abc", null, "def"]);

    assert.deepEqual(requestedCodes, ["abc", "def"]);
    assert.deepEqual(
      dataStore.$joinLinkPreviewsByCode.get("abc").name,
      "Group",
    );
    assert.deepEqual(dataStore.$joinLinkPreviewsByCode.get("def"), null);
  });

  it("should not fetch when unauthenticated or when there are no codes", async () => {
    let called = false;
    const mockApi = {
      isAuthenticated: false,
      getJoinLinkPreviews: async () => {
        called = true;
        return { joinLinkPreviews: [] };
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );

    await requests._loadJoinLinkPreviews(["abc"]);
    assert.deepEqual(called, false);

    mockApi.isAuthenticated = true;
    await requests._loadJoinLinkPreviews([null, undefined]);
    assert.deepEqual(called, false);
  });

  it("should swallow fetch failures", async () => {
    const mockApi = {
      isAuthenticated: true,
      getJoinLinkPreviews: async () => {
        throw new Error("boom");
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );

    await requests._loadJoinLinkPreviews(["abc"]);
  });
});

describe("_loadPostDependencies", () => {
  it("should not reject when a dependency loader fails", async () => {
    const mockApi = {
      getPosts: async () => {
        throw new Error("network down");
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );
    const blockedPost = {
      $type: "app.bsky.feed.defs#blockedPost",
      uri: "at://did:plc:x/app.bsky.feed.post/1",
    };

    await requests._loadPostDependencies([blockedPost]);
  });
});

describe("loadFeedGenerator / loadList / loadStarterPack", () => {
  it("should store the feed generator by uri", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const feedGenerator = { uri: "at://did/feed/1", displayName: "Feed" };
    const mockApi = { getFeedGenerator: async () => feedGenerator };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadFeedGenerator(feedGenerator.uri);

    assert.deepEqual(
      dataStore.$feedGenerators.get(feedGenerator.uri),
      feedGenerator,
    );
  });

  it("should store the list view by uri", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const listUri = "at://did/app.bsky.graph.list/1";
    let capturedOptions = null;
    const mockApi = {
      getList: async (_uri, options) => {
        capturedOptions = options;
        return { list: { uri: listUri, name: "L1" }, items: [] };
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadList(listUri);

    assert.deepEqual(capturedOptions, { limit: 1 });
    assert.deepEqual(dataStore.$lists.get(listUri).name, "L1");
  });

  it("should store the starter pack by uri", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const starterPack = { uri: "at://did/starterpack/1", record: {} };
    const mockApi = { getStarterPack: async () => starterPack };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadStarterPack(starterPack.uri);

    assert.deepEqual(dataStore.$starterPacks.get(starterPack.uri), starterPack);
  });
});

describe("loadListMembers", () => {
  const listUri = "at://did/app.bsky.graph.list/1";
  const queryKey = listMembersQueryKey({ listUri });

  it("should store the first page and hydrate member profiles", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getList: async () => ({
        list: { uri: listUri },
        items: [{ uri: "li1", subject: { did: "did:plc:a", handle: "a" } }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListMembers({ listUri });

    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:a"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a");
    assert.deepEqual(
      dataStore.$listItemUris.get(listUri).get("did:plc:a"),
      "li1",
    );
  });

  it("should short-circuit when fully loaded", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: [], cursor: null }] });
    let called = false;
    const mockApi = {
      getList: async () => {
        called = true;
        return { items: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListMembers({ listUri });

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(queryKey, {
      pages: [{ items: ["did:plc:a"], cursor: null }],
    });
    let capturedCursor;
    const mockApi = {
      getList: async (_uri, { cursor }) => {
        capturedCursor = cursor;
        return {
          items: [{ uri: "li2", subject: { did: "did:plc:b" } }],
          cursor: "next",
        };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadListMembers({ listUri }, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:b"]);
  });
});

describe("loadActorLists", () => {
  const did = "did:plc:author";
  const queryKey = actorListsQueryKey({ did });

  it("should store actor list uris and cache each list view", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getActorLists: async () => ({
        lists: [{ uri: "at://did/app.bsky.graph.list/1", name: "L1" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadActorLists({ did });

    assert.deepEqual(queryStore.getItems(queryKey), [
      "at://did/app.bsky.graph.list/1",
    ]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(
      dataStore.$lists.get("at://did/app.bsky.graph.list/1").name,
      "L1",
    );
  });

  it("should short-circuit when there is no remaining cursor", async () => {
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: [], cursor: null }] });
    let called = false;
    const mockApi = {
      getActorLists: async () => {
        called = true;
        return { lists: [], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, undefined, undefined, queryStore);

    await requests.loadActorLists({ did });

    assert.deepEqual(called, false);
  });

  it("should refetch from scratch on reload", async () => {
    const queryStore = new QueryStore();
    queryStore.set(queryKey, { pages: [{ items: ["old"], cursor: null }] });
    let capturedCursor;
    const mockApi = {
      getActorLists: async (_did, { cursor }) => {
        capturedCursor = cursor;
        return { lists: [{ uri: "new" }], cursor: "next" };
      },
    };
    const requests = makeRequests(mockApi, undefined, undefined, queryStore);

    await requests.loadActorLists({ did }, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(queryKey), ["new"]);
  });
});

describe("loadCurrentUserLists", () => {
  it("should do nothing when there is no current user", async () => {
    let called = false;
    const mockApi = {
      getActorLists: async () => {
        called = true;
        return { lists: [], cursor: null };
      },
    };
    const requests = makeRequests(
      mockApi,
      new DataStore(createSessionState(null)),
    );

    await requests.loadCurrentUserLists();

    assert.deepEqual(called, false);
  });

  it("should load the current user's lists", async () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$currentUser.set({ did: "did:plc:me" });
    const queryStore = new QueryStore();
    let requestedDid = null;
    const mockApi = {
      getActorLists: async (did) => {
        requestedDid = did;
        return { lists: [{ uri: "l1" }], cursor: null };
      },
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadCurrentUserLists();

    assert.deepEqual(requestedDid, "did:plc:me");
    assert.deepEqual(
      queryStore.getItems(actorListsQueryKey({ did: "did:plc:me" })),
      ["l1"],
    );
  });
});

describe("loadDrafts", () => {
  function makeRequestsWithDraftStore(
    api,
    dataStore,
    draftMediaStore,
    queryStore,
  ) {
    return new Requests(
      api,
      dataStore,
      { requirePreferences: () => Preferences.createLoggedOutPreferences() },
      draftMediaStore,
      new EventEmitter(),
      stubConstellation,
      queryStore,
    );
  }

  it("should store the drafts page and load local media refs", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const draftView = {
      draft: {
        posts: [
          {
            embedImages: [{ localRef: { path: "media/1" } }],
            embedVideos: [{ localRef: { path: "media/2" } }],
          },
        ],
      },
    };
    const mockApi = {
      getDrafts: async () => ({ drafts: [draftView], cursor: "next" }),
    };
    let loadedRefs = null;
    const draftMediaStore = {
      load: async (refs) => {
        loadedRefs = refs;
      },
    };
    const requests = makeRequestsWithDraftStore(
      mockApi,
      dataStore,
      draftMediaStore,
      queryStore,
    );

    await requests.loadDrafts();

    assert.deepEqual(loadedRefs, ["media/1", "media/2"]);
    assert.deepEqual(queryStore.getItems(draftsQueryKey()), [draftView]);
    assert.deepEqual(queryStore.getNextCursor(draftsQueryKey()), "next");
  });

  it("should refetch from scratch on reload", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(draftsQueryKey(), {
      pages: [{ items: [{ draft: {} }], cursor: "c1" }],
    });
    let capturedCursor;
    const mockApi = {
      getDrafts: async ({ cursor }) => {
        capturedCursor = cursor;
        return { drafts: [{ draft: { posts: [] } }], cursor: null };
      },
    };
    const requests = makeRequestsWithDraftStore(
      mockApi,
      dataStore,
      { load: async () => {} },
      queryStore,
    );

    await requests.loadDrafts({}, { reload: true });

    assert.deepEqual(capturedCursor, "");
    assert.deepEqual(queryStore.getItems(draftsQueryKey()).length, 1);
    assert.deepEqual(queryStore.getNextCursor(draftsQueryKey()), null);
  });
});

describe("loadKnownFollowers", () => {
  const profileDid = "did:plc:target";

  it("should store known followers and hydrate profiles on first load", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    const mockApi = {
      getKnownFollowers: async () => ({
        followers: [{ did: "did:plc:a", handle: "a" }],
        cursor: "next",
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadKnownFollowers({ did: profileDid });

    const queryKey = knownFollowersQueryKey({ did: profileDid });
    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:a"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), "next");
    assert.deepEqual(dataStore.$profiles.get("did:plc:a").handle, "a");
  });

  it("should append to the loaded pages when a cursor is stored", async () => {
    const dataStore = new DataStore(createSessionState(null));
    const queryStore = new QueryStore();
    queryStore.set(knownFollowersQueryKey({ did: profileDid }), {
      pages: [{ items: ["did:plc:a"], cursor: "c1" }],
    });
    const mockApi = {
      getKnownFollowers: async () => ({
        followers: [{ did: "did:plc:b" }],
        cursor: null,
      }),
    };
    const requests = makeRequests(mockApi, dataStore, undefined, queryStore);

    await requests.loadKnownFollowers({ did: profileDid });

    const queryKey = knownFollowersQueryKey({ did: profileDid });
    assert.deepEqual(queryStore.getItems(queryKey), ["did:plc:a", "did:plc:b"]);
    assert.deepEqual(queryStore.getNextCursor(queryKey), null);
  });
});

describe("loadProfileChatStatus", () => {
  it("should store the availability response keyed by profile did", async () => {
    const dataStore = new DataStore(createSessionState(null));
    let requestedDids = null;
    const availability = { canChat: true };
    const mockApi = {
      getConvoAvailability: async (dids) => {
        requestedDids = dids;
        return availability;
      },
    };
    const requests = makeRequests(mockApi, dataStore);

    await requests.loadProfileChatStatus("did:plc:a");

    assert.deepEqual(requestedDids, ["did:plc:a"]);
    assert.deepEqual(
      dataStore.$profileChatStatus.get("did:plc:a"),
      availability,
    );
  });
});
