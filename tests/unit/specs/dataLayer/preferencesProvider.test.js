import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "/js/preferences.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { makeTestPreferencesProvider } from "../../testHelpers.js";

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

  describe("updatePreferences", () => {
    const addPref = (type) => (preferences) =>
      new Preferences([...preferences.obj, { $type: type }], {
        persist: preferences.persist,
      });
    const prefTypes = (obj) => obj.map((pref) => pref.$type);

    it("writes the change and publishes the result", async () => {
      const { provider, server } = await makeTestPreferencesProvider();

      const result = await provider.updatePreferences(addPref("#a"));

      assert.deepEqual(prefTypes(server.stored), ["#a"]);
      assert.equal(provider.$preferences.get(), result);
      assert.equal(await provider.requirePreferences(), result);
    });

    it("applies the change to freshly fetched preferences, keeping changes made elsewhere", async () => {
      const { provider, server } = await makeTestPreferencesProvider();
      server.stored = [{ $type: "#fromAnotherDevice" }];

      await provider.updatePreferences(addPref("#a"));

      assert.deepEqual(prefTypes(server.stored), ["#fromAnotherDevice", "#a"]);
    });

    it("keeps both changes when two writes overlap", async () => {
      const { provider, server } = await makeTestPreferencesProvider();

      await Promise.all([
        provider.updatePreferences(addPref("#a")),
        provider.updatePreferences(addPref("#b")),
      ]);

      assert.deepEqual(prefTypes(server.stored), ["#a", "#b"]);
      assert.deepEqual(prefTypes((await provider.requirePreferences()).obj), [
        "#a",
        "#b",
      ]);
    });

    it("rejects a failed write without blocking the next one", async () => {
      const { provider, server, api } = await makeTestPreferencesProvider();
      const save = api.updatePreferences;
      api.updatePreferences = async () => {
        api.updatePreferences = save;
        throw new Error("500");
      };

      const failed = provider.updatePreferences(addPref("#a"));
      const next = provider.updatePreferences(addPref("#b"));

      await assert.rejects(failed, /500/);
      await next;
      assert.deepEqual(prefTypes(server.stored), ["#b"]);
    });

    it("skips the write when the change returns the preferences unchanged", async () => {
      const { provider, server } = await makeTestPreferencesProvider();
      server.stored = [{ $type: "#fromAnotherDevice" }];

      await provider.updatePreferences((preferences) => preferences);

      assert.equal(server.putCalls, 0);
      assert.deepEqual(prefTypes((await provider.requirePreferences()).obj), [
        "#fromAnotherDevice",
      ]);
    });

    it("applies changes locally without fetching or saving when logged out", async () => {
      const { provider, server } = await makeTestPreferencesProvider({
        isAuthenticated: false,
      });
      const before = await provider.requirePreferences();

      const result = await provider.updatePreferences(addPref("#a"));

      assert.deepEqual(prefTypes(result.obj), [...prefTypes(before.obj), "#a"]);
      assert.equal(await provider.requirePreferences(), result);
      assert.equal(server.getCalls, 0);
      assert.equal(server.putCalls, 0);
    });
  });
});
