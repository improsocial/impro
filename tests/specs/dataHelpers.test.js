import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  avatarThumbnailUrl,
  getRKey,
  getIsLiked,
  getQuotedPost,
  getBlockedQuote,
  createEmbedFromPost,
} from "../../src/js/dataHelpers.js";

const t = new TestSuite("dataHelpers");

t.describe("avatarThumbnailUrl", (it) => {
  it("should convert plain avatar URL to thumbnail URL", () => {
    const avatarUrl =
      "https://cdn.bsky.app/img/avatar/plain/did:plc:123/image@jpeg";
    const expected =
      "https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:123/image@jpeg";
    assertEquals(avatarThumbnailUrl(avatarUrl), expected);
  });

  it("should handle URL without /img/avatar/plain/", () => {
    const avatarUrl = "https://cdn.bsky.app/img/other/plain/image.jpg";
    assertEquals(avatarThumbnailUrl(avatarUrl), avatarUrl);
  });

  it("should handle empty string", () => {
    assertEquals(avatarThumbnailUrl(""), "");
  });
});

t.describe("getRKey", (it) => {
  it("should extract rkey from post URI", () => {
    const post = { uri: "at://did:plc:123/app.bsky.feed.post/3l7q2wm5ws22k" };
    assertEquals(getRKey(post), "3l7q2wm5ws22k");
  });

  it("should handle URI with different path structure", () => {
    const post = { uri: "at://did:plc:456/collection/another-rkey" };
    assertEquals(getRKey(post), "another-rkey");
  });

  it("should handle URI with single path segment", () => {
    const post = { uri: "single-segment" };
    assertEquals(getRKey(post), "single-segment");
  });
});

t.describe("getIsLiked", (it) => {
  it("should return true when post has viewer like", () => {
    const post = { viewer: { like: "at://did:plc:123/like/abc123" } };
    assertEquals(getIsLiked(post), true);
  });

  it("should return false when viewer like is empty string", () => {
    const post = { viewer: { like: "" } };
    assertEquals(getIsLiked(post), false);
  });

  it("should return false when viewer like is null", () => {
    const post = { viewer: { like: null } };
    assertEquals(getIsLiked(post), false);
  });

  it("should return false when viewer like is undefined", () => {
    const post = { viewer: { like: undefined } };
    assertEquals(getIsLiked(post), false);
  });

  it("should return false when viewer is undefined", () => {
    const post = {};
    assertEquals(getIsLiked(post), false);
  });

  it("should return false when post has no viewer property", () => {
    const post = { uri: "test" };
    assertEquals(getIsLiked(post), false);
  });
});

t.describe("getQuotedPost", (it) => {
  it("should return record for app.bsky.embed.record#view", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { uri: "quoted-post-uri", author: { displayName: "Test" } },
      },
    };
    assertEquals(getQuotedPost(post), post.embed.record);
  });

  it("should return nested record for app.bsky.embed.recordWithMedia#view", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.recordWithMedia#view",
        record: {
          record: { uri: "quoted-post-uri", author: { displayName: "Test" } },
        },
      },
    };
    assertEquals(getQuotedPost(post), post.embed.record.record);
  });

  it("should return null for embed with different $type", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [],
      },
    };
    assertEquals(getQuotedPost(post), null);
  });

  it("should return null when embed is undefined", () => {
    const post = {};
    assertEquals(getQuotedPost(post), null);
  });

  it("should return null when embed is null", () => {
    const post = { embed: null };
    assertEquals(getQuotedPost(post), null);
  });

  it("should return null when post has no embed property", () => {
    const post = { uri: "test" };
    assertEquals(getQuotedPost(post), null);
  });
});

t.describe("getBlockedQuote", (it) => {
  it("should return blocked quote when quoted post is blocked", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewBlocked",
          uri: "blocked-uri",
          blocked: true,
        },
      },
    };
    assertEquals(getBlockedQuote(post), post.embed.record);
  });

  it("should return null when quoted post is not blocked", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#view",
          uri: "normal-uri",
        },
      },
    };
    assertEquals(getBlockedQuote(post), null);
  });

  it("should return null when no quoted post exists", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [],
      },
    };
    assertEquals(getBlockedQuote(post), null);
  });

  it("should return null when post has no embed", () => {
    const post = {};
    assertEquals(getBlockedQuote(post), null);
  });
});

t.describe("createEmbedFromPost", (it) => {
  it("should create embed from post with all required fields", () => {
    const post = {
      author: { did: "did:plc:123", displayName: "Test User" },
      record: { text: "Hello world", createdAt: "2024-01-01" },
      uri: "at://did:plc:123/app.bsky.feed.post/abc123",
    };

    const result = createEmbedFromPost(post);

    assertEquals(result, {
      $type: "app.bsky.embed.record#viewRecord",
      author: { did: "did:plc:123", displayName: "Test User" },
      value: { text: "Hello world", createdAt: "2024-01-01" },
      uri: "at://did:plc:123/app.bsky.feed.post/abc123",
    });
  });

  it("should create separate copies of author and record objects", () => {
    const post = {
      author: { did: "did:plc:123" },
      record: { text: "Hello" },
      uri: "test-uri",
    };

    const result = createEmbedFromPost(post);

    assert(result.author !== post.author);
    assert(result.value !== post.record);
    assertEquals(result.author, post.author);
    assertEquals(result.value, post.record);
  });

  it("should handle post with minimal data", () => {
    const post = {
      author: {},
      record: {},
      uri: "minimal-uri",
    };

    const result = createEmbedFromPost(post);

    assertEquals(result, {
      $type: "app.bsky.embed.record#viewRecord",
      author: {},
      value: {},
      uri: "minimal-uri",
    });
  });
});

await t.run();
