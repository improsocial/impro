import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Api, ApiError } from "../../src/js/api.js";

const t = new TestSuite("Api");

function createMockSession(mockResponse = {}) {
  let lastFetchOptions = null;
  return {
    serviceEndpoint: "https://test.example.com",
    did: "did:plc:testuser",
    fetch: async (url, options) => {
      lastFetchOptions = { url, options };
      return {
        ok: true,
        json: async () => mockResponse,
      };
    },
    getLastFetchOptions: () => lastFetchOptions,
  };
}

t.describe("request", (it) => {
  it("should construct URL with path", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method");

    const { url } = session.getLastFetchOptions();
    assertEquals(url, "https://test.example.com/xrpc/com.example.method");
  });

  it("should append query string to URL", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method", {
      query: { foo: "bar", baz: "qux" },
    });

    const { url } = session.getLastFetchOptions();
    assertEquals(
      url,
      "https://test.example.com/xrpc/com.example.method?foo=bar&baz=qux",
    );
  });

  it("should default to GET method", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method");

    const { options } = session.getLastFetchOptions();
    assertEquals(options.method, "GET");
  });

  it("should use specified method", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method", { method: "POST" });

    const { options } = session.getLastFetchOptions();
    assertEquals(options.method, "POST");
  });

  it("should include Content-Type header by default", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method");

    const { options } = session.getLastFetchOptions();
    assertEquals(options.headers["Content-Type"], "application/json");
  });

  it("should merge custom headers", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method", {
      headers: { "X-Custom-Header": "custom-value" },
    });

    const { options } = session.getLastFetchOptions();
    assertEquals(options.headers["Content-Type"], "application/json");
    assertEquals(options.headers["X-Custom-Header"], "custom-value");
  });

  it("should stringify body by default", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.request("com.example.method", {
      method: "POST",
      body: { key: "value" },
    });

    const { options } = session.getLastFetchOptions();
    assertEquals(options.body, '{"key":"value"}');
  });

  it("should not stringify body when stringifyBody is false", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const rawBody = new Uint8Array([1, 2, 3]);

    await api.request("com.example.method", {
      method: "POST",
      body: rawBody,
      stringifyBody: false,
    });

    const { options } = session.getLastFetchOptions();
    assertEquals(options.body, rawBody);
  });

  it("should parse JSON response by default", async () => {
    const session = createMockSession({ result: "success" });
    const api = new Api(session);

    const res = await api.request("com.example.method");

    assertEquals(res.data, { result: "success" });
  });

  it("should not parse JSON when parseJson is false", async () => {
    const session = createMockSession({ result: "success" });
    const api = new Api(session);

    const res = await api.request("com.example.method", { parseJson: false });

    assertEquals(res.data, null);
  });

  it("should throw ApiError when response is not ok", async () => {
    const session = {
      serviceEndpoint: "https://test.example.com",
      did: "did:plc:testuser",
      fetch: async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "InvalidRequest" }),
      }),
    };
    const api = new Api(session);

    let thrownError = null;
    try {
      await api.request("com.example.method");
    } catch (e) {
      thrownError = e;
    }

    assert(thrownError instanceof ApiError);
    assertEquals(thrownError.status, 400);
  });
});

t.describe("service DID in requests", (it) => {
  it("should use custom bskyAppViewServiceDid in atproto-proxy header", async () => {
    const session = createMockSession({
      did: "did:plc:test",
      handle: "test.user",
    });
    const customDid = "did:web:custom.bsky.app#custom_appview";
    const api = new Api(session, { bskyAppViewServiceDid: customDid });

    await api.getProfile("did:plc:test");

    const { options } = session.getLastFetchOptions();
    assertEquals(options.headers["atproto-proxy"], customDid);
  });

  it("should use custom chatAppViewServiceDid in atproto-proxy header", async () => {
    const session = createMockSession({ convos: [] });
    const customDid = "did:web:custom.chat#custom_chat";
    const api = new Api(session, { chatAppViewServiceDid: customDid });

    await api.listConvos();

    const { options } = session.getLastFetchOptions();
    assertEquals(options.headers["atproto-proxy"], customDid);
  });
});

t.describe("createLikeRecord", (it) => {
  it("should create a like record with correct body", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.feed.like/abc123",
      cid: "cid123",
    });
    const api = new Api(session);
    const post = {
      uri: "at://did:plc:author/app.bsky.feed.post/xyz",
      cid: "postcid",
    };

    await api.createLikeRecord(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.createRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.feed.like");
    assertEquals(body.record.subject.uri, post.uri);
    assertEquals(body.record.subject.cid, post.cid);
  });
});

t.describe("deleteLikeRecord", (it) => {
  it("should delete a like record with correct rkey", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const post = {
      viewer: { like: "at://did:plc:testuser/app.bsky.feed.like/likerkey123" },
    };

    await api.deleteLikeRecord(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.deleteRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.feed.like");
    assertEquals(body.rkey, "likerkey123");
  });
});

t.describe("createRepostRecord", (it) => {
  it("should create a repost record with correct body", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.feed.repost/abc123",
      cid: "cid123",
    });
    const api = new Api(session);
    const post = {
      uri: "at://did:plc:author/app.bsky.feed.post/xyz",
      cid: "postcid",
    };

    await api.createRepostRecord(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.createRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.feed.repost");
    assertEquals(body.record.subject.uri, post.uri);
    assertEquals(body.record.subject.cid, post.cid);
  });
});

t.describe("deleteRepostRecord", (it) => {
  it("should delete a repost record with correct rkey", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const post = {
      viewer: {
        repost: "at://did:plc:testuser/app.bsky.feed.repost/repostrkey123",
      },
    };

    await api.deleteRepostRecord(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.deleteRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.feed.repost");
    assertEquals(body.rkey, "repostrkey123");
  });
});

t.describe("createBookmark", (it) => {
  it("should create a bookmark with correct body", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const post = {
      uri: "at://did:plc:author/app.bsky.feed.post/xyz",
      cid: "postcid",
    };

    await api.createBookmark(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.bookmark.createBookmark"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.uri, post.uri);
    assertEquals(body.cid, post.cid);
  });
});

t.describe("deleteBookmark", (it) => {
  it("should delete a bookmark with correct body", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const post = { uri: "at://did:plc:author/app.bsky.feed.post/xyz" };

    await api.deleteBookmark(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.bookmark.deleteBookmark"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.uri, post.uri);
  });
});

t.describe("createFollowRecord", (it) => {
  it("should create a follow record with correct body", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.graph.follow/abc123",
      cid: "cid123",
    });
    const api = new Api(session);
    const profile = { did: "did:plc:targetuser" };

    await api.createFollowRecord(profile);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.createRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.graph.follow");
    assertEquals(body.record.subject, "did:plc:targetuser");
  });
});

t.describe("deleteFollowRecord", (it) => {
  it("should delete a follow record with correct rkey", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const profile = {
      viewer: {
        following: "at://did:plc:testuser/app.bsky.graph.follow/followrkey123",
      },
    };

    await api.deleteFollowRecord(profile);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.deleteRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.repo, "did:plc:testuser");
    assertEquals(body.collection, "app.bsky.graph.follow");
    assertEquals(body.rkey, "followrkey123");
  });
});

t.describe("getPostThread", (it) => {
  it("should fetch post thread with correct query params", async () => {
    const session = createMockSession({ thread: { post: {} } });
    const api = new Api(session);

    await api.getPostThread("at://did:plc:author/app.bsky.feed.post/abc");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getPostThread"));
    assert(
      url.includes(
        "uri=at%3A%2F%2Fdid%3Aplc%3Aauthor%2Fapp.bsky.feed.post%2Fabc",
      ),
    );
  });

  it("should include labelers header when provided", async () => {
    const session = createMockSession({ thread: { post: {} } });
    const api = new Api(session);

    await api.getPostThread("at://did:plc:author/app.bsky.feed.post/abc", {
      labelers: ["did:plc:labeler1", "did:plc:labeler2"],
    });

    const { options } = session.getLastFetchOptions();
    assertEquals(
      options.headers["atproto-accept-labelers"],
      "did:plc:labeler1,did:plc:labeler2",
    );
  });
});

t.describe("getFeed", (it) => {
  it("should fetch feed with correct query params", async () => {
    const session = createMockSession({ feed: [], cursor: "nextcursor" });
    const api = new Api(session);

    const result = await api.getFeed(
      "at://did:plc:feed/app.bsky.feed.generator/myfeed",
    );

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getFeed"));
    assert(
      url.includes(
        "feed=at%3A%2F%2Fdid%3Aplc%3Afeed%2Fapp.bsky.feed.generator%2Fmyfeed",
      ),
    );
    assertEquals(result.cursor, "nextcursor");
  });

  it("should use custom limit and cursor", async () => {
    const session = createMockSession({ feed: [] });
    const api = new Api(session);

    await api.getFeed("at://did:plc:feed/app.bsky.feed.generator/myfeed", {
      limit: 50,
      cursor: "somecursor",
    });

    const { url } = session.getLastFetchOptions();
    assert(url.includes("limit=50"));
    assert(url.includes("cursor=somecursor"));
  });
});

t.describe("getFeedGenerator", (it) => {
  it("should fetch feed generator and return view", async () => {
    const session = createMockSession({
      view: { uri: "feeduri", displayName: "My Feed" },
    });
    const api = new Api(session);

    const result = await api.getFeedGenerator(
      "at://did:plc:feed/app.bsky.feed.generator/myfeed",
    );

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getFeedGenerator"));
    assertEquals(result.displayName, "My Feed");
  });
});

t.describe("getFeedGenerators", (it) => {
  it("should fetch multiple feed generators", async () => {
    const session = createMockSession({
      feeds: [{ uri: "feed1" }, { uri: "feed2" }],
    });
    const api = new Api(session);

    const result = await api.getFeedGenerators(["feed1", "feed2"]);

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getFeedGenerators"));
    assertEquals(result.length, 2);
  });
});

t.describe("getFollowingFeed", (it) => {
  it("should fetch timeline", async () => {
    const session = createMockSession({ feed: [], cursor: "nextcursor" });
    const api = new Api(session);

    const result = await api.getFollowingFeed();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getTimeline"));
    assertEquals(result.cursor, "nextcursor");
  });
});

t.describe("getPosts", (it) => {
  it("should fetch posts by URIs", async () => {
    const session = createMockSession({
      posts: [{ uri: "post1" }, { uri: "post2" }],
    });
    const api = new Api(session);

    const result = await api.getPosts([
      "at://did:plc:a/app.bsky.feed.post/1",
      "at://did:plc:b/app.bsky.feed.post/2",
    ]);

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getPosts"));
    assertEquals(result.length, 2);
  });
});

t.describe("getPost", (it) => {
  it("should fetch single post", async () => {
    const session = createMockSession({
      posts: [{ uri: "at://did:plc:a/app.bsky.feed.post/1", text: "hello" }],
    });
    const api = new Api(session);

    const result = await api.getPost("at://did:plc:a/app.bsky.feed.post/1");

    assertEquals(result.text, "hello");
  });

  it("should throw error when post not found", async () => {
    const session = createMockSession({ posts: [] });
    const api = new Api(session);

    let thrownError = null;
    try {
      await api.getPost("at://did:plc:a/app.bsky.feed.post/notfound");
    } catch (e) {
      thrownError = e;
    }

    assert(thrownError !== null);
    assert(thrownError.message.includes("Post not found"));
  });
});

t.describe("getRepost", (it) => {
  it("should fetch repost record", async () => {
    const session = createMockSession({
      uri: "at://did:plc:a/app.bsky.feed.repost/1",
      value: { subject: {} },
    });
    const api = new Api(session);

    const result = await api.getRepost("at://did:plc:a/app.bsky.feed.repost/1");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.getRecord"));
    assertEquals(result.uri, "at://did:plc:a/app.bsky.feed.repost/1");
  });
});

t.describe("getProfile", (it) => {
  it("should fetch profile by DID", async () => {
    const session = createMockSession({
      did: "did:plc:test",
      handle: "test.bsky.social",
    });
    const api = new Api(session);

    const result = await api.getProfile("did:plc:test");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.actor.getProfile"));
    assert(url.includes("actor=did%3Aplc%3Atest"));
    assertEquals(result.handle, "test.bsky.social");
  });
});

t.describe("searchProfiles", (it) => {
  it("should search profiles with query", async () => {
    const session = createMockSession({
      actors: [{ did: "did:plc:a" }, { did: "did:plc:b" }],
    });
    const api = new Api(session);

    const result = await api.searchProfiles("test");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.actor.searchActors"));
    assert(url.includes("q=test"));
    assertEquals(result.length, 2);
  });
});

t.describe("searchPosts", (it) => {
  it("should search posts with query", async () => {
    const session = createMockSession({
      posts: [{ uri: "post1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.searchPosts("hello");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.searchPosts"));
    assert(url.includes("q=hello"));
    assertEquals(result.cursor, "next");
  });

  it("should include sort parameter", async () => {
    const session = createMockSession({ posts: [] });
    const api = new Api(session);

    await api.searchPosts("hello", { sort: "latest" });

    const { url } = session.getLastFetchOptions();
    assert(url.includes("sort=latest"));
  });
});

t.describe("sendInteractions", (it) => {
  it("should send interactions to feed proxy", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const interactions = [{ uri: "post1", event: "view" }];

    await api.sendInteractions(
      interactions,
      "did:web:feed.example.com#feed_proxy",
    );

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.sendInteractions"));
    assertEquals(options.method, "POST");
    assertEquals(
      options.headers["atproto-proxy"],
      "did:web:feed.example.com#feed_proxy",
    );
  });
});

t.describe("getAuthorFeed", (it) => {
  it("should fetch author feed with filters", async () => {
    const session = createMockSession({ feed: [], cursor: "next" });
    const api = new Api(session);

    await api.getAuthorFeed("did:plc:author", { filter: "posts_no_replies" });

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getAuthorFeed"));
    assert(url.includes("actor=did%3Aplc%3Aauthor"));
    assert(url.includes("filter=posts_no_replies"));
  });
});

t.describe("getActorLikes", (it) => {
  it("should fetch actor likes", async () => {
    const session = createMockSession({ feed: [], cursor: "next" });
    const api = new Api(session);

    await api.getActorLikes("did:plc:user");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getActorLikes"));
    assert(url.includes("actor=did%3Aplc%3Auser"));
  });
});

t.describe("getPreferences", (it) => {
  it("should fetch preferences", async () => {
    const session = createMockSession({
      preferences: [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2" }],
    });
    const api = new Api(session);

    const result = await api.getPreferences();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.actor.getPreferences"));
    assertEquals(result.length, 1);
  });
});

t.describe("updatePreferences", (it) => {
  it("should update preferences", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const prefs = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
    ];

    await api.updatePreferences(prefs);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.actor.putPreferences"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.preferences, prefs);
  });
});

t.describe("getLabelers", (it) => {
  it("should fetch labelers by DIDs", async () => {
    const session = createMockSession({
      views: [{ creator: { did: "did:plc:labeler1" } }],
    });
    const api = new Api(session);

    const result = await api.getLabelers(["did:plc:labeler1"]);

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.labeler.getServices"));
    assert(url.includes("detailed=true"));
    assertEquals(result.length, 1);
  });
});

t.describe("getLabeler", (it) => {
  it("should fetch single labeler", async () => {
    const session = createMockSession({
      views: [{ creator: { did: "did:plc:labeler1" } }],
    });
    const api = new Api(session);

    const result = await api.getLabeler("did:plc:labeler1");

    assertEquals(result.creator.did, "did:plc:labeler1");
  });
});

t.describe("getSession", (it) => {
  it("should fetch session info", async () => {
    const session = createMockSession({
      did: "did:plc:testuser",
      handle: "test.bsky.social",
    });
    const api = new Api(session);

    const result = await api.getSession();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.server.getSession"));
    assertEquals(result.did, "did:plc:testuser");
  });
});

t.describe("getNumNotifications", (it) => {
  it("should fetch unread notification count", async () => {
    const session = createMockSession({ count: 5 });
    const api = new Api(session);

    const result = await api.getNumNotifications();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.notification.getUnreadCount"));
    assertEquals(result, 5);
  });
});

t.describe("getNotifications", (it) => {
  it("should fetch notifications", async () => {
    const session = createMockSession({
      notifications: [{ uri: "notif1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getNotifications();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.notification.listNotifications"));
    assertEquals(result.notifications.length, 1);
  });
});

t.describe("markNotificationsAsRead", (it) => {
  it("should mark notifications as seen", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.markNotificationsAsRead();

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.notification.updateSeen"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assert(body.seenAt !== undefined);
  });
});

t.describe("listConvos", (it) => {
  it("should list conversations", async () => {
    const session = createMockSession({
      convos: [{ id: "convo1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.listConvos();

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.listConvos"));
    assertEquals(
      options.headers["atproto-proxy"],
      "did:web:api.bsky.chat#bsky_chat",
    );
    assertEquals(result.convos.length, 1);
  });

  it("should include readState filter when provided", async () => {
    const session = createMockSession({ convos: [] });
    const api = new Api(session);

    await api.listConvos({ readState: "unread" });

    const { url } = session.getLastFetchOptions();
    assert(url.includes("readState=unread"));
  });
});

t.describe("getConvo", (it) => {
  it("should fetch conversation by ID", async () => {
    const session = createMockSession({ convo: { id: "convo1", members: [] } });
    const api = new Api(session);

    const result = await api.getConvo("convo1");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.getConvo"));
    assert(url.includes("convoId=convo1"));
    assertEquals(result.convo.id, "convo1");
  });
});

t.describe("getMessages", (it) => {
  it("should fetch messages for conversation", async () => {
    const session = createMockSession({
      messages: [{ id: "msg1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getMessages("convo1");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.getMessages"));
    assert(url.includes("convoId=convo1"));
    assertEquals(result.messages.length, 1);
  });
});

t.describe("sendMessage", (it) => {
  it("should send message to conversation", async () => {
    const session = createMockSession({ id: "msg1", text: "hello" });
    const api = new Api(session);

    await api.sendMessage("convo1", { text: "hello", facets: [] });

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.sendMessage"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
    assertEquals(body.message.text, "hello");
  });
});

t.describe("acceptConvo", (it) => {
  it("should accept conversation", async () => {
    const session = createMockSession({ convo: { id: "convo1" } });
    const api = new Api(session);

    await api.acceptConvo("convo1");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.acceptConvo"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
  });
});

t.describe("leaveConvo", (it) => {
  it("should leave conversation", async () => {
    const session = createMockSession({ convo: { id: "convo1" } });
    const api = new Api(session);

    await api.leaveConvo("convo1");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.leaveConvo"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
  });
});

t.describe("getConvoAvailability", (it) => {
  it("should check conversation availability", async () => {
    const session = createMockSession({ canChat: true });
    const api = new Api(session);

    const result = await api.getConvoAvailability(["did:plc:member1"]);

    const { url } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.getConvoAvailability"));
    assertEquals(result.canChat, true);
  });
});

t.describe("getConvoForMembers", (it) => {
  it("should get or create conversation for members", async () => {
    const session = createMockSession({ convo: { id: "convo1" } });
    const api = new Api(session);

    const result = await api.getConvoForMembers([
      "did:plc:member1",
      "did:plc:member2",
    ]);

    const { url } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.getConvoForMembers"));
    assertEquals(result.convo.id, "convo1");
  });
});

t.describe("getChatLogs", (it) => {
  it("should fetch chat logs", async () => {
    const session = createMockSession({ logs: [], cursor: "next" });
    const api = new Api(session);

    const result = await api.getChatLogs({ cursor: "somecursor" });

    const { url } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.getLog"));
    assert(url.includes("cursor=somecursor"));
    assertEquals(result.cursor, "next");
  });
});

t.describe("markConvoAsRead", (it) => {
  it("should mark conversation as read", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.markConvoAsRead("convo1");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.updateRead"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
  });
});

t.describe("addMessageReaction", (it) => {
  it("should add reaction to message", async () => {
    const session = createMockSession({
      message: { id: "msg1", reactions: [] },
    });
    const api = new Api(session);

    await api.addMessageReaction("convo1", "msg1", "👍");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.addReaction"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
    assertEquals(body.messageId, "msg1");
    assertEquals(body.value, "👍");
  });
});

t.describe("removeMessageReaction", (it) => {
  it("should remove reaction from message", async () => {
    const session = createMockSession({
      message: { id: "msg1", reactions: [] },
    });
    const api = new Api(session);

    await api.removeMessageReaction("convo1", "msg1", "👍");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("chat.bsky.convo.removeReaction"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.convoId, "convo1");
    assertEquals(body.messageId, "msg1");
    assertEquals(body.value, "👍");
  });
});

t.describe("getLikes", (it) => {
  it("should fetch likes for a post", async () => {
    const session = createMockSession({
      likes: [{ actor: { did: "did:plc:a" } }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getLikes(
      "at://did:plc:author/app.bsky.feed.post/abc",
    );

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getLikes"));
    assertEquals(result.likes.length, 1);
  });
});

t.describe("getQuotes", (it) => {
  it("should fetch quotes for a post", async () => {
    const session = createMockSession({
      posts: [{ uri: "quote1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getQuotes(
      "at://did:plc:author/app.bsky.feed.post/abc",
    );

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getQuotes"));
    assertEquals(result.posts.length, 1);
  });
});

t.describe("getRepostedBy", (it) => {
  it("should fetch users who reposted", async () => {
    const session = createMockSession({
      repostedBy: [{ did: "did:plc:a" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getRepostedBy(
      "at://did:plc:author/app.bsky.feed.post/abc",
    );

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.feed.getRepostedBy"));
    assertEquals(result.repostedBy.length, 1);
  });
});

t.describe("getBookmarks", (it) => {
  it("should fetch bookmarks", async () => {
    const session = createMockSession({
      bookmarks: [{ uri: "post1" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getBookmarks();

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.bookmark.getBookmarks"));
    assertEquals(result.bookmarks.length, 1);
  });
});

t.describe("getFollowers", (it) => {
  it("should fetch followers for actor", async () => {
    const session = createMockSession({
      followers: [{ did: "did:plc:a" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getFollowers("did:plc:user");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.graph.getFollowers"));
    assert(url.includes("actor=did%3Aplc%3Auser"));
    assertEquals(result.followers.length, 1);
  });
});

t.describe("getFollows", (it) => {
  it("should fetch follows for actor", async () => {
    const session = createMockSession({
      follows: [{ did: "did:plc:a" }],
      cursor: "next",
    });
    const api = new Api(session);

    const result = await api.getFollows("did:plc:user");

    const { url } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.graph.getFollows"));
    assert(url.includes("actor=did%3Aplc%3Auser"));
    assertEquals(result.follows.length, 1);
  });
});

t.describe("muteActor", (it) => {
  it("should mute actor", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.muteActor("did:plc:target");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.graph.muteActor"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.actor, "did:plc:target");
  });
});

t.describe("unmuteActor", (it) => {
  it("should unmute actor", async () => {
    const session = createMockSession({});
    const api = new Api(session);

    await api.unmuteActor("did:plc:target");

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("app.bsky.graph.unmuteActor"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.actor, "did:plc:target");
  });
});

t.describe("blockActor", (it) => {
  it("should create block record", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.graph.block/abc",
    });
    const api = new Api(session);
    const profile = { did: "did:plc:target" };

    await api.blockActor(profile);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.createRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.collection, "app.bsky.graph.block");
    assertEquals(body.record.subject, "did:plc:target");
  });
});

t.describe("unblockActor", (it) => {
  it("should delete block record", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const profile = {
      viewer: {
        blocking: "at://did:plc:testuser/app.bsky.graph.block/blockrkey123",
      },
    };

    await api.unblockActor(profile);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.deleteRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.collection, "app.bsky.graph.block");
    assertEquals(body.rkey, "blockrkey123");
  });
});

t.describe("createPost", (it) => {
  it("should create post with text", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.feed.post/abc",
      cid: "cid123",
    });
    const api = new Api(session);

    await api.createPost({ text: "Hello world", facets: [] });

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.createRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.collection, "app.bsky.feed.post");
    assertEquals(body.record.text, "Hello world");
  });

  it("should include embed when provided", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.feed.post/abc",
      cid: "cid123",
    });
    const api = new Api(session);
    const embed = { $type: "app.bsky.embed.images", images: [] };

    await api.createPost({ text: "Hello", facets: [], embed });

    const { options } = session.getLastFetchOptions();
    const body = JSON.parse(options.body);
    assertEquals(body.record.embed, embed);
  });

  it("should include reply when provided", async () => {
    const session = createMockSession({
      uri: "at://did:plc:testuser/app.bsky.feed.post/abc",
      cid: "cid123",
    });
    const api = new Api(session);
    const reply = {
      root: { uri: "rooturi", cid: "rootcid" },
      parent: { uri: "parenturi", cid: "parentcid" },
    };

    await api.createPost({ text: "Reply", facets: [], reply });

    const { options } = session.getLastFetchOptions();
    const body = JSON.parse(options.body);
    assertEquals(body.record.reply, reply);
  });
});

t.describe("deletePost", (it) => {
  it("should delete post by URI", async () => {
    const session = createMockSession({});
    const api = new Api(session);
    const post = {
      uri: "at://did:plc:testuser/app.bsky.feed.post/postrkey123",
    };

    await api.deletePost(post);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.deleteRecord"));
    assertEquals(options.method, "POST");
    const body = JSON.parse(options.body);
    assertEquals(body.collection, "app.bsky.feed.post");
    assertEquals(body.rkey, "postrkey123");
  });
});

t.describe("uploadBlob", (it) => {
  it("should upload blob with correct content type", async () => {
    const session = createMockSession({
      blob: { ref: { $link: "blobref123" }, mimeType: "image/png" },
    });
    const api = new Api(session);
    const blob = new Blob(["test"], { type: "image/png" });

    const result = await api.uploadBlob(blob);

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.repo.uploadBlob"));
    assertEquals(options.method, "POST");
    assertEquals(options.headers["Content-Type"], "image/png");
    assertEquals(result.ref.$link, "blobref123");
  });
});

t.describe("createModerationReport", (it) => {
  it("should create moderation report", async () => {
    const session = createMockSession({
      id: 123,
      reasonType: "com.atproto.moderation.defs#reasonSpam",
    });
    const api = new Api(session);
    const subject = {
      $type: "com.atproto.repo.strongRef",
      uri: "posturi",
      cid: "postcid",
    };

    await api.createModerationReport({
      reasonType: "com.atproto.moderation.defs#reasonSpam",
      reason: "This is spam",
      subject,
      labelerDid: "did:plc:labeler",
    });

    const { url, options } = session.getLastFetchOptions();
    assert(url.includes("com.atproto.moderation.createReport"));
    assertEquals(options.method, "POST");
    assertEquals(
      options.headers["atproto-proxy"],
      "did:plc:labeler#atproto_labeler",
    );
    const body = JSON.parse(options.body);
    assertEquals(body.reasonType, "com.atproto.moderation.defs#reasonSpam");
    assertEquals(body.reason, "This is spam");
    assertEquals(body.subject, subject);
  });

  it("should not include reason when not provided", async () => {
    const session = createMockSession({ id: 123 });
    const api = new Api(session);
    const subject = {
      $type: "com.atproto.repo.strongRef",
      uri: "posturi",
      cid: "postcid",
    };

    await api.createModerationReport({
      reasonType: "com.atproto.moderation.defs#reasonSpam",
      subject,
      labelerDid: "did:plc:labeler",
    });

    const { options } = session.getLastFetchOptions();
    const body = JSON.parse(options.body);
    assert(body.reason === undefined);
  });
});

await t.run();
