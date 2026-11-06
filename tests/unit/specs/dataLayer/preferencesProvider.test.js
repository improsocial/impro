import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "/js/preferences.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";

describe("PreferencesProvider", () => {
  // The retry waits a second before its second attempt.
  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    globalThis.setTimeout = (callback) => realSetTimeout(callback, 0);
  });
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it("should fetch preferences when requirePreferences is called before fetch", async () => {
    let fetchCount = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        fetchCount++;
        return [];
      },
    };
    const provider = new PreferencesProvider(mockApi);

    const preferences = await provider.requirePreferences();

    assert.deepEqual(preferences.obj, []);
    assert.deepEqual(fetchCount, 1);
  });

  it("should not refetch once preferences are loaded", async () => {
    let fetchCount = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        fetchCount++;
        return [];
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.requirePreferences();
    await provider.requirePreferences();

    assert.deepEqual(fetchCount, 1);
  });

  it("should share one fetch between concurrent requirePreferences calls", async () => {
    let fetchCount = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        fetchCount++;
        return [];
      },
    };
    const provider = new PreferencesProvider(mockApi);

    const [first, second] = await Promise.all([
      provider.requirePreferences(),
      provider.requirePreferences(),
    ]);

    assert.deepEqual(fetchCount, 1);
    assert(first === second);
  });

  it("should retry once when the fetch fails", async () => {
    let attempts = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        attempts++;
        if (attempts === 1) throw new Error("500");
        return [];
      },
    };
    const provider = new PreferencesProvider(mockApi);

    const preferences = await provider.requirePreferences();

    assert.deepEqual(attempts, 2);
    assert.deepEqual(preferences.obj, []);
  });

  it("should reject when both fetch attempts fail", async () => {
    let attempts = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        attempts++;
        throw new Error("500");
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await assert.rejects(() => provider.requirePreferences());

    assert.deepEqual(attempts, 2);
  });

  it("should not remember a failed fetch", async () => {
    let attempts = 0;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        attempts++;
        throw new Error("500");
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await assert.rejects(() => provider.requirePreferences(), /500/);
    await assert.rejects(() => provider.requirePreferences(), /500/);

    assert.deepEqual(attempts, 4);
  });

  it("should recover once a later call succeeds", async () => {
    let shouldFail = true;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => {
        if (shouldFail) throw new Error("500");
        return [];
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await assert.rejects(() => provider.requirePreferences());

    shouldFail = false;
    const preferences = await provider.requirePreferences();

    assert.deepEqual(preferences.obj, []);
  });

  it("should create logged out preferences when not authenticated", async () => {
    const mockApi = { isAuthenticated: false };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = await provider.requirePreferences();
    assert.deepEqual(preferences.obj.length, 1);
  });

  it("should fetch preferences from API when authenticated", async () => {
    const mockPreferencesObj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
    ];
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => mockPreferencesObj,
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = await provider.requirePreferences();
    assert.deepEqual(preferences.obj, mockPreferencesObj);
  });

  it("should update preferences via API", async () => {
    let updatedObj = null;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => [],
      updatePreferences: async (obj) => {
        updatedObj = obj;
      },
    };
    const provider = new PreferencesProvider(mockApi);
    await provider.fetchPreferences();

    const newPreferences = new Preferences([
      { $type: "app.bsky.actor.defs#testPref" },
    ]);
    await provider.updatePreferences(newPreferences);

    assert.deepEqual(updatedObj, newPreferences.obj);
    assert.deepEqual(await provider.requirePreferences(), newPreferences);
  });
});
