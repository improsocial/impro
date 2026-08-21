import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "/js/preferences.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";

describe("PreferencesProvider", () => {
  // The retry waits a second before its second attempt.
  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    globalThis.setTimeout = (callback) => realSetTimeout(callback, 0);
    for (const toast of document.querySelectorAll('[data-testid="toast"]')) {
      toast.remove();
    }
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
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
      getLabelers: async () => [],
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = await provider.requirePreferences();
    assert.deepEqual(preferences.obj, mockPreferencesObj);
  });

  it("should fall back to empty labeler defs when the labeler service fails", async () => {
    const mockPreferencesObj = [
      { $type: "app.bsky.actor.defs#savedFeedsPrefV2", items: [] },
    ];
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => mockPreferencesObj,
      getLabelers: async () => {
        throw new Error("502");
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = await provider.requirePreferences();
    assert.deepEqual(preferences.obj, mockPreferencesObj);
    assert.deepEqual(preferences.labelerDefs, []);
  });

  it("should warn with a toast when the labeler service fails", async () => {
    // The toast's own auto-dismiss timer shouldn't run on the patched clock.
    globalThis.setTimeout = realSetTimeout;
    const mockApi = {
      isAuthenticated: true,
      getPreferences: async () => [],
      getLabelers: async () => {
        throw new Error("502");
      },
    };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const toasts = document.querySelectorAll('[data-testid="toast"]');
    assert.deepEqual(toasts.length, 1);
    for (const toast of toasts) {
      toast.remove();
    }
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
      [],
    );
    await provider.updatePreferences(newPreferences);

    assert.deepEqual(updatedObj, newPreferences.obj);
    assert.deepEqual(await provider.requirePreferences(), newPreferences);
  });
});
