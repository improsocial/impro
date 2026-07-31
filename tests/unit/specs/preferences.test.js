import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Preferences,
  PLUGIN_SETTINGS_PREF_TYPE,
  INSTALLED_PLUGINS_PREF_TYPE,
  SEARCH_HISTORY_PREF_TYPE,
} from "/js/preferences.js";

describe("Preferences.createLoggedOutPreferences", () => {
  it("should create preferences with discover feed pinned", () => {
    const preferences = Preferences.createLoggedOutPreferences();

    assert.deepEqual(preferences.obj.length, 1);
    assert.deepEqual(
      preferences.obj[0].$type,
      "app.bsky.actor.defs#savedFeedsPrefV2",
    );
    assert.deepEqual(preferences.obj[0].items.length, 1);
    assert.deepEqual(preferences.obj[0].items[0].pinned, true);
  });

  it("should create preferences with empty labelerDefs", () => {
    const preferences = Preferences.createLoggedOutPreferences();

    assert.deepEqual(preferences.labelerDefs, []);
  });
});

describe("Preferences.getPreferenceByType", () => {
  it("should return matching preference by type", () => {
    const obj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
      { $type: "app.bsky.actor.defs#mutedWordsPref", items: [] },
    ];

    const result = Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#mutedWordsPref",
    );

    assert.deepEqual(result.$type, "app.bsky.actor.defs#mutedWordsPref");
  });

  it("should return undefined when type not found", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];

    const result = Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#nonExistent",
    );

    assert.deepEqual(result, undefined);
  });
});

describe("Preferences.getSavedFeedsPreference", () => {
  it("should return saved feeds preference", () => {
    const obj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: ["feed1"] },
    ];

    const result = Preferences.getSavedFeedsPreference(obj);

    assert.deepEqual(result.$type, "app.bsky.actor.defs#savedFeedsPrefV2");
    assert.deepEqual(result.items, ["feed1"]);
  });
});

describe("Preferences.getMutedWordsPreference", () => {
  it("should return muted words preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "test" }],
      },
    ];

    const result = Preferences.getMutedWordsPreference(obj);

    assert.deepEqual(result.$type, "app.bsky.actor.defs#mutedWordsPref");
  });
});

describe("Preferences.getLabelerDidsFromPreferences", () => {
  it("should return labeler DIDs with default appended", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:custom1" }, { did: "did:plc:custom2" }],
      },
    ];

    const result = Preferences.getLabelerDidsFromPreferences(obj);

    assert.deepEqual(result.length, 3);
    assert.deepEqual(result[0], "did:plc:custom1");
    assert.deepEqual(result[1], "did:plc:custom2");
    assert.deepEqual(result[2], "did:plc:ar7c4by46qjdydhdevvrndac");
  });

  it("should return only default when no labelers preference", () => {
    const obj = [];

    const result = Preferences.getLabelerDidsFromPreferences(obj);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0], "did:plc:ar7c4by46qjdydhdevvrndac");
  });
});

describe("Preferences.getPinnedFeeds", () => {
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

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].value, "feed1");
    assert.deepEqual(result[1].value, "feed3");
  });

  it("should return empty array when no saved feeds preference", () => {
    const preferences = new Preferences([], []);
    const result = preferences.getPinnedFeeds();

    assert.deepEqual(result, []);
  });
});

describe("Preferences.isFeedPinned", () => {
  it("should return true for a pinned feed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [
          { id: "1", value: "feed1", pinned: true },
          { id: "2", value: "feed2", pinned: false },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert(preferences.isFeedPinned("feed1"));
  });

  it("should return false for an unpinned feed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [
          { id: "1", value: "feed1", pinned: true },
          { id: "2", value: "feed2", pinned: false },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert(!preferences.isFeedPinned("feed2"));
  });

  it("should return false for a feed not in preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: true }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert(!preferences.isFeedPinned("nonexistent"));
  });

  it("should return false when no saved feeds preference exists", () => {
    const preferences = new Preferences([], []);

    assert(!preferences.isFeedPinned("feed1"));
  });
});

describe("Preferences.unpinFeed", () => {
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
    assert.deepEqual(preferences.getPinnedFeeds().length, 1);

    // New preferences should have feed unpinned
    assert.deepEqual(newPreferences.getPinnedFeeds().length, 0);
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

    assert.deepEqual(newPreferences.getPinnedFeeds().length, 1);
  });
});

describe("Preferences.pinFeed", () => {
  it("should pin existing feed", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [{ id: "1", value: "feed1", pinned: false }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.pinFeed("feed1");

    assert.deepEqual(newPreferences.getPinnedFeeds().length, 1);
    assert.deepEqual(newPreferences.getPinnedFeeds()[0].value, "feed1");
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
    assert.deepEqual(preferences.getPinnedFeeds().length, 0);

    // New preferences should have the feed pinned
    assert.deepEqual(newPreferences.getPinnedFeeds().length, 1);
  });
});

describe("Preferences.setPinnedItems", () => {
  const buildObj = () => [
    {
      $type: "app.bsky.actor.defs#savedFeedsPrefV2",
      items: [
        { id: "1", value: "following", type: "timeline", pinned: true },
        { id: "2", value: "feed-a", type: "feed", pinned: true },
        { id: "3", value: "list-a", type: "list", pinned: true },
        { id: "4", value: "feed-unpinned", type: "feed", pinned: false },
      ],
    },
  ];

  it("reorders the pinned slice and preserves unpinned entries at the end", () => {
    const preferences = new Preferences(buildObj(), []);
    const newPreferences = preferences.setPinnedItems([
      "list-a",
      "following",
      "feed-a",
    ]);
    const items = Preferences.getSavedFeedsPreference(newPreferences.obj).items;
    assert.deepEqual(
      items.map((it) => it.value),
      ["list-a", "following", "feed-a", "feed-unpinned"],
    );
  });

  it("does not mutate the original preferences", () => {
    const preferences = new Preferences(buildObj(), []);
    preferences.setPinnedItems(["feed-a", "following", "list-a"]);
    const items = Preferences.getSavedFeedsPreference(preferences.obj).items;
    assert.deepEqual(
      items.map((it) => it.value),
      ["following", "feed-a", "list-a", "feed-unpinned"],
    );
  });

  it("drops unknown values silently and pins listed unpinned items", () => {
    const preferences = new Preferences(buildObj(), []);
    const newPreferences = preferences.setPinnedItems([
      "feed-a",
      "unknown-value",
      "feed-unpinned",
      "following",
      "list-a",
    ]);
    const items = Preferences.getSavedFeedsPreference(newPreferences.obj).items;
    assert.deepEqual(
      items.map((it) => ({ value: it.value, pinned: it.pinned })),
      [
        { value: "feed-a", pinned: true },
        { value: "feed-unpinned", pinned: true },
        { value: "following", pinned: true },
        { value: "list-a", pinned: true },
      ],
    );
  });

  it("unpins currently-pinned items that are omitted from the target list", () => {
    const preferences = new Preferences(buildObj(), []);
    const newPreferences = preferences.setPinnedItems(["following", "list-a"]);
    const items = Preferences.getSavedFeedsPreference(newPreferences.obj).items;
    assert.deepEqual(
      items.map((it) => ({ value: it.value, pinned: it.pinned })),
      [
        { value: "following", pinned: true },
        { value: "list-a", pinned: true },
        { value: "feed-a", pinned: false },
        { value: "feed-unpinned", pinned: false },
      ],
    );
  });
});

describe("Preferences.getLabelerDids", () => {
  it("should return labeler DIDs from preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:test" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getLabelerDids();

    assert.deepEqual(result.includes("did:plc:test"), true);
    assert.deepEqual(result.includes("did:plc:ar7c4by46qjdydhdevvrndac"), true);
  });
});

describe("Preferences.getMutedWords", () => {
  it("should return muted words items", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { id: "1", value: "test", targets: ["content"], actorTarget: "all" },
          { id: "2", value: "spoiler", targets: ["tag"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.getMutedWords();

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].value, "test");
    assert.deepEqual(result[1].value, "spoiler");
  });

  it("should return empty array when no muted words preference exists", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];

    const preferences = new Preferences(obj, []);
    const result = preferences.getMutedWords();

    assert.deepEqual(result.length, 0);
  });
});

describe("Preferences.addMutedWord", () => {
  it("should add a muted word to existing preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            id: "1",
            value: "existing",
            targets: ["content"],
            actorTarget: "all",
          },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.addMutedWord({
      value: "newword",
      targets: ["content", "tag"],
      actorTarget: "all",
    });

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words.length, 2);
    assert.deepEqual(words[1].value, "newword");
    assert.deepEqual(words[1].targets.length, 2);
    assert.deepEqual(words[1].actorTarget, "all");
    assert(words[1].id !== undefined);
  });

  it("should create mutedWordsPref when it does not exist", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.addMutedWord({
      value: "newword",
      targets: ["tag"],
      actorTarget: "exclude-following",
    });

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].value, "newword");
    assert.deepEqual(words[0].targets[0], "tag");
    assert.deepEqual(words[0].actorTarget, "exclude-following");
  });

  it("should store expiresAt when provided", () => {
    const obj = [];
    const preferences = new Preferences(obj, []);
    const expiresAt = "2026-05-01T00:00:00.000Z";

    const newPreferences = preferences.addMutedWord({
      value: "temp",
      targets: ["content"],
      actorTarget: "all",
      expiresAt,
    });

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words[0].expiresAt, expiresAt);
  });

  it("should not modify original preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            id: "1",
            value: "existing",
            targets: ["content"],
            actorTarget: "all",
          },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    preferences.addMutedWord({
      value: "newword",
      targets: ["content"],
      actorTarget: "all",
    });

    assert.deepEqual(preferences.getMutedWords().length, 1);
  });
});

describe("Preferences.removeMutedWord", () => {
  it("should remove a muted word by id", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { id: "1", value: "keep", targets: ["content"], actorTarget: "all" },
          { id: "2", value: "remove", targets: ["tag"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.removeMutedWord("2");

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].value, "keep");
  });

  it("should not modify original preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { id: "1", value: "word", targets: ["content"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    preferences.removeMutedWord("1");

    assert.deepEqual(preferences.getMutedWords().length, 1);
  });

  it("should handle removing non-existent id gracefully", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { id: "1", value: "word", targets: ["content"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.removeMutedWord("nonexistent");

    assert.deepEqual(newPreferences.getMutedWords().length, 1);
  });

  it("should return clone when no mutedWordsPref exists", () => {
    const obj = [];
    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.removeMutedWord("1");

    assert.deepEqual(newPreferences.getMutedWords().length, 0);
  });
});

describe("Preferences.updateMutedWord", () => {
  it("should update a muted word by id", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            id: "1",
            value: "word",
            targets: ["content"],
            actorTarget: "all",
            expiresAt: "2025-01-01T00:00:00.000Z",
          },
          { id: "2", value: "other", targets: ["tag"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.updateMutedWord("1", {
      expiresAt: "2026-06-01T00:00:00.000Z",
    });

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words.length, 2);
    assert.deepEqual(words[0].expiresAt, "2026-06-01T00:00:00.000Z");
    assert.deepEqual(words[0].value, "word");
    assert.deepEqual(words[1].value, "other");
  });

  it("should not modify original preferences", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          {
            id: "1",
            value: "word",
            targets: ["content"],
            actorTarget: "all",
            expiresAt: "2025-01-01T00:00:00.000Z",
          },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    preferences.updateMutedWord("1", {
      expiresAt: "2026-06-01T00:00:00.000Z",
    });

    assert.deepEqual(
      preferences.getMutedWords()[0].expiresAt,
      "2025-01-01T00:00:00.000Z",
    );
  });

  it("should handle updating non-existent id gracefully", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [
          { id: "1", value: "word", targets: ["content"], actorTarget: "all" },
        ],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.updateMutedWord("nonexistent", {
      expiresAt: "2026-06-01T00:00:00.000Z",
    });

    const words = newPreferences.getMutedWords();
    assert.deepEqual(words.length, 1);
    assert.deepEqual(words[0].expiresAt, undefined);
  });

  it("should return clone when no mutedWordsPref exists", () => {
    const obj = [];
    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.updateMutedWord("1", {
      expiresAt: "2026-06-01T00:00:00.000Z",
    });

    assert.deepEqual(newPreferences.getMutedWords().length, 0);
  });
});

describe("Preferences.hasMutedWord", () => {
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
  });
});

describe("Preferences.hasMutedWord - word boundary matching", () => {
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
    assert.deepEqual(
      hasMutedWord(preferences, "I love category theory"),
      false,
    );
    assert.deepEqual(
      hasMutedWord(preferences, "concatenate these strings"),
      false,
    );
    assert.deepEqual(
      hasMutedWord(preferences, "The vacation was great"),
      false,
    );
  });

  it("should match when muted word appears as a standalone word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "cat", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert.deepEqual(hasMutedWord(preferences, "I love my cat"), true);
    assert.deepEqual(hasMutedWord(preferences, "cat is cute"), true);
    assert.deepEqual(hasMutedWord(preferences, "the cat sat"), true);
  });

  it("should use substring matching for single character muted words", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "x", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert.deepEqual(hasMutedWord(preferences, "example text"), true);
    assert.deepEqual(hasMutedWord(preferences, "no match here"), false);
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
    assert.deepEqual(hasMutedWord(preferences, "testing", ["ja"]), true); // Japanese
    assert.deepEqual(hasMutedWord(preferences, "testing", ["zh"]), true); // Chinese
    assert.deepEqual(hasMutedWord(preferences, "testing", ["ko"]), true); // Korean
    assert.deepEqual(hasMutedWord(preferences, "testing", ["th"]), true); // Thai
    assert.deepEqual(hasMutedWord(preferences, "testing", ["vi"]), true); // Vietnamese

    // Non-exception languages should use word boundary matching
    assert.deepEqual(hasMutedWord(preferences, "testing", ["en"]), false);
    assert.deepEqual(hasMutedWord(preferences, "testing", []), false);
  });

  it("should use substring matching for phrases with spaces", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "bad phrase", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert.deepEqual(
      hasMutedWord(preferences, "this is a bad phrase here"),
      true,
    );
    assert.deepEqual(hasMutedWord(preferences, "bad phrase at start"), true);
    assert.deepEqual(hasMutedWord(preferences, "ends with bad phrase"), true);
    assert.deepEqual(
      hasMutedWord(preferences, "bad and phrase separate"),
      false,
    );
  });

  it("should strip leading and trailing punctuation when matching", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "hello", targets: ["content"] }],
      },
    ];

    const preferences = new Preferences(obj, []);

    assert.deepEqual(hasMutedWord(preferences, "...hello..."), true);
    assert.deepEqual(hasMutedWord(preferences, '"hello"'), true);
    assert.deepEqual(hasMutedWord(preferences, "(hello)"), true);
    assert.deepEqual(hasMutedWord(preferences, "hello!"), true);
    assert.deepEqual(hasMutedWord(preferences, "!hello"), true);
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
    assert.deepEqual(hasMutedWord(preferences, "I don't know"), true);
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
    assert.deepEqual(hasMutedWord(preferences, "this and/or that"), false);
    // But standalone "and" should still match
    assert.deepEqual(hasMutedWord(preferences, "this and that"), true);
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

    assert.deepEqual(hasMutedWord(preferences, "this is spam"), true);
    assert.deepEqual(hasMutedWord(preferences, "this is a scam"), true);
    assert.deepEqual(hasMutedWord(preferences, "normal content"), false);
  });
});

describe("Preferences.postHasMutedWord", () => {
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, false);
  });
});

describe("Preferences.quotedPostHasMutedWord", () => {
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
  });
});

describe("Preferences.hasMutedWord - embed text matching", () => {
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
  });

  it("should not check embed when target is tags only", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tag"] }],
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

    assert.deepEqual(result, false);
  });
});

describe("Preferences.hasMutedWord - tag matching", () => {
  it("should match muted word in hashtag", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tag"] }],
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

    assert.deepEqual(result, true);
  });

  it("should not match text when target is tags only", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["tag"] }],
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

    assert.deepEqual(result, false);
  });

  it("should match both text and tags when both targets specified", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", targets: ["content", "tag"] }],
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
    assert.deepEqual(textResult, true);

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
    assert.deepEqual(tagResult, true);
  });
});

describe("Preferences.hasMutedWord - exclude-following", () => {
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

    assert.deepEqual(result, false);
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

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, true);
  });
});

describe("Preferences.isSubscribedToLabeler", () => {
  it("should return true when subscribed to labeler", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }, { did: "did:plc:labeler2" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.isSubscribedToLabeler("did:plc:labeler1");

    assert.deepEqual(result, true);
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

    assert.deepEqual(result, false);
  });

  it("should return false when no labeler preference exists", () => {
    const preferences = new Preferences([], []);
    const result = preferences.isSubscribedToLabeler("did:plc:labeler1");

    assert.deepEqual(result, false);
  });
});

describe("Preferences.subscribeLabeler", () => {
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

    assert.deepEqual(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
    assert.deepEqual(
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

    assert.deepEqual(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
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
    assert.deepEqual(labelerPref.labelers.length, 1);
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
    assert.deepEqual(preferences.isSubscribedToLabeler("did:plc:new"), false);
    // New should have the labeler
    assert.deepEqual(newPreferences.isSubscribedToLabeler("did:plc:new"), true);
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

    assert.deepEqual(newPreferences.labelerDefs.length, 1);
    assert.deepEqual(newPreferences.labelerDefs[0].creator.did, "did:plc:new");
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

    assert.deepEqual(newPreferences.labelerDefs.length, 1);
  });
});

describe("Preferences.unsubscribeLabeler", () => {
  it("should remove labeler from labelers preference", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [{ did: "did:plc:labeler1" }, { did: "did:plc:labeler2" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const newPreferences = preferences.unsubscribeLabeler("did:plc:labeler1");

    assert.deepEqual(
      newPreferences.isSubscribedToLabeler("did:plc:labeler1"),
      false,
    );
    assert.deepEqual(
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
    assert.deepEqual(
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
    assert.deepEqual(
      preferences.isSubscribedToLabeler("did:plc:labeler1"),
      true,
    );
    // New should have the labeler removed
    assert.deepEqual(
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

    assert.deepEqual(newPreferences.labelerDefs.length, 1);
    assert.deepEqual(
      newPreferences.labelerDefs[0].creator.did,
      "did:plc:labeler2",
    );
  });
});

describe("Preferences.clone", () => {
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
    assert.deepEqual(preferences.obj[0].items[0].pinned, true);
  });
});

describe("Preferences.getFollowingFeedPreference", () => {
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

    assert.deepEqual(result.$type, "app.bsky.actor.defs#feedViewPref");
    assert.deepEqual(result.feed, "home");
    assert.deepEqual(result.hideReplies, true);
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

    assert.deepEqual(result, null);
  });
});

describe("Preferences.getBadgeLabelsForPost", () => {
  it("should return empty array when post has no labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getBadgeLabelsForPost(post);

    assert.deepEqual(result, []);
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
    const result = preferences.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "verified");
    assert.deepEqual(result[0].labeler.creator.did, "did:labeler1");
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
    const result = preferences.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
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
    const result = preferences.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
  });
});

describe("Preferences.getBadgeLabelsForProfile", () => {
  const labelerDefs = [
    {
      creator: { did: "did:labeler1", handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          {
            identifier: "spam",
            blurs: "none",
            severity: "inform",
            locales: [{ lang: "en", name: "Spam" }],
          },
          {
            identifier: "nsfw",
            blurs: "content",
            locales: [{ lang: "en", name: "NSFW" }],
          },
          {
            identifier: "impersonation",
            blurs: "content",
            severity: "alert",
            locales: [{ lang: "en", name: "Impersonation" }],
          },
        ],
      },
    },
  ];

  it("should return empty array when profile has no labels", () => {
    const preferences = new Preferences([], labelerDefs);
    const result = preferences.getBadgeLabelsForProfile({ labels: [] });

    assert.deepEqual(result, []);
  });

  it("should return empty array when profile labels are missing", () => {
    const preferences = new Preferences([], labelerDefs);
    const result = preferences.getBadgeLabelsForProfile({});

    assert.deepEqual(result, []);
  });

  it("should return badge labels on the profile", () => {
    const preferences = new Preferences([], labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "spam" }],
    };
    const result = preferences.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "spam");
    assert.deepEqual(result[0].labeler.creator.did, "did:labeler1");
  });

  it("should not return blur labels without alert/inform severity", () => {
    const preferences = new Preferences([], labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });

  it("should return blur labels with alert/inform severity", () => {
    const preferences = new Preferences([], labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "impersonation" }],
    };
    const result = preferences.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "impersonation");
  });

  it("should not return blur labels as badges on posts", () => {
    const preferences = new Preferences([], labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "impersonation" }],
    };
    const result = preferences.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
  });

  it("should skip labels from unknown labelers", () => {
    const preferences = new Preferences([], labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler-unknown", val: "spam" }],
    };
    const result = preferences.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });

  it("should not return labels the user set to ignore", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "spam",
        labelerDid: "did:labeler1",
        visibility: "ignore",
      },
    ];
    const preferences = new Preferences(obj, labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "spam" }],
    };
    const result = preferences.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });
});

describe("Preferences.getContentLabel", () => {
  it("should return null when post has no content labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getContentLabel(post);

    assert.deepEqual(result, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nsfw");
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

    assert.deepEqual(result.visibility, "warn");
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "label2");
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

    assert.deepEqual(result, null);
  });
});

describe("Preferences.getMediaLabel", () => {
  it("should return null when post has no media labels", () => {
    const preferences = new Preferences([], []);
    const post = { labels: [] };
    const result = preferences.getMediaLabel(post);

    assert.deepEqual(result, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nudity_custom");
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

    assert.deepEqual(result, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });
});

describe("Preferences.getProfileBlurLabel", () => {
  it("should return null when author has no labels", () => {
    const preferences = new Preferences([], []);
    const author = { labels: [] };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should return null when author is undefined", () => {
    const preferences = new Preferences([], []);
    const result = preferences.getProfileBlurLabel(undefined);

    assert.deepEqual(result, null);
  });

  it("should return entry for the !hide global label", () => {
    const preferences = new Preferences([], []);
    const author = {
      labels: [{ src: "did:plc:author", val: "!hide" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
  });

  it("should return entry for the porn global label (default hide)", () => {
    const preferences = new Preferences([], []);
    const author = {
      labels: [{ src: "did:plc:author", val: "porn" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });

  it("should return null for nudity (default ignore)", () => {
    const preferences = new Preferences([], []);
    const author = {
      labels: [{ src: "did:plc:author", val: "nudity" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should respect labeler-defined blur labels when subscribed", () => {
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
    const author = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "nsfw");
  });

  it("should skip labeler-defined labels when labeler is not subscribed", () => {
    const preferences = new Preferences([], []);
    const author = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should skip badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const author = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should return the most restrictive label (hide over warn)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "soft",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Soft" }],
            },
            {
              identifier: "hard",
              blurs: "media",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Hard" }],
            },
          ],
        },
      },
    ];

    const preferences = new Preferences([], labelerDefs);
    const author = {
      labels: [
        { src: "did:labeler1", val: "soft" },
        { src: "did:labeler1", val: "hard" },
      ],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "hard");
  });

  it("should respect user preference upgrading nudity from ignore to hide", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nudity",
        labelerDid: null,
        visibility: "hide",
      },
    ];

    const preferences = new Preferences(obj, []);
    const author = {
      labels: [{ src: "did:plc:author", val: "nudity" }],
    };
    const result = preferences.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nudity");
  });
});

describe("Preferences.getContentLabelPref", () => {
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

    assert.deepEqual(result.label, "nsfw");
    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelerDid, labelerDid);
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

    assert.deepEqual(result, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelerDid, "did:plc:labeler2");
  });
});

describe("Preferences.setContentLabelPref", () => {
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
    assert.deepEqual(result.label, "nsfw");
    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelerDid, labelerDid);
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
    assert.deepEqual(result.visibility, "hide");
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
    assert.deepEqual(
      preferences.getContentLabelPref({ label: "nsfw", labelerDid }),
      null,
    );
    // New should have the pref
    assert.deepEqual(
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
    assert.deepEqual(prefs.length, 1);
    assert.deepEqual(prefs[0].$type, "app.bsky.actor.defs#contentLabelPref");
  });
});

describe("Preferences.getLabelerSettings", () => {
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

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].label, "nsfw");
    assert.deepEqual(result[1].label, "gore");
  });

  it("should return empty array when no settings exist", () => {
    const preferences = new Preferences([], []);
    const result = preferences.getLabelerSettings("did:plc:testlabeler");

    assert.deepEqual(result.length, 0);
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

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].label, "nsfw");
    assert.deepEqual(result[0].labelerDid, labelerDid1);
  });
});

describe("Preferences.getContentLabelPreferences", () => {
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

    assert.deepEqual(result.length, 2);
    assert.deepEqual(result[0].label, "nsfw");
    assert.deepEqual(result[1].label, "gore");
  });

  it("should return empty array when no content label preferences exist", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#savedFeedsPrefV2",
        items: [],
      },
    ];

    const result = Preferences.getContentLabelPreferences(obj);

    assert.deepEqual(result.length, 0);
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

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].$type, "app.bsky.actor.defs#contentLabelPref");
  });
});

describe("Preferences.getContentLabel - global labels", () => {
  it("should handle !hide global label with forced hide visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!hide" }],
    };
    const result = preferences.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
    assert.deepEqual(result.labeler, null);
  });

  it("should handle !warn global label with forced warn visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = preferences.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "!warn");
    assert.deepEqual(result.labeler, null);
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

    assert.deepEqual(result.visibility, "hide");
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

    assert.deepEqual(result.visibility, "warn");
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
  });
});

describe("Preferences.getMediaLabel - global self-labels", () => {
  it("should handle porn self-label with default hide visibility", () => {
    const preferences = new Preferences([], []);
    // Self-labels have src = author's DID, not a labeler's DID
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "porn" }],
    };
    const result = preferences.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
    assert.deepEqual(result.labeler, null);
  });

  it("should handle sexual self-label with default warn visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "sexual" }],
    };
    const result = preferences.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "sexual");
  });

  it("should handle nudity self-label with default ignore visibility", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "nudity" }],
    };
    const result = preferences.getMediaLabel(post);

    // nudity defaults to "ignore", so should return null
    assert.deepEqual(result, null);
  });

  it("should handle graphic-media self-label", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "graphic-media" }],
    };
    const result = preferences.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "graphic-media");
  });

  it("should handle legacy gore label", () => {
    const preferences = new Preferences([], []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "gore" }],
    };
    const result = preferences.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "gore");
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

    assert.deepEqual(result.visibility, "warn");
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });
});

describe("Preferences.getContentLabel - mixed global and custom labels", () => {
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

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "custom-warn");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
    assert.deepEqual(result.labeler, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-hide");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
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

    assert.deepEqual(result.visibility, "warn");
    // Should be the first warn encountered
    assert.deepEqual(result.labelDefinition.identifier, "!warn");
  });
});

describe("Preferences.getMediaLabel - mixed global and custom labels", () => {
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
    assert.deepEqual(result.labeler, null);
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-media-hide");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
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

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-media");
  });
});

describe("Preferences plugin settings", () => {
  it("returns null when no settings record exists", () => {
    const preferences = new Preferences([], []);
    assert.deepEqual(preferences.getPluginSettings("my-plugin"), null);
  });

  it("returns stored data for a plugin", () => {
    const obj = [
      {
        $type: PLUGIN_SETTINGS_PREF_TYPE,
        pluginId: "my-plugin",
        data: { foo: "bar" },
      },
    ];
    const preferences = new Preferences(obj, []);
    assert.deepEqual(preferences.getPluginSettings("my-plugin"), {
      foo: "bar",
    });
  });

  it("does not return data scoped to a different plugin", () => {
    const obj = [
      {
        $type: PLUGIN_SETTINGS_PREF_TYPE,
        pluginId: "plugin-a",
        data: { foo: "bar" },
      },
    ];
    const preferences = new Preferences(obj, []);
    assert.deepEqual(preferences.getPluginSettings("plugin-b"), null);
  });

  it("inserts a new record when none exists", () => {
    const preferences = new Preferences([], []);
    const updated = preferences.setPluginSettings("my-plugin", { count: 1 });
    assert.deepEqual(updated.getPluginSettings("my-plugin"), { count: 1 });
    // Original unchanged
    assert.deepEqual(preferences.getPluginSettings("my-plugin"), null);
  });

  it("updates an existing record", () => {
    const preferences = new Preferences([], []).setPluginSettings("my-plugin", {
      count: 1,
    });
    const updated = preferences.setPluginSettings("my-plugin", { count: 2 });
    assert.deepEqual(updated.getPluginSettings("my-plugin"), { count: 2 });
    // Only one record stored
    const records = updated.obj.filter(
      (pref) => pref.$type === PLUGIN_SETTINGS_PREF_TYPE,
    );
    assert.deepEqual(records.length, 1);
  });

  it("keeps settings for multiple plugins isolated", () => {
    const updated = new Preferences([], [])
      .setPluginSettings("plugin-a", { a: 1 })
      .setPluginSettings("plugin-b", { b: 2 });
    assert.deepEqual(updated.getPluginSettings("plugin-a"), { a: 1 });
    assert.deepEqual(updated.getPluginSettings("plugin-b"), { b: 2 });
  });

  it("clears settings for a single plugin", () => {
    const preferences = new Preferences([], [])
      .setPluginSettings("plugin-a", { a: 1 })
      .setPluginSettings("plugin-b", { b: 2 });
    const updated = preferences.clearPluginSettings("plugin-a");
    assert.deepEqual(updated.getPluginSettings("plugin-a"), null);
    assert.deepEqual(updated.getPluginSettings("plugin-b"), { b: 2 });
    // Original unchanged
    assert.deepEqual(preferences.getPluginSettings("plugin-a"), { a: 1 });
  });

  it("is a no-op when clearing settings for an unknown plugin", () => {
    const preferences = new Preferences([], []).setPluginSettings("plugin-a", {
      a: 1,
    });
    const updated = preferences.clearPluginSettings("plugin-b");
    assert.deepEqual(updated.getPluginSettings("plugin-a"), { a: 1 });
  });
});

describe("Preferences installed plugins", () => {
  it("returns empty array when no record exists", () => {
    const preferences = new Preferences([], []);
    assert.deepEqual(preferences.getInstalledPlugins(), []);
  });

  it("returns stored plugins list", () => {
    const obj = [
      {
        $type: INSTALLED_PLUGINS_PREF_TYPE,
        plugins: [
          { id: "alpha", version: "1.0.0", enabled: true },
          { id: "beta", version: "2.0.0", enabled: false },
        ],
      },
    ];
    const preferences = new Preferences(obj, []);
    assert.deepEqual(preferences.getInstalledPlugins(), [
      { id: "alpha", version: "1.0.0", enabled: true },
      { id: "beta", version: "2.0.0", enabled: false },
    ]);
  });

  it("inserts a new record when none exists", () => {
    const preferences = new Preferences([], []);
    const updated = preferences.setInstalledPlugins([
      { id: "alpha", version: "1.0.0", enabled: true },
    ]);
    assert.deepEqual(updated.getInstalledPlugins(), [
      { id: "alpha", version: "1.0.0", enabled: true },
    ]);
    // Original unchanged
    assert.deepEqual(preferences.getInstalledPlugins(), []);
  });

  it("updates an existing record without duplicating", () => {
    const preferences = new Preferences([], []).setInstalledPlugins([
      { id: "alpha", version: "1.0.0", enabled: true },
    ]);
    const updated = preferences.setInstalledPlugins([
      { id: "alpha", version: "1.1.0", enabled: true },
    ]);
    assert.deepEqual(updated.getInstalledPlugins(), [
      { id: "alpha", version: "1.1.0", enabled: true },
    ]);
    const records = updated.obj.filter(
      (pref) => pref.$type === INSTALLED_PLUGINS_PREF_TYPE,
    );
    assert.deepEqual(records.length, 1);
  });
});

describe("Preferences recent searches", () => {
  const buildObj = (searches) => [
    {
      $type: SEARCH_HISTORY_PREF_TYPE,
      searches,
    },
  ];

  it("returns empty array when no search history preference exists", () => {
    const preferences = new Preferences([], []);
    assert.deepEqual(preferences.getRecentSearches(), []);
  });

  it("adds a search and reads it back newest first", () => {
    const preferences = new Preferences([], [])
      .addRecentSearch("cats")
      .addRecentSearch("dogs");
    const searches = preferences.getRecentSearches();
    assert.deepEqual(
      searches.map((entry) => entry.q),
      ["dogs", "cats"],
    );
    assert(typeof searches[0].ts === "number");
    assert(searches[0].ts > 0);
  });

  it("creates the preference on first add", () => {
    const preferences = new Preferences([], []);
    const updated = preferences.addRecentSearch("cats");
    const pref = Preferences.getSearchHistoryPreference(updated.obj);
    assert.deepEqual(pref.$type, SEARCH_HISTORY_PREF_TYPE);
    assert.deepEqual(pref.searches.length, 1);
    // Original unchanged
    assert.deepEqual(preferences.getRecentSearches(), []);
  });

  it("trims the query and ignores empty/whitespace queries", () => {
    const preferences = new Preferences([], [])
      .addRecentSearch("  cats  ")
      .addRecentSearch("")
      .addRecentSearch("   ")
      .addRecentSearch(null);
    const searches = preferences.getRecentSearches();
    assert.deepEqual(
      searches.map((entry) => entry.q),
      ["cats"],
    );
  });

  it("clamps overlong queries", () => {
    const preferences = new Preferences([], []).addRecentSearch(
      "a".repeat(500),
    );
    assert.deepEqual(preferences.getRecentSearches()[0].q, "a".repeat(300));
  });

  it("dedupes by moving an existing query to the front", () => {
    const preferences = new Preferences([], [])
      .addRecentSearch("cats")
      .addRecentSearch("dogs")
      .addRecentSearch("cats");
    assert.deepEqual(
      preferences.getRecentSearches().map((entry) => entry.q),
      ["cats", "dogs"],
    );
  });

  it("caps stored searches at 5, dropping the oldest", () => {
    let preferences = new Preferences([], []);
    for (let i = 1; i <= 7; i++) {
      preferences = preferences.addRecentSearch(`query ${i}`);
    }
    const searches = preferences.getRecentSearches();
    assert.deepEqual(searches.length, 5);
    assert.deepEqual(searches[0].q, "query 7");
    assert.deepEqual(searches[4].q, "query 3");
  });

  it("removes a search by query", () => {
    const preferences = new Preferences([], [])
      .addRecentSearch("cats")
      .addRecentSearch("dogs");
    const updated = preferences.removeRecentSearch("cats");
    assert.deepEqual(
      updated.getRecentSearches().map((entry) => entry.q),
      ["dogs"],
    );
    // Original unchanged
    assert.deepEqual(preferences.getRecentSearches().length, 2);
  });

  it("handles removing an absent query gracefully", () => {
    const preferences = new Preferences([], []).addRecentSearch("cats");
    const updated = preferences.removeRecentSearch("dogs");
    assert.deepEqual(updated.getRecentSearches().length, 1);
    const noPref = new Preferences([], []).removeRecentSearch("cats");
    assert.deepEqual(noPref.getRecentSearches(), []);
  });

  it("drops malformed entries on read", () => {
    const preferences = new Preferences(
      buildObj([
        { q: "valid", ts: 123 },
        { q: "", ts: 1 },
        { q: "   ", ts: 1 },
        { q: 42, ts: 1 },
        { ts: 1 },
        null,
        "bare string",
      ]),
      [],
    );
    const searches = preferences.getRecentSearches();
    assert.deepEqual(searches.length, 1);
    assert.deepEqual(searches[0].q, "valid");
  });

  it("returns empty array when searches is not an array", () => {
    const preferences = new Preferences(buildObj("not an array"), []);
    assert.deepEqual(preferences.getRecentSearches(), []);
  });

  it("coerces non-numeric ts to 0 on read", () => {
    const preferences = new Preferences(
      buildObj([{ q: "cats", ts: "soon" }, { q: "dogs" }]),
      [],
    );
    const searches = preferences.getRecentSearches();
    assert.deepEqual(searches[0].ts, 0);
    assert.deepEqual(searches[1].ts, 0);
  });

  it("preserves unknown entry keys through unrelated mutations", () => {
    const preferences = new Preferences(
      buildObj([{ q: "cats", ts: 123, filters: { lang: "en" } }]),
      [],
    );
    const updated = preferences.addRecentSearch("dogs");
    const pref = Preferences.getSearchHistoryPreference(updated.obj);
    assert.deepEqual(pref.searches[1], {
      q: "cats",
      ts: 123,
      filters: { lang: "en" },
    });
  });

  it("leaves other preference types untouched", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];
    const preferences = new Preferences(obj, []);
    const updated = preferences.addRecentSearch("cats");
    assert.deepEqual(
      Preferences.getSavedFeedsPreference(updated.obj).items,
      [],
    );
    assert.deepEqual(updated.obj.length, 2);
  });
});

describe("Preferences recent search profiles", () => {
  it("returns empty array when no search history preference exists", () => {
    const preferences = new Preferences([], []);
    assert.deepEqual(preferences.getRecentSearchProfiles(), []);
  });

  it("adds profiles newest first and dedupes by DID", () => {
    const preferences = new Preferences([], [])
      .addRecentSearchProfile("did:plc:aaa")
      .addRecentSearchProfile("did:plc:bbb")
      .addRecentSearchProfile("did:plc:aaa");
    assert.deepEqual(preferences.getRecentSearchProfiles(), [
      "did:plc:aaa",
      "did:plc:bbb",
    ]);
  });

  it("caps stored profiles at 10", () => {
    let preferences = new Preferences([], []);
    for (let i = 1; i <= 12; i++) {
      preferences = preferences.addRecentSearchProfile(`did:plc:profile${i}`);
    }
    const profiles = preferences.getRecentSearchProfiles();
    assert.deepEqual(profiles.length, 10);
    assert.deepEqual(profiles[0], "did:plc:profile12");
    assert.deepEqual(profiles[9], "did:plc:profile3");
  });

  it("removes a profile by DID without mutating the original", () => {
    const preferences = new Preferences([], [])
      .addRecentSearchProfile("did:plc:aaa")
      .addRecentSearchProfile("did:plc:bbb");
    const updated = preferences.removeRecentSearchProfile("did:plc:bbb");
    assert.deepEqual(updated.getRecentSearchProfiles(), ["did:plc:aaa"]);
    assert.deepEqual(preferences.getRecentSearchProfiles().length, 2);
  });

  it("removes multiple profiles preserving stored order", () => {
    const preferences = new Preferences([], [])
      .addRecentSearchProfile("did:plc:aaa")
      .addRecentSearchProfile("did:plc:bbb")
      .addRecentSearchProfile("did:plc:ccc");
    const updated = preferences.removeRecentSearchProfiles([
      "did:plc:bbb",
      "did:plc:absent",
    ]);
    assert.deepEqual(updated.getRecentSearchProfiles(), [
      "did:plc:ccc",
      "did:plc:aaa",
    ]);
  });

  it("shares the preference record with recent searches", () => {
    const preferences = new Preferences([], [])
      .addRecentSearch("cats")
      .addRecentSearchProfile("did:plc:aaa");
    const records = preferences.obj.filter(
      (pref) => pref.$type === SEARCH_HISTORY_PREF_TYPE,
    );
    assert.deepEqual(records.length, 1);
    assert.deepEqual(preferences.getRecentSearches().length, 1);
    assert.deepEqual(preferences.getRecentSearchProfiles().length, 1);
  });

  it("ignores invalid DID values", () => {
    const preferences = new Preferences([], [])
      .addRecentSearchProfile("")
      .addRecentSearchProfile(null);
    assert.deepEqual(preferences.getRecentSearchProfiles(), []);
  });
});
