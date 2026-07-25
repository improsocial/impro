import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Declarative } from "/js/dataLayer/declarative.js";

const sig = (getter) => ({ get: getter });
// Stubs a ComputedMap: get(key) returns the derived value directly.
const mapSig = (getter) => ({ get: (key) => getter(key) });

function createMockDerived(data = {}) {
  return {
    $currentUser: sig(() => data.currentUser ?? null),
    $hydratedDetailedProfiles: mapSig((did) => data.profiles?.[did] ?? null),
    $hydratedProfiles: mapSig((did) => data.basicProfiles?.[did] ?? null),
    $knownFollowers: mapSig((did) => data.knownFollowers?.[did] ?? null),
    $hydratedPostThreads: mapSig((uri) => data.postThreads?.[uri] ?? null),
    $hydratedPosts: mapSig((uri) => data.posts?.[uri] ?? null),
    $feedGenerators: mapSig((uri) => data.feedGenerators?.[uri] ?? null),
    $hydratedPinnedItems: sig(() => data.pinnedItems ?? null),
    $convoList: sig(() => data.convoList ?? null),
    $convos: mapSig((id) => data.convos?.[id] ?? null),
    $convoForProfile: mapSig((did) => data.convoForProfile?.[did] ?? null),
  };
}

function createMockRequests(loadResults = {}) {
  return {
    loadCurrentUser: async () => loadResults.currentUser,
    loadDetailedProfile: async (did) => loadResults.profiles?.[did],
    loadDetailedProfiles: async () => {},
    loadKnownFollowers: async () => {},
    loadPostThread: async (uri) => loadResults.postThreads?.[uri],
    loadPost: async (uri) => loadResults.posts?.[uri],
    loadPosts: async () => {},
    loadFeedGenerator: async (uri) => loadResults.feedGenerators?.[uri],
    loadPinnedItems: async () => loadResults.pinnedItems,
    loadConvoList: async () => loadResults.convoList,
    loadConvo: async (id) => loadResults.convos?.[id],
    loadConvoForProfile: async (did) => loadResults.convoForProfile?.[did],
  };
}

describe("ensureCurrentUser", () => {
  it("should return existing current user without loading", async () => {
    const currentUser = { did: "did:test:user", handle: "test.user" };
    let loadCalled = false;

    const derived = createMockDerived({ currentUser });
    const requests = {
      loadCurrentUser: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureCurrentUser();

    assert.deepEqual(result, currentUser);
    assert.deepEqual(loadCalled, false);
  });

  it("should load current user when not in cache", async () => {
    const currentUser = { did: "did:test:user", handle: "test.user" };
    let callCount = 0;

    const derived = {
      $currentUser: sig(() => {
        callCount++;
        return callCount > 1 ? currentUser : null;
      }),
    };
    const requests = {
      loadCurrentUser: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureCurrentUser();

    assert.deepEqual(result, currentUser);
    assert.deepEqual(callCount, 2);
  });

  it("should throw when user not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureCurrentUser();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Current user not found");
  });
});

describe("ensureProfile", () => {
  it("returns cached detailed profile without loading", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let loadCalled = false;

    const derived = createMockDerived({ profiles: { [profileDid]: profile } });
    const requests = {
      loadDetailedProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureProfile(profileDid);

    assert.deepEqual(result, profile);
    assert.deepEqual(loadCalled, false);
  });

  it("returns cached basic profile without loading when no detailed profile exists", async () => {
    const profileDid = "did:test:profile";
    const basicProfile = { did: profileDid, handle: "test.profile" };
    let loadCalled = false;

    const derived = createMockDerived({
      basicProfiles: { [profileDid]: basicProfile },
    });
    const requests = {
      loadDetailedProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureProfile(profileDid);

    assert.deepEqual(result, basicProfile);
    assert.deepEqual(loadCalled, false);
  });

  it("prefers detailed profile over basic profile when both are cached", async () => {
    const profileDid = "did:test:profile";
    const detailed = {
      did: profileDid,
      handle: "test.profile",
      detailed: true,
    };
    const basic = { did: profileDid, handle: "test.profile" };

    const derived = createMockDerived({
      profiles: { [profileDid]: detailed },
      basicProfiles: { [profileDid]: basic },
    });
    const requests = { loadDetailedProfile: async () => {} };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureProfile(profileDid);

    assert.deepEqual(result, detailed);
  });

  it("loads detailed profile when neither cache has it", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let callCount = 0;
    let loadCalled = false;

    const derived = {
      $hydratedDetailedProfiles: mapSig(() => {
        callCount++;
        return callCount > 1 ? profile : null;
      }),
      $hydratedProfiles: mapSig(() => null),
    };
    const requests = {
      loadDetailedProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureProfile(profileDid);

    assert.deepEqual(result, profile);
    assert.deepEqual(loadCalled, true);
  });

  it("throws when profile not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureProfile("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Profile not found");
  });
});

describe("ensureDetailedProfile", () => {
  it("should return existing profile without loading", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let loadCalled = false;

    const derived = createMockDerived({ profiles: { [profileDid]: profile } });
    const requests = {
      loadDetailedProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureDetailedProfile(profileDid);

    assert.deepEqual(result, profile);
    assert.deepEqual(loadCalled, false);
  });

  it("should load profile when not in cache", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let callCount = 0;

    const derived = {
      $hydratedDetailedProfiles: mapSig(() => {
        callCount++;
        return callCount > 1 ? profile : null;
      }),
    };
    const requests = {
      loadDetailedProfile: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureDetailedProfile(profileDid);

    assert.deepEqual(result, profile);
  });

  it("should throw when profile not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureDetailedProfile("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Profile not found");
  });
});

describe("ensureKnownFollowers", () => {
  it("should return existing known followers without loading", async () => {
    const profileDid = "did:test:profile";
    const knownFollowers = { followers: [{ did: "did:test:follower" }] };
    let loadCalled = false;

    const derived = createMockDerived({
      knownFollowers: { [profileDid]: knownFollowers },
    });
    const requests = {
      loadKnownFollowers: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureKnownFollowers(profileDid);

    assert.deepEqual(result, knownFollowers);
    assert.deepEqual(loadCalled, false);
  });

  it("should load known followers when not in cache", async () => {
    const profileDid = "did:test:profile";
    const knownFollowers = { followers: [{ did: "did:test:follower" }] };
    let callCount = 0;

    const derived = {
      $knownFollowers: mapSig(() => {
        callCount++;
        return callCount > 1 ? knownFollowers : null;
      }),
    };
    const requests = {
      loadKnownFollowers: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureKnownFollowers(profileDid);

    assert.deepEqual(result, knownFollowers);
  });

  it("should throw when known followers not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureKnownFollowers("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Known followers not found");
  });
});

describe("ensureDetailedProfiles", () => {
  it("returns cached profiles in input order without loading", async () => {
    const profileA = { did: "did:test:a", handle: "a.test" };
    const profileB = { did: "did:test:b", handle: "b.test" };
    let loadCalled = false;

    const derived = createMockDerived({
      profiles: { [profileA.did]: profileA, [profileB.did]: profileB },
    });
    const requests = {
      loadDetailedProfiles: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureDetailedProfiles([
      profileB.did,
      profileA.did,
    ]);

    assert.deepEqual(result, [profileB, profileA]);
    assert.deepEqual(loadCalled, false);
  });

  it("loads only missing profiles", async () => {
    const profileA = { did: "did:test:a", handle: "a.test" };
    const profileB = { did: "did:test:b", handle: "b.test" };
    const store = { [profileA.did]: profileA };
    let loadedWith = null;

    const derived = {
      $hydratedDetailedProfiles: mapSig((did) => store[did] ?? null),
    };
    const requests = {
      loadDetailedProfiles: async (dids) => {
        loadedWith = dids;
        store[profileB.did] = profileB;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureDetailedProfiles([
      profileA.did,
      profileB.did,
    ]);

    assert.deepEqual(loadedWith, [profileB.did]);
    assert.deepEqual(result, [profileA, profileB]);
  });

  it("returns null entries for profiles still missing after load", async () => {
    const derived = { $hydratedDetailedProfiles: mapSig(() => null) };
    const requests = { loadDetailedProfiles: async () => {} };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureDetailedProfiles([
      "did:test:missing",
    ]);

    assert.deepEqual(result, [null]);
  });
});

describe("ensurePostThread", () => {
  it("should return existing post thread without loading", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let loadCalled = false;

    const derived = createMockDerived({
      postThreads: { [postURI]: postThread },
    });
    const requests = {
      loadPostThread: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePostThread(postURI);

    assert.deepEqual(result, postThread);
    assert.deepEqual(loadCalled, false);
  });

  it("should load post thread when not in cache", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let callCount = 0;

    const derived = {
      $hydratedPostThreads: mapSig(() => {
        callCount++;
        return callCount > 1 ? postThread : null;
      }),
    };
    const requests = {
      loadPostThread: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePostThread(postURI);

    assert.deepEqual(result, postThread);
  });

  it("should pass labelers option to loadPostThread", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let passedLabelers = null;
    let callCount = 0;

    const derived = {
      $hydratedPostThreads: mapSig(() => {
        callCount++;
        return callCount > 1 ? postThread : null;
      }),
    };
    const requests = {
      loadPostThread: async (uri, options) => {
        passedLabelers = options.labelers;
      },
    };

    const declarative = new Declarative(derived, requests);
    await declarative.ensurePostThread(postURI, { labelers: ["labeler1"] });

    assert.deepEqual(passedLabelers, ["labeler1"]);
  });

  it("should throw when post thread not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensurePostThread("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Post thread not found");
  });
});

describe("ensurePost", () => {
  it("should return existing post without loading", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const post = { uri: postURI, text: "Hello" };
    let loadCalled = false;

    const derived = createMockDerived({ posts: { [postURI]: post } });
    const requests = {
      loadPost: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePost(postURI);

    assert.deepEqual(result, post);
    assert.deepEqual(loadCalled, false);
  });

  it("should load post when not in cache", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const post = { uri: postURI, text: "Hello" };
    let callCount = 0;

    const derived = {
      $hydratedPosts: mapSig(() => {
        callCount++;
        return callCount > 1 ? post : null;
      }),
    };
    const requests = {
      loadPost: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePost(postURI);

    assert.deepEqual(result, post);
  });

  it("should throw when post not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensurePost("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Post not found");
  });
});

describe("ensurePosts", () => {
  it("returns cached posts in input order without loading", async () => {
    const postA = { uri: "at://a", text: "A" };
    const postB = { uri: "at://b", text: "B" };
    let loadCalled = false;

    const derived = createMockDerived({
      posts: { [postA.uri]: postA, [postB.uri]: postB },
    });
    const requests = {
      loadPosts: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePosts([postB.uri, postA.uri]);

    assert.deepEqual(result, [postB, postA]);
    assert.deepEqual(loadCalled, false);
  });

  it("loads only missing posts", async () => {
    const postA = { uri: "at://a", text: "A" };
    const postB = { uri: "at://b", text: "B" };
    const store = { [postA.uri]: postA };
    let loadedWith = null;

    const derived = {
      $hydratedPosts: mapSig((uri) => store[uri] ?? null),
    };
    const requests = {
      loadPosts: async (uris) => {
        loadedWith = uris;
        store[postB.uri] = postB;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePosts([postA.uri, postB.uri]);

    assert.deepEqual(loadedWith, [postB.uri]);
    assert.deepEqual(result, [postA, postB]);
  });

  it("returns null entries for posts still missing after load", async () => {
    const derived = {
      $hydratedPosts: mapSig(() => null),
    };
    const requests = { loadPosts: async () => {} };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePosts(["at://missing"]);

    assert.deepEqual(result, [null]);
  });
});

describe("ensureFeedGenerator", () => {
  it("should return existing feed generator without loading", async () => {
    const feedUri = "at://did:test/app.bsky.feed.generator/test";
    const feedGenerator = { uri: feedUri, displayName: "Test Feed" };
    let loadCalled = false;

    const derived = createMockDerived({
      feedGenerators: { [feedUri]: feedGenerator },
    });
    const requests = {
      loadFeedGenerator: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureFeedGenerator(feedUri);

    assert.deepEqual(result, feedGenerator);
    assert.deepEqual(loadCalled, false);
  });

  it("should load feed generator when not in cache", async () => {
    const feedUri = "at://did:test/app.bsky.feed.generator/test";
    const feedGenerator = { uri: feedUri, displayName: "Test Feed" };
    let callCount = 0;

    const derived = {
      $feedGenerators: mapSig(() => {
        callCount++;
        return callCount > 1 ? feedGenerator : null;
      }),
    };
    const requests = {
      loadFeedGenerator: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureFeedGenerator(feedUri);

    assert.deepEqual(result, feedGenerator);
  });

  it("should throw when feed generator not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureFeedGenerator("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Feed generator not found");
  });
});

describe("ensurePinnedItems", () => {
  it("should return existing pinned items without loading", async () => {
    const pinnedItems = [
      { type: "feed", data: { uri: "feed1" } },
      { type: "feed", data: { uri: "feed2" } },
    ];
    let loadCalled = false;

    const derived = createMockDerived({ pinnedItems });
    const requests = {
      loadPinnedItems: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePinnedItems();

    assert.deepEqual(result, pinnedItems);
    assert.deepEqual(loadCalled, false);
  });

  it("should load pinned items when not in cache", async () => {
    const pinnedItems = [{ type: "feed", data: { uri: "feed1" } }];
    let callCount = 0;

    const derived = {
      $hydratedPinnedItems: sig(() => {
        callCount++;
        return callCount > 1 ? pinnedItems : null;
      }),
    };
    const requests = {
      loadPinnedItems: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensurePinnedItems();

    assert.deepEqual(result, pinnedItems);
  });

  it("should throw when pinned items not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensurePinnedItems();
    } catch (caught) {
      error = caught;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Pinned items not found");
  });
});

describe("ensureConvoList", () => {
  it("should return existing convo list without loading", async () => {
    const convoList = [{ id: "convo1" }, { id: "convo2" }];
    let loadCalled = false;

    const derived = createMockDerived({ convoList });
    const requests = {
      loadConvoList: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvoList();

    assert.deepEqual(result, convoList);
    assert.deepEqual(loadCalled, false);
  });

  it("should load convo list when not in cache", async () => {
    const convoList = [{ id: "convo1" }];
    let callCount = 0;

    const derived = {
      $convoList: sig(() => {
        callCount++;
        return callCount > 1 ? convoList : null;
      }),
    };
    const requests = {
      loadConvoList: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvoList();

    assert.deepEqual(result, convoList);
  });

  it("should throw when convo list not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureConvoList();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Conversation list not found");
  });
});

describe("ensureConvo", () => {
  it("should return existing convo without loading", async () => {
    const convoId = "convo123";
    const convo = { id: convoId, messages: [] };
    let loadCalled = false;

    const derived = createMockDerived({ convos: { [convoId]: convo } });
    const requests = {
      loadConvo: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvo(convoId);

    assert.deepEqual(result, convo);
    assert.deepEqual(loadCalled, false);
  });

  it("should load convo when not in cache", async () => {
    const convoId = "convo123";
    const convo = { id: convoId, messages: [] };
    let callCount = 0;

    const derived = {
      $convos: mapSig(() => {
        callCount++;
        return callCount > 1 ? convo : null;
      }),
    };
    const requests = {
      loadConvo: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvo(convoId);

    assert.deepEqual(result, convo);
  });

  it("should throw when convo not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureConvo("nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Conversation not found");
  });
});

describe("ensureConvoForProfile", () => {
  it("should return existing convo for profile without loading", async () => {
    const profileDid = "did:test:profile";
    const convo = { id: "convo123", members: [profileDid] };
    let loadCalled = false;

    const derived = createMockDerived({
      convoForProfile: { [profileDid]: convo },
    });
    const requests = {
      loadConvoForProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvoForProfile(profileDid);

    assert.deepEqual(result, convo);
    assert.deepEqual(loadCalled, false);
  });

  it("should load convo for profile when not in cache", async () => {
    const profileDid = "did:test:profile";
    const convo = { id: "convo123", members: [profileDid] };
    let callCount = 0;

    const derived = {
      $convoForProfile: mapSig(() => {
        callCount++;
        return callCount > 1 ? convo : null;
      }),
    };
    const requests = {
      loadConvoForProfile: async () => {},
    };

    const declarative = new Declarative(derived, requests);
    const result = await declarative.ensureConvoForProfile(profileDid);

    assert.deepEqual(result, convo);
  });

  it("should throw when convo for profile not found after loading", async () => {
    const derived = createMockDerived({});
    const requests = createMockRequests({});

    const declarative = new Declarative(derived, requests);

    let error = null;
    try {
      await declarative.ensureConvoForProfile("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assert.deepEqual(error.message, "Conversation not found");
  });
});
