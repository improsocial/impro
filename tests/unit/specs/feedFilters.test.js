import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  filterFollowingFeed,
  filterAlgorithmicFeed,
  filterAuthorFeed,
} from "/js/feedFilters.js";

const t = new TestSuite("feedFilters");

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

t.describe("filterFollowingFeed", (it) => {
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 2);
    assertEquals(result.cursor, "test-cursor");
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 1);
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 2);
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 1);
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 2);
  });

  it("should return unfiltered feed when no currentUser", () => {
    const items = [
      createFeedItem({
        post: { author: { did: "did:plc:1", handle: "user1" } },
      }),
    ];
    const feed = createFeed(items);
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, null, preferences);

    assertEquals(result.feed.length, 1);
  });
});

t.describe("filterAlgorithmicFeed", (it) => {
  it("should deduplicate posts", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({ post: { uri: rootUri } }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed);

    assertEquals(result.feed.length, 1);
  });

  it("should preserve cursor", () => {
    const feed = createFeed([], "my-cursor");

    const result = filterAlgorithmicFeed(feed);

    assertEquals(result.cursor, "my-cursor");
  });

  it("should handle empty feed", () => {
    const feed = createFeed([]);

    const result = filterAlgorithmicFeed(feed);

    assertEquals(result.feed.length, 0);
  });
});

t.describe("filterAuthorFeed", (it) => {
  it("should deduplicate posts", () => {
    const rootUri = "at://did:plc:root/app.bsky.feed.post/123";
    const items = [
      createFeedItem({ post: { uri: rootUri } }),
      createFeedItem({ post: { uri: rootUri } }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed);

    assertEquals(result.feed.length, 1);
  });

  it("should preserve non-duplicate posts", () => {
    const items = [
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1" },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/3" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed);

    assertEquals(result.feed.length, 3);
  });

  it("should preserve cursor", () => {
    const feed = createFeed([], "author-cursor");

    const result = filterAuthorFeed(feed);

    assertEquals(result.cursor, "author-cursor");
  });
});

t.describe("filterFollowingFeed - content label filtering", (it) => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { contentLabel: { visibility: "hide" } },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);
    const currentUser = createCurrentUser();
    const preferences = createPreferences();

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 1);
    assertEquals(
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 2);
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 1);
    assertEquals(
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

    const result = filterFollowingFeed(feed, currentUser, preferences);

    assertEquals(result.feed.length, 1);
  });
});

t.describe("filterAlgorithmicFeed - content label filtering", (it) => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { contentLabel: { visibility: "hide" } },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAlgorithmicFeed(feed);

    assertEquals(result.feed.length, 1);
  });
});

t.describe("filterAuthorFeed - content label filtering", (it) => {
  it("should filter posts with content label visibility hide", () => {
    const items = [
      createFeedItem({
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/1",
          viewer: { contentLabel: { visibility: "hide" } },
        },
      }),
      createFeedItem({
        post: { uri: "at://did:plc:test/app.bsky.feed.post/2" },
      }),
    ];
    const feed = createFeed(items);

    const result = filterAuthorFeed(feed);

    assertEquals(result.feed.length, 1);
  });
});

await t.run();
