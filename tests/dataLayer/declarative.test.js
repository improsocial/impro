import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Declarative } from "../../src/js/dataLayer/declarative.js";

const t = new TestSuite("Declarative");

function createMockSelectors(data = {}) {
  return {
    getCurrentUser: () => data.currentUser ?? null,
    getPreferences: () => data.preferences ?? null,
    getProfile: (did) => data.profiles?.[did] ?? null,
    getPostThread: (uri) => data.postThreads?.[uri] ?? null,
    getPost: (uri) => data.posts?.[uri] ?? null,
    getFeedGenerator: (uri) => data.feedGenerators?.[uri] ?? null,
    getPinnedFeedGenerators: () => data.pinnedFeedGenerators ?? null,
    getConvoList: () => data.convoList ?? null,
    getConvo: (id) => data.convos?.[id] ?? null,
    getConvoForProfile: (did) => data.convoForProfile?.[did] ?? null,
  };
}

function createMockRequests(loadResults = {}) {
  return {
    loadCurrentUser: async () => loadResults.currentUser,
    loadPreferences: async () => loadResults.preferences,
    loadProfile: async (did) => loadResults.profiles?.[did],
    loadPostThread: async (uri) => loadResults.postThreads?.[uri],
    loadPost: async (uri) => loadResults.posts?.[uri],
    loadFeedGenerator: async (uri) => loadResults.feedGenerators?.[uri],
    loadPinnedFeedGenerators: async () => loadResults.pinnedFeedGenerators,
    loadConvoList: async () => loadResults.convoList,
    loadConvo: async (id) => loadResults.convos?.[id],
    loadConvoForProfile: async (did) => loadResults.convoForProfile?.[did],
  };
}

t.describe("ensureCurrentUser", (it) => {
  it("should return existing current user without loading", async () => {
    const currentUser = { did: "did:test:user", handle: "test.user" };
    let loadCalled = false;

    const selectors = createMockSelectors({ currentUser });
    const requests = {
      loadCurrentUser: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureCurrentUser();

    assertEquals(result, currentUser);
    assertEquals(loadCalled, false);
  });

  it("should load current user when not in cache", async () => {
    const currentUser = { did: "did:test:user", handle: "test.user" };
    let callCount = 0;

    const selectors = {
      getCurrentUser: () => {
        callCount++;
        return callCount > 1 ? currentUser : null;
      },
    };
    const requests = {
      loadCurrentUser: async () => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureCurrentUser();

    assertEquals(result, currentUser);
    assertEquals(callCount, 2);
  });

  it("should throw when user not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureCurrentUser();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Current user not found");
  });
});

t.describe("ensurePreferences", (it) => {
  it("should return existing preferences without loading", async () => {
    const preferences = { theme: "dark" };
    let loadCalled = false;

    const selectors = createMockSelectors({ preferences });
    const requests = {
      loadPreferences: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePreferences();

    assertEquals(result, preferences);
    assertEquals(loadCalled, false);
  });

  it("should load preferences when not in cache", async () => {
    const preferences = { theme: "dark" };
    let callCount = 0;

    const selectors = {
      getPreferences: () => {
        callCount++;
        return callCount > 1 ? preferences : null;
      },
    };
    const requests = {
      loadPreferences: async () => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePreferences();

    assertEquals(result, preferences);
  });

  it("should throw when preferences not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensurePreferences();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Preferences not found");
  });
});

t.describe("ensureProfile", (it) => {
  it("should return existing profile without loading", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let loadCalled = false;

    const selectors = createMockSelectors({ profiles: { [profileDid]: profile } });
    const requests = {
      loadProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureProfile(profileDid);

    assertEquals(result, profile);
    assertEquals(loadCalled, false);
  });

  it("should load profile when not in cache", async () => {
    const profileDid = "did:test:profile";
    const profile = { did: profileDid, handle: "test.profile" };
    let callCount = 0;

    const selectors = {
      getProfile: (did) => {
        callCount++;
        return callCount > 1 ? profile : null;
      },
    };
    const requests = {
      loadProfile: async (did) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureProfile(profileDid);

    assertEquals(result, profile);
  });

  it("should throw when profile not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureProfile("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Profile not found");
  });
});

t.describe("ensurePostThread", (it) => {
  it("should return existing post thread without loading", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let loadCalled = false;

    const selectors = createMockSelectors({
      postThreads: { [postURI]: postThread },
    });
    const requests = {
      loadPostThread: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePostThread(postURI);

    assertEquals(result, postThread);
    assertEquals(loadCalled, false);
  });

  it("should load post thread when not in cache", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let callCount = 0;

    const selectors = {
      getPostThread: (uri) => {
        callCount++;
        return callCount > 1 ? postThread : null;
      },
    };
    const requests = {
      loadPostThread: async (uri, options) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePostThread(postURI);

    assertEquals(result, postThread);
  });

  it("should pass labelers option to loadPostThread", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const postThread = { post: { uri: postURI }, replies: [] };
    let passedLabelers = null;
    let callCount = 0;

    const selectors = {
      getPostThread: (uri) => {
        callCount++;
        return callCount > 1 ? postThread : null;
      },
    };
    const requests = {
      loadPostThread: async (uri, options) => {
        passedLabelers = options.labelers;
      },
    };

    const declarative = new Declarative(selectors, requests);
    await declarative.ensurePostThread(postURI, { labelers: ["labeler1"] });

    assertEquals(passedLabelers, ["labeler1"]);
  });

  it("should throw when post thread not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensurePostThread("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Post thread not found");
  });
});

t.describe("ensurePost", (it) => {
  it("should return existing post without loading", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const post = { uri: postURI, text: "Hello" };
    let loadCalled = false;

    const selectors = createMockSelectors({ posts: { [postURI]: post } });
    const requests = {
      loadPost: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePost(postURI);

    assertEquals(result, post);
    assertEquals(loadCalled, false);
  });

  it("should load post when not in cache", async () => {
    const postURI = "at://did:test/app.bsky.feed.post/123";
    const post = { uri: postURI, text: "Hello" };
    let callCount = 0;

    const selectors = {
      getPost: (uri) => {
        callCount++;
        return callCount > 1 ? post : null;
      },
    };
    const requests = {
      loadPost: async (uri) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePost(postURI);

    assertEquals(result, post);
  });

  it("should throw when post not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensurePost("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Post not found");
  });
});

t.describe("ensureFeedGenerator", (it) => {
  it("should return existing feed generator without loading", async () => {
    const feedUri = "at://did:test/app.bsky.feed.generator/test";
    const feedGenerator = { uri: feedUri, displayName: "Test Feed" };
    let loadCalled = false;

    const selectors = createMockSelectors({
      feedGenerators: { [feedUri]: feedGenerator },
    });
    const requests = {
      loadFeedGenerator: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureFeedGenerator(feedUri);

    assertEquals(result, feedGenerator);
    assertEquals(loadCalled, false);
  });

  it("should load feed generator when not in cache", async () => {
    const feedUri = "at://did:test/app.bsky.feed.generator/test";
    const feedGenerator = { uri: feedUri, displayName: "Test Feed" };
    let callCount = 0;

    const selectors = {
      getFeedGenerator: (uri) => {
        callCount++;
        return callCount > 1 ? feedGenerator : null;
      },
    };
    const requests = {
      loadFeedGenerator: async (uri) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureFeedGenerator(feedUri);

    assertEquals(result, feedGenerator);
  });

  it("should throw when feed generator not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureFeedGenerator("at://nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Feed generator not found");
  });
});

t.describe("ensurePinnedFeedGenerators", (it) => {
  it("should return existing pinned feed generators without loading", async () => {
    const pinnedFeedGenerators = [{ uri: "feed1" }, { uri: "feed2" }];
    let loadCalled = false;

    const selectors = createMockSelectors({ pinnedFeedGenerators });
    const requests = {
      loadPinnedFeedGenerators: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePinnedFeedGenerators();

    assertEquals(result, pinnedFeedGenerators);
    assertEquals(loadCalled, false);
  });

  it("should load pinned feed generators when not in cache", async () => {
    const pinnedFeedGenerators = [{ uri: "feed1" }];
    let callCount = 0;

    const selectors = {
      getPinnedFeedGenerators: () => {
        callCount++;
        return callCount > 1 ? pinnedFeedGenerators : null;
      },
    };
    const requests = {
      loadPinnedFeedGenerators: async () => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensurePinnedFeedGenerators();

    assertEquals(result, pinnedFeedGenerators);
  });

  it("should throw when pinned feed generators not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensurePinnedFeedGenerators();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Pinned feed generators not found");
  });
});

t.describe("ensureConvoList", (it) => {
  it("should return existing convo list without loading", async () => {
    const convoList = [{ id: "convo1" }, { id: "convo2" }];
    let loadCalled = false;

    const selectors = createMockSelectors({ convoList });
    const requests = {
      loadConvoList: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvoList();

    assertEquals(result, convoList);
    assertEquals(loadCalled, false);
  });

  it("should load convo list when not in cache", async () => {
    const convoList = [{ id: "convo1" }];
    let callCount = 0;

    const selectors = {
      getConvoList: () => {
        callCount++;
        return callCount > 1 ? convoList : null;
      },
    };
    const requests = {
      loadConvoList: async () => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvoList();

    assertEquals(result, convoList);
  });

  it("should throw when convo list not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureConvoList();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Conversation list not found");
  });
});

t.describe("ensureConvo", (it) => {
  it("should return existing convo without loading", async () => {
    const convoId = "convo123";
    const convo = { id: convoId, messages: [] };
    let loadCalled = false;

    const selectors = createMockSelectors({ convos: { [convoId]: convo } });
    const requests = {
      loadConvo: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvo(convoId);

    assertEquals(result, convo);
    assertEquals(loadCalled, false);
  });

  it("should load convo when not in cache", async () => {
    const convoId = "convo123";
    const convo = { id: convoId, messages: [] };
    let callCount = 0;

    const selectors = {
      getConvo: (id) => {
        callCount++;
        return callCount > 1 ? convo : null;
      },
    };
    const requests = {
      loadConvo: async (id) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvo(convoId);

    assertEquals(result, convo);
  });

  it("should throw when convo not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureConvo("nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Conversation not found");
  });
});

t.describe("ensureConvoForProfile", (it) => {
  it("should return existing convo for profile without loading", async () => {
    const profileDid = "did:test:profile";
    const convo = { id: "convo123", members: [profileDid] };
    let loadCalled = false;

    const selectors = createMockSelectors({
      convoForProfile: { [profileDid]: convo },
    });
    const requests = {
      loadConvoForProfile: async () => {
        loadCalled = true;
      },
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvoForProfile(profileDid);

    assertEquals(result, convo);
    assertEquals(loadCalled, false);
  });

  it("should load convo for profile when not in cache", async () => {
    const profileDid = "did:test:profile";
    const convo = { id: "convo123", members: [profileDid] };
    let callCount = 0;

    const selectors = {
      getConvoForProfile: (did) => {
        callCount++;
        return callCount > 1 ? convo : null;
      },
    };
    const requests = {
      loadConvoForProfile: async (did) => {},
    };

    const declarative = new Declarative(selectors, requests);
    const result = await declarative.ensureConvoForProfile(profileDid);

    assertEquals(result, convo);
  });

  it("should throw when convo for profile not found after loading", async () => {
    const selectors = createMockSelectors({});
    const requests = createMockRequests({});

    const declarative = new Declarative(selectors, requests);

    let error = null;
    try {
      await declarative.ensureConvoForProfile("did:nonexistent");
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Conversation not found");
  });
});

await t.run();
