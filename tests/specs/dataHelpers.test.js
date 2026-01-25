import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  avatarThumbnailUrl,
  getRKey,
  getIsLiked,
  getQuotedPost,
  getBlockedQuote,
  createEmbedFromPost,
  replaceTopParent,
  isLabelerProfile,
  getLabelNameAndDescription,
  getLabelerForLabel,
  getDefinitionForLabel,
  isBadgeLabel,
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

await t.run();
