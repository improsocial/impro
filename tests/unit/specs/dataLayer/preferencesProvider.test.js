import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "/js/preferences.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";

describe("PreferencesProvider", () => {
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
    assert.deepEqual(error.message, "Preferences not loaded");
  });

  it("should create logged out preferences when not authenticated", async () => {
    const mockApi = { isAuthenticated: false };
    const provider = new PreferencesProvider(mockApi);

    await provider.fetchPreferences();

    const preferences = provider.requirePreferences();
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

    const preferences = provider.requirePreferences();
    assert.deepEqual(preferences.obj, mockPreferencesObj);
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
    assert.deepEqual(provider.requirePreferences(), newPreferences);
  });
});
