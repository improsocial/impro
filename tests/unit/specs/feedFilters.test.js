import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterFollowingFeed,
  filterAlgorithmicFeed,
  filterAuthorFeed,
  filterBookmarksFeed,
} from "/js/feedFilters.js";
import { createUnavailablePost } from "/js/dataHelpers.js";

// Helper to create mock posts
function createPost(options = {}) {
  return {
    uri: options.uri || `at://did:plc:test/app.bsky.feed.post/${Math.random()}`,
    cid: options.cid || "test-cid",
    author: options.author || { did: "did:plc:author", handle: "author.test" },
    record: { text: options.text || "Test post" },
    ...options,
  };
}

function createFeedItem(options = {}) {
  return {
    post: createPost(options.post),
    reply: options.reply,
    reason: options.reason,
  };
}

function createFeed(items, cursor = "test-cursor") {
  return {
    feed: items,
    cursor,
  };
}

function createPreferences(overrides = {}) {
  return {
    getFollowingFeedPreference: () => ({
      hideReposts: false,
      hideReplies: false,
      hideQuotePosts: false,
      ...overrides,
    }),
  };
}

function createCurrentUser(did = "did:plc:currentuser") {
  return {
    did,
    handle: "currentuser.test",
  };
}

describe("filterFollowingFeed", () => {
  it("should return all non-reply posts", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
      createFeedItem({
        post: { author: { did: "did:plc:2", handle: "user2" } },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 2);
    assert.deepEqual(result.cursor, "test-cursor");
  });

  it("should filter out reposts when hideReposts is true", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
      createFeedItem({
        post: { author: { did: "did:plc:2", handle: "user2" } },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences({ hideReposts: true });

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should keep reposts when hideReposts is false", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
      createFeedItem({
        post: { author: { did: "did:plc:2", handle: "user2" } },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences({ hideReposts: false });

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 2);
  });

  it("should filter out replies when hideReplies is true", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
      createFeedItem({
        post: { author: { did: "did:plc:2", handle: "user2" } },
        reply: {
          parent: createPost(),
          root: createPost(),
        },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences({ hideReplies: true });

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should deduplicate posts by root URI", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({
        post: { uri: "at://did:plc:other/app.bsky.feed.post/456" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 2);
  });

  it("should deduplicate reposts with the same root URI", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({
        post: { uri: rootUri },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should keep reposts with unique root URIs", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:root/app.bsky.feed.post/1" },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:root/app.bsky.feed.post/2" },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 2);
  });

  it("should return unfiltered feed when no currentUser", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
    ];
    const feed = createFeed(items);
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, null, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAlgorithmicFeed", () => {
  it("should deduplicate posts", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({ post: { uri: rootUri } }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should deduplicate reposts with the same root URI", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({
        post: { uri: rootUri },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should preserve cursor", () => {
    const feed = createFeed([], "my-cursor");

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.cursor, "my-cursor");
  });

  it("should handle empty feed", () => {
    const feed = createFeed([]);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 0);
  });
});

describe("filterAlgorithmicFeed - blocked quote filtering", () => {
  function createBlockedQuoteItem(viewerState) {
    return createFeedItem({
      post: {
        embed: {
          $type: "app.bsky.embed.record#view",
          record: {
            $type: "app.bsky.embed.record#viewBlocked",
            uri: "at://did:plc:quoted/app.bsky.feed.post/q",
            blocked: true,
            author: { did: "did:plc:quoted", viewer: viewerState },
          },
        },
      },
    });
  }

  it("should filter out posts quoting an author who blocks the viewer", () => {
    const feed = createFeed([createBlockedQuoteItem({ blockedBy: true })]);
    const result = filterAlgorithmicFeed(feed, true, {});
    assert.deepEqual(result.feed.length, 0);
  });

  it("should filter out posts quoting an author the viewer blocks", () => {
    const feed = createFeed([
      createBlockedQuoteItem({
        blocking: "at://did:plc:me/app.bsky.graph.block/1",
      }),
    ]);
    const result = filterAlgorithmicFeed(feed, true, {});
    assert.deepEqual(result.feed.length, 0);
  });

  it("should keep posts with third-party-blocked quotes", () => {
    const feed = createFeed([createBlockedQuoteItem({})]);
    const result = filterAlgorithmicFeed(feed, true, {});
    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAlgorithmicFeed - blocked post filtering", () => {
  it("should filter out feed items whose post is a #blockedPost", () => {
    const feed = createFeed([
      createFeedItem({
        post: {
          $type: "app.bsky.feed.defs#blockedPost",
          uri: "at://did:plc:blocked/app.bsky.feed.post/1",
          blocked: true,
          author: { did: "did:plc:blocked" },
        },
      }),
      createFeedItem({ post: { text: "visible post" } }),
    ]);
    const result = filterAlgorithmicFeed(feed, true, {});
    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(result.feed[0].post.record.text, "visible post");
  });
});

describe("filterAuthorFeed", () => {
  it("should preserve cursor", () => {
    const feed = createFeed([], "author-cursor");

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.cursor, "author-cursor");
  });

  it("should handle empty feed", () => {
    const feed = createFeed([]);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 0);
  });

  it("should pass through regular posts unmodified", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1" },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should deduplicate posts by root URI", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({
        post: { uri: "at://did:plc:other/app.bsky.feed.post/456" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should keep the rest of a thread when its newest reply is deleted", () => {
    const rootUri = "at://did:plc:test/app.bsky.feed.post/root";
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/deleted-reply",
          $type: "app.bsky.feed.defs#notFoundPost",
        },
        reply: {
          root: { uri: rootUri },
          parent: { uri: rootUri },
        },
      }),
      createFeedItem({ post: { uri: rootUri } }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(result.feed[0].post.uri, rootUri);
  });

  it("should not deduplicate reposts with the same root URI", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({
        post: { uri: rootUri },
        reason: { $type: "app.bsky.feed.defs#reasonRepost" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should filter out blocked posts", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          $type: "app.bsky.feed.defs#blockedPost",
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should filter out not-found posts", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          $type: "app.bsky.feed.defs#notFoundPost",
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should filter out unavailable posts", () => {
    const items = [
      createFeedItem({
        post: createUnavailablePost("at://did:plc:test/app.bsky.feed.post/1"),
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep items with blocked reply parent", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1" },
        reply: {
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: "at://blocked",
          },
          root: createPost(),
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should keep items with not-found reply root", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1" },
        reply: {
          parent: createPost(),
          root: {
            $type: "app.bsky.feed.defs#notFoundPost",
            uri: "at://notfound",
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should filter out posts hidden by viewer", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { isHidden: true },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should filter out posts with hidden quoted post", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              isHidden: true,
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts where viewer.isHidden is false", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { isHidden: false },
        },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });

  it("should filter out posts with content label hide on quoted post", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              contentLabel: { visibility: "hide" },
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with content label warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          contentLabel: { visibility: "warn" },
        },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });

  it("should apply all filters together", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/blocked",
          $type: "app.bsky.feed.defs#blockedPost",
        },
      }),
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/hidden",
          viewer: { isHidden: true },
        },
      }),
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/labeled",
          contentLabel: { visibility: "hide" },
        },
      }),
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/unauth",
          author: {
            did: "did:plc:private",
            handle: "private.test",
            labels: [{ val: "!no-unauthenticated" }],
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/ok" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, false);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/ok",
    );
  });
});

describe("filterFollowingFeed - content label filtering", () => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          contentLabel: { visibility: "hide" },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with content label visibility warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { contentLabel: { visibility: "warn" } },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 2);
  });

  it("should filter posts with quoted post content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              contentLabel: { visibility: "hide" },
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with quoted post content label visibility warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              contentLabel: { visibility: "warn" },
            },
          },
        },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAlgorithmicFeed - content label filtering", () => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          contentLabel: { visibility: "hide" },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAuthorFeed - content label filtering", () => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          contentLabel: { visibility: "hide" },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterFollowingFeed - badge label filtering", () => {
  it("should filter posts with badge label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "hide" }],
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with badge label visibility warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "warn" }],
        },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should filter posts with quoted post badge label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              badgeLabels: [{ visibility: "hide" }],
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with quoted post badge label visibility warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              badgeLabels: [{ visibility: "warn" }],
            },
          },
        },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 1);
  });

  it("should filter if any badge label has hide visibility", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "warn" }, { visibility: "hide" }],
        },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences, {});

    assert.deepEqual(result.feed.length, 0);
  });
});

describe("filterAlgorithmicFeed - badge label filtering", () => {
  it("should filter posts with badge label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "hide" }],
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAuthorFeed - badge label filtering", () => {
  it("should filter posts with badge label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "hide" }],
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });

  it("should filter posts with badge label hide on quoted post", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:other/app.bsky.feed.post/quoted",
              badgeLabels: [{ visibility: "hide" }],
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts with badge label warn", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          badgeLabels: [{ visibility: "warn" }],
        },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAlgorithmicFeed - unauthorized filtering", () => {
  it("should filter posts from no-unauthenticated authors when not authenticated", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          author: {
            did: "did:plc:private",
            handle: "private.test",
            labels: [{ val: "!no-unauthenticated" }],
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, false, {});

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts from no-unauthenticated authors when authenticated", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          author: {
            did: "did:plc:private",
            handle: "private.test",
            labels: [{ val: "!no-unauthenticated" }],
          },
        },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed, true, {});

    assert.deepEqual(result.feed.length, 1);
  });
});

describe("filterAuthorFeed - unauthorized filtering", () => {
  it("should filter posts from no-unauthenticated authors when not authenticated", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          author: {
            did: "did:plc:private",
            handle: "private.test",
            labels: [{ val: "!no-unauthenticated" }],
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, false);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should keep posts from no-unauthenticated authors when authenticated", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          author: {
            did: "did:plc:private",
            handle: "private.test",
            labels: [{ val: "!no-unauthenticated" }],
          },
        },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, true);

    assert.deepEqual(result.feed.length, 1);
  });

  it("should filter posts quoting a no-unauthenticated author when not authenticated", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          embed: {
            $type: "app.bsky.embed.record#view",
            record: {
              uri: "at://did:plc:private/app.bsky.feed.post/quoted",
              author: {
                did: "did:plc:private",
                handle: "private.test",
                labels: [{ val: "!no-unauthenticated" }],
              },
            },
          },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed, false);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });
});

describe("filterBookmarksFeed", () => {
  it("should preserve cursor", () => {
    const feed = createFeed([], "bookmarks-cursor");

    const result = filterBookmarksFeed(feed);

    assert.deepEqual(result.cursor, "bookmarks-cursor");
  });

  it("should pass through regular posts unmodified", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1" },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterBookmarksFeed(feed);

    assert.deepEqual(result.feed.length, 2);
  });

  it("should filter out blocked posts", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          $type: "app.bsky.feed.defs#blockedPost",
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterBookmarksFeed(feed);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/2",
    );
  });

  it("should filter out not-found and unavailable posts", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          $type: "app.bsky.feed.defs#notFoundPost",
        },
      }),
      createFeedItem({
        post: createUnavailablePost("at://did:plc:test/app.bsky.feed.post/2"),
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/3" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterBookmarksFeed(feed);

    assert.deepEqual(result.feed.length, 1);
    assert.deepEqual(
      result.feed[0].post.uri,
      "at://did:plc:test/app.bsky.feed.post/3",
    );
  });
});
