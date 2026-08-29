import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CDN_URL } from "/js/config.js";
import {
  avatarThumbnailUrl,
  buildProfileFromRecord,
  cdnImageUrl,
  getRKey,
  getIsLiked,
  isListFeed,
  getQuotedPost,
  getImagesFromDraftPost,
  getLocalRefsFromDraft,
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
  createUnavailablePost,
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
  isInAppLinkHostname,
  getInviteCodeFromUrl,
  isVideoLink,
  isAvailableJoinLinkPreview,
  getJoinLinkCodeFromEmbed,
  getJoinLinkCodesFromPosts,
  getJoinLinkCodesFromMessages,
  attachJoinLinkPreviewToEmbed,
  getPostsFromPostThread,
  getPostsFromFeed,
} from "/js/dataHelpers.js";
import { IN_APP_LINK_DOMAINS } from "/js/config.js";

describe("buildProfileFromRecord", () => {
  const did = "did:plc:me";
  const blob = (cid) => ({
    $type: "blob",
    ref: { $link: cid },
    mimeType: "image/jpeg",
    size: 1000,
  });

  it("should map record fields and build CDN urls for blobs", () => {
    const profile = buildProfileFromRecord({
      did,
      handle: "me.test",
      record: {
        uri: `at://${did}/app.bsky.actor.profile/self`,
        value: {
          displayName: "Me",
          description: "hello",
          avatar: blob("avatarcid"),
          banner: blob("bannercid"),
          pinnedPost: { uri: `at://${did}/app.bsky.feed.post/1`, cid: "abc" },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      },
    });

    assert.deepEqual(profile, {
      did,
      handle: "me.test",
      displayName: "Me",
      description: "hello",
      avatar: `${CDN_URL}/img/avatar/plain/${did}/avatarcid@jpeg`,
      banner: `${CDN_URL}/img/banner/plain/${did}/bannercid@jpeg`,
      pinnedPost: { uri: `at://${did}/app.bsky.feed.post/1`, cid: "abc" },
      createdAt: "2024-01-01T00:00:00.000Z",
      labels: [],
      isPartial: true,
    });
  });

  it("should null out missing fields when there is no record", () => {
    const profile = buildProfileFromRecord({
      did,
      handle: "me.test",
      record: null,
    });

    assert.deepEqual(profile.did, did);
    assert.deepEqual(profile.handle, "me.test");
    assert.deepEqual(profile.displayName, null);
    assert.deepEqual(profile.avatar, null);
    assert.deepEqual(profile.banner, null);
    assert.deepEqual(profile.pinnedPost, null);
    assert.deepEqual(profile.isPartial, true);
  });
});

describe("avatarThumbnailUrl", () => {
  it("should convert plain avatar URL to thumbnail URL", () => {
    const avatarUrl =
      "https://cdn.bsky.app/img/avatar/plain/did:plc:123/image@jpeg";
    const expected =
      "https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:123/image@jpeg";
    assert.deepEqual(avatarThumbnailUrl(avatarUrl), expected);
  });

  it("should handle URL without /img/avatar/plain/", () => {
    const avatarUrl = "https://cdn.bsky.app/img/other/plain/image.jpg";
    assert.deepEqual(avatarThumbnailUrl(avatarUrl), avatarUrl);
  });

  it("should handle empty string", () => {
    assert.deepEqual(avatarThumbnailUrl(""), "");
  });
});

describe("cdnImageUrl", () => {
  it("should rewrite the bsky CDN origin to the configured CDN", () => {
    assert.deepEqual(
      cdnImageUrl(
        "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:123/imagecid@jpeg",
      ),
      `${CDN_URL}/img/feed_thumbnail/plain/did:plc:123/imagecid@jpeg`,
    );
  });

  it("should leave other hosts alone", () => {
    const videoThumb =
      "https://video.bsky.app/watch/did:plc:123/videocid/thumbnail.jpg";
    assert.deepEqual(cdnImageUrl(videoThumb), videoThumb);
    const ogCard = "https://ogcard.cdn.bsky.app/start/did:plc:123/rkey";
    assert.deepEqual(cdnImageUrl(ogCard), ogCard);
  });

  it("should leave non-absolute and non-URL values alone", () => {
    assert.deepEqual(
      cdnImageUrl("/img/avatar-fallback.svg"),
      "/img/avatar-fallback.svg",
    );
    assert.deepEqual(
      cdnImageUrl("data:image/png;base64,abc"),
      "data:image/png;base64,abc",
    );
  });

  it("should pass through empty values", () => {
    assert.deepEqual(cdnImageUrl(""), "");
    assert.deepEqual(cdnImageUrl(null), null);
    assert.deepEqual(cdnImageUrl(undefined), undefined);
  });
});

describe("getRKey", () => {
  it("should extract rkey from post URI", () => {
    const post = { uri: "at://did:plc:123/app.bsky.feed.post/3l7q2wm5ws22k" };
    assert.deepEqual(getRKey(post), "3l7q2wm5ws22k");
  });

  it("should handle URI with different path structure", () => {
    const post = { uri: "at://did:plc:456/collection/another-rkey" };
    assert.deepEqual(getRKey(post), "another-rkey");
  });

  it("should handle URI with single path segment", () => {
    const post = { uri: "single-segment" };
    assert.deepEqual(getRKey(post), "single-segment");
  });
});

describe("isListFeed", () => {
  it("should return true for a list URI", () => {
    assert.deepEqual(
      isListFeed("at://did:plc:123/app.bsky.graph.list/3ltcvl4ver723"),
      true,
    );
  });

  it("should return false for a feed generator URI", () => {
    assert.deepEqual(
      isListFeed("at://did:plc:123/app.bsky.feed.generator/whats-hot"),
      false,
    );
  });

  it("should return false for the following feed", () => {
    assert.deepEqual(isListFeed("following"), false);
  });
});

describe("getIsLiked", () => {
  it("should return true when post has viewer like", () => {
    const post = { viewer: { like: "at://did:plc:123/like/abc123" } };
    assert.deepEqual(getIsLiked(post), true);
  });

  it("should return false when viewer like is empty string", () => {
    const post = { viewer: { like: "" } };
    assert.deepEqual(getIsLiked(post), false);
  });

  it("should return false when viewer like is null", () => {
    const post = { viewer: { like: null } };
    assert.deepEqual(getIsLiked(post), false);
  });

  it("should return false when viewer like is undefined", () => {
    const post = { viewer: { like: undefined } };
    assert.deepEqual(getIsLiked(post), false);
  });

  it("should return false when viewer is undefined", () => {
    const post = {};
    assert.deepEqual(getIsLiked(post), false);
  });

  it("should return false when post has no viewer property", () => {
    const post = { uri: "test" };
    assert.deepEqual(getIsLiked(post), false);
  });
});

describe("getQuotedPost", () => {
  it("should return record for app.bsky.embed.record#view", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { uri: "quoted-post-uri", author: { displayName: "Test" } },
      },
    };
    assert.deepEqual(getQuotedPost(post), post.embed.record);
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
    assert.deepEqual(getQuotedPost(post), post.embed.record.record);
  });

  it("should return null for embed with different $type", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [],
      },
    };
    assert.deepEqual(getQuotedPost(post), null);
  });

  it("should return null when embed is undefined", () => {
    const post = {};
    assert.deepEqual(getQuotedPost(post), null);
  });

  it("should return null when embed is null", () => {
    const post = { embed: null };
    assert.deepEqual(getQuotedPost(post), null);
  });

  it("should return null when post has no embed property", () => {
    const post = { uri: "test" };
    assert.deepEqual(getQuotedPost(post), null);
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
    assert.deepEqual(getQuotedPost(post), post.embeds[0].record);
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
    assert.deepEqual(getQuotedPost(post), post.embeds[0].record.record);
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
    assert.deepEqual(getQuotedPost(post), post.embeds[0].record);
  });

  it("should fall back to embed when embeds is empty", () => {
    const post = {
      embeds: [],
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { uri: "from-embed-prop" },
      },
    };
    assert.deepEqual(getQuotedPost(post), null);
  });
});

describe("getBlockedQuote", () => {
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
    assert.deepEqual(getBlockedQuote(post), post.embed.record);
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
    assert.deepEqual(getBlockedQuote(post), null);
  });

  it("should return null when no quoted post exists", () => {
    const post = {
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [],
      },
    };
    assert.deepEqual(getBlockedQuote(post), null);
  });

  it("should return null when post has no embed", () => {
    const post = {};
    assert.deepEqual(getBlockedQuote(post), null);
  });
});

describe("createEmbedFromPost", () => {
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

    assert.deepEqual(result, {
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
    assert.deepEqual(result.author, post.author);
    assert.deepEqual(result.value, post.record);
  });

  it("should handle post with minimal data", () => {
    const post = {
      author: {},
      record: {},
      uri: "minimal-uri",
    };

    const result = createEmbedFromPost(post);

    assert.deepEqual(result, {
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

    assert.deepEqual(result, {
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

describe("embedViewRecordToPostView", () => {
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

    assert.deepEqual(result, {
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

    assert.deepEqual(result.record, viewRecord.value);
    assert.deepEqual(result.embed, viewRecord.embeds[0]);
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

    assert.deepEqual(result.embed, undefined);
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

    assert.deepEqual(result.embed, undefined);
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

    assert.deepEqual(result.likeCount, undefined);
    assert.deepEqual(result.replyCount, undefined);
    assert.deepEqual(result.repostCount, undefined);
    assert.deepEqual(result.quoteCount, undefined);
  });
});

describe("replaceTopParent", () => {
  it("should throw error when postThread has no parent", () => {
    const postThread = { post: { uri: "post-uri" } };
    let threw = false;
    try {
      replaceTopParent(postThread, { post: { uri: "new-parent" } });
    } catch (e) {
      threw = true;
      assert.deepEqual(e.message, "No parent found");
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

    assert.deepEqual(result.parent, newParent);
    assert.deepEqual(result.post, postThread.post);
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

    assert.deepEqual(result.parent.parent, newParent);
    assert.deepEqual(result.parent.post.uri, "parent-uri");
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

    assert.deepEqual(result.parent.parent.parent, newParent);
    assert.deepEqual(result.parent.parent.post.uri, "grandparent-uri");
  });
});

describe("isAutomatedAccount", () => {
  it("should return false for profile without labels", () => {
    const profile = { did: "did:plc:123", handle: "user.bsky.social" };
    assert.deepEqual(isAutomatedAccount(profile), false);
  });

  it("should return false for profile with empty labels", () => {
    const profile = { did: "did:plc:123", labels: [] };
    assert.deepEqual(isAutomatedAccount(profile), false);
  });

  it("should return false for profile with non-bot labels", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "!no-unauthenticated" }],
    };
    assert.deepEqual(isAutomatedAccount(profile), false);
  });

  it("should return true for profile with bot label", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "bot" }],
    };
    assert.deepEqual(isAutomatedAccount(profile), true);
  });

  it("should return true when bot label is among other labels", () => {
    const profile = {
      did: "did:plc:123",
      labels: [{ val: "!no-unauthenticated" }, { val: "bot" }],
    };
    assert.deepEqual(isAutomatedAccount(profile), true);
  });
});

describe("isLabelerProfile", () => {
  it("should return true when profile has associated labeler", () => {
    const profile = { associated: { labeler: true } };
    assert.deepEqual(isLabelerProfile(profile), true);
  });

  it("should return false when profile has no associated labeler", () => {
    const profile = { associated: { labeler: false } };
    assert.deepEqual(isLabelerProfile(profile), false);
  });

  it("should return undefined when profile has no associated property", () => {
    const profile = {};
    assert.deepEqual(isLabelerProfile(profile), undefined);
  });

  it("should return undefined when associated has no labeler property", () => {
    const profile = { associated: {} };
    assert.deepEqual(isLabelerProfile(profile), undefined);
  });
});

describe("getLabelNameAndDescription", () => {
  it("should return identifier as name when no locales", () => {
    const labelDefinition = { identifier: "test-label" };
    const result = getLabelNameAndDescription(labelDefinition);

    assert.deepEqual(result.name, "test-label");
    assert.deepEqual(result.description, "");
  });

  it("should return identifier as name when locales is empty", () => {
    const labelDefinition = { identifier: "test-label", locales: [] };
    const result = getLabelNameAndDescription(labelDefinition);

    assert.deepEqual(result.name, "test-label");
    assert.deepEqual(result.description, "");
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

    assert.deepEqual(result.name, "Label");
    assert.deepEqual(result.description, "Description");
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

    assert.deepEqual(result.name, "Etiqueta");
    assert.deepEqual(result.description, "Descripción");
  });

  it("should use identifier when locale name is missing", () => {
    const labelDefinition = {
      identifier: "test-label",
      locales: [{ lang: "en", description: "Description only" }],
    };
    const result = getLabelNameAndDescription(labelDefinition, "en");

    assert.deepEqual(result.name, "test-label");
    assert.deepEqual(result.description, "Description only");
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

    assert.deepEqual(result.name, "Label");
    assert.deepEqual(result.description, "Description");
  });
});

describe("getLabelerForLabel", () => {
  it("should return matching labeler by src did", () => {
    const label = { src: "did:plc:labeler1", val: "nsfw" };
    const labelers = [
      { creator: { did: "did:plc:labeler1" }, policies: {} },
      { creator: { did: "did:plc:labeler2" }, policies: {} },
    ];

    const result = getLabelerForLabel(label, labelers);

    assert.deepEqual(result.creator.did, "did:plc:labeler1");
  });

  it("should return null when no matching labeler", () => {
    const label = { src: "did:plc:unknown", val: "nsfw" };
    const labelers = [{ creator: { did: "did:plc:labeler1" }, policies: {} }];

    const result = getLabelerForLabel(label, labelers);

    assert.deepEqual(result, null);
  });

  it("should return null when labelers is empty", () => {
    const label = { src: "did:plc:labeler1", val: "nsfw" };

    const result = getLabelerForLabel(label, []);

    assert.deepEqual(result, null);
  });
});

describe("getDefinitionForLabel", () => {
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

    assert.deepEqual(result.identifier, "nsfw");
    assert.deepEqual(result.blurs, "media");
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

    assert.deepEqual(result, undefined);
  });
});

describe("isBadgeLabel", () => {
  it("should return true when blurs is none", () => {
    const labelDefinition = { blurs: "none" };
    assert.deepEqual(isBadgeLabel(labelDefinition), true);
  });

  it("should return true when blurs is undefined", () => {
    const labelDefinition = {};
    assert.deepEqual(isBadgeLabel(labelDefinition), true);
  });

  it("should return false when blurs is media", () => {
    const labelDefinition = { blurs: "media" };
    assert.deepEqual(isBadgeLabel(labelDefinition), false);
  });

  it("should return false when blurs is content", () => {
    const labelDefinition = { blurs: "content" };
    assert.deepEqual(isBadgeLabel(labelDefinition), false);
  });
});

describe("addFeedItemToFeed", () => {
  it("should add item to empty feed", () => {
    const feedItem = { post: { uri: "post-1" } };
    const result = addFeedItemToFeed(feedItem, []);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0], feedItem);
  });

  it("should add item to beginning of feed without pinned post", () => {
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [existingItem]);

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0], newItem);
    assert.deepEqual(result[1], existingItem);
  });

  it("should add item after pinned post", () => {
    const pinnedItem = {
      post: { uri: "pinned-post" },
      reason: { $type: "app.bsky.feed.defs#reasonPin" },
    };
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [pinnedItem, existingItem]);

    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0], pinnedItem);
    assert.deepEqual(result[1], newItem);
    assert.deepEqual(result[2], existingItem);
  });

  it("should handle pinned post not at first position", () => {
    const pinnedItem = {
      post: { uri: "pinned-post" },
      reason: { $type: "app.bsky.feed.defs#reasonPin" },
    };
    const existingItem = { post: { uri: "post-1" } };
    const newItem = { post: { uri: "post-2" } };

    const result = addFeedItemToFeed(newItem, [existingItem, pinnedItem]);

    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0], pinnedItem);
    assert.deepEqual(result[1], newItem);
    assert.deepEqual(result[2], existingItem);
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

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].reason.$type, "app.bsky.feed.defs#reasonRepost");
  });
});

describe("pinPostInFeed", () => {
  const pinReason = { $type: "app.bsky.feed.defs#reasonPin" };

  it("should add a pinned item to an empty feed", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const result = pinPostInFeed([], post);
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].post, post);
    assert.deepEqual(result[0].reason.$type, pinReason.$type);
  });

  it("should move an existing post to the top and mark it pinned", () => {
    const post = { uri: "post-2", cid: "cid-2" };
    const feed = [
      { post: { uri: "post-1" } },
      { post },
      { post: { uri: "post-3" } },
    ];
    const result = pinPostInFeed(feed, post);
    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0].post.uri, "post-2");
    assert.deepEqual(result[0].reason.$type, pinReason.$type);
    assert.deepEqual(result[1].post.uri, "post-1");
    assert.deepEqual(result[2].post.uri, "post-3");
  });

  it("should unpin a previously pinned item when pinning a new one", () => {
    const oldPinned = { post: { uri: "post-1" }, reason: pinReason };
    const other = { post: { uri: "post-2" } };
    const newPost = { uri: "post-3", cid: "cid-3" };
    const result = pinPostInFeed([oldPinned, other], newPost);
    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0].post.uri, "post-3");
    assert.deepEqual(result[0].reason.$type, pinReason.$type);
    // Old pinned item is still present, but no longer carries the pin reason.
    const oldInResult = result.find((item) => item.post.uri === "post-1");
    assert.deepEqual(oldInResult.reason, undefined);
  });

  it("should not duplicate the post when it is already pinned", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post, reason: pinReason }, { post: { uri: "post-2" } }];
    const result = pinPostInFeed(feed, post);
    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].post.uri, "post-1");
    assert.deepEqual(result[0].reason.$type, pinReason.$type);
    assert.deepEqual(result[1].post.uri, "post-2");
  });

  it("should not mutate the input feed", () => {
    const post = { uri: "post-1" };
    const feed = [{ post: { uri: "post-2" } }];
    const before = [...feed];
    pinPostInFeed(feed, post);
    assert.deepEqual(feed.length, before.length);
    assert.deepEqual(feed[0], before[0]);
  });
});

describe("unpinPostInFeed", () => {
  const pinReason = { $type: "app.bsky.feed.defs#reasonPin" };

  it("should clear the pin reason on the matching item but keep it in place", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post, reason: pinReason }, { post: { uri: "post-2" } }];
    const result = unpinPostInFeed(feed, post);
    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].post.uri, "post-1");
    assert.deepEqual(result[0].reason, undefined);
    assert.deepEqual(result[1].post.uri, "post-2");
  });

  it("should leave a non-pinned occurrence of the post unchanged", () => {
    const post = { uri: "post-1", cid: "cid-1" };
    const feed = [{ post }, { post: { uri: "post-2" } }];
    const result = unpinPostInFeed(feed, post);
    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].post.uri, "post-1");
    assert.deepEqual(result[0].reason, undefined);
  });

  it("should not affect another pinned item with a different uri", () => {
    const post = { uri: "post-1" };
    const otherPinned = { post: { uri: "post-2" }, reason: pinReason };
    const result = unpinPostInFeed([otherPinned], post);
    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].post.uri, "post-2");
    assert.deepEqual(result[0].reason.$type, pinReason.$type);
  });

  it("should return an empty feed when given one", () => {
    assert.deepEqual(unpinPostInFeed([], { uri: "post-1" }).length, 0);
  });
});

describe("getDisplayName", () => {
  it("should return displayName when present", () => {
    const profile = { displayName: "Alice", handle: "alice.bsky.social" };
    assert.deepEqual(getDisplayName(profile), "Alice");
  });

  it("should trim whitespace from displayName", () => {
    const profile = { displayName: "  Alice  ", handle: "alice.bsky.social" };
    assert.deepEqual(getDisplayName(profile), "Alice");
  });

  it("should strip check mark characters", () => {
    const profile = {
      displayName: "Alice \u2705\u2713\u2714\u2611",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice");
  });

  it("should strip control characters", () => {
    const profile = {
      displayName: "Ali\u0000ce\u001F",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice");
  });

  it("should strip bidirectional override characters", () => {
    const profile = {
      displayName: "Ali\u202Ace\u202E",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice");
  });

  it("should collapse multiple spaces into one", () => {
    const profile = {
      displayName: "Alice   Bob",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice Bob");
  });

  it("should collapse spaces with zero-width spaces", () => {
    const profile = {
      displayName: "Alice \u200B Bob",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice Bob");
  });

  it("should handle all sanitizations together", () => {
    const profile = {
      displayName: "  \u2705Alice\u0000   Bob\u202E  ",
      handle: "alice.bsky.social",
    };
    assert.deepEqual(getDisplayName(profile), "Alice Bob");
  });

  it("should return 'Deleted Account' for missing.invalid handle", () => {
    const profile = { handle: "missing.invalid" };
    assert.deepEqual(getDisplayName(profile), "Deleted Account");
  });

  it("should return 'Invalid Handle' for handle.invalid handle", () => {
    const profile = { handle: "handle.invalid" };
    assert.deepEqual(getDisplayName(profile), "Invalid Handle");
  });

  it("should return handle when no displayName", () => {
    const profile = { handle: "alice.bsky.social" };
    assert.deepEqual(getDisplayName(profile), "alice.bsky.social");
  });

  it("should prefer displayName over special handle fallbacks", () => {
    const profile = { displayName: "Still Here", handle: "missing.invalid" };
    assert.deepEqual(getDisplayName(profile), "Still Here");
  });
});

describe("hasValidHandle", () => {
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

describe("getThreadgateAllowSettings", () => {
  it("returns everybody when post has no threadgate", () => {
    assert.deepEqual(getThreadgateAllowSettings({}), { type: "everybody" });
  });

  it("returns everybody when allow is undefined", () => {
    const post = {
      threadgate: { record: { $type: "app.bsky.feed.threadgate" } },
    };
    assert.deepEqual(getThreadgateAllowSettings(post), { type: "everybody" });
  });

  it("returns nobody when allow is empty array", () => {
    const post = { threadgate: { record: { allow: [] } } };
    assert.deepEqual(getThreadgateAllowSettings(post), { type: "nobody" });
  });

  it("maps a mention rule", () => {
    const post = {
      threadgate: {
        record: { allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }] },
      },
    };
    assert.deepEqual(getThreadgateAllowSettings(post), [{ type: "mention" }]);
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
    assert.deepEqual(getThreadgateAllowSettings(post), [
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
    assert.deepEqual(getThreadgateAllowSettings(post), [
      { type: "list", list },
    ]);
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
    assert.deepEqual(getThreadgateAllowSettings(post), [
      { type: "list", list: null },
    ]);
  });

  it("marks unknown rule types", () => {
    const post = {
      threadgate: {
        record: { allow: [{ $type: "app.bsky.feed.threadgate#futureRule" }] },
      },
    };
    assert.deepEqual(getThreadgateAllowSettings(post), [{ type: "unknown" }]);
  });
});

describe("isEmptyPost", () => {
  it("should return true for blocked posts", () => {
    const post = { $type: "app.bsky.feed.defs#blockedPost", uri: "at://x" };
    assert.deepEqual(isEmptyPost(post), true);
  });

  it("should return true for not-found posts", () => {
    const post = { $type: "app.bsky.feed.defs#notFoundPost", uri: "at://x" };
    assert.deepEqual(isEmptyPost(post), true);
  });

  it("should return true for unavailable posts", () => {
    const post = createUnavailablePost("at://x");
    assert.deepEqual(isEmptyPost(post), true);
  });

  it("should return false for normal post views", () => {
    const post = { $type: "app.bsky.feed.defs#postView", uri: "at://x" };
    assert.deepEqual(isEmptyPost(post), false);
  });
});

describe("canReplyToPost", () => {
  it("should return true for a normal post view with no restrictions", () => {
    const post = {
      $type: "app.bsky.feed.defs#postView",
      uri: "at://x",
      viewer: {},
    };
    assert.deepEqual(canReplyToPost(post), true);
  });

  it("should return false for a blocked post", () => {
    const post = { $type: "app.bsky.feed.defs#blockedPost", uri: "at://x" };
    assert.deepEqual(canReplyToPost(post), false);
  });

  it("should return false for a not-found post", () => {
    const post = { $type: "app.bsky.feed.defs#notFoundPost", uri: "at://x" };
    assert.deepEqual(canReplyToPost(post), false);
  });

  it("should return false for an unavailable post", () => {
    const post = createUnavailablePost("at://x");
    assert.deepEqual(canReplyToPost(post), false);
  });

  it("should return false when viewer.replyDisabled is true", () => {
    const post = {
      $type: "app.bsky.feed.defs#postView",
      uri: "at://x",
      viewer: { replyDisabled: true },
    };
    assert.deepEqual(canReplyToPost(post), false);
  });

  it("should return true when viewer is missing", () => {
    const post = { $type: "app.bsky.feed.defs#postView", uri: "at://x" };
    assert.deepEqual(canReplyToPost(post), true);
  });
});

describe("transformNestedQuotes", () => {
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
    assert.deepEqual(result, post);
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
    assert.deepEqual(result.uri, "post");
    assert.deepEqual(result.flag, "root");
    assert.deepEqual(result.embed.record, { uri: "quote", touched: true });
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
    assert.deepEqual(calls, ["quote", "nested"]);
    assert.deepEqual(result.embed.record.touched, true);
    assert.deepEqual(result.embed.record.embeds[0].record, {
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
    assert.deepEqual(seen, ["quote", "nested"]);
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
    assert.deepEqual(originalQuote.touched, undefined);
    assert.deepEqual(originalNested.touched, undefined);
    assert.deepEqual(post.embed.record, originalQuote);
  });
});

describe("getInteractionTimestamp", () => {
  it("should return sentAt for message views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#messageView",
      sentAt: "2026-06-11T01:00:00.000Z",
    });
    assert.deepEqual(timestamp, "2026-06-11T01:00:00.000Z");
  });

  it("should return sentAt for system message views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#systemMessageView",
      sentAt: "2026-06-11T02:00:00.000Z",
    });
    assert.deepEqual(timestamp, "2026-06-11T02:00:00.000Z");
  });

  it("should return reaction createdAt for message-and-reaction views", () => {
    const timestamp = getInteractionTimestamp({
      $type: "chat.bsky.convo.defs#messageAndReactionView",
      reaction: { createdAt: "2026-06-11T03:00:00.000Z" },
    });
    assert.deepEqual(timestamp, "2026-06-11T03:00:00.000Z");
  });
});

describe("getGroupConvoDetails", () => {
  const groupKind = {
    $type: "chat.bsky.convo.defs#groupConvo",
    name: "Test Group",
    memberCount: 3,
    memberLimit: 10,
    lockStatus: "unlocked",
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  it("should return the kind object for group convos", () => {
    assert.deepEqual(
      getGroupConvoDetails({ id: "c1", kind: groupKind }),
      groupKind,
    );
  });

  it("should return null for direct convos", () => {
    const directConvo = {
      id: "c2",
      kind: { $type: "chat.bsky.convo.defs#directConvo" },
    };
    assert.deepEqual(getGroupConvoDetails(directConvo), null);
  });

  it("should return null when kind is missing", () => {
    assert.deepEqual(getGroupConvoDetails({ id: "c3" }), null);
  });
});

describe("isGroupConvo", () => {
  it("should detect group convos", () => {
    const convo = {
      id: "c1",
      kind: { $type: "chat.bsky.convo.defs#groupConvo", name: "Test Group" },
    };
    assert.deepEqual(isGroupConvo(convo), true);
  });

  it("should reject direct and untyped convos", () => {
    assert.deepEqual(
      isGroupConvo({ kind: { $type: "chat.bsky.convo.defs#directConvo" } }),
      false,
    );
    assert.deepEqual(isGroupConvo({}), false);
  });
});

describe("getGroupConvoOwner", () => {
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
    assert.deepEqual(getGroupConvoOwner(convo), owner);
  });

  it("should return null when the owner has left", () => {
    const convo = {
      members: [
        groupMember("did:plc:me", "standard"),
        groupMember("did:plc:bob", "standard"),
      ],
    };
    assert.deepEqual(getGroupConvoOwner(convo), null);
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
    assert.deepEqual(getGroupConvoOwner(convo), null);
  });
});

describe("getSystemMessageDisplayText", () => {
  function systemMessage(dataType, data = {}) {
    return {
      $type: "chat.bsky.convo.defs#systemMessageView",
      id: "sys-1",
      data: { $type: `chat.bsky.convo.defs#${dataType}`, ...data },
    };
  }

  it("should use the member name for member events when provided", () => {
    assert.deepEqual(
      getSystemMessageDisplayText(systemMessage("systemMessageDataAddMember"), {
        memberName: "Alice",
      }),
      "Alice was added to the group",
    );
    assert.deepEqual(
      getSystemMessageDisplayText(
        systemMessage("systemMessageDataMemberLeave"),
        { memberName: "Alice" },
      ),
      "Alice left the group",
    );
  });

  it("should fall back to anonymous copy for member events without a name", () => {
    assert.deepEqual(
      getSystemMessageDisplayText(systemMessage("systemMessageDataAddMember")),
      "Someone was added to the group",
    );
  });

  it("should include the new name for edit-group events", () => {
    assert.deepEqual(
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
    assert.deepEqual(
      getSystemMessageDisplayText(systemMessage("systemMessageDataEditGroup")),
      "Chat title changed",
    );
  });

  it("should ignore memberName for non-member events", () => {
    assert.deepEqual(
      getSystemMessageDisplayText(systemMessage("systemMessageDataLockConvo"), {
        memberName: "Alice",
      }),
      "Chat locked",
    );
  });

  it("should fall back to generic copy for unknown kinds", () => {
    assert.deepEqual(
      getSystemMessageDisplayText(systemMessage("systemMessageDataFuture")),
      "Chat updated",
    );
  });
});

describe("getConvoPreviewText", () => {
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
    assert.deepEqual(
      getConvoPreviewText(messageView({ text: "hi", senderDid: alice.did }), {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Alice: hi",
    );
    assert.deepEqual(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: currentUser.did }),
        { currentUser, convo: groupConvo, profiles: groupConvo.members },
      ),
      "You: hi",
    );
  });

  it("should fall back to Someone for unknown group senders", () => {
    assert.deepEqual(
      getConvoPreviewText(
        messageView({ text: "hi", senderDid: "did:plc:stranger" }),
        { currentUser, convo: groupConvo, profiles: groupConvo.members },
      ),
      "Someone: hi",
    );
  });

  it("should resolve senders from the passed profiles", () => {
    assert.deepEqual(
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
    assert.deepEqual(
      getConvoPreviewText(messageView({ text: "hi", senderDid: alice.did }), {
        currentUser,
        convo: directConvo,
        profiles: directConvo.members,
      }),
      "hi",
    );
    assert.deepEqual(
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
    assert.deepEqual(
      getConvoPreviewText(embedMessage, {
        currentUser,
        convo: directConvo,
        profiles: directConvo.members,
      }),
      "(embedded content)",
    );
    assert.deepEqual(
      getConvoPreviewText(
        { ...embedMessage, sender: { did: currentUser.did } },
        { currentUser, convo: directConvo, profiles: directConvo.members },
      ),
      "You: (embedded content)",
    );
    assert.deepEqual(
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
    assert.deepEqual(
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
    assert.deepEqual(
      getConvoPreviewText(reaction, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      'Alice reacted 👍 to "hello"',
    );
  });

  it("should describe deleted messages", () => {
    assert.deepEqual(
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
    assert.deepEqual(
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
    assert.deepEqual(
      getConvoPreviewText(systemMessage, {
        currentUser,
        convo: groupConvo,
        profiles: groupConvo.members,
      }),
      "Someone left the group",
    );
  });
});

describe("getInteractionProfileDids", () => {
  it("should return an empty list for a missing interaction", () => {
    assert.deepEqual(getInteractionProfileDids(null), []);
  });

  it("should extract the sender from a message", () => {
    const message = {
      $type: "chat.bsky.convo.defs#messageView",
      sender: { did: "did:plc:sender" },
    };
    assert.deepEqual(getInteractionProfileDids(message), ["did:plc:sender"]);
  });

  it("should extract both senders from a reaction", () => {
    const reaction = {
      $type: "chat.bsky.convo.defs#messageAndReactionView",
      message: { sender: { did: "did:plc:author" } },
      reaction: { value: "👍", sender: { did: "did:plc:reactor" } },
    };
    assert.deepEqual(getInteractionProfileDids(reaction), [
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
    assert.deepEqual(getInteractionProfileDids(systemMessage), [
      "did:plc:added",
      "did:plc:adder",
    ]);
  });

  it("should return an empty list for a deleted message", () => {
    assert.deepEqual(
      getInteractionProfileDids({
        $type: "chat.bsky.convo.defs#deletedMessageView",
      }),
      [],
    );
  });
});

describe("groupReactions", () => {
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
    assert.deepEqual(groups.length, 2);
    assert.deepEqual(groups[0].value, "❤️");
    assert.deepEqual(groups[0].count, 2);
    assert.deepEqual(groups[0].senders.length, 2);
    assert.deepEqual(groups[0].senders[0].did, "did:plc:a");
    assert.deepEqual(groups[0].senders[1].did, "did:plc:b");
    assert.deepEqual(groups[1].value, "👍");
    assert.deepEqual(groups[1].count, 1);
  });

  it("returns an empty array for empty or missing input", () => {
    assert.deepEqual(groupReactions([]).length, 0);
    assert.deepEqual(groupReactions(null).length, 0);
    assert.deepEqual(groupReactions(undefined).length, 0);
  });

  it("keeps each sender entry even when the same user reacts twice with one emoji", () => {
    const groups = groupReactions([
      reaction("❤️", "did:plc:a"),
      reaction("❤️", "did:plc:a"),
    ]);
    assert.deepEqual(groups.length, 1);
    assert.deepEqual(groups[0].count, 2);
    assert.deepEqual(groups[0].senders.length, 2);
  });
});

describe("isInAppLinkHostname", () => {
  it("accepts the static in-app domains", () => {
    assert.deepEqual(isInAppLinkHostname("bsky.app"), true);
    assert.deepEqual(isInAppLinkHostname("impro.social"), true);
    assert.deepEqual(isInAppLinkHostname("dev.impro.social"), true);
  });

  it("accepts the current hostname even when it's not in the static domain list", () => {
    // window.location.hostname is "localhost" in tests, which is not in
    // IN_APP_LINK_DOMAINS -- this exercises the same-origin fallback.
    assert(!IN_APP_LINK_DOMAINS.includes("localhost"));
    assert.deepEqual(isInAppLinkHostname("localhost"), true);
  });

  it("rejects other hostnames", () => {
    assert.deepEqual(isInAppLinkHostname("example.com"), false);
    assert.deepEqual(isInAppLinkHostname("evil-impro.social"), false);
  });
});

describe("getInviteCodeFromUrl", () => {
  it("extracts code from absolute bsky.app URL", () => {
    assert.deepEqual(
      getInviteCodeFromUrl("https://bsky.app/chat/abcd1234"),
      "abcd1234",
    );
  });

  it("extracts code from relative path", () => {
    assert.deepEqual(getInviteCodeFromUrl("/chat/abcd1234"), "abcd1234");
  });

  it("ignores query and hash", () => {
    assert.deepEqual(
      getInviteCodeFromUrl("/chat/abcd1234?ref=x#y"),
      "abcd1234",
    );
  });

  it("rejects non-bsky hosts", () => {
    assert.deepEqual(
      getInviteCodeFromUrl("https://example.com/chat/abcd1234"),
      null,
    );
  });

  it("accepts impro.social hosts", () => {
    assert.deepEqual(
      getInviteCodeFromUrl("https://impro.social/chat/abcd1234"),
      "abcd1234",
    );
    assert.deepEqual(
      getInviteCodeFromUrl("https://dev.impro.social/chat/abcd1234"),
      "abcd1234",
    );
  });

  it("accepts a link to the current origin even when it's not in the static domain list", () => {
    // window.location.hostname is "localhost" in tests, which is not in
    // IN_APP_LINK_DOMAINS -- this exercises the same-origin fallback.
    assert(!IN_APP_LINK_DOMAINS.includes("localhost"));
    assert.deepEqual(
      getInviteCodeFromUrl("http://localhost/chat/abcd1234"),
      "abcd1234",
    );
  });

  it("rejects malformed codes", () => {
    assert.deepEqual(getInviteCodeFromUrl("/chat/short"), null);
    assert.deepEqual(getInviteCodeFromUrl("/chat/!!!!!!!!"), null);
  });

  it("rejects unrelated paths", () => {
    assert.deepEqual(getInviteCodeFromUrl("/profile/foo"), null);
    assert.deepEqual(getInviteCodeFromUrl(""), null);
    assert.deepEqual(getInviteCodeFromUrl(null), null);
  });
});

describe("isInviteLinkUrl", () => {
  it("is true for valid invite URLs", () => {
    assert.deepEqual(isInviteLinkUrl("https://bsky.app/chat/abcd1234"), true);
    assert.deepEqual(isInviteLinkUrl("/chat/abcd1234"), true);
  });

  it("is false otherwise", () => {
    assert.deepEqual(isInviteLinkUrl("https://bsky.app/profile/x"), false);
    assert.deepEqual(isInviteLinkUrl(""), false);
  });
});

describe("getJoinLinkCodeFromEmbed", () => {
  it("returns the code from a chat invite view embed", () => {
    assert.deepEqual(
      getJoinLinkCodeFromEmbed({
        $type: "chat.bsky.embed.joinLink#view",
        joinLinkPreview: { code: "abcd1234" },
      }),
      "abcd1234",
    );
  });

  it("returns null for a chat invite view embed without a code", () => {
    assert.deepEqual(
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
    assert.deepEqual(
      getJoinLinkCodeFromEmbed({
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://bsky.app/chat/abcd1234" },
      }),
      "abcd1234",
    );
  });

  it("returns null for an external embed pointing elsewhere", () => {
    assert.deepEqual(
      getJoinLinkCodeFromEmbed({
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://example.com" },
      }),
      null,
    );
  });

  it("returns null for unrelated embed types and falsy input", () => {
    assert.deepEqual(
      getJoinLinkCodeFromEmbed({ $type: "app.bsky.embed.images#view" }),
      null,
    );
    assert.deepEqual(getJoinLinkCodeFromEmbed(null), null);
    assert.deepEqual(getJoinLinkCodeFromEmbed(undefined), null);
  });
});

describe("getJoinLinkCodesFromPosts", () => {
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
    assert.deepEqual(getJoinLinkCodesFromPosts(posts), ["aaaaaaa", "bbbbbbb"]);
  });

  it("skips posts without an embed or with unrelated embeds", () => {
    const posts = [
      { embed: null },
      { embed: { $type: "app.bsky.embed.images#view" } },
      { embed: undefined },
      undefined,
    ];
    assert.deepEqual(getJoinLinkCodesFromPosts(posts), []);
  });

  it("returns an empty array for null/undefined input", () => {
    assert.deepEqual(getJoinLinkCodesFromPosts(null), []);
    assert.deepEqual(getJoinLinkCodesFromPosts(undefined), []);
  });
});

describe("getJoinLinkCodesFromMessages", () => {
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
    assert.deepEqual(getJoinLinkCodesFromMessages(messages), [
      "aaaaaaa",
      "bbbbbbb",
    ]);
  });

  it("returns an empty array for null/undefined input", () => {
    assert.deepEqual(getJoinLinkCodesFromMessages(null), []);
    assert.deepEqual(getJoinLinkCodesFromMessages(undefined), []);
  });
});

describe("attachJoinLinkPreviewToEmbed", () => {
  const fresh = {
    $type: "chat.bsky.group.defs#joinLinkPreviewView",
    code: "abcd1234",
    name: "Updated",
  };

  it("returns null for unrelated embeds", () => {
    assert.deepEqual(
      attachJoinLinkPreviewToEmbed(
        { $type: "app.bsky.embed.images#view" },
        fresh,
      ),
      null,
    );
  });

  it("returns null when the cached preview is the same reference", () => {
    assert.deepEqual(
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
    assert.deepEqual(updated.$type, "chat.bsky.embed.joinLink#view");
    assert.deepEqual(updated.joinLinkPreview, fresh);
  });

  it("upgrades an external invite embed into a joinLink embed", () => {
    const updated = attachJoinLinkPreviewToEmbed(
      {
        $type: "app.bsky.embed.external#view",
        external: { uri: "https://bsky.app/chat/abcd1234" },
      },
      fresh,
    );
    assert.deepEqual(updated.$type, "chat.bsky.embed.joinLink#view");
    assert.deepEqual(updated.joinLinkPreview, fresh);
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

describe("isAvailableJoinLinkPreview", () => {
  it("returns true only for the available variant", () => {
    assert(isAvailableJoinLinkPreview(makeJoinLinkPreview()));
    assert(
      !isAvailableJoinLinkPreview({
        $type: "chat.bsky.group.defs#disabledJoinLinkPreviewView",
      }),
    );
  });
});

describe("getPostsFromPostThread", () => {
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

    assert.deepEqual(result.length, 5);
    assert.deepEqual(result[0], { uri: "main-post", content: "Main post" });
    assert.deepEqual(result[1], { uri: "parent1", content: "Parent 1" });
    assert.deepEqual(result[2], { uri: "parent2", content: "Parent 2" });
    assert.deepEqual(result[3], { uri: "reply1", content: "Reply 1" });
    assert.deepEqual(result[4], { uri: "reply2", content: "Reply 2" });
  });

  it("should handle thread with no parents or replies", () => {
    const mockPostThread = {
      post: { uri: "lonely-post", content: "All alone" },
    };

    const result = getPostsFromPostThread(mockPostThread);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0], { uri: "lonely-post", content: "All alone" });
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

    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0], { uri: "main-post", content: "Main post" });
    assert.deepEqual(result[1], { uri: "parent1", content: "Parent 1" });
    assert.deepEqual(result[2], { uri: "reply1", content: "Reply 1" });
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

    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0], { uri: "main-post", content: "Main post" });
    assert.deepEqual(result[1], { uri: "reply1", content: "Reply 1" });
    assert.deepEqual(result[2], { uri: "reply2", content: "Reply 2" });
  });
});

describe("getPostsFromFeed", () => {
  it("should extract posts from simple feed", () => {
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Post 1" } },
        { post: { uri: "post2", content: "Post 2" } },
      ],
    };

    const result = getPostsFromFeed(mockFeed);

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0], { uri: "post1", content: "Post 1" });
    assert.deepEqual(result[1], { uri: "post2", content: "Post 2" });
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

    assert.deepEqual(result.length, 4);
    assert.deepEqual(result[0].uri, "post1");
    assert.deepEqual(result[1].uri, "post2");
    assert.deepEqual(result[2].uri, "root1");
    assert.deepEqual(result[3].uri, "parent1");
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

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0], { uri: "post1", content: "Post 1" });
    assert.deepEqual(result[1], { uri: "post2", content: "Post 2" });
  });

  it("should handle empty feed", () => {
    const mockFeed = { feed: [] };

    const result = getPostsFromFeed(mockFeed);

    assert.deepEqual(result.length, 0);
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

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].uri, "post1");
    assert.deepEqual(result[1].uri, "root1");
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

    assert.deepEqual(result.length, 5);
    assert.deepEqual(result[0].uri, "post1");
    assert.deepEqual(result[1].uri, "post2");
    assert.deepEqual(result[2].uri, "root1");
    assert.deepEqual(result[3].uri, "parent1");
    assert.deepEqual(result[4].uri, "post3");
  });
});

describe("isVideoLink", () => {
  it("returns true for youtube watch links", () => {
    assert(isVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
    assert(isVideoLink("https://youtube.com/watch?v=dQw4w9WgXcQ"));
    assert(isVideoLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ"));
  });

  it("returns true for youtu.be links", () => {
    assert(isVideoLink("https://youtu.be/dQw4w9WgXcQ"));
  });

  it("returns true for youtube shorts and live links", () => {
    assert(isVideoLink("https://www.youtube.com/shorts/dQw4w9WgXcQ"));
    assert(isVideoLink("https://www.youtube.com/live/dQw4w9WgXcQ"));
  });

  it("returns false for youtube pages that are not videos", () => {
    assert(!isVideoLink("https://www.youtube.com/"));
    assert(!isVideoLink("https://www.youtube.com/results?search_query=cats"));
    assert(!isVideoLink("https://www.youtube.com/@somechannel"));
  });

  it("returns false for non-youtube links and invalid input", () => {
    assert(!isVideoLink("https://example.com/watch?v=dQw4w9WgXcQ"));
    assert(!isVideoLink("not a url"));
    assert(!isVideoLink(null));
  });
});

describe("getImagesFromDraftPost", () => {
  it("reads embedGallery items", () => {
    const images = getImagesFromDraftPost({
      embedGallery: { items: [{ localRef: { path: "image:a" } }] },
    });
    assert.deepEqual(images.length, 1);
  });

  it("reads legacy embedImages", () => {
    const images = getImagesFromDraftPost({
      embedImages: [{ localRef: { path: "image:a" }, alt: "old" }],
    });
    assert.deepEqual(images[0].alt, "old");
  });

  it("skips entries without a localRef path", () => {
    const images = getImagesFromDraftPost({
      embedGallery: { items: [{ localRef: {} }, {}] },
    });
    assert.deepEqual(images, []);
  });
});

describe("getLocalRefsFromDraft", () => {
  it("collects image and video refs across posts, including legacy images", () => {
    const refs = getLocalRefsFromDraft({
      posts: [
        {
          embedGallery: { items: [{ localRef: { path: "image:a" } }] },
          embedVideos: [{ localRef: { path: "video:video/mp4:v.mp4" } }],
        },
        { embedImages: [{ localRef: { path: "image:b" } }] },
      ],
    });
    assert.deepEqual(refs, ["image:a", "video:video/mp4:v.mp4", "image:b"]);
  });

  it("returns an empty array for drafts with no media", () => {
    assert.deepEqual(getLocalRefsFromDraft({ posts: [{ text: "hi" }] }), []);
  });
});
