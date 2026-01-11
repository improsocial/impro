import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  Preferences,
  PreferencesProvider,
} from "../../src/js/dataLayer/preferencesProvider.js";

const t = new TestSuite("PreferencesProvider");

t.describe("Preferences.createLoggedOutPreferences", (it) => {
  it("should create preferences with discover feed pinned", () => {
    const preferences = Preferences.createLoggedOutPreferences();

    assertEquals(preferences.obj.length, 1);
    assertEquals(
      preferences.obj[0].$type,
      "app.bsky.actor.defs#savedFeedsPrefV2"
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
      "app.bsky.actor.defs#mutedWordsPref"
    );

    assertEquals(result.$type, "app.bsky.actor.defs#mutedWordsPref");
  });

  it("should return undefined when type not found", () => {
    const obj = [{ $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] }];

    const result = Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#nonExistent"
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

t.describe("Preferences.textHasMutedWord", (it) => {
  it("should return true when text contains muted word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.textHasMutedWord("This is spam content");

    assertEquals(result, true);
  });

  it("should be case insensitive", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "SPAM" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.textHasMutedWord("This is spam content");

    assertEquals(result, true);
  });

  it("should return false when no muted words match", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.textHasMutedWord("This is normal content");

    assertEquals(result, false);
  });

  it("should return false when no muted words preference", () => {
    const preferences = new Preferences([], []);
    const result = preferences.textHasMutedWord("This is spam content");

    assertEquals(result, false);
  });

  it("should ignore expired muted words", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", expiresAt: pastDate }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.textHasMutedWord("This is spam content");

    assertEquals(result, false);
  });

  it("should include non-expired muted words", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam", expiresAt: futureDate }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const result = preferences.textHasMutedWord("This is spam content");

    assertEquals(result, true);
  });
});

t.describe("Preferences.postHasMutedWord", (it) => {
  it("should return true when post text contains muted word", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = { record: { text: "This is spam content" } };
    const result = preferences.postHasMutedWord(post);

    assertEquals(result, true);
  });

  it("should return false when post has no text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const post = { record: {} };
    const result = preferences.postHasMutedWord(post);

    assertEquals(result, false);
  });

  it("should return false when post is null", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
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
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const quotedPost = { value: { text: "This is spam content" } };
    const result = preferences.quotedPostHasMutedWord(quotedPost);

    assertEquals(result, true);
  });

  it("should return false when quoted post has no text", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [{ value: "spam" }],
      },
    ];

    const preferences = new Preferences(obj, []);
    const quotedPost = { value: {} };
    const result = preferences.quotedPostHasMutedWord(quotedPost);

    assertEquals(result, false);
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

t.describe("PreferencesProvider", (it) => {
  it("should throw when requirePreferences called before fetch", () => {
    const mockApi = { isAuthenticated: true };
    const provider = new PreferencesProvider(mockApi);

    let error = null;
    try {
      provider.requirePreferences();
    } catch (e) {
      error = e;
    }

    assert(error !== null);
    assertEquals(error.message, "Preferences not loaded");
  });

  it("should create logged out preferences when not authenticated", async () => {
    const mockApi = { isAuthenticated: false };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = provider.requirePreferences();
    assertEquals(preferences.obj.length, 1);
  });

  it("should fetch preferences from API when authenticated", async () => {
    const mockPreferencesObj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
    ];
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => mockPreferencesObj,
      getLabelers: async () => [],
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = provider.requirePreferences();
    assertEquals(preferences.obj, mockPreferencesObj);
  });

  it("should update preferences via API", async () => {
    let updatedObj = null;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => [],
      getLabelers: async () => [],
      updatePreferences: async (obj) => {
        updatedObj = obj;
      },
    };
    const provider = new PreferencesProvider(mockApi);
    await provider.fetchPreferences();

    const newPreferences = new Preferences(
      [{ $type: "app.bsky.actor.defs#testPref" }],
      []
    );
    await provider.updatePreferences(newPreferences);

    assertEquals(updatedObj, newPreferences.obj);
    assertEquals(provider.requirePreferences(), newPreferences);
  });
});

await t.run();
