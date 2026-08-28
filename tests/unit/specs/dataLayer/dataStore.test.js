import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";

describe("setPosts", () => {
  it("should insert multiple posts", () => {
    const dataStore = new DataStore(createSessionState(null));
    const posts = [
      { uri: "at://did:test/app.bsky.feed.post/1", record: { text: "one" } },
      { uri: "at://did:test/app.bsky.feed.post/2", record: { text: "two" } },
      { uri: "at://did:test/app.bsky.feed.post/3", record: { text: "three" } },
    ];
    dataStore.setPosts(posts);
    for (const post of posts) {
      assert.deepEqual(dataStore.$posts.get(post.uri), post);
    }
  });

  it("should match $posts.set behavior when given a single post", () => {
    const dataStoreA = new DataStore(createSessionState(null));
    const dataStoreB = new DataStore(createSessionState(null));
    const post = {
      uri: "at://did:test/app.bsky.feed.post/solo",
      record: { text: "solo" },
    };
    dataStoreA.$posts.set(post.uri, post);
    dataStoreB.setPosts([post]);
    assert.deepEqual(
      dataStoreA.$posts.get(post.uri),
      dataStoreB.$posts.get(post.uri),
    );
  });

  it("should store nested quoted posts as embedded previews", () => {
    const dataStore = new DataStore(createSessionState(null));
    const nestedQuotedPost = {
      $type: "app.bsky.embed.record#viewRecord",
      uri: "at://did:test/app.bsky.feed.post/nested",
      cid: "nested-cid",
      author: { did: "did:test", handle: "nested.test" },
      value: { text: "nested" },
      indexedAt: "2026-07-19T00:00:00Z",
    };
    const quotedPost = {
      $type: "app.bsky.embed.record#viewRecord",
      uri: "at://did:test/app.bsky.feed.post/quoted",
      cid: "quoted-cid",
      author: { did: "did:test", handle: "quoted.test" },
      value: { text: "quoted" },
      embeds: [
        {
          $type: "app.bsky.embed.record#view",
          record: nestedQuotedPost,
        },
      ],
      indexedAt: "2026-07-19T00:00:00Z",
    };
    const post = {
      uri: "at://did:test/app.bsky.feed.post/root",
      record: { text: "root" },
      embed: {
        $type: "app.bsky.embed.record#view",
        record: quotedPost,
      },
    };

    dataStore.setPosts([post]);

    assert.deepEqual(dataStore.$posts.get(quotedPost.uri), null);
    assert.deepEqual(dataStore.$embeddedPosts.get(quotedPost.uri), {
      uri: quotedPost.uri,
      cid: quotedPost.cid,
      author: quotedPost.author,
      record: quotedPost.value,
      embed: quotedPost.embeds[0],
      labels: undefined,
      likeCount: undefined,
      replyCount: undefined,
      repostCount: undefined,
      quoteCount: undefined,
      indexedAt: quotedPost.indexedAt,
    });
    assert.deepEqual(dataStore.$posts.get(nestedQuotedPost.uri), null);
    assert.deepEqual(dataStore.$embeddedPosts.get(nestedQuotedPost.uri), {
      uri: nestedQuotedPost.uri,
      cid: nestedQuotedPost.cid,
      author: nestedQuotedPost.author,
      record: nestedQuotedPost.value,
      embed: undefined,
      labels: undefined,
      likeCount: undefined,
      replyCount: undefined,
      repostCount: undefined,
      quoteCount: undefined,
      indexedAt: nestedQuotedPost.indexedAt,
    });
  });

  it("should replace an embedded preview with a full post", () => {
    const dataStore = new DataStore(createSessionState(null));
    const quotedUri = "at://did:test/app.bsky.feed.post/quoted";
    const quotedPost = {
      $type: "app.bsky.embed.record#viewRecord",
      uri: quotedUri,
      cid: "quoted-cid",
      author: { did: "did:test", handle: "quoted.test" },
      value: { text: "quoted" },
      indexedAt: "2026-07-19T00:00:00Z",
    };
    dataStore.setPosts([
      {
        uri: "at://did:test/app.bsky.feed.post/root",
        record: { text: "root" },
        embed: {
          $type: "app.bsky.embed.record#view",
          record: quotedPost,
        },
      },
    ]);

    const fullPost = {
      uri: quotedUri,
      cid: "quoted-cid",
      author: quotedPost.author,
      record: quotedPost.value,
      indexedAt: quotedPost.indexedAt,
      viewer: { like: "at://did:test/app.bsky.feed.like/quoted" },
    };
    dataStore.setPosts([fullPost]);

    assert.deepEqual(dataStore.$embeddedPosts.get(quotedUri), null);
    assert.deepEqual(dataStore.$posts.get(quotedUri), fullPost);
  });

  it("should normalize post authors into $profiles", () => {
    const dataStore = new DataStore(createSessionState(null));
    const author = {
      did: "did:test:author",
      handle: "author.test",
      displayName: "Author",
      viewer: { following: null },
    };
    dataStore.setPosts([
      {
        uri: "at://did:test:author/app.bsky.feed.post/1",
        record: { text: "one" },
        author,
      },
    ]);
    assert.deepEqual(dataStore.$profiles.get("did:test:author"), author);
  });

  it("should normalize quoted post authors into $profiles", () => {
    const dataStore = new DataStore(createSessionState(null));
    const quotedAuthor = { did: "did:test:quoted", handle: "quoted.test" };
    dataStore.setPosts([
      {
        uri: "at://did:test:author/app.bsky.feed.post/1",
        record: { text: "root" },
        author: { did: "did:test:author", handle: "author.test" },
        embed: {
          $type: "app.bsky.embed.record#view",
          record: {
            $type: "app.bsky.embed.record#viewRecord",
            uri: "at://did:test:quoted/app.bsky.feed.post/2",
            cid: "quoted-cid",
            author: quotedAuthor,
            value: { text: "quoted" },
            indexedAt: "2026-07-19T00:00:00Z",
          },
        },
      },
    ]);
    assert.deepEqual(dataStore.$profiles.get("did:test:quoted"), quotedAuthor);
  });
});

describe("mergeProfile", () => {
  it("should keep fields the new fragment does not carry", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.mergeProfile({
      did: "did:test:a",
      handle: "a.test",
      description: "richer profile view",
      viewer: { following: null },
    });
    dataStore.mergeProfile({
      did: "did:test:a",
      handle: "a.test",
      displayName: "A",
      viewer: { following: "at://follow-uri" },
    });
    assert.deepEqual(dataStore.$profiles.get("did:test:a"), {
      did: "did:test:a",
      handle: "a.test",
      description: "richer profile view",
      displayName: "A",
      viewer: { following: "at://follow-uri" },
    });
  });

  it("should not merge tombstone authors without a handle", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.mergeProfile({
      did: "did:test:blocked",
      viewer: { blockedBy: true },
    });
    assert.deepEqual(dataStore.$profiles.get("did:test:blocked"), null);
  });

  it("should not dirty the entry when nothing changed", () => {
    const dataStore = new DataStore(createSessionState(null));
    const profile = {
      did: "did:test:a",
      handle: "a.test",
      viewer: { following: null },
    };
    dataStore.mergeProfile(profile);
    const stored = dataStore.$profiles.get("did:test:a");
    dataStore.mergeProfile({ ...profile, viewer: { following: null } });
    assert(dataStore.$profiles.get("did:test:a") === stored);
  });
});

describe("setConvo", () => {
  it("should save the convo and prepend it to the loaded convo list", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convoList.set({ convos: [{ id: "c1" }], cursor: "page2" });
    const convo = { id: "c2", status: "accepted" };

    dataStore.setConvo(convo);

    assert.deepEqual(dataStore.$convos.get("c2"), convo);
    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      ["c2", "c1"],
    );
    assert.deepEqual(dataStore.$convoList.get().cursor, "page2");
  });

  it("should replace an existing list entry instead of duplicating it", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convoList.set({
      convos: [{ id: "c1", unreadCount: 0 }],
      cursor: null,
    });

    dataStore.setConvo({
      id: "c1",
      status: "accepted",
      unreadCount: 2,
    });

    const list = dataStore.$convoList.get();
    assert.deepEqual(list.convos.length, 1);
    assert.deepEqual(list.convos[0].unreadCount, 2);
  });

  it("should leave unloaded lists null", () => {
    const dataStore = new DataStore(createSessionState(null));

    dataStore.setConvo({ id: "c1", status: "accepted" });

    assert.deepEqual(dataStore.$convos.get("c1").id, "c1");
    assert.deepEqual(dataStore.$convoList.get(), null);
    assert.deepEqual(dataStore.$convoRequestList.get(), null);
  });

  it("should route request convos to the request list", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convoList.set({ convos: [], cursor: null });
    dataStore.$convoRequestList.set({ convos: [], cursor: null });

    dataStore.setConvo({ id: "c1", status: "request" });

    assert.deepEqual(dataStore.$convoList.get().convos, []);
    assert.deepEqual(
      dataStore.$convoRequestList.get().convos.map((listConvo) => listConvo.id),
      ["c1"],
    );
  });

  it("should move an accepted convo out of the request list", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$convoList.set({ convos: [], cursor: null });
    dataStore.$convoRequestList.set({
      convos: [{ id: "c1", status: "request" }],
      cursor: null,
    });

    dataStore.setConvo({ id: "c1", status: "accepted" });

    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      ["c1"],
    );
    assert.deepEqual(dataStore.$convoRequestList.get().convos, []);
  });
});

describe("setPinnedItems", () => {
  const followingItem = {
    type: "timeline",
    data: { uri: "following", displayName: "Following" },
  };
  const feedItem = {
    type: "feed",
    data: { uri: "at://did:test/app.bsky.feed.generator/cats" },
  };

  it("should save the pinned items", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.setPinnedItems([followingItem, feedItem]);
    assert.deepEqual(dataStore.$pinnedItems.get(), [followingItem, feedItem]);
  });

  it("should keep a selected feed that is still pinned", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$selectedFeedUri.set(feedItem.data.uri);
    dataStore.setPinnedItems([followingItem, feedItem]);
    assert.deepEqual(dataStore.$selectedFeedUri.get(), feedItem.data.uri);
  });

  it("should reset a no-longer-pinned selected feed to the first pinned item", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$selectedFeedUri.set(feedItem.data.uri);
    dataStore.setPinnedItems([followingItem]);
    assert.deepEqual(dataStore.$selectedFeedUri.get(), "following");
  });

  it("should leave a null selected feed alone", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.setPinnedItems([followingItem]);
    assert.deepEqual(dataStore.$selectedFeedUri.get(), null);
  });

  it("should clear the selected feed when nothing is pinned", () => {
    const dataStore = new DataStore(createSessionState(null));
    dataStore.$selectedFeedUri.set(feedItem.data.uri);
    dataStore.setPinnedItems([]);
    assert.deepEqual(dataStore.$selectedFeedUri.get(), null);
  });
});
