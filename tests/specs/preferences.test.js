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

t.describe("Preferences.getPostLabels", (it) => {
  it("should return empty array when post has no matching labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getPostLabels(post);

    assertEquals(result, []);
  });

  it("should return display labels for matching labelers", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              locales: [{ lang: "en", name: "NSFW Content" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getPostLabels(post);

    assertEquals(result.length, 1);
    assertEquals(result[0].displayName, "NSFW Content");
  });
});

await t.run();
