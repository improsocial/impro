import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Preferences } from "../../src/js/preferences.js";

const t = new TestSuite("Preferences");

t.describe("Preferences.createLoggedOutPreferences", (it) => {
  it("should create preferences with discover feed pinned", () => {
    const preferences = Preferences.createLoggedOutPreferences();

    assertEquals(preferences.obj.length, 1);
    assertEquals(
      preferences.obj[0].$type,
      "app.bsky.actor.defs#savedFeedsPrefV2",
    );
    assertEquals(preferences.obj[0].items.length, 1);
    assertEquals(preferences.obj[0].items[0].pinned, true);
  });

  it("should create preferences with empty labelerDefs", () => {
    const preferences = Preferences.createLoggedOutPreferences();

    assertEquals(preferences.labelerDefs, []);
  });
});

t.describe("Preferences.getPreferenceByType", (it) => {
  it("should return matching preference by type", () => {
    const obj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
      { $type: "app.bsky.actor.defs#mutedWordsPref", items: [] },
    ];

    const result = Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#mutedWordsPref",
    );

    assertEquals(result.$type, "app.bsky.actor.defs#mutedWordsPref");
  });

  it("should return undefined when type not found", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];

    const result = Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#nonExistent",
    );

    assertEquals(result, undefined);
  });
});

t.describe("Preferences.getSavedFeedsPreference", (it) => {
  it("should return saved feeds preference", () => {
    const obj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: ["feed1"] },
    ];

    const result = Preferences.getSavedFeedsPreference(obj);

    assertEquals(result.$type, "app.bsky.actor.defs#savedFeedsPrefV2");
    assertEquals(result.items, ["feed1"]);
  });
});

t.describe("Preferences.getMutedWordsPreference", (it) => {
  it("should return muted words preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "test" }],
      },
    ];

    const result = Preferences.getMutedWordsPreference(obj);

    assertEquals(result.$type, "app.bsky.actor.defs#mutedWordsPref");
  });
});

t.describe("Preferences.getLabelerDidsFromPreferences", (it) => {
  it("should return labeler DIDs with default appended", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:custom1" }, { did: "did:plc:custom2" }],
      },
    ];

    const result = Preferences.getLabelerDidsFromPreferences(obj);

    assertEquals(result.length, 3);
    assertEquals(result[0], "did:plc:custom1");
    assertEquals(result[1], "did:plc:custom2");
    assertEquals(result[2], "did:plc:ar7c4by46qjdydhdevvrndac");
  });

  it("should return only default when no labelers preference", () => {
    const obj = [];

    const result = Preferences.getLabelerDidsFromPreferences(obj);

    assertEquals(result.length, 1);
    assertEquals(result[0], "did:plc:ar7c4by46qjdydhdevvrndac");
  });
});

t.describe("Preferences.getPinnedFeeds", (it) => {
  it("should return only pinned feeds", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [
          { id: "1", value: "feed1", pinned: true },
          { id: "2", value: "feed2", pinned: false },
          { id: "3", value: "feed3", pinned: true },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getPinnedFeeds();

    assertEquals(result.length, 2);
    assertEquals(result[0].value, "feed1");
    assertEquals(result[1].value, "feed3");
  });

  it("should return empty array when no saved feeds preference", () => {
    const preferences = new Preferences([], []);
    const result = preferences.getPinnedFeeds();

    assertEquals(result, []);
  });
});

t.describe("Preferences.unpinFeed", (it) => {
  it("should return new preferences with feed unpinned", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: true }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unpinFeed("feed1");

    // Original should be unchanged
    assertEquals(preferences.getPinnedFeeds().length, 1);

    // New preferences should have feed unpinned
    assertEquals(newPreferences.getPinnedFeeds().length, 0);
  });

  it("should do nothing when feed not found", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: true }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unpinFeed("nonexistent");

    assertEquals(newPreferences.getPinnedFeeds().length, 1);
  });
});

t.describe("Preferences.pinFeed", (it) => {
  it("should pin existing feed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: false }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.pinFeed("feed1");

    assertEquals(newPreferences.getPinnedFeeds().length, 1);
    assertEquals(newPreferences.getPinnedFeeds()[0].value, "feed1");
  });

  it("should not modify original when pinning existing feed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: false }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.pinFeed("feed1");

    // Original should be unchanged
    assertEquals(preferences.getPinnedFeeds().length, 0);

    // New preferences should have the feed pinned
    assertEquals(newPreferences.getPinnedFeeds().length, 1);
  });
});

t.describe("Preferences.getLabelerDids", (it) => {
  it("should return labeler DIDs from preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:test" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getLabelerDids();

    assertEquals(result.includes("did:plc:test"), true);
    assertEquals(result.includes("did:plc:ar7c4by46qjdydhdevvrndac"), true);
  });
});

t.describe("Preferences.hasMutedWord", (it) => {
  it("should return true when text contains muted word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should be case insensitive", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "SPAM", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should return false when no muted words match", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is normal content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });

  it("should return false when no muted words preference", () => {
    const preferences = new Preferences([], []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });

  it("should ignore expired muted words", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"], expiresAt: pastDate }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });

  it("should include non-expired muted words", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"], expiresAt: futureDate }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should return false when text is null", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: null,
      facets: null,
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });
});

t.describe("Preferences.hasMutedWord - word boundary matching", (it) => {
  const hasMutedWord = (preferences, text, languages = []) =>
    preferences.hasMutedWord({
      text,
      facets: null,
      embed: null,
      languages,
      author: null,
    });

  it("should NOT match when muted word is a substring of another word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "cat", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    // Should NOT match - "cat" is a substring of these words
    assertEquals(hasMutedWord(preferences, "I love category theory"), false);
    assertEquals(hasMutedWord(preferences, "concatenate these strings"), false);
    assertEquals(hasMutedWord(preferences, "The vacation was great"), false);
  });

  it("should match when muted word appears as a standalone word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "cat", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assertEquals(hasMutedWord(preferences, "I love my cat"), true);
    assertEquals(hasMutedWord(preferences, "cat is cute"), true);
    assertEquals(hasMutedWord(preferences, "the cat sat"), true);
  });

  it("should use substring matching for single character muted words", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "x", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assertEquals(hasMutedWord(preferences, "example text"), true);
    assertEquals(hasMutedWord(preferences, "no match here"), false);
  });

  it("should use substring matching for language exceptions", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "test", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    // Languages that don't use spaces should use substring matching
    assertEquals(hasMutedWord(preferences, "testing", ["ja"]), true); // Japanese
    assertEquals(hasMutedWord(preferences, "testing", ["zh"]), true); // Chinese
    assertEquals(hasMutedWord(preferences, "testing", ["ko"]), true); // Korean
    assertEquals(hasMutedWord(preferences, "testing", ["th"]), true); // Thai
    assertEquals(hasMutedWord(preferences, "testing", ["vi"]), true); // Vietnamese

    // Non-exception languages should use word boundary matching
    assertEquals(hasMutedWord(preferences, "testing", ["en"]), false);
    assertEquals(hasMutedWord(preferences, "testing", []), false);
  });

  it("should use substring matching for phrases with spaces", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "bad phrase", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assertEquals(hasMutedWord(preferences, "this is a bad phrase here"), true);
    assertEquals(hasMutedWord(preferences, "bad phrase at start"), true);
    assertEquals(hasMutedWord(preferences, "ends with bad phrase"), true);
    assertEquals(hasMutedWord(preferences, "bad and phrase separate"), false);
  });

  it("should strip leading and trailing punctuation when matching", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "hello", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assertEquals(hasMutedWord(preferences, "...hello..."), true);
    assertEquals(hasMutedWord(preferences, '"hello"'), true);
    assertEquals(hasMutedWord(preferences, "(hello)"), true);
    assertEquals(hasMutedWord(preferences, "hello!"), true);
    assertEquals(hasMutedWord(preferences, "!hello"), true);
  });

  it("should handle internal punctuation by normalizing", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "dont", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    // "don't" with punctuation removed becomes "dont"
    assertEquals(hasMutedWord(preferences, "I don't know"), true);
  });

  it("should NOT match words containing slashes to avoid false positives", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "and", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    // "and/or" contains "/" so should be skipped to avoid "Andor" matching "and/or"
    assertEquals(hasMutedWord(preferences, "this and/or that"), false);
    // But standalone "and" should still match
    assertEquals(hasMutedWord(preferences, "this and that"), true);
  });

  it("should match multiple muted words correctly", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { value: "spam", targets: ["content"] },
          { value: "scam", targets: ["content"] },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);

    assertEquals(hasMutedWord(preferences, "this is spam"), true);
    assertEquals(hasMutedWord(preferences, "this is a scam"), true);
    assertEquals(hasMutedWord(preferences, "normal content"), false);
  });
});

t.describe("Preferences.postHasMutedWord", (it) => {
  it("should return true when post text contains muted word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = { record: { text: "This is spam content", langs: [] } };
    const result = preferences.postHasMutedWord(post);

    assertEquals(result, true);
  });

  it("should return false when post has no text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = { record: { langs: [] } };
    const result = preferences.postHasMutedWord(post);

    assertEquals(result, false);
  });

  it("should return false when post is null", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.postHasMutedWord(null);

    assertEquals(result, false);
  });
});

t.describe("Preferences.quotedPostHasMutedWord", (it) => {
  it("should return true when quoted post contains muted word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const quotedPost = { value: { text: "This is spam content", langs: [] } };
    const result = preferences.quotedPostHasMutedWord(quotedPost);

    assertEquals(result, true);
  });

  it("should return false when quoted post has no text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const quotedPost = { value: { langs: [] } };
    const result = preferences.quotedPostHasMutedWord(quotedPost);

    assertEquals(result, false);
  });
});

t.describe("Preferences.hasMutedWord - embed text matching", (it) => {
  it("should match muted word in image alt text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Check out this image",
      facets: null,
      embed: {
        $type: "app.bsky.embed.images",
        images: [{ alt: "This is spam content" }],
      },
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should match muted word in any image alt text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Multiple images",
      facets: null,
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          { alt: "Normal image" },
          { alt: "This has spam in it" },
          { alt: "Another normal one" },
        ],
      },
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should skip images without alt text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Image without alt",
      facets: null,
      embed: {
        $type: "app.bsky.embed.images",
        images: [{ alt: "" }, { alt: null }],
      },
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });

  it("should match muted word in external link title", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Check out this link",
      facets: null,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://example.com",
          title: "This is spam content",
          description: "A normal description",
        },
      },
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should match muted word in external link description", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Check out this link",
      facets: null,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://example.com",
          title: "Normal title",
          description: "This description has spam",
        },
      },
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should match muted word in recordWithMedia embed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Quote with media",
      facets: null,
      embed: {
        $type: "app.bsky.embed.recordWithMedia",
        media: {
          $type: "app.bsky.embed.images",
          images: [{ alt: "This has spam" }],
        },
      },
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should not check embed when target is tags only", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tags"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Check out this link",
      facets: null,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://example.com",
          title: "This is spam content",
          description: "spam spam spam",
        },
      },
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });
});

t.describe("Preferences.hasMutedWord - tag matching", (it) => {
  it("should match muted word in hashtag", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tags"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "Check out this post #spam",
      facets: [
        {
          index: { byteStart: 20, byteEnd: 25 },
          features: [{ $type: "app.bsky.richtext.facet#tag", tag: "spam" }],
        },
      ],
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, true);
  });

  it("should not match text when target is tags only", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tags"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: [],
      embed: null,
      languages: [],
      author: null,
    });

    assertEquals(result, false);
  });

  it("should match both text and tags when both targets specified", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content", "tags"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    // Should match text
    const textResult = preferences.hasMutedWord({
      text: "This is spam content",
      facets: [],
      embed: null,
      languages: [],
      author: null,
    });
    assertEquals(textResult, true);

    // Should match tag
    const tagResult = preferences.hasMutedWord({
      text: "Normal content",
      facets: [
        {
          features: [{ $type: "app.bsky.richtext.facet#tag", tag: "spam" }],
        },
      ],
      embed: null,
      languages: [],
      author: null,
    });
    assertEquals(tagResult, true);
  });
});

t.describe("Preferences.hasMutedWord - exclude-following", (it) => {
  it("should skip muting for followed accounts when actorTarget is exclude-following", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            value: "spam",
            targets: ["content"],
            actorTarget: "exclude-following",
          },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: {
        viewer: { following: "at://did:plc:xyz/app.bsky.graph.follow/abc" },
      },
    });

    assertEquals(result, false);
  });

  it("should mute non-followed accounts even with exclude-following", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            value: "spam",
            targets: ["content"],
            actorTarget: "exclude-following",
          },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: { viewer: { following: null } },
    });

    assertEquals(result, true);
  });

  it("should mute followed accounts without exclude-following actorTarget", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.hasMutedWord({
      text: "This is spam content",
      facets: null,
      embed: null,
      languages: [],
      author: {
        viewer: { following: "at://did:plc:xyz/app.bsky.graph.follow/abc" },
      },
    });

    assertEquals(result, true);
  });
});

t.describe("Preferences.isSubscribedToLabeler", (it) => {
  it("should return true when subscribed to labeler", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }, { did: "did:plc:labeler2" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.isSubscribedToLabeler("did:plc:labeler1");

    assertEquals(result, true);
  });

  it("should return false when not subscribed to labeler", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.isSubscribedToLabeler("did:plc:other");

    assertEquals(result, false);
  });

  it("should return false when no labeler preference exists", () => {
    const preferences = new Preferences([], []);
    const result = preferences.isSubscribedToLabeler("did:plc:labeler1");

    assertEquals(result, false);
  });
});

t.describe("Preferences.subscribeLabeler", (it) => {
  const makeLabelerInfo = (did) => ({
    creator: { did },
    policies: { labelValueDefinitions: [] },
  });

  it("should add labeler to existing labelers preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:existing" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:new",
      makeLabelerInfo("did:plc:new"),
    );

    assertEquals(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
    assertEquals(
      newPreferences.isSubscribedToLabeler("did:plc:existing"),
      true,
    );
  });

  it("should create labelers preference if it does not exist", () => {
    const preferences = new Preferences([], []);
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:new",
      makeLabelerInfo("did:plc:new"),
    );

    assertEquals(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
  });

  it("should not add duplicate labeler", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:existing" }],
      },
    ];

    const preferences = new Preferences(obj, [
      makeLabelerInfo("did:plc:existing"),
    ]);
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:existing",
      makeLabelerInfo("did:plc:existing"),
    );

    // Get the labelers preference and check count
    const labelerPref = Preferences.getLabelerPreference(newPreferences.obj);
    assertEquals(labelerPref.labelers.length, 1);
  });

  it("should not modify original preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:existing" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:new",
      makeLabelerInfo("did:plc:new"),
    );

    // Original should be unchanged
    assertEquals(preferences.isSubscribedToLabeler("did:plc:new"), false);
    // New should have the labeler
    assertEquals(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
  });

  it("should add labelerInfo to labelerDefs", () => {
    const preferences = new Preferences([], []);
    const labelerInfo = {
      creator: { did: "did:plc:new" },
      policies: { labelValueDefinitions: [] },
    };
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:new",
      labelerInfo,
    );

    assertEquals(newPreferences.labelerDefs.length, 1);
    assertEquals(newPreferences.labelerDefs[0].creator.did, "did:plc:new");
  });

  it("should not add duplicate labelerInfo to labelerDefs", () => {
    const existingLabelerInfo = {
      creator: { did: "did:plc:existing" },
      policies: { labelValueDefinitions: [] },
    };
    const preferences = new Preferences([], [existingLabelerInfo]);
    const newPreferences = preferences.subscribeLabeler(
      "did:plc:existing",
      existingLabelerInfo,
    );

    assertEquals(newPreferences.labelerDefs.length, 1);
  });
});

t.describe("Preferences.unsubscribeLabeler", (it) => {
  it("should remove labeler from labelers preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }, { did: "did:plc:labeler2" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unsubscribeLabeler("did:plc:labeler1");

    assertEquals(
      newPreferences.isSubscribedToLabeler("did:plc:labeler1"),
      false,
    );
    assertEquals(
      newPreferences.isSubscribedToLabeler("did:plc:labeler2"),
      true,
    );
  });

  it("should handle unsubscribing from non-existent labeler", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unsubscribeLabeler(
      "did:plc:nonexistent",
    );

    // Should not throw and should keep existing labeler
    assertEquals(
      newPreferences.isSubscribedToLabeler("did:plc:labeler1"),
      true,
    );
  });

  it("should return clone when no labelers preference exists", () => {
    const preferences = new Preferences([], []);
    const newPreferences = preferences.unsubscribeLabeler("did:plc:labeler1");

    // Should not throw and should return a clone
    assert(newPreferences !== preferences);
  });

  it("should not modify original preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }, { did: "did:plc:labeler2" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unsubscribeLabeler("did:plc:labeler1");

    // Original should be unchanged
    assertEquals(preferences.isSubscribedToLabeler("did:plc:labeler1"), true);
    // New should have the labeler removed
    assertEquals(
      newPreferences.isSubscribedToLabeler("did:plc:labeler1"),
      false,
    );
  });

  it("should remove labelerInfo from labelerDefs", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }],
      },
    ];
    const labelerDefs = [
      { creator: { did: "did:plc:labeler1" }, policies: {} },
      { creator: { did: "did:plc:labeler2" }, policies: {} },
    ];

    const preferences = new Preferences(obj, labelerDefs);
    const newPreferences = preferences.unsubscribeLabeler("did:plc:labeler1");

    assertEquals(newPreferences.labelerDefs.length, 1);
    assertEquals(newPreferences.labelerDefs[0].creator.did, "did:plc:labeler2");
  });
});

t.describe("Preferences.clone", (it) => {
  it("should create independent copy of preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: true }],
      },
    ];
    const labelerDefs = [{ creator: { did: "did:test" } }];

    const preferences = new Preferences(obj, labelerDefs);
    const cloned = preferences.clone();

    // Modify cloned
    cloned.obj[0].items[0].pinned = false;

    // Original should be unchanged
    assertEquals(preferences.obj[0].items[0].pinned, true);
  });
});

t.describe("Preferences.getFollowingFeedPreference", (it) => {
  it("should return following feed preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#feedViewPref",
        feed: "home",
        hideReplies: true,
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getFollowingFeedPreference();

    assertEquals(result.$type, "app.bsky.actor.defs#feedViewPref");
    assertEquals(result.feed, "home");
    assertEquals(result.hideReplies, true);
  });

  it("should return null when no following feed preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#feedViewPref",
        feed: "other",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getFollowingFeedPreference();

    assertEquals(result, null);
  });
});

t.describe("Preferences.getBadgeLabels", (it) => {
  it("should return empty array when post has no labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getBadgeLabels(post);

    assertEquals(result, []);
  });

  it("should return badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = preferences.getBadgeLabels(post);

    assertEquals(result.length, 1);
    assertEquals(result[0].labelDefinition.identifier, "verified");
    assertEquals(result[0].labeler.creator.did, "did:labeler1");
  });

  it("should not return content labels as badges", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getBadgeLabels(post);

    assertEquals(result.length, 0);
  });

  it("should not return media labels as badges", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nudity",
              blurs: "media",
              locales: [{ lang: "en", name: "Nudity" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nudity" }],
    };
    const result = preferences.getBadgeLabels(post);

    assertEquals(result.length, 0);
  });
});

t.describe("Preferences.getContentLabel", (it) => {
  it("should return null when post has no content labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getContentLabel(post);

    assertEquals(result, null);
  });

  it("should return content label with visibility from preference", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:labeler1",
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "nsfw");
  });

  it("should use defaultSetting when no preference exists", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "warn");
  });

  it("should return most restrictive label (hide over warn)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "label1",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Label 1" }],
            },
            {
              identifier: "label2",
              blurs: "content",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Label 2" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [
        { src: "did:labeler1", val: "label1" },
        { src: "did:labeler1", val: "label2" },
      ],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "label2");
  });

  it("should ignore badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result, null);
  });
});

t.describe("Preferences.getMediaLabel", (it) => {
  it("should return null when post has no media labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getMediaLabel(post);

    assertEquals(result, null);
  });

  it("should return media label with visibility from preference", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nudity_custom",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Nudity" }],
            },
          ],
        },
      },
    ];
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nudity_custom",
        labelerDid: "did:labeler1",
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nudity_custom" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "nudity_custom");
  });

  it("should ignore content labels (blurs: content)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result, null);
  });

  it("should return most restrictive media label", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "suggestive",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Suggestive" }],
            },
            {
              identifier: "porn",
              blurs: "media",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Porn" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [
        { src: "did:labeler1", val: "suggestive" },
        { src: "did:labeler1", val: "porn" },
      ],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "porn");
  });
});

t.describe("Preferences.getContentLabelPref", (it) => {
  it("should return matching content label preference", () => {
    const labelerDid = "did:plc:testlabeler";
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid,
        visibility: "warn",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getContentLabelPref({
      label: "nsfw",
      labelerDid,
    });

    assertEquals(result.label, "nsfw");
    assertEquals(result.visibility, "warn");
    assertEquals(result.labelerDid, labelerDid);
  });

  it("should return null when no matching preference exists", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:plc:testlabeler",
        visibility: "warn",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getContentLabelPref({
      label: "gore",
      labelerDid: "did:plc:testlabeler",
    });

    assertEquals(result, null);
  });

  it("should match both label and labelerDid", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:plc:labeler1",
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:plc:labeler2",
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getContentLabelPref({
      label: "nsfw",
      labelerDid: "did:plc:labeler2",
    });

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelerDid, "did:plc:labeler2");
  });
});

t.describe("Preferences.setContentLabelPref", (it) => {
  it("should add new content label preference", () => {
    const labelerDid = "did:plc:testlabeler";
    const preferences = new Preferences([], []);

    const newPreferences = preferences.setContentLabelPref({
      label: "nsfw",
      visibility: "warn",
      labelerDid,
    });

    const result = newPreferences.getContentLabelPref({
      label: "nsfw",
      labelerDid,
    });
    assertEquals(result.label, "nsfw");
    assertEquals(result.visibility, "warn");
    assertEquals(result.labelerDid, labelerDid);
  });

  it("should update existing content label preference", () => {
    const labelerDid = "did:plc:testlabeler";
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid,
        visibility: "warn",
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.setContentLabelPref({
      label: "nsfw",
      visibility: "hide",
      labelerDid,
    });

    const result = newPreferences.getContentLabelPref({
      label: "nsfw",
      labelerDid,
    });
    assertEquals(result.visibility, "hide");
  });

  it("should not modify original preferences", () => {
    const labelerDid = "did:plc:testlabeler";
    const preferences = new Preferences([], []);

    const newPreferences = preferences.setContentLabelPref({
      label: "nsfw",
      visibility: "warn",
      labelerDid,
    });

    // Original should be unchanged
    assertEquals(
      preferences.getContentLabelPref({ label: "nsfw", labelerDid }),
      null,
    );
    // New should have the pref
    assertEquals(
      newPreferences.getContentLabelPref({ label: "nsfw", labelerDid }).label,
      "nsfw",
    );
  });

  it("should set correct $type on new preference", () => {
    const labelerDid = "did:plc:testlabeler";
    const preferences = new Preferences([], []);

    const newPreferences = preferences.setContentLabelPref({
      label: "nsfw",
      visibility: "warn",
      labelerDid,
    });

    const prefs = Preferences.getContentLabelPreferences(newPreferences.obj);
    assertEquals(prefs.length, 1);
    assertEquals(prefs[0].$type, "app.bsky.actor.defs#contentLabelPref");
  });
});

t.describe("Preferences.getLabelerSettings", (it) => {
  it("should return all content label prefs for a labeler", () => {
    const labelerDid = "did:plc:testlabeler";
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid,
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "gore",
        labelerDid: labelerDid,
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getLabelerSettings(labelerDid);

    assertEquals(result.length, 2);
    assertEquals(result[0].label, "nsfw");
    assertEquals(result[1].label, "gore");
  });

  it("should return empty array when no settings exist", () => {
    const preferences = new Preferences([], []);
    const result = preferences.getLabelerSettings("did:plc:testlabeler");

    assertEquals(result.length, 0);
  });

  it("should filter by labelerDid", () => {
    const labelerDid1 = "did:plc:labeler1";
    const labelerDid2 = "did:plc:labeler2";
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: labelerDid1,
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "gore",
        labelerDid: labelerDid2,
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getLabelerSettings(labelerDid1);

    assertEquals(result.length, 1);
    assertEquals(result[0].label, "nsfw");
    assertEquals(result[0].labelerDid, labelerDid1);
  });
});

t.describe("Preferences.getContentLabelPreferences", (it) => {
  it("should return all content label preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:plc:labeler1",
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [],
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "gore",
        labelerDid: "did:plc:labeler2",
        visibility: "hide",
      },
    ];

    const result = Preferences.getContentLabelPreferences(obj);

    assertEquals(result.length, 2);
    assertEquals(result[0].label, "nsfw");
    assertEquals(result[1].label, "gore");
  });

  it("should return empty array when no content label preferences exist", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [],
      },
    ];

    const result = Preferences.getContentLabelPreferences(obj);

    assertEquals(result.length, 0);
  });

  it("should only return contentLabelPref type", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:plc:labeler1",
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }],
      },
    ];

    const result = Preferences.getContentLabelPreferences(obj);

    assertEquals(result.length, 1);
    assertEquals(result[0].$type, "app.bsky.actor.defs#contentLabelPref");
  });
});

t.describe("Preferences.getContentLabel - global labels", (it) => {
  it("should handle !hide global label with forced hide visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!hide" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "!hide");
    assertEquals(result.labeler, null);
  });

  it("should handle !warn global label with forced warn visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "warn");
    assertEquals(result.labelDefinition.identifier, "!warn");
    assertEquals(result.labeler, null);
  });

  it("should not allow user to override !hide visibility", () => {
    // User tries to set !hide to "ignore" - should still be "hide"
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "!hide",
        labelerDid: "did:plc:modservice",
        visibility: "ignore",
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!hide" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "hide");
  });

  it("should not allow user to override !warn visibility", () => {
    // User tries to set !warn to "ignore" - should still be "warn"
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "!warn",
        labelerDid: "did:plc:modservice",
        visibility: "ignore",
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "warn");
  });

  it("should prefer !hide over !warn when both present", () => {
    const preferences = new Preferences([], []);
    const post = {
      labels: [
        { src: "did:plc:modservice", val: "!warn" },
        { src: "did:plc:modservice", val: "!hide" },
      ],
    };
    const result = preferences.getContentLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "!hide");
  });
});

t.describe("Preferences.getMediaLabel - global self-labels", (it) => {
  it("should handle porn self-label with default hide visibility", () => {
    const preferences = new Preferences([], []);
    // Self-labels have src = author's DID, not a labeler's DID
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "porn" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "porn");
    assertEquals(result.labeler, null);
  });

  it("should handle sexual self-label with default warn visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "sexual" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "warn");
    assertEquals(result.labelDefinition.identifier, "sexual");
  });

  it("should handle nudity self-label with default ignore visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "nudity" }],
    };
    const result = preferences.getMediaLabel(post);

    // nudity defaults to "ignore", so should return null
    assertEquals(result, null);
  });

  it("should handle graphic-media self-label", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "graphic-media" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "warn");
    assertEquals(result.labelDefinition.identifier, "graphic-media");
  });

  it("should handle legacy gore label", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "gore" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "warn");
    assertEquals(result.labelDefinition.identifier, "gore");
  });

  it("should allow user to change self-label visibility", () => {
    // User sets porn to "warn" instead of default "hide" on the global labeler
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "porn",
        labelerDid: "did:plc:ar7c4by46qjdydhdevvrndac",
        visibility: "warn",
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "porn" }],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "warn");
  });

  it("should prefer most restrictive self-label", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "sexual" }, // default: warn
        { src: "did:plc:author123", val: "porn" }, // default: hide
      ],
    };
    const result = preferences.getMediaLabel(post);

    assertEquals(result.visibility, "hide");
    assertEquals(result.labelDefinition.identifier, "porn");
  });
});

t.describe(
  "Preferences.getContentLabel - mixed global and custom labels",
  (it) => {
    it("should check both global and custom labels", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-warn",
                blurs: "content",
                defaultSetting: "warn",
                locales: [{ lang: "en", name: "Custom Warning" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        labels: [{ src: "did:plc:labeler1", val: "custom-warn" }],
      };
      const result = preferences.getContentLabel(post);

      assertEquals(result.visibility, "warn");
      assertEquals(result.labelDefinition.identifier, "custom-warn");
      assertEquals(result.labeler.creator.did, "did:plc:labeler1");
    });

    it("should return global label when more restrictive than custom", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-warn",
                blurs: "content",
                defaultSetting: "warn",
                locales: [{ lang: "en", name: "Custom Warning" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        labels: [
          { src: "did:plc:labeler1", val: "custom-warn" }, // warn
          { src: "did:plc:modservice", val: "!hide" }, // hide (global)
        ],
      };
      const result = preferences.getContentLabel(post);

      assertEquals(result.visibility, "hide");
      assertEquals(result.labelDefinition.identifier, "!hide");
      assertEquals(result.labeler, null);
    });

    it("should return custom label when more restrictive than global", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-hide",
                blurs: "content",
                defaultSetting: "hide",
                locales: [{ lang: "en", name: "Custom Hide" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        labels: [
          { src: "did:plc:modservice", val: "!warn" }, // warn (global) - processed first
          { src: "did:plc:labeler1", val: "custom-hide" }, // hide - processed second, should win
        ],
      };
      const result = preferences.getContentLabel(post);

      assertEquals(result.visibility, "hide");
      assertEquals(result.labelDefinition.identifier, "custom-hide");
      assertEquals(result.labeler.creator.did, "did:plc:labeler1");
    });

    it("should return first warn when no hide labels exist", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-warn",
                blurs: "content",
                defaultSetting: "warn",
                locales: [{ lang: "en", name: "Custom Warning" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        labels: [
          { src: "did:plc:modservice", val: "!warn" }, // warn (global) - first
          { src: "did:plc:labeler1", val: "custom-warn" }, // warn (custom)
        ],
      };
      const result = preferences.getContentLabel(post);

      assertEquals(result.visibility, "warn");
      // Should be the first warn encountered
      assertEquals(result.labelDefinition.identifier, "!warn");
    });
  },
);

t.describe(
  "Preferences.getMediaLabel - mixed global and custom labels",
  (it) => {
    it("should return global label when more restrictive than custom", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-media-warn",
                blurs: "media",
                defaultSetting: "warn",
                locales: [{ lang: "en", name: "Custom Media Warning" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        author: { did: "did:plc:author123" },
        labels: [
          { src: "did:plc:labeler1", val: "custom-media-warn" }, // warn
          { src: "did:plc:author123", val: "porn" }, // hide (global self-label)
        ],
      };
      const result = preferences.getMediaLabel(post);

      assertEquals(result.visibility, "hide");
      assertEquals(result.labelDefinition.identifier, "porn");
      assertEquals(result.labeler, null);
    });

    it("should return custom label when more restrictive than global", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-media-hide",
                blurs: "media",
                defaultSetting: "hide",
                locales: [{ lang: "en", name: "Custom Media Hide" }],
              },
            ],
          },
        },
      ];

      const preferences = new Preferences([], labelerDefs);
      const post = {
        author: { did: "did:plc:author123" },
        labels: [
          { src: "did:plc:author123", val: "sexual" }, // warn (global self-label)
          { src: "did:plc:labeler1", val: "custom-media-hide" }, // hide
        ],
      };
      const result = preferences.getMediaLabel(post);

      assertEquals(result.visibility, "hide");
      assertEquals(result.labelDefinition.identifier, "custom-media-hide");
      assertEquals(result.labeler.creator.did, "did:plc:labeler1");
    });

    it("should handle mix of global self-labels and custom labels with user prefs", () => {
      const labelerDefs = [
        {
          creator: { did: "did:plc:labeler1", handle: "labeler.test" },
          policies: {
            labelValueDefinitions: [
              {
                identifier: "custom-media",
                blurs: "media",
                defaultSetting: "warn",
                locales: [{ lang: "en", name: "Custom Media" }],
              },
            ],
          },
        },
      ];
      // User sets porn to warn and custom-media to hide
      const obj = [
        {
          $type: "app.bsky.actor.defs#contentLabelPref",
          label: "porn",
          labelerDid: "did:plc:ar7c4by46qjdydhdevvrndac",
          visibility: "warn",
        },
        {
          $type: "app.bsky.actor.defs#contentLabelPref",
          label: "custom-media",
          labelerDid: "did:plc:labeler1",
          visibility: "hide",
        },
      ];

      const preferences = new Preferences(obj, labelerDefs);
      const post = {
        author: { did: "did:plc:author123" },
        labels: [
          { src: "did:plc:author123", val: "porn" }, // user set to warn
          { src: "did:plc:labeler1", val: "custom-media" }, // user set to hide
        ],
      };
      const result = preferences.getMediaLabel(post);

      assertEquals(result.visibility, "hide");
      assertEquals(result.labelDefinition.identifier, "custom-media");
    });
  },
);

await t.run();
