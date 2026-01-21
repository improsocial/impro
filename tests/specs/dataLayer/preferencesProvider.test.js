import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { Preferences } from "../../../src/js/preferences.js";
import { PreferencesProvider } from "../../../src/js/dataLayer/preferencesProvider.js";

const t = new TestSuite("PreferencesProvider");

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
