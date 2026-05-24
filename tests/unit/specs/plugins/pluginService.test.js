import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  PluginService,
  PermissionsDeclinedError,
} from "/js/plugins/pluginService.js";

class FakePreferences {
  constructor(state) {
    this.state = state;
  }
  getInstalledPlugins() {
    return this.state.installedPlugins;
  }
  setInstalledPlugins(plugins) {
    this.state.installedPlugins = plugins;
    return this;
  }
  getPluginSettings(pluginId) {
    return this.state.pluginSettings[pluginId];
  }
  setPluginSettings(pluginId, data) {
    this.state.pluginSettings[pluginId] = data;
    return this;
  }
  clearPluginSettings(pluginId) {
    delete this.state.pluginSettings[pluginId];
    return this;
  }
}

function makeProvider() {
  const state = { installedPlugins: [], pluginSettings: {} };
  const preferences = new FakePreferences(state);
  return {
    state,
    provider: {
      requirePreferences: () => preferences,
      savePreferences: async () => {},
    },
  };
}

// Build a PluginService with its async-heavy dependencies replaced by
// inert fakes so we can exercise the install/update orchestration logic
// without spinning up sandbox iframes or real fetches.
function makeService({
  remoteListings = [],
  localListings = null,
  liveManifests = {},
  liveManifestsByRepo = {},
} = {}) {
  const { state, provider } = makeProvider();
  const service = new PluginService(provider, null);
  const loadCalls = [];
  const reloadCalls = [];
  const unloadCalls = [];
  const reconcileCalls = [];
  service.pluginBridge = {
    isLoaded: () => false,
    unloadPlugin: (id) => {
      unloadCalls.push(id);
    },
    loadPlugin: async (id, version, repo) => {
      loadCalls.push({ id, version, repo });
    },
    reloadPlugin: async (id, version, repo) => {
      reloadCalls.push({ id, version, repo });
    },
    loadPlugins: async (entries) => ({
      loadedPlugins: entries,
      erroredPlugins: [],
    }),
  };
  service.remoteRegistry = {
    getListing: async (id) =>
      remoteListings.find((listing) => listing.id === id) ?? null,
    getListings: async () => remoteListings,
  };
  service.localPluginsEnabled = localListings != null;
  service.localRegistry = localListings
    ? {
        getListings: async () => localListings,
        getListing: async (id) =>
          localListings.find((listing) => listing.id === id) ?? null,
      }
    : null;
  service.sourceProvider = {
    getLiveManifest: async (id) => {
      if (!liveManifests[id]) throw new Error(`no manifest for ${id}`);
      return liveManifests[id];
    },
    getLiveManifestFromRepo: async (repo) => {
      if (!liveManifestsByRepo[repo]) {
        throw new Error(`no manifest for ${repo}`);
      }
      return liveManifestsByRepo[repo];
    },
    getCacheUrls: async (id, version, repo) => [
      `https://cache.test/${id}/${version}/${repo}`,
    ],
  };
  service.pluginCache = {
    reconcile: async (urls) => {
      reconcileCalls.push(urls);
    },
  };
  return {
    service,
    state,
    loadCalls,
    reloadCalls,
    unloadCalls,
    reconcileCalls,
  };
}

const t = new TestSuite("pluginService");

t.describe("installPlugin", (it, { afterEach }) => {
  afterEach(() => {
    delete globalThis.__testConfirmation;
  });

  it("persists manifest metadata and loads the plugin", async () => {
    const { service, state, loadCalls } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          author: "ow",
          description: "the first",
        },
      },
    });
    await service.installPlugin("alpha");
    assertEquals(state.installedPlugins, [
      {
        id: "alpha",
        name: "Alpha",
        version: "1.0.0",
        author: "ow",
        description: "the first",
        repo: "ow/alpha",
        enabled: true,
        permissions: {},
      },
    ]);
    assertEquals(loadCalls, [
      { id: "alpha", version: "1.0.0", repo: "ow/alpha" },
    ]);
  });

  it("getPluginsInfo reflects newly installed plugin synchronously", async () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          author: "ow",
          description: "the first",
        },
      },
    });
    assertEquals(service.getPluginsInfo(), []);
    await service.installPlugin("alpha");
    const info = service.getPluginsInfo();
    assertEquals(info.length, 1);
    assertEquals(info[0].id, "alpha");
    assertEquals(info[0].name, "Alpha");
    assertEquals(info[0].version, "1.0.0");
    assertEquals(info[0].enabled, true);
  });

  it("throws and rolls back the preference entry when load fails", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    service.pluginBridge.loadPlugin = async () => {
      throw new Error("boom");
    };
    let caught = null;
    try {
      await service.installPlugin("alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("boom"));
    assertEquals(state.installedPlugins, []);
  });

  it("rejects when the plugin is not in the remote registry", async () => {
    const { service } = makeService();
    let caught = null;
    try {
      await service.installPlugin("alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("unknown plugin"));
  });

  it("aborts install when the permission prompt is declined", async () => {
    const { service, state, loadCalls } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          permissions: { fetch: ["https://api.example.com/*"] },
        },
      },
    });
    globalThis.__testConfirmation = (resolve) => resolve(false);
    let caught = null;
    try {
      await service.installPlugin("alpha");
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof PermissionsDeclinedError);
    assertEquals(state.installedPlugins, []);
    assertEquals(loadCalls, []);
  });

  it("does not prompt on install when manifest has no permissions", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    // If the prompt were called, this would force a decline. A successful
    // install proves the prompt was skipped.
    globalThis.__testConfirmation = (resolve) => resolve(false);
    await service.installPlugin("alpha");
    assertEquals(state.installedPlugins.length, 1);
  });
});

t.describe("updatePlugin", (it, { beforeEach, afterEach }) => {
  // Several tests here seed state via installPlugin() with permissions, then
  // exercise update. Auto-accept by default; tests override for decline.
  beforeEach(() => {
    globalThis.__testConfirmation = (resolve) => resolve(true);
  });
  afterEach(() => {
    delete globalThis.__testConfirmation;
  });

  it("refreshes name/description/author/version from the live manifest", async () => {
    const { service, state, reloadCalls } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          author: "ow",
          description: "the first",
        },
      },
    });
    await service.installPlugin("alpha");

    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha Renamed",
      version: "1.1.0",
      author: "ow2",
      description: "new description",
    });

    const result = await service.updatePlugin("alpha");
    assertEquals(result, { updated: true, version: "1.1.0" });
    assertEquals(state.installedPlugins[0], {
      id: "alpha",
      name: "Alpha Renamed",
      version: "1.1.0",
      author: "ow2",
      description: "new description",
      repo: "ow/alpha",
      enabled: true,
      permissions: {},
    });
    assertEquals(reloadCalls, [
      { id: "alpha", version: "1.1.0", repo: "ow/alpha" },
    ]);
  });

  it("does nothing when live manifest is not newer", async () => {
    const { service, state, reloadCalls } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    await service.installPlugin("alpha");

    const result = await service.updatePlugin("alpha");
    assertEquals(result, { updated: false });
    assertEquals(state.installedPlugins[0].version, "1.0.0");
    assertEquals(reloadCalls.length, 0);
  });

  it("does not prompt when no new permissions were added", async () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          permissions: { fetch: ["https://api.example.com/*"] },
        },
      },
    });
    await service.installPlugin("alpha");
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: { fetch: ["https://api.example.com/*"] },
    });

    // A force-decline that still permits the update proves the prompt was
    // skipped (no new permissions => no prompt).
    globalThis.__testConfirmation = (resolve) => resolve(false);
    const result = await service.updatePlugin("alpha");
    assertEquals(result, { updated: true, version: "1.1.0" });
  });

  it("aborts update and keeps old version when the prompt is declined", async () => {
    const { service, state, reloadCalls } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          permissions: { fetch: ["https://api.example.com/*"] },
        },
      },
    });
    await service.installPlugin("alpha");
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: {
        fetch: ["https://api.example.com/*", "https://newhost.com/*"],
      },
    });

    globalThis.__testConfirmation = (resolve) => resolve(false);
    let caught = null;
    try {
      await service.updatePlugin("alpha");
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof PermissionsDeclinedError);
    assertEquals(state.installedPlugins[0].version, "1.0.0");
    assertEquals(state.installedPlugins[0].permissions, {
      fetch: ["https://api.example.com/*"],
    });
    assertEquals(reloadCalls.length, 0);
  });

  it("persists updated permissions when the prompt is accepted", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          permissions: { fetch: ["https://api.example.com/*"] },
        },
      },
    });
    await service.installPlugin("alpha");
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: {
        fetch: ["https://api.example.com/*", "https://newhost.com/*"],
      },
    });

    await service.updatePlugin("alpha");
    assertEquals(state.installedPlugins[0].permissions, {
      fetch: ["https://api.example.com/*", "https://newhost.com/*"],
    });
  });
});

t.describe("loadEnabledPlugins", (it) => {
  it("only loads entries marked enabled", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
    ];
    const loadPluginsCalls = [];
    service.pluginBridge.loadPlugins = async (entries) => {
      loadPluginsCalls.push(entries);
      return { loadedPlugins: entries, erroredPlugins: [] };
    };
    await service.loadEnabledPlugins();
    assertEquals(loadPluginsCalls.length, 1);
    assertEquals(
      loadPluginsCalls[0].map((entry) => entry.id),
      ["a"],
    );
  });

  it("skips __LOCAL entries when localPluginsEnabled is false", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b__LOCAL", version: "1.0.0", repo: null, enabled: true },
    ];
    const loadPluginsCalls = [];
    service.pluginBridge.loadPlugins = async (entries) => {
      loadPluginsCalls.push(entries);
      return { loadedPlugins: entries, erroredPlugins: [] };
    };
    await service.loadEnabledPlugins();
    assertEquals(
      loadPluginsCalls[0].map((entry) => entry.id),
      ["a"],
    );
  });

  it("loads __LOCAL entries when localPluginsEnabled is true", async () => {
    const { service, state } = makeService({ localListings: [] });
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b__LOCAL", version: "1.0.0", repo: null, enabled: true },
    ];
    const loadPluginsCalls = [];
    service.pluginBridge.loadPlugins = async (entries) => {
      loadPluginsCalls.push(entries);
      return { loadedPlugins: entries, erroredPlugins: [] };
    };
    await service.loadEnabledPlugins();
    assertEquals(
      loadPluginsCalls[0].map((entry) => entry.id),
      ["a", "b__LOCAL"],
    );
  });

  it("disables plugins reported as errored by the bridge", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    service.pluginBridge.loadPlugins = async () => ({
      loadedPlugins: [],
      erroredPlugins: [{ pluginId: "b", error: new Error("nope") }],
    });
    await service.loadEnabledPlugins();
    assertEquals(
      state.installedPlugins.find((entry) => entry.id === "b").enabled,
      false,
    );
    assertEquals(
      state.installedPlugins.find((entry) => entry.id === "a").enabled,
      true,
    );
  });

  it("with ?disable-plugins, disables all enabled plugins in one save and skips loading", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
      { id: "c", version: "1.0.0", repo: "ow/c", enabled: true },
    ];
    const loadPluginsCalls = [];
    service.pluginBridge.loadPlugins = async (entries) => {
      loadPluginsCalls.push(entries);
      return { loadedPlugins: entries, erroredPlugins: [] };
    };
    let saveCalls = 0;
    const originalSave =
      service.prefManager.preferencesProvider.savePreferences;
    service.prefManager.preferencesProvider.savePreferences = async (prefs) => {
      saveCalls++;
      return originalSave(prefs);
    };
    window.history.replaceState({}, "", "http://localhost/?disable-plugins");
    try {
      await service.loadEnabledPlugins();
    } finally {
      window.history.replaceState({}, "", "http://localhost/");
    }
    assertEquals(loadPluginsCalls.length, 0);
    assertEquals(saveCalls, 1);
    assertEquals(state.installedPlugins, [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: false },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
      { id: "c", version: "1.0.0", repo: "ow/c", enabled: false },
    ]);
  });

  it("with ?disable-plugins and no enabled plugins, performs no save and no load", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: false },
    ];
    const loadPluginsCalls = [];
    service.pluginBridge.loadPlugins = async (entries) => {
      loadPluginsCalls.push(entries);
      return { loadedPlugins: entries, erroredPlugins: [] };
    };
    let saveCalls = 0;
    service.prefManager.preferencesProvider.savePreferences = async () => {
      saveCalls++;
    };
    window.history.replaceState({}, "", "http://localhost/?disable-plugins");
    try {
      await service.loadEnabledPlugins();
    } finally {
      window.history.replaceState({}, "", "http://localhost/");
    }
    assertEquals(loadPluginsCalls.length, 0);
    assertEquals(saveCalls, 0);
  });

  it("reconciles cache against all installed (including disabled)", async () => {
    const { service, state, reconcileCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
    ];
    await service.loadEnabledPlugins();
    assertEquals(reconcileCalls.length, 1);
    assertEquals(reconcileCalls[0], [
      "https://cache.test/a/1.0.0/ow/a",
      "https://cache.test/b/1.0.0/ow/b",
    ]);
  });
});

t.describe("uninstallPlugin", (it) => {
  it("unloads, removes preference, clears settings, and reconciles", async () => {
    const { service, state, unloadCalls, reconcileCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    state.pluginSettings = { a: { color: "red" }, b: { color: "blue" } };
    await service.uninstallPlugin("a");
    assertEquals(unloadCalls, ["a"]);
    assertEquals(
      state.installedPlugins.map((entry) => entry.id),
      ["b"],
    );
    assertEquals(state.pluginSettings, { b: { color: "blue" } });
    // Cache should be reconciled against the remaining plugin only
    assertEquals(reconcileCalls.length, 1);
    assertEquals(reconcileCalls[0], ["https://cache.test/b/1.0.0/ow/b"]);
  });
});

t.describe("enablePlugin", (it) => {
  it("flips enabled and loads the plugin", async () => {
    const { service, state, loadCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: false },
    ];
    await service.enablePlugin("a");
    assertEquals(state.installedPlugins[0].enabled, true);
    assertEquals(loadCalls, [{ id: "a", version: "1.0.0", repo: "ow/a" }]);
  });

  it("rolls back to disabled when load fails", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: false },
    ];
    service.pluginBridge.loadPlugin = async () => {
      throw new Error("boom");
    };
    let caught = null;
    try {
      await service.enablePlugin("a");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("boom"));
    assertEquals(state.installedPlugins[0].enabled, false);
  });
});

t.describe("reloadPlugins", (it) => {
  it("reloads only enabled plugins", async () => {
    const { service, state, reloadCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
    ];
    await service.reloadPlugins();
    assertEquals(
      reloadCalls.map((call) => call.id),
      ["a"],
    );
  });

  it("disables plugins that throw and re-throws the first failure", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    service.pluginBridge.reloadPlugin = async (id) => {
      if (id === "b") throw new Error("b broke");
    };
    let caught = null;
    try {
      await service.reloadPlugins();
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("b broke"));
    assertEquals(
      state.installedPlugins.find((entry) => entry.id === "b").enabled,
      false,
    );
    assertEquals(
      state.installedPlugins.find((entry) => entry.id === "a").enabled,
      true,
    );
  });
});

t.describe("checkForUpdates", (it) => {
  it("populates _availableUpdates with plugins whose live version is newer", async () => {
    const { service, state } = makeService({
      liveManifests: {
        a: { id: "a", name: "A", version: "2.0.0" },
        b: { id: "b", name: "B", version: "1.0.0" },
      },
    });
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    const updates = await service.checkForUpdates();
    assertEquals([...updates.entries()], [["a", "2.0.0"]]);
    assertEquals(service.getAvailableUpdates(), updates);
  });

  it("skips plugins whose live manifest fails to fetch", async () => {
    const { service, state } = makeService({
      liveManifests: {
        a: { id: "a", name: "A", version: "2.0.0" },
        // b intentionally missing — getLiveManifest will throw
      },
    });
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    const updates = await service.checkForUpdates();
    assertEquals([...updates.keys()], ["a"]);
  });
});

t.describe("updateAllPlugins", (it) => {
  it("returns empty buckets when there are no available updates", async () => {
    const { service } = makeService();
    const result = await service.updateAllPlugins();
    assertEquals(result, { updated: [], failed: [], declined: [] });
  });

  it("partitions results into updated and failed buckets", async () => {
    const { service, state } = makeService({
      liveManifests: {
        a: { id: "a", name: "A", version: "2.0.0" },
        b: { id: "b", name: "B", version: "2.0.0" },
      },
    });
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    await service.checkForUpdates();
    // Make b's reload fail; a should still update successfully.
    service.pluginBridge.reloadPlugin = async (id) => {
      if (id === "b") throw new Error("reload failed");
    };
    const result = await service.updateAllPlugins();
    assertEquals(result.updated, ["a"]);
    assertEquals(result.failed, ["b"]);
  });
});

t.describe("getPluginsInfo", (it) => {
  it("hides __LOCAL plugins when localPluginsEnabled is false", () => {
    const { service, state } = makeService({});
    state.installedPlugins = [
      { id: "alpha", name: "Alpha", version: "1.0.0", enabled: true },
      { id: "gamma__LOCAL", name: "Gamma", version: "0.1.0", enabled: true },
    ];
    const info = service.getPluginsInfo();
    assertEquals(info.length, 1);
    assertEquals(info[0].id, "alpha");
  });

  it("includes __LOCAL plugins when localPluginsEnabled is true", () => {
    const { service, state } = makeService({ localListings: [] });
    state.installedPlugins = [
      { id: "alpha", name: "Alpha", version: "1.0.0", enabled: true },
      { id: "gamma__LOCAL", name: "Gamma", version: "0.1.0", enabled: true },
    ];
    const info = service.getPluginsInfo();
    assertEquals(info.length, 2);
  });
});

t.describe("registry listings loader/selector", (it) => {
  it("returns null from the selector before the loader runs", () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    assertEquals(service.getRegistryListings(), null);
  });

  it("merges remote + local listings and marks installed entries", async () => {
    const { service, state } = makeService({
      remoteListings: [
        { id: "alpha", repo: "ow/alpha", name: "Alpha" },
        { id: "beta", repo: "ow/beta", name: "Beta" },
      ],
      localListings: [{ id: "gamma__LOCAL", name: "Gamma" }],
    });
    state.installedPlugins = [
      { id: "alpha", version: "1.0.0", repo: "ow/alpha", enabled: true },
    ];
    await service.loadRegistryListings();
    const listings = service.getRegistryListings();
    assertEquals(listings.length, 3);
    const byId = Object.fromEntries(
      listings.map((listing) => [listing.id, listing]),
    );
    assertEquals(byId.alpha.installed, true);
    assertEquals(byId.beta.installed, false);
    assertEquals(byId.gamma__LOCAL.installed, false);
  });

  it("reflects updated install state on subsequent selector reads", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    await service.loadRegistryListings();
    assertEquals(service.getRegistryListings()[0].installed, false);
    state.installedPlugins = [
      { id: "alpha", version: "1.0.0", repo: "ow/alpha", enabled: true },
    ];
    assertEquals(service.getRegistryListings()[0].installed, true);
  });

  it("returns only remote listings when localRegistry is absent", async () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    await service.loadRegistryListings();
    const listings = service.getRegistryListings();
    assertEquals(listings.length, 1);
    assertEquals(listings[0].id, "alpha");
  });
});

t.describe("installUnregisteredPlugin", (it) => {
  it("installs from a github.com URL using manifest metadata", async () => {
    const { service, state, loadCalls } = makeService({
      liveManifestsByRepo: {
        "ow/alpha": {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          author: "ow",
          description: "the first",
        },
      },
    });
    const result = await service.installUnregisteredPlugin(
      "https://github.com/ow/alpha",
    );
    assertEquals(result, { id: "alpha", name: "Alpha" });
    assertEquals(state.installedPlugins, [
      {
        id: "alpha",
        name: "Alpha",
        version: "1.0.0",
        author: "ow",
        description: "the first",
        repo: "ow/alpha",
        enabled: true,
        permissions: {},
      },
    ]);
    assertEquals(loadCalls, [
      { id: "alpha", version: "1.0.0", repo: "ow/alpha" },
    ]);
  });

  it("strips .git and extra path segments from the URL", async () => {
    const { service, state } = makeService({
      liveManifestsByRepo: {
        "ow/alpha": { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    await service.installUnregisteredPlugin(
      "https://github.com/ow/alpha.git/tree/main",
    );
    assertEquals(state.installedPlugins[0].repo, "ow/alpha");
  });

  it("rejects non-GitHub URLs", async () => {
    const { service, state } = makeService();
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://example.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Invalid GitHub URL"));
    assertEquals(state.installedPlugins, []);
  });

  it("rejects malformed URL strings", async () => {
    const { service } = makeService();
    let caught = null;
    try {
      await service.installUnregisteredPlugin("not a url");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Invalid GitHub URL"));
  });

  it("throws when manifest is missing required fields", async () => {
    const { service, state } = makeService();
    service.sourceProvider.getLiveManifestFromRepo = async () => {
      throw new Error('missing required field "version"');
    };
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://github.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Failed to fetch manifest"));
    assertEquals(state.installedPlugins, []);
  });

  it("rejects when the plugin id is already installed", async () => {
    const { service, state } = makeService({
      liveManifestsByRepo: {
        "ow/alpha": { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    state.installedPlugins = [
      {
        id: "alpha",
        name: "Alpha",
        version: "0.9.0",
        repo: "ow/alpha",
        enabled: true,
      },
    ];
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://github.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("already installed"));
    assertEquals(state.installedPlugins.length, 1);
  });

  it("rolls back the preference entry when load fails", async () => {
    const { service, state } = makeService({
      liveManifestsByRepo: {
        "ow/alpha": { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    service.pluginBridge.loadPlugin = async () => {
      throw new Error("boom");
    };
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://github.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("boom"));
    assertEquals(state.installedPlugins, []);
  });

  it("rejects when the plugin id is already in the remote registry", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifestsByRepo: {
        "someone/alpha-fork": {
          id: "alpha",
          name: "Alpha Fork",
          version: "1.0.0",
        },
      },
    });
    let caught = null;
    try {
      await service.installUnregisteredPlugin(
        "https://github.com/someone/alpha-fork",
      );
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("in the registry"));
    assertEquals(state.installedPlugins, []);
  });

  it("rejects when the plugin id is in the local registry", async () => {
    const { service, state } = makeService({
      localListings: [{ id: "alpha", repo: "ow/alpha-local" }],
      liveManifestsByRepo: {
        "someone/alpha-fork": {
          id: "alpha",
          name: "Alpha Fork",
          version: "1.0.0",
        },
      },
    });
    let caught = null;
    try {
      await service.installUnregisteredPlugin(
        "https://github.com/someone/alpha-fork",
      );
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("in the registry"));
    assertEquals(state.installedPlugins, []);
  });
});

t.describe("getFilteredFeedItems", (it) => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  function addFilter(service, pluginId, invoke) {
    const entry = { pluginId, invoke };
    service.registries.feedFilters.add(entry);
    return entry;
  }

  it("returns an empty object when no filters are registered", async () => {
    const { service } = makeService();
    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });
    assertEquals(result, {});
  });

  it("passes feed.feed (not the wrapper) to each filter", async () => {
    const { service } = makeService();
    const feedItems = [{ post: { uri: "p1" } }];
    let captured = null;
    addFilter(service, "alpha", async (_uri, items) => {
      captured = items;
      return {};
    });

    await service.getFilteredFeedItems(feedURI, { feed: feedItems });

    assertEquals(captured, feedItems);
  });

  it("merges results from multiple filters", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => ({ p1: { hidden: true } }));
    addFilter(service, "beta", async () => ({ p2: { hidden: true } }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assertEquals(result, {
      p1: { hidden: true },
      p2: { hidden: true },
    });
  });

  it("lets later filters override earlier ones for the same key", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => ({ p1: { hidden: true } }));
    addFilter(service, "beta", async () => ({ p1: { hidden: false } }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assertEquals(result, { p1: { hidden: false } });
  });

  it("continues past filters that throw", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => {
      throw new Error("boom");
    });
    addFilter(service, "beta", async () => ({ p1: { hidden: true } }));

    const originalError = console.error;
    console.error = () => {};
    let result;
    try {
      result = await service.getFilteredFeedItems(feedURI, { feed: [] });
    } finally {
      console.error = originalError;
    }

    assertEquals(result, { p1: { hidden: true } });
  });

  it("skips filters that return null or non-object values", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => null);
    addFilter(service, "beta", async () => "not-an-object");
    addFilter(service, "gamma", async () => ({ p1: { hidden: true } }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assertEquals(result, { p1: { hidden: true } });
  });
});

t.describe("slot registry", (it) => {
  // These tests exercise the registration target wired by _setupRegistries,
  // so they need the real PluginBridge instead of the makeService stub.
  function makeServiceWithRealBridge() {
    const { provider } = makeProvider();
    return new PluginService(provider, null);
  }

  function register(service, plugin, message) {
    const handler = service.pluginBridge._registrationTargets.get("slot");
    return handler(plugin, message);
  }

  function makePlugin(pluginId, calls = []) {
    return {
      pluginId,
      call: (handlerId, ...args) => {
        calls.push({ handlerId, args });
        return Promise.resolve({ tag: "div", attrs: {}, text: pluginId });
      },
    };
  }

  it("returns an empty list for unknown slots", () => {
    const service = makeServiceWithRealBridge();
    assertEquals(service.getSlotEntries("nope"), []);
  });

  it("records registrations in order", async () => {
    const service = makeServiceWithRealBridge();
    register(service, makePlugin("alpha"), {
      target: "slot",
      name: "x",
      handlerId: 1,
    });
    register(service, makePlugin("beta"), {
      target: "slot",
      name: "x",
      handlerId: 2,
    });
    const entries = service.getSlotEntries("x");
    assertEquals(
      entries.map((entry) => entry.pluginId),
      ["alpha", "beta"],
    );
  });

  it("invokes the plugin handler with the slot context", async () => {
    const service = makeServiceWithRealBridge();
    const calls = [];
    register(service, makePlugin("alpha", calls), {
      target: "slot",
      name: "x",
      handlerId: 7,
    });
    const [entry] = service.getSlotEntries("x");
    await entry.invoke({ uri: "at://test" });
    assertEquals(calls, [{ handlerId: 7, args: [{ uri: "at://test" }] }]);
  });

  it("dispose removes the entry and prunes the slot when empty", () => {
    const service = makeServiceWithRealBridge();
    const dispose = register(service, makePlugin("alpha"), {
      target: "slot",
      name: "x",
      handlerId: 1,
    });
    assertEquals(service.getSlotEntries("x").length, 1);
    dispose();
    assertEquals(service.getSlotEntries("x"), []);
    assert(!service.registries.slots.has("x"));
  });

  it("emits slotRegistered / slotUnregistered events", () => {
    const service = makeServiceWithRealBridge();
    const events = [];
    service.on("slotRegistered", (data) =>
      events.push({ type: "reg", ...data }),
    );
    service.on("slotUnregistered", (data) =>
      events.push({ type: "unreg", ...data }),
    );
    const dispose = register(service, makePlugin("alpha"), {
      target: "slot",
      name: "x",
      handlerId: 1,
    });
    dispose();
    assertEquals(events, [
      { type: "reg", name: "x" },
      { type: "unreg", name: "x" },
    ]);
  });
});

t.describe("app.data host methods", (it) => {
  function makeServiceWithRealBridge() {
    const { provider } = makeProvider();
    return new PluginService(provider, null);
  }

  it("getPost host method returns selectors.getPost result", async () => {
    const service = makeServiceWithRealBridge();
    const calls = [];
    service.setDataLayer({
      selectors: {
        getPost: (uri) => {
          calls.push(uri);
          return { uri, record: { text: "cached" } };
        },
        getProfile: () => null,
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getPost");
    const result = await handler(null, { uri: "at://example/post/1" });
    assertEquals(calls, ["at://example/post/1"]);
    assertEquals(result, {
      uri: "at://example/post/1",
      record: { text: "cached" },
    });
  });

  it("getProfile host method returns selectors.getProfile result", async () => {
    const service = makeServiceWithRealBridge();
    const calls = [];
    service.setDataLayer({
      selectors: {
        getPost: () => null,
        getProfile: (did) => {
          calls.push(did);
          return { did, handle: "alice.test" };
        },
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:abc" });
    assertEquals(calls, ["did:plc:abc"]);
    assertEquals(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getPost returns null when dataLayer has not been set", async () => {
    const service = makeServiceWithRealBridge();
    const handler = service.pluginBridge._hostCallHandlers.get("getPost");
    const result = await handler(null, { uri: "at://example" });
    assertEquals(result, null);
  });

  it("getProfile returns null when selector returns null (uncached)", async () => {
    const service = makeServiceWithRealBridge();
    service.setDataLayer({
      selectors: {
        getPost: () => null,
        getProfile: () => null,
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:missing" });
    assertEquals(result, null);
  });
});

await t.run();
