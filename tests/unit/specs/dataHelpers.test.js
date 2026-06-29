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
  pinPostInFeed,
  unpinPostInFeed,
  getDisplayName,
  getThreadgateAllowSettings,
  isEmptyPost,
  hasValidHandle,
  INVALID_HANDLE,
  MISSING_HANDLE,
  canReplyToPost,
  transformNestedQuotes,
  getInteractionTimestamp,
  getConvoPreviewText,
  getInteractionProfileDids,
  getGroupConvoDetails,
  getGroupConvoOwner,
  getSystemMessageDisplayText,
  groupReactions,
  isGroupConvo,
  isInviteLinkUrl,
  getInviteCodeFromUrl,
  isAvailableJoinLinkPreview,
  getJoinLinkCodeFromEmbed,
  getJoinLinkCodesFromPosts,
  getJoinLinkCodesFromMessages,
  attachJoinLinkPreviewToEmbed,
  getPostsFromPostThread,
  getPostsFromFeed,
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

t.describe("pinPostInFeed", (it) => {
  const pinReason = { $type: "app.bsky.feed.defs#reasonPin" };

  it("should add a pinned item to an empty feed", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const result = pinPostInFeed([], post);
    assertEquals(result.length, 1);
    assertEquals(result[0].post, post);
    assertEquals(result[0].reason.$type, pinReason.$type);
  });

  it("should move an existing post to the top and mark it pinned", () => {
    const post = { uri: "post-2", cid: "cid-2" };
    const feed = [
      { post: { uri: "post-1" } },
      { post },
      { post: { uri: "post-3" } },
    ];
    const result = pinPostInFeed(feed, post);
    assertEquals(result.length, 3);
    assertEquals(result[0].post.uri, "post-2");
    assertEquals(result[0].reason.$type, pinReason.$type);
    assertEquals(result[1].post.uri, "post-1");
    assertEquals(result[2].post.uri, "post-3");
  });

  it("should unpin a previously pinned item when pinning a new one", () => {
    const oldPinned = { post: { uri: "post-1" }, reason: pinReason };
    const other = { post: { uri: "post-2" } };
    const newPost = { uri: "post-3", cid: "cid-3" };
    const result = pinPostInFeed([oldPinned, other], newPost);
    assertEquals(result.length, 3);
    assertEquals(result[0].post.uri, "post-3");
    assertEquals(result[0].reason.$type, pinReason.$type);
    // Old pinned item is still present, but no longer carries the pin reason.
    const oldInResult = result.find((item) => item.post.uri === "post-1");
    assertEquals(oldInResult.reason, undefined);
  });

  it("should not duplicate the post when it is already pinned", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post, reason: pinReason }, { post: { uri: "post-2" } }];
    const result = pinPostInFeed(feed, post);
    assertEquals(result.length, 2);
    assertEquals(result[0].post.uri, "post-1");
    assertEquals(result[0].reason.$type, pinReason.$type);
    assertEquals(result[1].post.uri, "post-2");
  });

  it("should not mutate the input feed", () => {
    const post = { uri: "post-1" };
    const feed = [{ post: { uri: "post-2" } }];
    const before = [...feed];
    pinPostInFeed(feed, post);
    assertEquals(feed.length, before.length);
    assertEquals(feed[0], before[0]);
  });
});

t.describe("unpinPostInFeed", (it) => {
  const pinReason = { $type: "app.bsky.feed.defs#reasonPin" };

  it("should clear the pin reason on the matching item but keep it in place", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post, reason: pinReason }, { post: { uri: "post-2" } }];
    const result = unpinPostInFeed(feed, post);
    assertEquals(result.length, 2);
    assertEquals(result[0].post.uri, "post-1");
    assertEquals(result[0].reason, undefined);
    assertEquals(result[1].post.uri, "post-2");
  });

  it("should leave a non-pinned occurrence of the post unchanged", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post }, { post: { uri: "post-2" } }];
    const result = unpinPostInFeed(feed, post);
    assertEquals(result.length, 2);
    assertEquals(result[0].post.uri, "post-1");
    assertEquals(result[0].reason, undefined);
  });

  it("should not affect another pinned item with a different uri", () => {
    const post = { uri: "post-1" };
    const otherPinned = { post: { uri: "post-2" }, reason: pinReason };
    const result = unpinPostInFeed([otherPinned], post);
    assertEquals(result.length, 1);
    assertEquals(result[0].post.uri, "post-2");
    assertEquals(result[0].reason.$type, pinReason.$type);
  });

  it("should return an empty feed when given one", () => {
    assertEquals(unpinPostInFeed([], { uri: "post-1" }).length, 0);
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

t.describe("hasValidHandle", (it) => {
  it("returns true for a normal handle", () => {
    assert(hasValidHandle({ handle: "alice.bsky.social" }));
  });

  it("returns false for the invalid sentinel", () => {
    assert(!hasValidHandle({ handle: INVALID_HANDLE }));
  });

  it("returns false for the missing sentinel", () => {
    assert(!hasValidHandle({ handle: MISSING_HANDLE }));
  });

  it("returns false when handle is absent", () => {
    assert(!hasValidHandle({ did: "did:plc:bob" }));
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

t.describe("isEmptyPost", (it) => {
  it("should return true for blocked posts", () => {
    const post = { $type: "app.bsky.feed.defs#blockedPost", uri: "at://x" };
    assertEquals(isEmptyPost(post), true);
  });

  it("should return true for not-found posts", () => {
    const post = { $type: "app.bsky.feed.defs#notFoundPost", uri: "at://x" };
    assertEquals(isEmptyPost(post), true);
  });

  it("should return true for unavailable posts", () => {
    const post = {
      $type: "social.impro.feed.defs#unavailablePost",
      uri: "at://x",
    };
    assertEquals(isEmptyPost(post), true);
  });

  it("should return false for normal post views", () => {
    const post = { $type: "app.bsky.feed.defs#postView", uri: "at://x" };
    assertEquals(isEmptyPost(post), false);
  });
});

t.describe("canReplyToPost", (it) => {
  it("should return true for a normal post view with no restrictions", () => {
    const post = {
      $type: "app.bsky.feed.defs#postView",
      uri: "at://x",
      viewer: {},
    };
    assertEquals(canReplyToPost(post), true);
  });

  it("should return false for a blocked post", () => {
    const post = { $type: "app.bsky.feed.defs#blockedPost", uri: "at://x" };
    assertEquals(canReplyToPost(post), false);
  });

  it("should return false for a not-found post", () => {
    const post = { $type: "app.bsky.feed.defs#notFoundPost", uri: "at://x" };
    assertEquals(canReplyToPost(post), false);
  });

  it("should return false for an unavailable post", () => {
    const post = {
      $type: "social.impro.feed.defs#unavailablePost",
      uri: "at://x",
    };
    assertEquals(canReplyToPost(post), false);
  });

  it("should return false when viewer.replyDisabled is true", () => {
    const post = {
      $type: "app.bsky.feed.defs#postView",
      uri: "at://x",
      viewer: { replyDisabled: true },
    };
    assertEquals(canReplyToPost(post), false);
  });

  it("should return true when viewer is missing", () => {
    const post = { $type: "app.bsky.feed.defs#postView", uri: "at://x" };
    assertEquals(canReplyToPost(post), true);
  });
});

t.describe("transformNestedQuotes", (it) => {
  const makeQuote = (uri, nestedQuote) => {
    const quote = { uri };
    if (nestedQuote) {
      quote.embeds = [
        { $type: "app.bsky.embed.record#view", record: nestedQuote },
      ];
    }
    return quote;
  };

  it("returns the post unchanged when there is no quote", () => {
    const post = { uri: "post" };
    const result = transformNestedQuotes(post, () => ({ touched: true }));
    assertEquals(result, post);
  });

  it("leaves the root post untouched but transforms the direct quote", () => {
    const post = {
      uri: "post",
      flag: "root",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: makeQuote("quote"),
      },
    };
    const result = transformNestedQuotes(post, (quotedPost) => ({
      ...quotedPost,
      touched: true,
    }));
    assertEquals(result.uri, "post");
    assertEquals(result.flag, "root");
    assertEquals(result.embed.record, { uri: "quote", touched: true });
  });

  it("transforms both the direct and nested quote (two levels)", () => {
    const post = {
      uri: "post",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: makeQuote("quote", makeQuote("nested")),
      },
    };
    const calls = [];
    const result = transformNestedQuotes(post, (quotedPost) => {
      calls.push(quotedPost.uri);
      return { ...quotedPost, touched: true };
    });
    assertEquals(calls, ["quote", "nested"]);
    assertEquals(result.embed.record.touched, true);
    assertEquals(result.embed.record.embeds[0].record, {
      uri: "nested",
      touched: true,
    });
  });

  it("does not recurse into a third level of nesting", () => {
    const deepest = makeQuote("deepest");
    const nested = makeQuote("nested", deepest);
    const post = {
      uri: "post",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: makeQuote("quote", nested),
      },
    };
    const seen = [];
    transformNestedQuotes(post, (quotedPost) => {
      seen.push(quotedPost.uri);
      return quotedPost;
    });
    assertEquals(seen, ["quote", "nested"]);
  });

  it("returns the same post when the transform leaves quotes unchanged", () => {
    const post = {
      uri: "post",
      embed: {
        $type: "app.bsky.embed.record#view",
        record: makeQuote("quote", makeQuote("nested")),
      },
    };
    const result = transformNestedQuotes(post, (quotedPost) => quotedPost);
    assert(result === post);
  });

  it("does not mutate the input post", () => {
    const originalNested = { uri: "nested" };
    const originalQuote = {
      uri: "quote",
      embeds: [{ $type: "app.bsky.embed.record#view", record: originalNested }],
    };
    const post = {
      uri: "post",
      embed: { $type: "app.bsky.embed.record#view", record: originalQuote },
    };
    transformNestedQuotes(post, (quotedPost) => ({
      ...quotedPost,
      touched: true,
    }));
    assertEquals(originalQuote.touched, undefined);
    assertEquals(originalNested.touched, undefined);
    assertEquals(post.embed.record, originalQuote);
  });
});

t.describe("getInteractionTimestamp", (it) => {
  it("should return sentAt for message views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#messageView",
      sentAt: "2026-06-11T01:00:00.000Z",
    });
    assertEquals(timestamp, "2026-06-11T01:00:00.000Z");
  });

  it("should return sentAt for system message views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#systemMessageView",
      sentAt: "2026-06-11T02:00:00.000Z",
    });
    assertEquals(timestamp, "2026-06-11T02:00:00.000Z");
  });

  it("should return reaction createdAt for message-and-reaction views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#messageAndReactionView",
      reaction: { createdAt: "2026-06-11T03:00:00.000Z" },
    });
    assertEquals(timestamp, "2026-06-11T03:00:00.000Z");
  });
});

t.describe("getGroupConvoDetails", (it) => {
  const groupKind = {
    $type: "chat.bsky.convo.defs#groupConvo",
    name: "Test Group",
    memberCount: 3,
    memberLimit: 10,
    lockStatus: "unlocked",
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  it("should return the kind object for group convos", () => {
    assertEquals(
      getGroupConvoDetails({ id: "c1", kind: groupKind }),
      groupKind,
    );
  });

  it("should return null for direct convos", () => {
    const directConvo = {
      id: "c2",
      kind: { $type: "chat.bsky.convo.defs#directConvo" },
    };
    assertEquals(getGroupConvoDetails(directConvo), null);
  });

  it("should return null when kind is missing", () => {
    assertEquals(getGroupConvoDetails({ id: "c3" }), null);
  });
});

t.describe("isGroupConvo", (it) => {
  it("should detect group convos", () => {
    const convo = {
      id: "c1",
      kind: { $type: "chat.bsky.convo.defs#groupConvo", name: "Test Group" },
    };
    assertEquals(isGroupConvo(convo), true);
  });

  it("should reject direct and untyped convos", () => {
    assertEquals(
      isGroupConvo({ kind: { $type: "chat.bsky.convo.defs#directConvo" } }),
      false,
    );
    assertEquals(isGroupConvo({}), false);
  });
});

t.describe("getGroupConvoOwner", (it) => {
  function groupMember(did, role) {
    return {
      did,
      handle: `${did.split(":").pop()}.bsky.social`,
      kind: { $type: "chat.bsky.actor.defs#groupConvoMember", role },
    };
  }

  it("should find the member with the owner role", () => {
    const owner = groupMember("did:plc:alice", "owner");
    const convo = {
      members: [groupMember("did:plc:me", "standard"), owner],
    };
    assertEquals(getGroupConvoOwner(convo), owner);
  });

  it("should return null when the owner has left", () => {
    const convo = {
      members: [
        groupMember("did:plc:me", "standard"),
        groupMember("did:plc:bob", "standard"),
      ],
    };
    assertEquals(getGroupConvoOwner(convo), null);
  });

  it("should ignore members without a group member kind", () => {
    const convo = {
      members: [
        { did: "did:plc:me", handle: "me.bsky.social" },
        {
          did: "did:plc:bob",
          handle: "bob.bsky.social",
          kind: { role: "owner" },
        },
      ],
    };
    assertEquals(getGroupConvoOwner(convo), null);
  });
});

t.describe("getSystemMessageDisplayText", (it) => {
  function systemMessage(dataType, data = {}) {
    return {
      $type: "chat.bsky.convo.defs#systemMessageView",
      id: "sys-1",
      data: { $type: `chat.bsky.convo.defs#${dataType}`, ...data },
    };
  }

  it("should use the member name for member events when provided", () => {
    assertEquals(
      getSystemMessageDisplayText(systemMessage("systemMessageDataAddMember"), {
        memberName: "Alice",
      }),
      "Alice was added to the group",
    );
    assertEquals(
      getSystemMessageDisplayText(
        systemMessage("systemMessageDataMemberLeave"),
        { memberName: "Alice" },
      ),
      "Alice left the group",
    );
  });

  it("should fall back to anonymous copy for member events without a name", () => {
    assertEquals(
      getSystemMessageDisplayText(systemMessage("systemMessageDataAddMember")),
      "Someone was added to the group",
    );
  });

  it("should include the new name for edit-group events", () => {
    assertEquals(
      getSystemMessageDisplayText(
        systemMessage("systemMessageDataEditGroup", {
          oldName: "Old Club",
          newName: "Book Club",
        }),
      ),
      "Chat title changed to Book Club",
    );
  });

  it("should use generic copy for edit-group events without a new name", () => {
    assertEquals(
      getSystemMessageDisplayText(systemMessage("systemMessageDataEditGroup")),
      "Chat title changed",
    );
  });

  it("should ignore memberName for non-member events", () => {
    assertEquals(
      getSystemMessageDisplayText(systemMessage("systemMessageDataLockConvo"), {
        memberName: "Alice",
      }),
      "Chat locked",
    );
  });

  it("should fall back to generic copy for unknown kinds", () => {
    assertEquals(
      getSystemMessageDisplayText(systemMessage("systemMessageDataFuture")),
      "Chat updated",
    );
  });
});

t.describe("getConvoPreviewText", (it) => {
  const currentUser = { did: "did:plc:me", handle: "me.bsky.social" };
  const alice = {
    did: "did:plc:alice",
    handle: "alice.bsky.social",
    displayName: "Alice",
  };
  const groupConvo = {
    id: "group-1",
    members: [currentUser, alice],
    kind: { $type: "chat.bsky.convo.defs#groupConvo", name: "Book Club" },
  };
  const directConvo = { id: "convo-1", members: [currentUser, alice] };

  function messageView({ text, senderDid }) {
    return {
      $type: "chat.bsky.convo.defs#messageView",
      id: "msg-1",
      text,
      sender: { did: senderDid },
    };
  }

  it("should prefix group messages with the sender name", () => {
    assertEquals(
      getConvoPreviewText(messageView({ text: "hi", senderDid: alice.did }), {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Alice: hi",
    );
    assertEquals(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: currentUser.did }),
        { currentUser, convo: groupConvo, profiles: groupConvo.members },
      ),
      "You: hi",
    );
  });

  it("should fall back to Someone for unknown group senders", () => {
    assertEquals(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: "did:plc:stranger" }),
        { currentUser, convo: groupConvo, profiles: groupConvo.members },
      ),
      "Someone: hi",
    );
  });

  it("should resolve senders from the passed profiles", () => {
    assertEquals(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: "did:plc:stranger" }),
        {
          currentUser,
          convo: groupConvo,
          profiles: [
            ...groupConvo.members,
            {
              did: "did:plc:stranger",
              handle: "stranger.bsky.social",
              displayName: "Stranger",
            },
          ],
        },
      ),
      "Stranger: hi",
    );
  });

  it("should only prefix own messages in direct convos", () => {
    assertEquals(
      getConvoPreviewText(messageView({ text: "hi", senderDid: alice.did }), {
        currentUser,
        convo: directConvo,
        profiles: directConvo.members,
      }),
      "hi",
    );
    assertEquals(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: currentUser.did }),
        { currentUser, convo: directConvo, profiles: directConvo.members },
      ),
      "You: hi",
    );
  });

  it("should fall back to a generic label for embed-only messages", () => {
    const embedMessage = {
      ...messageView({ text: "", senderDid: alice.did }),
      embed: { $type: "app.bsky.embed.images#view" },
    };
    assertEquals(
      getConvoPreviewText(embedMessage, {
        currentUser,
        convo: directConvo,
        profiles: directConvo.members,
      }),
      "(embedded content)",
    );
    assertEquals(
      getConvoPreviewText(
        { ...embedMessage, sender: { did: currentUser.did } },
        { currentUser, convo: directConvo, profiles: directConvo.members },
      ),
      "You: (embedded content)",
    );
    assertEquals(
      getConvoPreviewText(embedMessage, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Alice: (embedded content)",
    );
  });

  it("should label quoted-post embeds distinctly", () => {
    const recordEmbedMessage = {
      ...messageView({ text: "", senderDid: alice.did }),
      embed: { $type: "app.bsky.embed.record#view" },
    };
    assertEquals(
      getConvoPreviewText(recordEmbedMessage, {
        currentUser,
        convo: directConvo,
        profiles: directConvo.members,
      }),
      "(quoted post)",
    );
  });

  it("should describe reactions", () => {
    const reaction = {
      $type: "chat.bsky.convo.defs#messageAndReactionView",
      message: { text: "hello" },
      reaction: { value: "👍", sender: { did: alice.did } },
    };
    assertEquals(
      getConvoPreviewText(reaction, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      'Alice reacted 👍 to "hello"',
    );
  });

  it("should describe deleted messages", () => {
    assertEquals(
      getConvoPreviewText(
        { $type: "chat.bsky.convo.defs#deletedMessageView" },
        { currentUser, convo: directConvo, profiles: directConvo.members },
      ),
      "Deleted message",
    );
  });

  it("should render system messages with the member name when resolvable", () => {
    const systemMessage = {
      $type: "chat.bsky.convo.defs#systemMessageView",
      data: {
        $type: "chat.bsky.convo.defs#systemMessageDataAddMember",
        member: { did: alice.did },
      },
    };
    assertEquals(
      getConvoPreviewText(systemMessage, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Alice was added to the group",
    );
  });

  it("should render anonymous system messages for unknown members", () => {
    const systemMessage = {
      $type: "chat.bsky.convo.defs#systemMessageView",
      data: {
        $type: "chat.bsky.convo.defs#systemMessageDataMemberLeave",
        member: { did: "did:plc:stranger" },
      },
    };
    assertEquals(
      getConvoPreviewText(systemMessage, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Someone left the group",
    );
  });
});

t.describe("getInteractionProfileDids", (it) => {
  it("should return an empty list for a missing interaction", () => {
    assertEquals(getInteractionProfileDids(null), []);
  });

  it("should extract the sender from a message", () => {
    const message = {
      $type: "chat.bsky.convo.defs#messageView",
      sender: { did: "did:plc:sender" },
    };
    assertEquals(getInteractionProfileDids(message), ["did:plc:sender"]);
  });

  it("should extract both senders from a reaction", () => {
    const reaction = {
      $type: "chat.bsky.convo.defs#messageAndReactionView",
      message: { sender: { did: "did:plc:author" } },
      reaction: { value: "👍", sender: { did: "did:plc:reactor" } },
    };
    assertEquals(getInteractionProfileDids(reaction), [
      "did:plc:author",
      "did:plc:reactor",
    ]);
  });

  it("should extract the member and adder from a system message", () => {
    const systemMessage = {
      $type: "chat.bsky.convo.defs#systemMessageView",
      data: {
        $type: "chat.bsky.convo.defs#systemMessageDataAddMember",
        member: { did: "did:plc:added" },
        addedBy: { did: "did:plc:adder" },
      },
    };
    assertEquals(getInteractionProfileDids(systemMessage), [
      "did:plc:added",
      "did:plc:adder",
    ]);
  });

  it("should return an empty list for a deleted message", () => {
    assertEquals(
      getInteractionProfileDids({
        $type: "chat.bsky.convo.defs#deletedMessageView",
      }),
      [],
    );
  });
});

t.describe("groupReactions", (it) => {
  const reaction = (value, did) => ({
    value,
    sender: { did },
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("groups by emoji value, preserving first-seen order", () => {
    const groups = groupReactions([
      reaction("❤️", "did:plc:a"),
      reaction("👍", "did:plc:b"),
      reaction("❤️", "did:plc:b"),
    ]);
    assertEquals(groups.length, 2);
    assertEquals(groups[0].value, "❤️");
    assertEquals(groups[0].count, 2);
    assertEquals(groups[0].senders.length, 2);
    assertEquals(groups[0].senders[0].did, "did:plc:a");
    assertEquals(groups[0].senders[1].did, "did:plc:b");
    assertEquals(groups[1].value, "👍");
    assertEquals(groups[1].count, 1);
  });

  it("returns an empty array for empty or missing input", () => {
    assertEquals(groupReactions([]).length, 0);
    assertEquals(groupReactions(null).length, 0);
    assertEquals(groupReactions(undefined).length, 0);
  });

  it("keeps each sender entry even when the same user reacts twice with one emoji", () => {
    const groups = groupReactions([
      reaction("❤️", "did:plc:a"),
      reaction("❤️", "did:plc:a"),
    ]);
    assertEquals(groups.length, 1);
    assertEquals(groups[0].count, 2);
    assertEquals(groups[0].senders.length, 2);
  });
});

t.describe("getInviteCodeFromUrl", (it) => {
  it("extracts code from absolute bsky.app URL", () => {
    assertEquals(
      getInviteCodeFromUrl("https://bsky.app/chat/abcd1234"),
      "abcd1234",
    );
  });

  it("extracts code from relative path", () => {
    assertEquals(getInviteCodeFromUrl("/chat/abcd1234"), "abcd1234");
  });

  it("ignores query and hash", () => {
    assertEquals(getInviteCodeFromUrl("/chat/abcd1234?ref=x#y"), "abcd1234");
  });

  it("rejects non-bsky hosts", () => {
    assertEquals(
      getInviteCodeFromUrl("https://example.com/chat/abcd1234"),
      null,
    );
  });

  it("accepts impro.social hosts", () => {
    assertEquals(
      getInviteCodeFromUrl("https://impro.social/chat/abcd1234"),
      "abcd1234",
    );
    assertEquals(
      getInviteCodeFromUrl("https://dev.impro.social/chat/abcd1234"),
      "abcd1234",
    );
  });

  it("rejects malformed codes", () => {
    assertEquals(getInviteCodeFromUrl("/chat/short"), null);
    assertEquals(getInviteCodeFromUrl("/chat/!!!!!!!!"), null);
  });

  it("rejects unrelated paths", () => {
    assertEquals(getInviteCodeFromUrl("/profile/foo"), null);
    assertEquals(getInviteCodeFromUrl(""), null);
    assertEquals(getInviteCodeFromUrl(null), null);
  });
});

t.describe("isInviteLinkUrl", (it) => {
  it("is true for valid invite URLs", () => {
    assertEquals(isInviteLinkUrl("https://bsky.app/chat/abcd1234"), true);
    assertEquals(isInviteLinkUrl("/chat/abcd1234"), true);
  });

  it("is false otherwise", () => {
    assertEquals(isInviteLinkUrl("https://bsky.app/profile/x"), false);
    assertEquals(isInviteLinkUrl(""), false);
  });
});

t.describe("getJoinLinkCodeFromEmbed", (it) => {
  it("returns the code from a chat invite view embed", () => {
    assertEquals(
      getJoinLinkCodeFromEmbed({
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: { code: "abcd1234" },
      }),
      "abcd1234",
    );
  });

  it("returns null for a chat invite view embed without a code", () => {
    assertEquals(
      getJoinLinkCodeFromEmbed({
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: {
          $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView",
        },
      }),
      null,
    );
  });

  it("returns the code from an external embed whose URI is an invite link", () => {
    assertEquals(
      getJoinLinkCodeFromEmbed({
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://bsky.app/chat/abcd1234" },
      }),
      "abcd1234",
    );
  });

  it("returns null for an external embed pointing elsewhere", () => {
    assertEquals(
      getJoinLinkCodeFromEmbed({
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://example.com" },
      }),
      null,
    );
  });

  it("returns null for unrelated embed types and falsy input", () => {
    assertEquals(
      getJoinLinkCodeFromEmbed({ $type: "app.bsky.embed.images#view" }),
      null,
    );
    assertEquals(getJoinLinkCodeFromEmbed(null), null);
    assertEquals(getJoinLinkCodeFromEmbed(undefined), null);
  });
});

t.describe("getJoinLinkCodesFromPosts", (it) => {
  it("collects codes from joinLink and external invite embeds", () => {
    const posts = [
      {
        embed: {
          $type: "chat.bsky.embed.joinLink#view",
          joinLinkPreview: { code: "aaaaaaa" },
        },
      },
      {
        embed: {
          $type: "app.bsky.embed.external#view",
          external: { uri: "https://bsky.app/chat/bbbbbbb" },
        },
      },
    ];
    assertEquals(getJoinLinkCodesFromPosts(posts), ["aaaaaaa", "bbbbbbb"]);
  });

  it("skips posts without an embed or with unrelated embeds", () => {
    const posts = [
      { embed: null },
      { embed: { $type: "app.bsky.embed.images#view" } },
      { embed: undefined },
      undefined,
    ];
    assertEquals(getJoinLinkCodesFromPosts(posts), []);
  });

  it("returns an empty array for null/undefined input", () => {
    assertEquals(getJoinLinkCodesFromPosts(null), []);
    assertEquals(getJoinLinkCodesFromPosts(undefined), []);
  });
});

t.describe("getJoinLinkCodesFromMessages", (it) => {
  it("collects codes from message join link embeds", () => {
    const messages = [
      {
        embed: {
          $type: "chat.bsky.embed.joinLink#view",
          joinLinkPreview: { code: "aaaaaaa" },
        },
      },
      { embed: null },
      {
        embed: {
          $type: "app.bsky.embed.external#view",
          external: { uri: "https://bsky.app/chat/bbbbbbb" },
        },
      },
    ];
    assertEquals(getJoinLinkCodesFromMessages(messages), [
      "aaaaaaa",
      "bbbbbbb",
    ]);
  });

  it("returns an empty array for null/undefined input", () => {
    assertEquals(getJoinLinkCodesFromMessages(null), []);
    assertEquals(getJoinLinkCodesFromMessages(undefined), []);
  });
});

t.describe("attachJoinLinkPreviewToEmbed", (it) => {
  const fresh = {
    $type: "chat.bsky.group.defs#joinLinkPreviewView",
    code: "abcd1234",
    name: "Updated",
  };

  it("returns null for unrelated embeds", () => {
    assertEquals(
      attachJoinLinkPreviewToEmbed(
        { $type: "app.bsky.embed.images#view" },
        fresh,
      ),
      null,
    );
  });

  it("returns null when the cached preview is the same reference", () => {
    assertEquals(
      attachJoinLinkPreviewToEmbed(
        { $type: "chat.bsky.embed.joinLink#view", joinLinkPreview: fresh },
        fresh,
      ),
      null,
    );
  });

  it("attaches a fresh preview to a joinLink embed", () => {
    const updated = attachJoinLinkPreviewToEmbed(
      {
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: { code: "abcd1234", name: "Stale" },
      },
      fresh,
    );
    assertEquals(updated.$type, "chat.bsky.embed.joinLink#view");
    assertEquals(updated.joinLinkPreview, fresh);
  });

  it("upgrades an external invite embed into a joinLink embed", () => {
    const updated = attachJoinLinkPreviewToEmbed(
      {
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://bsky.app/chat/abcd1234" },
      },
      fresh,
    );
    assertEquals(updated.$type, "chat.bsky.embed.joinLink#view");
    assertEquals(updated.joinLinkPreview, fresh);
  });
});

function makeJoinLinkPreview(overrides = {}) {
  return {
    $type: "chat.bsky.group.defs#joinLinkPreviewView",
    code: "abcdefg",
    name: "Friends of Bsky",
    memberCount: 5,
    memberLimit: 50,
    joinRule: "open",
    requireApproval: false,
    owner: { did: "did:plc:owner", handle: "owner.test", viewer: {} },
    viewer: {},
    ...overrides,
  };
}

t.describe("isAvailableJoinLinkPreview", (it) => {
  it("returns true only for the available variant", () => {
    assert(isAvailableJoinLinkPreview(makeJoinLinkPreview()));
    assert(
      !isAvailableJoinLinkPreview({
        $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView",
      }),
    );
  });
});

t.describe("getPostsFromPostThread", (it) => {
  it("should extract and deduplicate posts from post thread", () => {
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      parent: {
        post: { uri: "parent2", content: "Parent 2" },
        parent: {
          post: { uri: "parent1", content: "Parent 1" },
        },
      },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply2", content: "Reply 2" },
        },
      ],
    };

    const result = getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 5);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "parent1", content: "Parent 1" });
    assertEquals(result[2], { uri: "parent2", content: "Parent 2" });
    assertEquals(result[3], { uri: "reply1", content: "Reply 1" });
    assertEquals(result[4], { uri: "reply2", content: "Reply 2" });
  });

  it("should handle thread with no parents or replies", () => {
    const mockPostThread = {
      post: { uri: "lonely-post", content: "All alone" },
    };

    const result = getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 1);
    assertEquals(result[0], { uri: "lonely-post", content: "All alone" });
  });

  it("should handle duplicate posts across thread parts", () => {
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      parent: {
        post: { uri: "parent1", content: "Parent 1" },
      },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "parent1", content: "Parent 1" },
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
      ],
    };

    const result = getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 3);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "parent1", content: "Parent 1" });
    assertEquals(result[2], { uri: "reply1", content: "Reply 1" });
  });

  it("should filter out blocked replies", () => {
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
        {
          $type: "app.bsky.feed.defs#blockedPost",
          uri: "blocked-reply",
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply2", content: "Reply 2" },
        },
      ],
    };

    const result = getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 3);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "reply1", content: "Reply 1" });
    assertEquals(result[2], { uri: "reply2", content: "Reply 2" });
  });
});

t.describe("getPostsFromFeed", (it) => {
  it("should extract posts from simple feed", () => {
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Post 1" } },
        { post: { uri: "post2", content: "Post 2" } },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0], { uri: "post1", content: "Post 1" });
    assertEquals(result[1], { uri: "post2", content: "Post 2" });
  });

  it("should extract posts from feed with reply context", () => {
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Post 1" } },
        {
          post: { uri: "post2", content: "Reply post" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root post",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "parent1",
              content: "Parent post",
            },
          },
        },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 4);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "post2");
    assertEquals(result[2].uri, "root1");
    assertEquals(result[3].uri, "parent1");
  });

  it("should handle feed items without reply context", () => {
    const mockFeed = {
      feed: [
        {
          post: { uri: "post1", content: "Post 1" },
          reply: undefined,
        },
        {
          post: { uri: "post2", content: "Post 2" },
        },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0], { uri: "post1", content: "Post 1" });
    assertEquals(result[1], { uri: "post2", content: "Post 2" });
  });

  it("should handle empty feed", () => {
    const mockFeed = { feed: [] };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 0);
  });

  it("should handle duplicates in feed", () => {
    const mockFeed = {
      feed: [
        {
          post: { uri: "post1", content: "Post 1" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root post",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "post1",
              content: "Post 1",
            },
          },
        },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "root1");
  });

  it("should handle mixed feed items", () => {
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Simple post" } },
        {
          post: { uri: "post2", content: "Reply post" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "parent1",
              content: "Parent",
            },
          },
        },
        { post: { uri: "post3", content: "Another simple post" } },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assertEquals(result.length, 5);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "post2");
    assertEquals(result[2].uri, "root1");
    assertEquals(result[3].uri, "parent1");
    assertEquals(result[4].uri, "post3");
  });
});

await t.run();
