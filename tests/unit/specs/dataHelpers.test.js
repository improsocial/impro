import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  avatarThumbnailUrl,
  getRKey,
  getIsLiked,
  getQuotedPost,
  getBlockedQuote,
  createEmbedFromPost,
  embedViewRecordToPostView,
  replaceTopParent,
  isAutomatedAccount,
  isLabelerProfile,
  getLabelNameAndDescription,
  getLabelerForLabel,
  getDefinitionForLabel,
  isBadgeLabel,
  addFeedItemToFeed,
  getDisplayName,
  getThreadgateAllowSettings,
} from "/js/dataHelpers.js";

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

  it("should use embeds array when available", () => {
    const post = {
      embeds: [
        {
          $type: "app.bsky.embed.record#view",
          record: { uri: "quoted-post-uri", author: { displayName: "Test" } },
        },
      ],
    };
    assertEquals(getQuotedPost(post), post.embeds[0].record);
  });

  it("should use embeds array for recordWithMedia", () => {
    const post = {
      embeds: [
        {
          $type: "app.bsky.embed.recordWithMedia#view",
          record: {
            record: {
              uri: "quoted-post-uri",
              author: { displayName: "Test" },
            },
          },
        },
      ],
    };
    assertEquals(getQuotedPost(post), post.embeds[0].record.record);
  });

  it("should prefer embeds array over embed property", () => {
    const post = {
      embeds: [
        {
          $type: "app.bsky.embed.record#view",
          record: { uri: "from-embeds-array" },
        },
      ],
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { uri: "from-embed-prop" },
      },
    };
    assertEquals(getQuotedPost(post), post.embeds[0].record);
  });

  it("should fall back to embed when embeds is empty", () => {
    const post = {
      embeds: [],
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { uri: "from-embed-prop" },
      },
    };
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
      cid: "cid123",
      indexedAt: "2024-01-01T00:00:00Z",
      labels: [{ val: "test" }],
      likeCount: 5,
      replyCount: 2,
      repostCount: 1,
      quoteCount: 3,
    };

    const result = createEmbedFromPost(post);

    assertEquals(result, {
      $type: "app.bsky.embed.record#viewRecord",
      author: { did: "did:plc:123", displayName: "Test User" },
      value: { text: "Hello world", createdAt: "2024-01-01" },
      uri: "at://did:plc:123/app.bsky.feed.post/abc123",
      cid: "cid123",
      indexedAt: "2024-01-01T00:00:00Z",
      labels: [{ val: "test" }],
      likeCount: 5,
      replyCount: 2,
      repostCount: 1,
      quoteCount: 3,
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
      cid: undefined,
      indexedAt: undefined,
      labels: undefined,
      likeCount: undefined,
      replyCount: undefined,
      repostCount: undefined,
      quoteCount: undefined,
    });
  });

  it("should include embeds when post has an embed", () => {
    const post = {
      author: { did: "did:plc:123" },
      record: { text: "Hello" },
      uri: "test-uri",
      cid: "cid456",
      indexedAt: "2024-02-01T00:00:00Z",
      labels: [],
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [{ thumb: "thumb.jpg" }],
      },
    };

    const result = createEmbedFromPost(post);

    assertEquals(result, {
      $type: "app.bsky.embed.record#viewRecord",
      author: { did: "did:plc:123" },
      value: { text: "Hello" },
      uri: "test-uri",
      cid: "cid456",
      indexedAt: "2024-02-01T00:00:00Z",
      labels: [],
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
      embeds: [
        {
          $type: "app.bsky.embed.images#view",
          images: [{ thumb: "thumb.jpg" }],
        },
      ],
    });
  });

  it("should not include embeds when post has no embed", () => {
    const post = {
      author: { did: "did:plc:456" },
      record: { text: "No embed" },
      uri: "no-embed-uri",
    };

    const result = createEmbedFromPost(post);

    assert(!("embeds" in result));
  });
});

t.describe("embedViewRecordToPostView", (it) => {
  it("should convert a ViewRecord to a PostView", () => {
    const viewRecord = {
      uri: "at://did:plc:123/app.bsky.feed.post/abc",
      cid: "cid123",
      author: { did: "did:plc:123", handle: "test.user" },
      value: { text: "Hello world", createdAt: "2024-01-01" },
      embeds: [{ $type: "app.bsky.embed.images#view", images: [] }],
      labels: [{ val: "test" }],
      likeCount: 5,
      replyCount: 2,
      repostCount: 1,
      quoteCount: 3,
      indexedAt: "2024-01-01T00:00:00Z",
    };

    const result = embedViewRecordToPostView(viewRecord);

    assertEquals(result, {
      uri: "at://did:plc:123/app.bsky.feed.post/abc",
      cid: "cid123",
      author: { did: "did:plc:123", handle: "test.user" },
      record: { text: "Hello world", createdAt: "2024-01-01" },
      embed: { $type: "app.bsky.embed.images#view", images: [] },
      labels: [{ val: "test" }],
      likeCount: 5,
      replyCount: 2,
      repostCount: 1,
      quoteCount: 3,
      indexedAt: "2024-01-01T00:00:00Z",
    });
  });

  it("should map value to record and embeds[0] to embed", () => {
    const viewRecord = {
      uri: "test-uri",
      cid: "test-cid",
      author: {},
      value: { text: "test" },
      embeds: [{ $type: "embed1" }, { $type: "embed2" }],
      indexedAt: "2024-01-01T00:00:00Z",
    };

    const result = embedViewRecordToPostView(viewRecord);

    assertEquals(result.record, viewRecord.value);
    assertEquals(result.embed, viewRecord.embeds[0]);
  });

  it("should handle missing embeds", () => {
    const viewRecord = {
      uri: "test-uri",
      cid: "test-cid",
      author: {},
      value: { text: "test" },
      indexedAt: "2024-01-01T00:00:00Z",
    };

    const result = embedViewRecordToPostView(viewRecord);

    assertEquals(result.embed, undefined);
  });

  it("should handle empty embeds array", () => {
    const viewRecord = {
      uri: "test-uri",
      cid: "test-cid",
      author: {},
      value: { text: "test" },
      embeds: [],
      indexedAt: "2024-01-01T00:00:00Z",
    };

    const result = embedViewRecordToPostView(viewRecord);

    assertEquals(result.embed, undefined);
  });

  it("should handle missing optional count fields", () => {
    const viewRecord = {
      uri: "test-uri",
      cid: "test-cid",
      author: {},
      value: {},
      indexedAt: "2024-01-01T00:00:00Z",
    };

    const result = embedViewRecordToPostView(viewRecord);

    assertEquals(result.likeCount, undefined);
    assertEquals(result.replyCount, undefined);
    assertEquals(result.repostCount, undefined);
    assertEquals(result.quoteCount, undefined);
  });
});

t.describe("replaceTopParent", (it) => {
  it("should throw error when postThread has no parent", () => {
    const postThread = { post: { uri: "post-uri" } };
    let threw = false;
    try {
      replaceTopParent(postThread, { post: { uri: "new-parent" } });
    } catch (e) {
      threw = true;
      assertEquals(e.message, "No parent found");
    }
    assert(threw, "Expected replaceTopParent to throw");
  });

  it("should replace immediate parent when it is the top", () => {
    const postThread = {
      post: { uri: "child-uri" },
      parent: { post: { uri: "parent-uri" } },
    };
    const newParent = { post: { uri: "new-parent-uri" } };

    const result = replaceTopParent(postThread, newParent);

    assertEquals(result.parent, newParent);
    assertEquals(result.post, postThread.post);
  });

  it("should return new object when immediate parent is the top", () => {
    const postThread = {
      post: { uri: "child-uri" },
      parent: { post: { uri: "parent-uri" } },
    };
    const newParent = { post: { uri: "new-parent-uri" } };

    const result = replaceTopParent(postThread, newParent);

    assert(result !== postThread, "Should return a new object");
  });

  it("should replace top parent when there are multiple levels", () => {
    const postThread = {
      post: { uri: "child-uri" },
      parent: {
        post: { uri: "parent-uri" },
        parent: {
          post: { uri: "grandparent-uri" },
        },
      },
    };
    const newParent = { post: { uri: "new-grandparent-uri" } };

    const result = replaceTopParent(postThread, newParent);

    assertEquals(result.parent.parent, newParent);
    assertEquals(result.parent.post.uri, "parent-uri");
  });

  it("should replace top parent when there are three levels", () => {
    const postThread = {
      post: { uri: "child-uri" },
      parent: {
        post: { uri: "parent-uri" },
        parent: {
          post: { uri: "grandparent-uri" },
          parent: {
            post: { uri: "great-grandparent-uri" },
          },
        },
      },
    };
    const newParent = { post: { uri: "new-top-uri" } };

    const result = replaceTopParent(postThread, newParent);

    assertEquals(result.parent.parent.parent, newParent);
    assertEquals(result.parent.parent.post.uri, "grandparent-uri");
  });
});

t.describe("isAutomatedAccount", (it) => {
  it("should return false for profile without labels", () => {
    const profile = { did: "did:plc:123", handle: "user.bsky.social" };
    assertEquals(isAutomatedAccount(profile), false);
  });

  it("should return false for profile with empty labels", () => {
    const profile = { did: "did:plc:123", labels: [] };
    assertEquals(isAutomatedAccount(profile), false);
  });

  it("should return false for profile with non-bot labels", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "!no-unauthenticated" }],
    };
    assertEquals(isAutomatedAccount(profile), false);
  });

  it("should return true for profile with bot label", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "bot" }],
    };
    assertEquals(isAutomatedAccount(profile), true);
  });

  it("should return true when bot label is among other labels", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "!no-unauthenticated" }, { val: "bot" }],
    };
    assertEquals(isAutomatedAccount(profile), true);
  });
});

t.describe("isLabelerProfile", (it) => {
  it("should return true when profile has associated labeler", () => {
    const profile = { associated: { labeler: true } };
    assertEquals(isLabelerProfile(profile), true);
  });

  it("should return false when profile has no associated labeler", () => {
    const profile = { associated: { labeler: false } };
    assertEquals(isLabelerProfile(profile), false);
  });

  it("should return undefined when profile has no associated property", () => {
    const profile = {};
    assertEquals(isLabelerProfile(profile), undefined);
  });

  it("should return undefined when associated has no labeler property", () => {
    const profile = { associated: {} };
    assertEquals(isLabelerProfile(profile), undefined);
  });
});

t.describe("getLabelNameAndDescription", (it) => {
  it("should return identifier as name when no locales", () => {
    const labelDefinition = { identifier: "test-label" };
    const result = getLabelNameAndDescription(labelDefinition);

    assertEquals(result.name, "test-label");
    assertEquals(result.description, "");
  });

  it("should return identifier as name when locales is empty", () => {
    const labelDefinition = { identifier: "test-label", locales: [] };
    const result = getLabelNameAndDescription(labelDefinition);

    assertEquals(result.name, "test-label");
    assertEquals(result.description, "");
  });

  it("should return preferred language locale", () => {
    const labelDefinition = {
      identifier: "test-label",
      locales: [
        { lang: "es", name: "Etiqueta", description: "Descripción" },
        { lang: "en", name: "Label", description: "Description" },
      ],
    };
    const result = getLabelNameAndDescription(labelDefinition, "en");

    assertEquals(result.name, "Label");
    assertEquals(result.description, "Description");
  });

  it("should fall back to first locale when preferred not found", () => {
    const labelDefinition = {
      identifier: "test-label",
      locales: [
        { lang: "es", name: "Etiqueta", description: "Descripción" },
        { lang: "fr", name: "Étiquette", description: "La description" },
      ],
    };
    const result = getLabelNameAndDescription(labelDefinition, "en");

    assertEquals(result.name, "Etiqueta");
    assertEquals(result.description, "Descripción");
  });

  it("should use identifier when locale name is missing", () => {
    const labelDefinition = {
      identifier: "test-label",
      locales: [{ lang: "en", description: "Description only" }],
    };
    const result = getLabelNameAndDescription(labelDefinition, "en");

    assertEquals(result.name, "test-label");
    assertEquals(result.description, "Description only");
  });

  it("should default to en as preferred language", () => {
    const labelDefinition = {
      identifier: "test-label",
      locales: [
        { lang: "es", name: "Etiqueta", description: "Descripción" },
        { lang: "en", name: "Label", description: "Description" },
      ],
    };
    const result = getLabelNameAndDescription(labelDefinition);

    assertEquals(result.name, "Label");
    assertEquals(result.description, "Description");
  });
});

t.describe("getLabelerForLabel", (it) => {
  it("should return matching labeler by src did", () => {
    const label = { src: "did:plc:labeler1", val: "nsfw" };
    const labelers = [
      { creator: { did: "did:plc:labeler1" }, policies: {} },
      { creator: { did: "did:plc:labeler2" }, policies: {} },
    ];

    const result = getLabelerForLabel(label, labelers);

    assertEquals(result.creator.did, "did:plc:labeler1");
  });

  it("should return null when no matching labeler", () => {
    const label = { src: "did:plc:unknown", val: "nsfw" };
    const labelers = [{ creator: { did: "did:plc:labeler1" }, policies: {} }];

    const result = getLabelerForLabel(label, labelers);

    assertEquals(result, null);
  });

  it("should return null when labelers is empty", () => {
    const label = { src: "did:plc:labeler1", val: "nsfw" };

    const result = getLabelerForLabel(label, []);

    assertEquals(result, null);
  });
});

t.describe("getDefinitionForLabel", (it) => {
  it("should return matching label definition", () => {
    const label = { src: "did:plc:labeler1", val: "nsfw" };
    const labeler = {
      creator: { did: "did:plc:labeler1" },
      policies: {
        labelValueDefinitions: [
          { identifier: "spam", blurs: "none" },
          { identifier: "nsfw", blurs: "media" },
        ],
      },
    };

    const result = getDefinitionForLabel(label, labeler);

    assertEquals(result.identifier, "nsfw");
    assertEquals(result.blurs, "media");
  });

  it("should return undefined when no matching definition", () => {
    const label = { src: "did:plc:labeler1", val: "unknown" };
    const labeler = {
      creator: { did: "did:plc:labeler1" },
      policies: {
        labelValueDefinitions: [{ identifier: "nsfw", blurs: "media" }],
      },
    };

    const result = getDefinitionForLabel(label, labeler);

    assertEquals(result, undefined);
  });
});

t.describe("isBadgeLabel", (it) => {
  it("should return true when blurs is none", () => {
    const labelDefinition = { blurs: "none" };
    assertEquals(isBadgeLabel(labelDefinition), true);
  });

  it("should return true when blurs is undefined", () => {
    const labelDefinition = {};
    assertEquals(isBadgeLabel(labelDefinition), true);
  });

  it("should return false when blurs is media", () => {
    const labelDefinition = { blurs: "media" };
    assertEquals(isBadgeLabel(labelDefinition), false);
  });

  it("should return false when blurs is content", () => {
    const labelDefinition = { blurs: "content" };
    assertEquals(isBadgeLabel(labelDefinition), false);
  });
});

t.describe("addFeedItemToFeed", (it) => {
  it("should add item to empty feed", () => {
    const feedItem = { post: { uri: "post-1" } };
    const result = addFeedItemToFeed(feedItem, []);

    assertEquals(result.length, 1);
    assertEquals(result[0], feedItem);
  });

  it("should add item to beginning of feed without pinned post", () => {
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [existingItem]);

    assertEquals(result.length, 2);
    assertEquals(result[0], newItem);
    assertEquals(result[1], existingItem);
  });

  it("should add item after pinned post", () => {
    const pinnedItem = {
      post: { uri: "pinned-post" },
      reason: { $type: "app.bsky.feed.defs#reasonPin" },
    };
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [pinnedItem, existingItem]);

    assertEquals(result.length, 3);
    assertEquals(result[0], pinnedItem);
    assertEquals(result[1], newItem);
    assertEquals(result[2], existingItem);
  });

  it("should handle pinned post not at first position", () => {
    const pinnedItem = {
      post: { uri: "pinned-post" },
      reason: { $type: "app.bsky.feed.defs#reasonPin" },
    };
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [existingItem, pinnedItem]);

    assertEquals(result.length, 3);
    assertEquals(result[0], pinnedItem);
    assertEquals(result[1], newItem);
    assertEquals(result[2], existingItem);
  });

  it("should handle repost feed items", () => {
    const repostItem = {
      post: { uri: "post-1" },
      reason: {
        $type: "app.bsky.feed.defs#reasonRepost",
        by: { did: "did:plc:123" },
        uri: "at://did:plc:123/app.bsky.feed.repost/abc",
        indexedAt: "2024-01-01T00:00:00Z",
      },
    };

    const result = addFeedItemToFeed(repostItem, []);

    assertEquals(result.length, 1);
    assertEquals(result[0].reason.$type, "app.bsky.feed.defs#reasonRepost");
  });
});

t.describe("getDisplayName", (it) => {
  it("should return displayName when present", () => {
    const profile = { displayName: "Alice", handle: "alice.bsky.social" };
    assertEquals(getDisplayName(profile), "Alice");
  });

  it("should trim whitespace from displayName", () => {
    const profile = { displayName: "  Alice  ", handle: "alice.bsky.social" };
    assertEquals(getDisplayName(profile), "Alice");
  });

  it("should strip check mark characters", () => {
    const profile = {
      displayName: "Alice \u2705\u2713\u2714\u2611",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice");
  });

  it("should strip control characters", () => {
    const profile = {
      displayName: "Ali\u0000ce\u001F",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice");
  });

  it("should strip bidirectional override characters", () => {
    const profile = {
      displayName: "Ali\u202Ace\u202E",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice");
  });

  it("should collapse multiple spaces into one", () => {
    const profile = {
      displayName: "Alice   Bob",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice Bob");
  });

  it("should collapse spaces with zero-width spaces", () => {
    const profile = {
      displayName: "Alice \u200B Bob",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice Bob");
  });

  it("should handle all sanitizations together", () => {
    const profile = {
      displayName: "  \u2705Alice\u0000   Bob\u202E  ",
      handle: "alice.bsky.social",
    };
    assertEquals(getDisplayName(profile), "Alice Bob");
  });

  it("should return 'Deleted Account' for missing.invalid handle", () => {
    const profile = { handle: "missing.invalid" };
    assertEquals(getDisplayName(profile), "Deleted Account");
  });

  it("should return 'Invalid Handle' for handle.invalid handle", () => {
    const profile = { handle: "handle.invalid" };
    assertEquals(getDisplayName(profile), "Invalid Handle");
  });

  it("should return handle when no displayName", () => {
    const profile = { handle: "alice.bsky.social" };
    assertEquals(getDisplayName(profile), "alice.bsky.social");
  });

  it("should prefer displayName over special handle fallbacks", () => {
    const profile = { displayName: "Still Here", handle: "missing.invalid" };
    assertEquals(getDisplayName(profile), "Still Here");
  });
});

t.describe("getThreadgateAllowSettings", (it) => {
  it("returns everybody when post has no threadgate", () => {
    assertEquals(getThreadgateAllowSettings({}), { type: "everybody" });
  });

  it("returns everybody when allow is undefined", () => {
    const post = {
      threadgate: { record: { $type: "app.bsky.feed.threadgate" } },
    };
    assertEquals(getThreadgateAllowSettings(post), { type: "everybody" });
  });

  it("returns nobody when allow is empty array", () => {
    const post = { threadgate: { record: { allow: [] } } };
    assertEquals(getThreadgateAllowSettings(post), { type: "nobody" });
  });

  it("maps a mention rule", () => {
    const post = {
      threadgate: {
        record: { allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }] },
      },
    };
    assertEquals(getThreadgateAllowSettings(post), [{ type: "mention" }]);
  });

  it("maps follower and following rules", () => {
    const post = {
      threadgate: {
        record: {
          allow: [
            { $type: "app.bsky.feed.threadgate#followerRule" },
            { $type: "app.bsky.feed.threadgate#followingRule" },
          ],
        },
      },
    };
    assertEquals(getThreadgateAllowSettings(post), [
      { type: "followers" },
      { type: "following" },
    ]);
  });

  it("resolves a list rule against threadgate.lists", () => {
    const listUri = "at://did:plc:abc/app.bsky.graph.list/123";
    const list = { uri: listUri, name: "Cool people" };
    const post = {
      threadgate: {
        lists: [list],
        record: {
          allow: [
            { $type: "app.bsky.feed.threadgate#listRule", list: listUri },
          ],
        },
      },
    };
    assertEquals(getThreadgateAllowSettings(post), [{ type: "list", list }]);
  });

  it("returns null list when list rule references missing list", () => {
    const post = {
      threadgate: {
        lists: [],
        record: {
          allow: [
            {
              $type: "app.bsky.feed.threadgate#listRule",
              list: "at://did:plc:abc/app.bsky.graph.list/zzz",
            },
          ],
        },
      },
    };
    assertEquals(getThreadgateAllowSettings(post), [
      { type: "list", list: null },
    ]);
  });

  it("marks unknown rule types", () => {
    const post = {
      threadgate: {
        record: { allow: [{ $type: "app.bsky.feed.threadgate#futureRule" }] },
      },
    };
    assertEquals(getThreadgateAllowSettings(post), [{ type: "unknown" }]);
  });
});

await t.run();
