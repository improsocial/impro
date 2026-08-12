import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  PluginService,
  PermissionsDeclinedError,
} from "/js/plugins/pluginService.js";
import { Signal, SignalMap } from "/js/signals.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { Constellation } from "/js/constellation.js";
import { respondToConfirm } from "../../testHelpers.js";

function emptyDataLayer() {
  const dataLayer = new EventEmitter();
  dataLayer.dataStore = { $feeds: new SignalMap() };
  return dataLayer;
}

class FakePreferences {
  constructor(state) {
    this.state = state;
  }
  getInstalledPlugins() {
    return this.state.installedPlugins;
  }
  setInstalledPlugins(plugins) {
    this.state.installedPlugins = plugins;
    // Return a fresh identity to mirror the real provider, which clones
    // preferences on every write so dependent signals invalidate.
    return new FakePreferences(this.state);
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
  const $preferences = new Signal.State(preferences);
  return {
    state,
    provider: {
      $preferences,
      requirePreferences: () => preferences,
      updatePreferences: async (saved) => {
        $preferences.set(saved);
      },
    },
  };
}

// A real PluginService, wired to a real PluginBridge — for tests that drive
// the bridge's registration targets and host-call handlers directly.
function makeServiceWithRealBridge({
  provider,
  session = null,
  dataLayer,
  hiddenFeedItemsStore,
  router = null,
  constellation,
} = {}) {
  return new PluginService(
    provider ?? makeProvider().provider,
    session,
    dataLayer ?? emptyDataLayer(),
    hiddenFeedItemsStore ?? new HiddenFeedItemsStore(),
    router,
    constellation ?? new Constellation(),
  );
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
  const service = makeServiceWithRealBridge({ provider });
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
    $loadStatuses: { get: () => ({ loading: false, error: null }) },
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
  const binaryCacheClearCalls = [];
  service.binaryCache = {
    clear: async (pluginId) => {
      binaryCacheClearCalls.push(pluginId);
    },
  };
  return {
    service,
    state,
    provider,
    loadCalls,
    reloadCalls,
    unloadCalls,
    reconcileCalls,
    binaryCacheClearCalls,
  };
}

describe("installPlugin", () => {
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
    assert.deepEqual(state.installedPlugins, [
      {
        id: "alpha",
        name: "Alpha",
        version: "1.0.0",
        author: "ow",
        description: "the first",
        repo: "ow/alpha",
        enabled: true,
        permissions: {},
        executables: [],
      },
    ]);
    assert.deepEqual(loadCalls, [
      { id: "alpha", version: "1.0.0", repo: "ow/alpha" },
    ]);
  });

  it("$pluginsInfo reflects newly installed plugin synchronously", async () => {
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
    assert.deepEqual(service.$pluginsInfo.get(), []);
    await service.installPlugin("alpha");
    const info = service.$pluginsInfo.get();
    assert.deepEqual(info.length, 1);
    assert.deepEqual(info[0].id, "alpha");
    assert.deepEqual(info[0].name, "Alpha");
    assert.deepEqual(info[0].version, "1.0.0");
    assert.deepEqual(info[0].enabled, true);
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
    assert.deepEqual(state.installedPlugins, []);
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
    const installing = service.installPlugin("alpha");
    await respondToConfirm(false);
    let caught = null;
    try {
      await installing;
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof PermissionsDeclinedError);
    assert.deepEqual(state.installedPlugins, []);
    assert.deepEqual(loadCalls, []);
  });

  it("does not prompt on install when manifest has no permissions", async () => {
    const { service, state } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha" }],
      liveManifests: {
        alpha: { id: "alpha", name: "Alpha", version: "1.0.0" },
      },
    });
    await service.installPlugin("alpha");
    assert.deepEqual(state.installedPlugins.length, 1);
  });
});

describe("updatePlugin", () => {
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
    assert.deepEqual(result, { updated: true, version: "1.1.0" });
    assert.deepEqual(state.installedPlugins[0], {
      id: "alpha",
      name: "Alpha Renamed",
      version: "1.1.0",
      author: "ow2",
      description: "new description",
      repo: "ow/alpha",
      enabled: true,
      permissions: {},
      executables: [],
    });
    assert.deepEqual(reloadCalls, [
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
    assert.deepEqual(result, { updated: false });
    assert.deepEqual(state.installedPlugins[0].version, "1.0.0");
    assert.deepEqual(reloadCalls.length, 0);
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
    const installing = service.installPlugin("alpha");
    await respondToConfirm(true);
    await installing;
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: { fetch: ["https://api.example.com/*"] },
    });

    const result = await service.updatePlugin("alpha");
    assert.deepEqual(result, { updated: true, version: "1.1.0" });
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
    const installing = service.installPlugin("alpha");
    await respondToConfirm(true);
    await installing;
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: {
        fetch: ["https://api.example.com/*", "https://newhost.com/*"],
      },
    });

    const updating = service.updatePlugin("alpha");
    await respondToConfirm(false);
    let caught = null;
    try {
      await updating;
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof PermissionsDeclinedError);
    assert.deepEqual(state.installedPlugins[0].version, "1.0.0");
    assert.deepEqual(state.installedPlugins[0].permissions, {
      fetch: ["https://api.example.com/*"],
    });
    assert.deepEqual(reloadCalls.length, 0);
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
    const installing = service.installPlugin("alpha");
    await respondToConfirm(true);
    await installing;
    service.sourceProvider.getLiveManifest = async () => ({
      id: "alpha",
      name: "Alpha",
      version: "1.1.0",
      permissions: {
        fetch: ["https://api.example.com/*", "https://newhost.com/*"],
      },
    });

    const updating = service.updatePlugin("alpha");
    await respondToConfirm(true);
    await updating;
    assert.deepEqual(state.installedPlugins[0].permissions, {
      fetch: ["https://api.example.com/*", "https://newhost.com/*"],
    });
  });
});

describe("loadEnabledPlugins", () => {
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
    assert.deepEqual(loadPluginsCalls.length, 1);
    assert.deepEqual(
      loadPluginsCalls[0].map((entry) => entry.id),
      ["a"],
    );
  });

  it("reports every plugin as loading until the initial load completes", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
    ];
    service.pluginBridge.loadPlugins = async (entries) => ({
      loadedPlugins: entries,
      erroredPlugins: [],
    });
    assert.deepEqual(service.getPluginLoadStatus("a").loading, true);
    await service.loadEnabledPlugins();
    assert.deepEqual(service.getPluginLoadStatus("a").loading, false);
  });

  it("marks the initial load complete even when loading throws", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
    ];
    service.pluginBridge.loadPlugins = async () => {
      throw new Error("boom");
    };
    await assert.rejects(service.loadEnabledPlugins(), /boom/);
    assert.deepEqual(service.getPluginLoadStatus("a").loading, false);
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
    assert.deepEqual(
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
    assert.deepEqual(
      loadPluginsCalls[0].map((entry) => entry.id),
      ["a", "b__LOCAL"],
    );
  });

  it("keeps plugins enabled when the bridge reports they errored", async () => {
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
    assert.deepEqual(
      state.installedPlugins.find((entry) => entry.id === "b").enabled,
      true,
    );
    assert.deepEqual(
      state.installedPlugins.find((entry) => entry.id === "a").enabled,
      true,
    );
  });

  it("shows one error toast per distinct load-error message", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
      { id: "c", version: "1.0.0", repo: "ow/c", enabled: true },
    ];
    service.pluginBridge.loadPlugins = async () => ({
      loadedPlugins: [],
      erroredPlugins: [
        { pluginId: "a", error: new Error("Could not fetch plugin source") },
        { pluginId: "b", error: new Error("Could not fetch plugin source") },
        { pluginId: "c", error: new Error("Could not fetch plugin manifest") },
      ],
    });
    document.body.innerHTML = "";
    await service.loadEnabledPlugins();
    const toasts = [...document.body.querySelectorAll('[data-testid="toast"]')];
    assert.deepEqual(
      toasts.map((toast) => toast.textContent.trim()),
      [
        "Failed to load plugin(s): a, b - Could not fetch plugin source",
        "Failed to load plugin(s): c - Could not fetch plugin manifest",
      ],
    );
    document.body.innerHTML = "";
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
      service.prefManager.preferencesProvider.updatePreferences;
    service.prefManager.preferencesProvider.updatePreferences = async (
      prefs,
    ) => {
      saveCalls++;
      return originalSave(prefs);
    };
    window.history.replaceState({}, "", "http://localhost/?disable-plugins");
    try {
      await service.loadEnabledPlugins();
    } finally {
      window.history.replaceState({}, "", "http://localhost/");
    }
    assert.deepEqual(loadPluginsCalls.length, 0);
    assert.deepEqual(saveCalls, 1);
    assert.deepEqual(state.installedPlugins, [
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
    service.prefManager.preferencesProvider.updatePreferences = async () => {
      saveCalls++;
    };
    window.history.replaceState({}, "", "http://localhost/?disable-plugins");
    try {
      await service.loadEnabledPlugins();
    } finally {
      window.history.replaceState({}, "", "http://localhost/");
    }
    assert.deepEqual(loadPluginsCalls.length, 0);
    assert.deepEqual(saveCalls, 0);
  });

  it("reconciles cache against all installed (including disabled)", async () => {
    const { service, state, reconcileCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
    ];
    await service.loadEnabledPlugins();
    assert.deepEqual(reconcileCalls.length, 1);
    assert.deepEqual(reconcileCalls[0], [
      "https://cache.test/a/1.0.0/ow/a",
      "https://cache.test/b/1.0.0/ow/b",
    ]);
  });
});

describe("uninstallPlugin", () => {
  it("unloads, removes preference, clears settings, and reconciles", async () => {
    const { service, state, unloadCalls, reconcileCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: true },
    ];
    state.pluginSettings = { a: { color: "red" }, b: { color: "blue" } };
    await service.uninstallPlugin("a");
    assert.deepEqual(unloadCalls, ["a"]);
    assert.deepEqual(
      state.installedPlugins.map((entry) => entry.id),
      ["b"],
    );
    assert.deepEqual(state.pluginSettings, { b: { color: "blue" } });
    // Cache should be reconciled against the remaining plugin only
    assert.deepEqual(reconcileCalls.length, 1);
    assert.deepEqual(reconcileCalls[0], ["https://cache.test/b/1.0.0/ow/b"]);
  });

  it("also clears device-local plugin data", async () => {
    const { service, state } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
    ];
    service.localDataStore.set("a", { keys: [{ id: "k1", secret: "shh" }] });
    assert.notDeepEqual(service.localDataStore.get("a"), null);
    await service.uninstallPlugin("a");
    assert.deepEqual(service.localDataStore.get("a"), null);
  });
});

describe("enablePlugin", () => {
  it("flips enabled and loads the plugin", async () => {
    const { service, state, loadCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: false },
    ];
    await service.enablePlugin("a");
    assert.deepEqual(state.installedPlugins[0].enabled, true);
    assert.deepEqual(loadCalls, [{ id: "a", version: "1.0.0", repo: "ow/a" }]);
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
    assert.deepEqual(state.installedPlugins[0].enabled, false);
  });
});

describe("reloadPlugins", () => {
  it("reloads only enabled plugins", async () => {
    const { service, state, reloadCalls } = makeService();
    state.installedPlugins = [
      { id: "a", version: "1.0.0", repo: "ow/a", enabled: true },
      { id: "b", version: "1.0.0", repo: "ow/b", enabled: false },
    ];
    await service.reloadPlugins();
    assert.deepEqual(
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
    assert.deepEqual(
      state.installedPlugins.find((entry) => entry.id === "b").enabled,
      false,
    );
    assert.deepEqual(
      state.installedPlugins.find((entry) => entry.id === "a").enabled,
      true,
    );
  });
});

describe("checkForUpdates", () => {
  it("populates $availableUpdates with plugins whose live version is newer", async () => {
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
    assert.deepEqual([...updates.entries()], [["a", "2.0.0"]]);
    assert.deepEqual(service.$availableUpdates.get(), updates);
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
    assert.deepEqual([...updates.keys()], ["a"]);
  });
});

describe("updateAllPlugins", () => {
  it("returns empty buckets when there are no available updates", async () => {
    const { service } = makeService();
    const result = await service.updateAllPlugins();
    assert.deepEqual(result, { updated: [], failed: [], declined: [] });
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
    assert.deepEqual(result.updated, ["a"]);
    assert.deepEqual(result.failed, ["b"]);
  });
});

describe("$pluginsInfo", () => {
  it("hides __LOCAL plugins when localPluginsEnabled is false", () => {
    const { service, state } = makeService({});
    state.installedPlugins = [
      { id: "alpha", name: "Alpha", version: "1.0.0", enabled: true },
      { id: "gamma__LOCAL", name: "Gamma", version: "0.1.0", enabled: true },
    ];
    const info = service.$pluginsInfo.get();
    assert.deepEqual(info.length, 1);
    assert.deepEqual(info[0].id, "alpha");
  });

  it("includes __LOCAL plugins when localPluginsEnabled is true", () => {
    const { service, state } = makeService({ localListings: [] });
    state.installedPlugins = [
      { id: "alpha", name: "Alpha", version: "1.0.0", enabled: true },
      { id: "gamma__LOCAL", name: "Gamma", version: "0.1.0", enabled: true },
    ];
    const info = service.$pluginsInfo.get();
    assert.deepEqual(info.length, 2);
  });

  it("lists only loaded plugins as previewing, and only in preview mode", () => {
    const { state, provider } = makeProvider();
    const service = makeServiceWithRealBridge({
      provider,
      router: { go: () => {} },
    });
    state.installedPlugins = [
      { id: "alpha", name: "Alpha", version: "1.0.0", enabled: true },
      { id: "beta", name: "Beta", version: "1.0.0", enabled: true },
    ];
    service.pluginBridge._loadedPlugins.set("alpha", { pluginId: "alpha" });

    assert.deepEqual(service.getPreviewPlugins(), []);

    service.isPreviewMode = true;
    assert.deepEqual(
      service.getPreviewPlugins().map((plugin) => plugin.id),
      ["alpha"],
    );
  });
});

describe("registry listings loader/selector", () => {
  it("returns null from the selector before the loader runs", () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    assert.deepEqual(service.$registryListings.get(), null);
  });

  it("merges remote + local listings and marks installed entries", async () => {
    const { service, provider } = makeService({
      remoteListings: [
        { id: "alpha", repo: "ow/alpha", name: "Alpha" },
        { id: "beta", repo: "ow/beta", name: "Beta" },
      ],
      localListings: [{ id: "gamma__LOCAL", name: "Gamma" }],
    });
    provider.$preferences.set(
      provider
        .requirePreferences()
        .setInstalledPlugins([
          { id: "alpha", version: "1.0.0", repo: "ow/alpha", enabled: true },
        ]),
    );
    await service.loadRegistryListings();
    const listings = service.$registryListings.get();
    assert.deepEqual(listings.length, 3);
    const byId = Object.fromEntries(
      listings.map((listing) => [listing.id, listing]),
    );
    assert.deepEqual(byId.alpha.installed, true);
    assert.deepEqual(byId.beta.installed, false);
    assert.deepEqual(byId.gamma__LOCAL.installed, false);
  });

  it("reflects updated install state on subsequent selector reads", async () => {
    const { service, provider } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    await service.loadRegistryListings();
    assert.deepEqual(service.$registryListings.get()[0].installed, false);
    provider.$preferences.set(
      provider
        .requirePreferences()
        .setInstalledPlugins([
          { id: "alpha", version: "1.0.0", repo: "ow/alpha", enabled: true },
        ]),
    );
    assert.deepEqual(service.$registryListings.get()[0].installed, true);
  });

  it("updates installed plugin repo when remote listing repo changes", async () => {
    const { service, provider } = makeService({
      remoteListings: [{ id: "alpha", repo: "newowner/alpha", name: "Alpha" }],
    });
    provider.$preferences.set(
      provider.requirePreferences().setInstalledPlugins([
        {
          id: "alpha",
          version: "1.0.0",
          repo: "oldowner/alpha",
          enabled: true,
        },
      ]),
    );
    await service.loadRegistryListings();
    const installed = provider.requirePreferences().getInstalledPlugins();
    assert.deepEqual(installed[0].repo, "newowner/alpha");
  });

  it("does not rewrite installed repos when listings match", async () => {
    const { service, provider } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    provider.$preferences.set(
      provider
        .requirePreferences()
        .setInstalledPlugins([
          { id: "alpha", version: "1.0.0", repo: "ow/alpha", enabled: true },
        ]),
    );
    const before = provider.$preferences.get();
    await service.loadRegistryListings();
    assert.deepEqual(provider.$preferences.get(), before);
  });

  it("sorts listings alphabetically by name, ignoring case", async () => {
    const { service } = makeService({
      remoteListings: [
        { id: "gamma", repo: "ow/gamma", name: "gamma" },
        { id: "alpha", repo: "ow/alpha", name: "Alpha" },
      ],
      localListings: [{ id: "beta__LOCAL", name: "Beta" }],
    });
    await service.loadRegistryListings();
    const listings = service.$registryListings.get();
    assert.deepEqual(
      listings.map((listing) => listing.name),
      ["Alpha", "Beta", "gamma"],
    );
  });

  it("returns only remote listings when localRegistry is absent", async () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    await service.loadRegistryListings();
    const listings = service.$registryListings.get();
    assert.deepEqual(listings.length, 1);
    assert.deepEqual(listings[0].id, "alpha");
  });
});

describe("installUnregisteredPlugin", () => {
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
    assert.deepEqual(result, { id: "alpha", name: "Alpha" });
    assert.deepEqual(state.installedPlugins, [
      {
        id: "alpha",
        name: "Alpha",
        version: "1.0.0",
        author: "ow",
        description: "the first",
        repo: "ow/alpha",
        enabled: true,
        permissions: {},
        executables: [],
      },
    ]);
    assert.deepEqual(loadCalls, [
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
    assert.deepEqual(state.installedPlugins[0].repo, "ow/alpha");
  });

  it("installs from a tangled.org URL using a tangled repo spec", async () => {
    const { service, state, loadCalls } = makeService({
      liveManifestsByRepo: {
        "tangled:@ow.example.com/alpha": {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
        },
      },
    });
    const result = await service.installUnregisteredPlugin(
      "https://tangled.org/@ow.example.com/alpha",
    );
    assert.deepEqual(result, { id: "alpha", name: "Alpha" });
    assert.deepEqual(
      state.installedPlugins[0].repo,
      "tangled:@ow.example.com/alpha",
    );
    assert.deepEqual(loadCalls, [
      {
        id: "alpha",
        version: "1.0.0",
        repo: "tangled:@ow.example.com/alpha",
      },
    ]);
  });

  it("accepts tangled.sh URLs", async () => {
    const { service, state } = makeService({
      liveManifestsByRepo: {
        "tangled:@ow.example.com/alpha": {
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
        },
      },
    });
    await service.installUnregisteredPlugin(
      "https://tangled.sh/@ow.example.com/alpha",
    );
    assert.deepEqual(
      state.installedPlugins[0].repo,
      "tangled:@ow.example.com/alpha",
    );
  });

  it("rejects URLs from unsupported hosts", async () => {
    const { service, state } = makeService();
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://example.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Invalid repo URL"));
    assert.deepEqual(state.installedPlugins, []);
  });

  it("rejects malformed URL strings", async () => {
    const { service } = makeService();
    let caught = null;
    try {
      await service.installUnregisteredPlugin("not a url");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Invalid repo URL"));
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
    assert.deepEqual(state.installedPlugins, []);
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
    assert.deepEqual(state.installedPlugins.length, 1);
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
    assert.deepEqual(state.installedPlugins, []);
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
    assert.deepEqual(state.installedPlugins, []);
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
    assert.deepEqual(state.installedPlugins, []);
  });
});

describe("getFilteredFeedItems", () => {
  const feedURI = "at://did:test/app.bsky.feed.generator/test";

  function addFilter(service, pluginId, invoke) {
    const entry = { pluginId, invoke };
    service.registries.feedFilters.add(entry);
    return entry;
  }

  it("returns an empty object when no filters are registered", async () => {
    const { service } = makeService();
    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });
    assert.deepEqual(result, {});
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

    assert.deepEqual(captured, feedItems);
  });

  it("merges hide verdicts from multiple filters", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => ({ p1: false }));
    addFilter(service, "beta", async () => ({ p2: false }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assert.deepEqual(result, { p1: false, p2: false });
  });

  it("ignores non-false verdicts", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => ({
      p1: true,
      p2: false,
      p3: null,
      p4: { hidden: true },
    }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assert.deepEqual(result, { p2: false });
  });

  it("does not let one filter's keep override another filter's hide", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => ({ p1: false, p2: true }));
    addFilter(service, "beta", async () => ({ p1: true, p2: false }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assert.deepEqual(result, { p1: false, p2: false });
  });

  it("continues past filters that throw", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => {
      throw new Error("boom");
    });
    addFilter(service, "beta", async () => ({ p1: false }));

    const originalError = console.error;
    console.error = () => {};
    let result;
    try {
      result = await service.getFilteredFeedItems(feedURI, { feed: [] });
    } finally {
      console.error = originalError;
    }

    assert.deepEqual(result, { p1: false });
  });

  it("skips filters that return null or non-object values", async () => {
    const { service } = makeService();
    addFilter(service, "alpha", async () => null);
    addFilter(service, "beta", async () => "not-an-object");
    addFilter(service, "gamma", async () => ({ p1: false }));

    const result = await service.getFilteredFeedItems(feedURI, { feed: [] });

    assert.deepEqual(result, { p1: false });
  });
});

describe("feed filter integration", () => {
  function makeHarness(getFilteredFeedItems) {
    const dataLayer = emptyDataLayer();
    const hiddenFeedItemsStore = new HiddenFeedItemsStore();
    const service = makeServiceWithRealBridge({
      dataLayer,
      hiddenFeedItemsStore,
    });
    service.getFilteredFeedItems = getFilteredFeedItems;
    return { service, dataLayer, hiddenFeedItemsStore };
  }

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("merges appended pages into the hidden-items store", async () => {
    let call = 0;
    const { dataLayer, hiddenFeedItemsStore } = makeHarness(async () => {
      call += 1;
      return call === 1 ? { p1: false } : { p2: false };
    });
    dataLayer.emit("feedLoaded", { feedURI: "f", feed: {}, reload: false });
    await flush();
    dataLayer.emit("feedLoaded", { feedURI: "f", feed: {}, reload: false });
    await flush();
    assert.deepEqual(hiddenFeedItemsStore.get("f"), { p1: false, p2: false });
  });

  it("replaces on reload", async () => {
    let call = 0;
    const { dataLayer, hiddenFeedItemsStore } = makeHarness(async () => {
      call += 1;
      return call === 1 ? { p1: false } : { p2: false };
    });
    dataLayer.emit("feedLoaded", { feedURI: "f", feed: {}, reload: false });
    await flush();
    dataLayer.emit("feedLoaded", { feedURI: "f", feed: {}, reload: true });
    await flush();
    assert.deepEqual(hiddenFeedItemsStore.get("f"), { p2: false });
  });

  it("targets a specific feed on refresh request", async () => {
    const invocations = [];
    const { service, dataLayer, hiddenFeedItemsStore } = makeHarness(
      async (uri) => {
        invocations.push(uri);
        return { [`x-${uri}`]: false };
      },
    );
    dataLayer.dataStore.$feeds.set("a", { feed: [] });
    dataLayer.dataStore.$feeds.set("b", { feed: [] });
    await service.refreshFeedFilters("a");
    await flush();
    assert.deepEqual(invocations, ["a"]);
    assert.deepEqual(hiddenFeedItemsStore.get("a"), { "x-a": false });
    assert.deepEqual(hiddenFeedItemsStore.get("b"), {});
  });

  it("refreshes all cached feeds when no URI is supplied", async () => {
    const invocations = [];
    const { service, dataLayer, hiddenFeedItemsStore } = makeHarness(
      async (uri) => {
        invocations.push(uri);
        return { [`x-${uri}`]: false };
      },
    );
    dataLayer.dataStore.$feeds.set("a", { feed: [] });
    dataLayer.dataStore.$feeds.set("b", { feed: [] });
    await service.refreshFeedFilters();
    await flush();
    assert.deepEqual(new Set(invocations), new Set(["a", "b"]));
    assert.deepEqual(hiddenFeedItemsStore.get("a"), { "x-a": false });
    assert.deepEqual(hiddenFeedItemsStore.get("b"), { "x-b": false });
  });
});

// The dispatcher's own behavior is covered in pluginRichTextDispatcher.test.js;
// these cover the bridge wiring and the facade rich-text elements read through.
describe("rich text wiring", () => {
  function registerTransform(service, plugin, message) {
    return service.pluginBridge._registrationTargets.get("richTextTransform")(
      plugin,
      { target: "richTextTransform", handlerId: 3, ...message },
    );
  }

  it("registers the plugin's transform with the dispatcher", async () => {
    const service = makeServiceWithRealBridge();
    const calls = [];
    registerTransform(
      service,
      {
        pluginId: "alpha",
        call: (handlerId, batch) => {
          calls.push({ handlerId, batch });
          return Promise.resolve(
            batch.map(({ tokens }) => ({ value: tokens })),
          );
        },
      },
      { handlesFacetTypes: ["blue.moji.richtext.facet"] },
    );
    assert.deepEqual(
      [...service.getClaimedFacetTypes()],
      ["blue.moji.richtext.facet"],
    );

    const tokens = [{ type: "text", value: "hello" }];
    await service.transformRichTextTokens(tokens, {
      surface: "largePost",
      uri: "at://did:test/app.bsky.feed.post/1",
      did: "did:test",
      numberOfLines: null,
      source: { text: "hello", facets: [] },
    });
    assert.deepEqual(calls.length, 1);
    assert.deepEqual(calls[0].handlerId, 3);
    assert.deepEqual(calls[0].batch[0].tokens, tokens);
  });

  it("exposes the dispatcher's version signal, which a registration bumps", () => {
    const service = makeServiceWithRealBridge();
    assert.equal(
      service.$richTextTransformsVersion,
      service.richTextDispatcher.$version,
    );
    const versionBefore = service.$richTextTransformsVersion.get();
    const dispose = registerTransform(service, {
      pluginId: "alpha",
      call: () => {},
    });
    assert.notEqual(service.$richTextTransformsVersion.get(), versionBefore);
    const versionAfterRegister = service.$richTextTransformsVersion.get();
    dispose();
    assert.notEqual(
      service.$richTextTransformsVersion.get(),
      versionAfterRegister,
    );
    assert.deepEqual([...service.getClaimedFacetTypes()], []);
  });

  it("mounts node tokens through the emitting plugin's renderer", () => {
    const service = makeServiceWithRealBridge();
    const host = document.createElement("div");
    const element = service.renderRichTextNodeToken(
      {
        type: "inline",
        pluginId: "alpha",
        node: { tag: "code", attrs: {}, text: "x", children: [], events: {} },
      },
      host,
    );
    assert.deepEqual(element.localName, "code");
    assert.deepEqual(element.textContent, "x");
  });
});

// The dispatcher's own behavior is covered in pluginSlotDispatcher.test.js; these
// cover the bridge wiring and the facade the slot element reads through.
describe("slot wiring", () => {
  function registerSlot(service, plugin, message = {}) {
    return service.pluginBridge._registrationTargets.get("slot")(plugin, {
      target: "slot",
      name: "author-badges",
      handlerId: 7,
      ...message,
    });
  }

  it("registers the plugin's slot handler with the dispatcher", async () => {
    const service = makeServiceWithRealBridge();
    const calls = [];
    registerSlot(
      service,
      {
        pluginId: "alpha",
        call: (handlerId, payload) => {
          calls.push({ handlerId, payload });
          return Promise.resolve([{ value: null }]);
        },
      },
      { cacheKey: ["did"], batch: true },
    );
    const [registration] =
      service.slotDispatcher.getRegistrations("author-badges");
    assert.deepEqual(registration.pluginId, "alpha");
    assert.deepEqual(registration.cacheKey, ["did"]);

    await registration.request({ did: "did:one", uri: "at://a" });
    // The message's batch flag reached the dispatcher (payloads arrive as an
    // array), and only the declared cacheKey fields reach the plugin
    assert.deepEqual(calls, [{ handlerId: 7, payload: [{ did: "did:one" }] }]);
  });

  it("exposes the dispatcher's registrations and slot signal", () => {
    const service = makeServiceWithRealBridge();
    const dispose = registerSlot(service, {
      pluginId: "alpha",
      call: () => Promise.resolve([]),
    });
    assert.deepEqual(service.getSlotRegistrations("author-badges").length, 1);
    assert.equal(service.$slots, service.slotDispatcher.$slots);
    assert.deepEqual(service.$slots.get("author-badges").length, 1);
    dispose();
    assert.deepEqual(service.getSlotRegistrations("author-badges"), []);
  });

  it("routes the refreshSlot host method to the calling plugin's slot", async () => {
    const service = makeServiceWithRealBridge();
    registerSlot(service, {
      pluginId: "alpha",
      call: () => Promise.resolve([{ value: null }]),
    });
    const [registration] =
      service.slotDispatcher.getRegistrations("author-badges");
    const context = { did: "did:one" };
    await registration.request(context);
    const versionBefore = registration.versionFor(context);

    service.pluginBridge._hostCallHandlers.get("refreshSlot")(
      { pluginId: "alpha" },
      { name: "author-badges", keys: [context] },
    );
    assert.notEqual(registration.versionFor(context), versionBefore);
  });
});

// Plugin pages are registered at runtime rather than declared in the
// manifest, so these cover the bridge wiring and what the page view reads.
describe("page wiring", () => {
  function makeRecordingRouter() {
    const paths = [];
    return { paths, router: { go: (path) => paths.push(path) } };
  }

  function makeServiceWithRouter(router = makeRecordingRouter().router) {
    return makeServiceWithRealBridge({ router });
  }

  function registerPage(service, plugin, message = {}) {
    return service.pluginBridge._registrationTargets.get("page")(plugin, {
      target: "page",
      id: "dashboard",
      title: "Dashboard",
      displayHandlerId: 5,
      ...message,
    });
  }

  function makePlugin(pluginId = "alpha", call = () => Promise.resolve(null)) {
    return { pluginId, call };
  }

  it("exposes a registered page and invokes its display handler", async () => {
    const service = makeServiceWithRouter();
    const calls = [];
    registerPage(
      service,
      makePlugin("alpha", (handlerId) => {
        calls.push(handlerId);
        return Promise.resolve({ tag: "div" });
      }),
    );
    const page = service.getPage("alpha", "dashboard");
    assert.deepEqual(page.pluginId, "alpha");
    assert.deepEqual(page.pageId, "dashboard");
    assert.deepEqual(page.title, "Dashboard");
    // Registering must not invoke display on its own
    assert.deepEqual(calls, []);
    assert.deepEqual(await page.customContent.display(), { tag: "div" });
    assert.deepEqual(calls, [5]);
  });

  it("keeps pages of the same plugin separate and scoped by plugin id", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin("alpha"), { id: "one", title: "One" });
    registerPage(service, makePlugin("alpha"), { id: "two", title: "Two" });
    registerPage(service, makePlugin("beta"), { id: "one", title: "Beta One" });
    assert.deepEqual(service.getPage("alpha", "one").title, "One");
    assert.deepEqual(service.getPage("alpha", "two").title, "Two");
    assert.deepEqual(service.getPage("beta", "one").title, "Beta One");
    assert.deepEqual(service.getPage("alpha", "three"), null);
  });

  it("defaults a missing title to null", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin(), { title: undefined });
    assert.deepEqual(service.getPage("alpha", "dashboard").title, null);
  });

  it("rejects page ids that aren't URL-safe", () => {
    const service = makeServiceWithRouter();
    for (const id of ["Dashboard", "a/b", "a b", "a?b", "", 7, null]) {
      assert.deepEqual(
        registerPage(service, makePlugin(), { id }),
        null,
        `expected ${JSON.stringify(id)} to be rejected`,
      );
    }
    assert.deepEqual(service.$pages.size, 0);
  });

  it("replaces an earlier registration of the same id", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin(), { title: "First" });
    registerPage(service, makePlugin(), { title: "Second" });
    assert.deepEqual(service.$pages.size, 1);
    assert.deepEqual(service.getPage("alpha", "dashboard").title, "Second");
  });

  it("disposes only its own entry, not a replacement", () => {
    const service = makeServiceWithRouter();
    const disposeFirst = registerPage(service, makePlugin(), {
      title: "First",
    });
    registerPage(service, makePlugin(), { title: "Second" });
    disposeFirst();
    assert.deepEqual(service.getPage("alpha", "dashboard").title, "Second");
  });

  it("removes the page when its registration is disposed", () => {
    const service = makeServiceWithRouter();
    const dispose = registerPage(service, makePlugin());
    dispose();
    assert.deepEqual(service.getPage("alpha", "dashboard"), null);
  });

  it("bumps the page's customContent refresh signal", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin());
    const { customContent } = service.getPage("alpha", "dashboard");
    assert.deepEqual(customContent.$refresh.get(), null);

    service.pluginBridge._hostCallHandlers.get("refreshPage")(
      { pluginId: "alpha" },
      { pageId: "dashboard", reset: true },
    );
    assert.deepEqual(customContent.$refresh.get(), { reset: true });
  });

  it("defaults refreshPage's reset flag to false and requires a pageId", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin());
    const { customContent } = service.getPage("alpha", "dashboard");
    const refreshPage =
      service.pluginBridge._hostCallHandlers.get("refreshPage");

    refreshPage({ pluginId: "alpha" }, { pageId: "dashboard" });
    assert.deepEqual(customContent.$refresh.get(), { reset: false });
    assert.throws(() => refreshPage({ pluginId: "alpha" }, {}), /pageId/);
  });

  it("signals a fresh value on every refresh so repeats still notify", () => {
    const service = makeServiceWithRouter();
    registerPage(service, makePlugin());
    const { customContent } = service.getPage("alpha", "dashboard");
    const refreshPage =
      service.pluginBridge._hostCallHandlers.get("refreshPage");

    refreshPage({ pluginId: "alpha" }, { pageId: "dashboard" });
    const first = customContent.$refresh.get();
    refreshPage({ pluginId: "alpha" }, { pageId: "dashboard" });
    assert.notEqual(customContent.$refresh.get(), first);
  });

  it("ignores a refresh for a page that is not registered", () => {
    const service = makeServiceWithRouter();
    const refreshPage =
      service.pluginBridge._hostCallHandlers.get("refreshPage");
    refreshPage({ pluginId: "alpha" }, { pageId: "missing" });
  });

  it("routes openPage to the calling plugin's own page path", () => {
    const { paths, router } = makeRecordingRouter();
    const service = makeServiceWithRouter(router);
    const openPage = service.pluginBridge._hostCallHandlers.get("openPage");
    openPage({ pluginId: "alpha" }, { pageId: "dashboard" });
    assert.deepEqual(paths, ["/plugin/alpha/pages/dashboard"]);
  });

  it("encodes the plugin id in the openPage path and requires a pageId", () => {
    const { paths, router } = makeRecordingRouter();
    const service = makeServiceWithRouter(router);
    const openPage = service.pluginBridge._hostCallHandlers.get("openPage");
    openPage({ pluginId: "alpha/../beta" }, { pageId: "dashboard" });
    assert.deepEqual(paths, ["/plugin/alpha%2F..%2Fbeta/pages/dashboard"]);
    assert.throws(() => openPage({ pluginId: "alpha" }, {}), /pageId/);
  });

  it("reports the plugin's load status", async () => {
    const service = makeServiceWithRouter();
    service.$initialLoadComplete.set(true);
    assert.deepEqual(service.getPluginLoadStatus("alpha"), {
      loading: false,
      error: null,
    });
    service.pluginBridge.$loading.set("alpha", true);
    assert.deepEqual(service.getPluginLoadStatus("alpha"), {
      loading: true,
      error: null,
    });
    const error = new Error("boom");
    service.pluginBridge.$loading.set("alpha", false);
    service.pluginBridge.$pluginLoadingErrors.set("alpha", error);
    assert.deepEqual(service.getPluginLoadStatus("alpha"), {
      loading: false,
      error,
    });
  });
});

describe("app.data host methods", () => {
  function makeStubComputedMap(lookup) {
    const calls = [];
    const map = {
      get: (key) => {
        calls.push(key);
        return lookup(key);
      },
    };
    return { map, calls };
  }

  function makeService(dataLayerOverrides) {
    const dataLayer = Object.assign(emptyDataLayer(), dataLayerOverrides);
    return makeServiceWithRealBridge({ dataLayer });
  }

  it("getProfile host method returns the hydrated profile from derived", async () => {
    const profiles = makeStubComputedMap((did) => ({
      did,
      handle: "alice.test",
    }));
    const service = makeService({
      derived: { $hydratedProfiles: profiles.map },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:abc" });
    assert.deepEqual(profiles.calls, ["did:plc:abc"]);
    assert.deepEqual(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getPost fetches the post on a cache miss", async () => {
    const ensureCalls = [];
    const service = makeService({
      declarative: {
        ensurePost: async (uri) => {
          ensureCalls.push(uri);
          return { uri, record: { text: "fetched" } };
        },
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getPost");
    const result = await handler(null, { uri: "at://example/post/1" });
    assert.deepEqual(ensureCalls, ["at://example/post/1"]);
    assert.deepEqual(result, {
      uri: "at://example/post/1",
      record: { text: "fetched" },
    });
  });

  it("getPost returns null when the post cannot be loaded", async () => {
    const service = makeService({
      declarative: {
        ensurePost: async () => {
          throw new Error("Post not found");
        },
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getPost");
    const result = await handler(null, { uri: "at://example/post/gone" });
    assert.deepEqual(result, null);
  });

  it("getProfile fetches on a cache miss and returns the basic hydrated profile", async () => {
    let loaded = false;
    const profiles = makeStubComputedMap((did) =>
      loaded ? { did, handle: "alice.test" } : null,
    );
    const ensureCalls = [];
    const service = makeService({
      derived: { $hydratedProfiles: profiles.map },
      declarative: {
        ensureDetailedProfile: async (did) => {
          ensureCalls.push(did);
          loaded = true;
        },
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:abc" });
    assert.deepEqual(ensureCalls, ["did:plc:abc"]);
    assert.deepEqual(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getKnownFollowers resolves via the declarative layer", async () => {
    const knownFollowers = { followers: [{ did: "did:plc:follower" }] };
    const ensureCalls = [];
    const service = makeService({
      declarative: {
        ensureKnownFollowers: async (did) => {
          ensureCalls.push(did);
          return knownFollowers;
        },
      },
    });
    const handler =
      service.pluginBridge._hostCallHandlers.get("getKnownFollowers");
    const result = await handler(null, { did: "did:plc:abc" });
    assert.deepEqual(ensureCalls, ["did:plc:abc"]);
    assert.deepEqual(result, knownFollowers);
  });

  it("getKnownFollowers returns null when the list cannot be loaded", async () => {
    const service = makeService({
      declarative: {
        ensureKnownFollowers: async () => {
          throw new Error("Known followers not found");
        },
      },
    });
    const handler =
      service.pluginBridge._hostCallHandlers.get("getKnownFollowers");
    const result = await handler(null, { did: "did:plc:missing" });
    assert.deepEqual(result, null);
  });

  it("getProfile returns null when the profile cannot be loaded", async () => {
    const service = makeService({
      derived: { $hydratedProfiles: makeStubComputedMap(() => null).map },
      declarative: {
        ensureDetailedProfile: async () => {
          throw new Error("Profile not found");
        },
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:missing" });
    assert.deepEqual(result, null);
  });
});

describe("action host methods", () => {
  const feedbackPlugin = { pluginId: "test-plugin" };
  const postUri = "at://did:plc:author/app.bsky.feed.post/1";
  const feedUri = "at://did:plc:feedgen/app.bsky.feed.generator/cool-feed";

  function makeService({
    feedItem = null,
    feedGenerator = null,
    hydratedProfiles = {},
    permissions = { actions: ["mute", "block", "feedFeedback"] },
  } = {}) {
    const { state, provider } = makeProvider();
    state.installedPlugins = [
      { id: "test-plugin", version: "1.0.0", enabled: true, permissions },
    ];
    const calls = {
      showLess: [],
      showMore: [],
      mute: [],
      unmute: [],
      block: [],
      unblock: [],
    };
    const dataLayer = Object.assign(new EventEmitter(), {
      dataStore: {
        $feeds: {
          get: (uri) =>
            uri === feedUri && feedItem ? { feed: [feedItem] } : null,
        },
      },
      derived: {
        $feedGenerators: {
          get: (uri) => (uri === feedUri ? feedGenerator : null),
        },
        $hydratedDetailedProfiles: { get: () => null },
        $hydratedProfiles: { get: (did) => hydratedProfiles[did] ?? null },
      },
      mutations: {
        sendShowLessInteraction: async (...args) => calls.showLess.push(args),
        sendShowMoreInteraction: async (...args) => calls.showMore.push(args),
        muteProfile: async (profile) => calls.mute.push(profile),
        unmuteProfile: async (profile) => calls.unmute.push(profile),
        blockProfile: async (profile) => calls.block.push(profile),
        unblockProfile: async (profile) => calls.unblock.push(profile),
      },
      declarative: {
        ensureProfile: async (did) => hydratedProfiles[did] ?? { did },
      },
    });
    const session = { did: "did:plc:me", handle: "me.test" };
    const service = makeServiceWithRealBridge({ provider, session, dataLayer });
    return { service, calls };
  }

  function getHandler(service, name) {
    return service.pluginBridge._hostCallHandlers.get(name);
  }

  it("showLessLikeThis resolves feedContext and proxy from the feed", async () => {
    const { service, calls } = makeService({
      feedItem: { post: { uri: postUri }, feedContext: "ctx" },
      feedGenerator: { uri: feedUri, did: "did:web:feed.example" },
    });
    await getHandler(service, "showLessLikeThis")(feedbackPlugin, {
      postUri,
      feedUri,
    });
    assert.deepEqual(calls.showLess, [
      [postUri, feedUri, "ctx", "did:web:feed.example#bsky_fg"],
    ]);
  });

  it("showLessLikeThis and showMoreLikeThis reject when feedUri is missing", async () => {
    const { service, calls } = makeService();
    await assert.rejects(
      getHandler(service, "showLessLikeThis")(feedbackPlugin, { postUri }),
      /requires a feedUri/,
    );
    await assert.rejects(
      getHandler(service, "showMoreLikeThis")(feedbackPlugin, { postUri }),
      /requires a feedUri/,
    );
    assert.deepEqual(calls.showLess, []);
    assert.deepEqual(calls.showMore, []);
  });

  it("both methods reject when postUri is missing", async () => {
    const { service, calls } = makeService();
    await assert.rejects(
      getHandler(service, "showLessLikeThis")(feedbackPlugin, { feedUri }),
      /requires a postUri/,
    );
    await assert.rejects(
      getHandler(service, "showMoreLikeThis")(feedbackPlugin, { feedUri }),
      /requires a postUri/,
    );
    assert.deepEqual(calls.showLess, []);
    assert.deepEqual(calls.showMore, []);
  });

  it("muteActor and blockActor reject when did is missing", async () => {
    const { service } = makeService();
    await assert.rejects(
      getHandler(service, "muteActor")({ pluginId: "test-plugin" }, {}),
      /muteActor requires a did/,
    );
    await assert.rejects(
      getHandler(service, "blockActor")({ pluginId: "test-plugin" }, {}),
      /blockActor requires a did/,
    );
  });

  it("showLessLikeThis with an uncached feed still resolves the generator proxy", async () => {
    const { service, calls } = makeService({
      feedGenerator: { uri: feedUri, did: "did:web:feed.example" },
    });
    await getHandler(service, "showLessLikeThis")(feedbackPlugin, {
      postUri,
      feedUri,
    });
    assert.deepEqual(calls.showLess, [
      [postUri, feedUri, null, "did:web:feed.example#bsky_fg"],
    ]);
  });

  it("showMoreLikeThis resolves attribution the same way", async () => {
    const { service, calls } = makeService({
      feedItem: { post: { uri: postUri }, feedContext: "ctx" },
      feedGenerator: { uri: feedUri, did: "did:web:feed.example" },
    });
    await getHandler(service, "showMoreLikeThis")(feedbackPlugin, {
      postUri,
      feedUri,
    });
    assert.deepEqual(calls.showMore, [
      [postUri, feedUri, "ctx", "did:web:feed.example#bsky_fg"],
    ]);
  });

  it("both methods require the feedFeedback action permission", async () => {
    const { service, calls } = makeService({
      permissions: { actions: ["mute"] },
    });
    for (const name of ["showLessLikeThis", "showMoreLikeThis"]) {
      await assert.rejects(
        getHandler(service, name)(feedbackPlugin, { postUri, feedUri }),
        /"feedFeedback" action permission/,
      );
    }
    assert.deepEqual(calls.showLess, []);
    assert.deepEqual(calls.showMore, []);
  });

  it("muteActor routes the mute flag to muteProfile and unmuteProfile", async () => {
    const did = "did:plc:target";
    const profile = { did, handle: "target.example" };
    const { service, calls } = makeService({
      hydratedProfiles: { [did]: profile },
      permissions: { actions: ["mute"] },
    });
    const mutePlugin = { pluginId: "test-plugin" };
    await getHandler(service, "muteActor")(mutePlugin, { did, mute: true });
    await getHandler(service, "muteActor")(mutePlugin, { did, mute: false });
    assert.deepEqual(calls.mute, [profile]);
    assert.deepEqual(calls.unmute, [profile]);
  });

  it("blockActor routes the block flag to blockProfile and unblockProfile", async () => {
    const did = "did:plc:target";
    const { service, calls } = makeService({
      permissions: { actions: ["block"] },
    });
    const blockPlugin = { pluginId: "test-plugin" };
    await getHandler(service, "blockActor")(blockPlugin, { did, block: true });
    await getHandler(service, "blockActor")(blockPlugin, { did, block: false });
    assert.deepEqual(calls.block, [{ did }]);
    assert.deepEqual(calls.unblock, [{ did }]);
  });

  it("muteActor and blockActor require their action permissions", async () => {
    const { service, calls } = makeService({
      permissions: { actions: ["feedFeedback"] },
    });
    const plugin = { pluginId: "test-plugin" };
    const did = "did:plc:target";
    await assert.rejects(
      getHandler(service, "muteActor")(plugin, { did }),
      /"mute" action permission/,
    );
    await assert.rejects(
      getHandler(service, "blockActor")(plugin, { did }),
      /"block" action permission/,
    );
    assert.deepEqual(calls.mute, []);
    assert.deepEqual(calls.block, []);
  });

  it("denies actions for a plugin with no installed-plugin entry", async () => {
    const { service, calls } = makeService();
    await assert.rejects(
      getHandler(service, "muteActor")(
        { pluginId: "not-installed" },
        { did: "did:plc:x" },
      ),
      /"mute" action permission/,
    );
    assert.deepEqual(calls.mute, []);
  });

  it("all action methods reject when signed out", async () => {
    const service = makeServiceWithRealBridge();
    const allActionsPlugin = {
      pluginId: "test-plugin",
      permissions: { actions: ["mute", "block", "feedFeedback"] },
    };
    const argsByMethod = {
      muteActor: { did: "did:plc:target" },
      blockActor: { did: "did:plc:target" },
      showLessLikeThis: { postUri, feedUri },
      showMoreLikeThis: { postUri, feedUri },
    };
    for (const [name, args] of Object.entries(argsByMethod)) {
      await assert.rejects(
        getHandler(service, name)(allActionsPlugin, args),
        /Not signed in/,
      );
    }
  });
});

describe("getRecord host method", () => {
  function jsonResponse(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  }

  const VALID_COLLECTION = "blue.moji.collection.item";
  const VALID_RKEY = "blobcat";

  let didCounter = 0;
  function uniqueDid() {
    didCounter++;
    return `did:plc:test${didCounter.toString().padStart(6, "0")}`;
  }

  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch(handler) {
    const calls = [];
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return handler(url);
    };
    return { calls };
  }

  it("fetches the record from Slingshot", async () => {
    const service = makeServiceWithRealBridge();
    const did = uniqueDid();
    const record = {
      uri: `at://${did}/${VALID_COLLECTION}/${VALID_RKEY}`,
      cid: "bafyfake",
      value: { name: "blobcat" },
    };
    const { calls } = stubFetch(async () => jsonResponse(200, record));
    const handler = service.pluginBridge._hostCallHandlers.get("getRecord");
    const result = await handler(null, {
      repo: did,
      collection: VALID_COLLECTION,
      rkey: VALID_RKEY,
    });
    assert.deepEqual(result, record);
    const url = new URL(calls[0]);
    assert.deepEqual(url.origin, "https://slingshot.microcosm.blue");
    assert.deepEqual(url.pathname, "/xrpc/com.atproto.repo.getRecord");
    assert.deepEqual(url.searchParams.get("repo"), did);
    assert.deepEqual(url.searchParams.get("collection"), VALID_COLLECTION);
    assert.deepEqual(url.searchParams.get("rkey"), VALID_RKEY);
  });

  it("returns null on RecordNotFound", async () => {
    const service = makeServiceWithRealBridge();
    const did = uniqueDid();
    stubFetch(async () =>
      jsonResponse(400, { error: "RecordNotFound", message: "gone" }),
    );
    const handler = service.pluginBridge._hostCallHandlers.get("getRecord");
    const result = await handler(null, {
      repo: did,
      collection: VALID_COLLECTION,
      rkey: VALID_RKEY,
    });
    assert.deepEqual(result, null);
  });

  it("rejects on other errors so the plugin can retry", async () => {
    const service = makeServiceWithRealBridge();
    const did = uniqueDid();
    stubFetch(async () => jsonResponse(502, null));
    const handler = service.pluginBridge._hostCallHandlers.get("getRecord");
    let caught = null;
    try {
      await handler(null, {
        repo: did,
        collection: VALID_COLLECTION,
        rkey: VALID_RKEY,
      });
    } catch (e) {
      caught = e;
    }
    assert(caught !== null);
  });

  it("rejects invalid repo/collection/rkey inputs without hitting the network", async () => {
    const service = makeServiceWithRealBridge();
    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return jsonResponse(200, {});
    };
    const handler = service.pluginBridge._hostCallHandlers.get("getRecord");
    const invalidInputs = [
      { repo: "not-a-did", collection: VALID_COLLECTION, rkey: VALID_RKEY },
      { repo: "did:plc:abc", collection: "not.enough", rkey: VALID_RKEY },
      { repo: "did:plc:abc", collection: VALID_COLLECTION, rkey: "" },
      { repo: "did:plc:abc", collection: VALID_COLLECTION, rkey: "has/slash" },
    ];
    for (const inputs of invalidInputs) {
      let caught = null;
      try {
        await handler(null, inputs);
      } catch (e) {
        caught = e;
      }
      assert(
        caught !== null,
        `expected rejection for ${JSON.stringify(inputs)}`,
      );
    }
    assert.deepEqual(fetched, false);
  });
});

describe("getBacklinks host method", () => {
  const SUBJECT = "at://did:plc:test000001/app.bsky.graph.list/3laa";
  const SOURCE = "app.bsky.graph.listitem:list";

  function makeServiceWithStubbedConstellation() {
    const { provider } = makeProvider();
    const calls = [];
    const constellation = {
      getLinks: async (args) => {
        calls.push(args);
        return [
          { did: "did:plc:test000002", collection: SOURCE, rkey: "3lbb" },
        ];
      },
    };
    return { service: makeServiceWithRealBridge({ constellation }), calls };
  }

  function getHandler(service) {
    return service.pluginBridge._hostCallHandlers.get("getBacklinks");
  }

  it("passes validated args through to the constellation client", async () => {
    const { service, calls } = makeServiceWithStubbedConstellation();
    const result = await getHandler(service)(null, {
      subject: SUBJECT,
      source: SOURCE,
      limit: 50,
    });
    assert.deepEqual(calls, [{ subject: SUBJECT, source: SOURCE, limit: 50 }]);
    assert.deepEqual(result.length, 1);
  });

  it("accepts a bare did as the subject", async () => {
    const { service, calls } = makeServiceWithStubbedConstellation();
    await getHandler(service)(null, {
      subject: "did:plc:test000001",
      source: "app.bsky.graph.follow:subject",
      limit: 10,
    });
    assert.deepEqual(calls[0].subject, "did:plc:test000001");
  });

  it("ignores a plugin-supplied timeout", async () => {
    const { service, calls } = makeServiceWithStubbedConstellation();
    await getHandler(service)(null, {
      subject: SUBJECT,
      source: SOURCE,
      limit: 1000,
      timeout: 1,
    });
    assert.deepEqual(calls[0], {
      subject: SUBJECT,
      source: SOURCE,
      limit: 1000,
    });
  });

  // A malformed subject/source is the plugin author's problem: it comes back
  // as an upstream 400 rather than being second-guessed here.
  it("passes through subject/source syntax it doesn't recognize", async () => {
    const { service, calls } = makeServiceWithStubbedConstellation();
    await getHandler(service)(null, {
      subject: "https://example.com/not-atproto",
      source: "not-an-nsid",
      limit: 10,
    });
    assert.deepEqual(calls[0].subject, "https://example.com/not-atproto");
    assert.deepEqual(calls[0].source, "not-an-nsid");
  });

  // A limit that isn't a positive integer under the cap would leave the
  // host's pagination loop unbounded (missing/null) or silently empty
  // (NaN, non-numeric strings), so none of them may reach constellation.
  it("rejects a limit that isn't a positive integer within the cap", async () => {
    const { service, calls } = makeServiceWithStubbedConstellation();
    const invalidLimits = [
      undefined,
      null,
      0,
      -1,
      1.5,
      1001,
      "10",
      "abc",
      NaN,
      Infinity,
    ];
    for (const limit of invalidLimits) {
      await assert.rejects(
        (async () =>
          getHandler(service)(null, {
            subject: SUBJECT,
            source: SOURCE,
            limit,
          }))(),
        /getBacklinks: invalid limit/,
        `expected rejection for limit ${limit}`,
      );
    }
    assert.deepEqual(calls, []);
  });

  it("requires no permissions and no session", () => {
    const { service } = makeServiceWithStubbedConstellation();
    assert.deepEqual(service.session, null);
    assert(getHandler(service) !== undefined);
  });
});

describe("loadLocalData/saveLocalData host methods", () => {
  function getHandler(service, name) {
    return service.pluginBridge._hostCallHandlers.get(name);
  }

  const plugin = { pluginId: "tags", permissions: {} };

  it("returns null before anything has been saved", () => {
    const service = makeServiceWithRealBridge();
    assert.deepEqual(getHandler(service, "loadLocalData")(plugin), null);
  });

  it("round-trips data through saveLocalData/loadLocalData", () => {
    const service = makeServiceWithRealBridge();
    const data = { keys: [{ id: "k1", label: "personal", secret: "shh" }] };
    getHandler(service, "saveLocalData")(plugin, { data });
    assert.deepEqual(getHandler(service, "loadLocalData")(plugin), data);
  });

  it("isolates data between plugins", () => {
    const service = makeServiceWithRealBridge();
    getHandler(service, "saveLocalData")(plugin, { data: { a: 1 } });
    getHandler(service, "saveLocalData")(
      { pluginId: "other", permissions: {} },
      { data: { a: 2 } },
    );
    assert.deepEqual(getHandler(service, "loadLocalData")(plugin), { a: 1 });
    assert.deepEqual(
      getHandler(service, "loadLocalData")({ pluginId: "other" }),
      { a: 2 },
    );
  });
});

describe("binaryCache host methods", () => {
  function makeServiceWithPermissions(permissions) {
    const { state, provider } = makeProvider();
    state.installedPlugins = [
      { id: "translate", version: "1.0.0", enabled: true, permissions },
    ];
    const service = makeServiceWithRealBridge({ provider });
    // The real store is Cache-API backed; these tests are about permission
    // gating and argument plumbing, which pluginBinaryCache.test.js already
    // covers directly against the real class - swap in an inert fake here.
    const calls = [];
    service.binaryCache = {
      _data: new Map(),
      async get(pluginId, key) {
        calls.push(["get", pluginId, key]);
        return this._data.get(`${pluginId}:${key}`) ?? null;
      },
      async put(pluginId, key, buffer) {
        calls.push(["put", pluginId, key]);
        this._data.set(`${pluginId}:${key}`, buffer);
      },
      async delete(pluginId, key) {
        calls.push(["delete", pluginId, key]);
        this._data.delete(`${pluginId}:${key}`);
      },
    };
    return { service, calls };
  }

  function getHandler(service, name) {
    return service.pluginBridge._hostCallHandlers.get(name);
  }

  const plugin = { pluginId: "translate" };

  it("rejects every operation without the binaryCache storage scope", async () => {
    const { service } = makeServiceWithPermissions({});
    await assert.rejects(
      () => getHandler(service, "getBinaryCacheEntry")(plugin, { key: "k" }),
      /"binaryCache" storage permission/,
    );
    await assert.rejects(
      () =>
        getHandler(service, "putBinaryCacheEntry")(plugin, {
          key: "k",
          data: "AQ==",
        }),
      /"binaryCache" storage permission/,
    );
    await assert.rejects(
      () => getHandler(service, "deleteBinaryCacheEntry")(plugin, { key: "k" }),
      /"binaryCache" storage permission/,
    );
  });

  it("round-trips bytes through put/get when permitted", async () => {
    const { service } = makeServiceWithPermissions({
      storage: ["binaryCache"],
    });
    // base64 for the bytes [1, 2, 3]
    await getHandler(service, "putBinaryCacheEntry")(plugin, {
      key: "engine",
      data: "AQID",
    });
    const base64 = await getHandler(service, "getBinaryCacheEntry")(plugin, {
      key: "engine",
    });
    const stored = new Uint8Array(Buffer.from(base64, "base64"));
    assert.deepEqual([...stored], [1, 2, 3]);
  });

  it("returns null for a key that was never stored", async () => {
    const { service } = makeServiceWithPermissions({
      storage: ["binaryCache"],
    });
    assert.deepEqual(
      await getHandler(service, "getBinaryCacheEntry")(plugin, {
        key: "missing",
      }),
      null,
    );
  });

  it("delete removes the entry and calls are scoped to this plugin's id", async () => {
    const { service, calls } = makeServiceWithPermissions({
      storage: ["binaryCache"],
    });
    await getHandler(service, "putBinaryCacheEntry")(plugin, {
      key: "engine",
      data: "AQID",
    });
    await getHandler(service, "deleteBinaryCacheEntry")(plugin, {
      key: "engine",
    });
    assert.deepEqual(
      await getHandler(service, "getBinaryCacheEntry")(plugin, {
        key: "engine",
      }),
      null,
    );
    assert.deepEqual(
      calls.every(([, pluginId]) => pluginId === "translate"),
      true,
    );
  });

  it("requires a key argument", async () => {
    const { service } = makeServiceWithPermissions({
      storage: ["binaryCache"],
    });
    await assert.rejects(
      () => getHandler(service, "getBinaryCacheEntry")(plugin, {}),
      /key/,
    );
  });
});

describe("getPostComposerInit", () => {
  function addListener(service, pluginId, handler) {
    let listeners = service.registries.eventListeners.get("post-composer-open");
    if (!listeners) {
      listeners = new Map();
      service.registries.eventListeners.set("post-composer-open", listeners);
    }
    listeners.set(pluginId, handler);
  }

  it("returns null when no listeners are registered", async () => {
    const { service } = makeService();
    const result = await service.getPostComposerInit({ kind: "post" });
    assert.deepEqual(result, null);
  });

  it("returns null when listeners contribute no ops and no cursor", async () => {
    const { service } = makeService();
    addListener(service, "noop", async () => ({ ops: [], cursor: null }));
    addListener(service, "alsoNoop", async () => null);
    const result = await service.getPostComposerInit({ kind: "post" });
    assert.deepEqual(result, null);
  });

  it("appends text from a single listener", async () => {
    const { service } = makeService();
    addListener(service, "sig", async () => ({
      ops: [{ op: "append", text: "\n\n— signed" }],
      cursor: null,
    }));
    const result = await service.getPostComposerInit({ kind: "post" });
    assert.deepEqual(result, { text: "\n\n— signed", cursor: null });
  });

  it("composes set/append/prepend across multiple listeners in order", async () => {
    const { service } = makeService();
    addListener(service, "alpha", async () => ({
      ops: [{ op: "set", text: "middle" }],
      cursor: null,
    }));
    addListener(service, "beta", async () => ({
      ops: [{ op: "append", text: " end" }],
      cursor: null,
    }));
    addListener(service, "gamma", async () => ({
      ops: [{ op: "prepend", text: "start " }],
      cursor: null,
    }));
    const result = await service.getPostComposerInit({ kind: "post" });
    assert.deepEqual(result.text, "start middle end");
  });

  it("last setCursor wins; nulls do not clobber prior cursor", async () => {
    const { service } = makeService();
    addListener(service, "alpha", async () => ({
      ops: [{ op: "append", text: "a" }],
      cursor: 0,
    }));
    addListener(service, "beta", async () => ({
      ops: [{ op: "append", text: "b" }],
      cursor: null,
    }));
    addListener(service, "gamma", async () => ({
      ops: [{ op: "append", text: "c" }],
      cursor: -1,
    }));
    const result = await service.getPostComposerInit({ kind: "post" });
    assert.deepEqual(result, { text: "abc", cursor: -1 });
  });

  it("ignores listeners that throw", async () => {
    const { service } = makeService();
    addListener(service, "alpha", async () => {
      throw new Error("boom");
    });
    addListener(service, "beta", async () => ({
      ops: [{ op: "append", text: "ok" }],
      cursor: null,
    }));
    const originalError = console.error;
    console.error = () => {};
    let result;
    try {
      result = await service.getPostComposerInit({ kind: "post" });
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(result, { text: "ok", cursor: null });
  });

  it("passes context through to each listener", async () => {
    const { service } = makeService();
    let captured = null;
    addListener(service, "alpha", async (context) => {
      captured = context;
      return { ops: [], cursor: null };
    });
    const context = { kind: "reply", replyTo: { uri: "at://x" } };
    await service.getPostComposerInit(context);
    // The service normalizes the context, so absent fields arrive as
    // explicit undefined keys
    assert.deepEqual(captured, {
      kind: "reply",
      replyTo: { uri: "at://x" },
      replyRoot: undefined,
      quotedPost: undefined,
    });
  });
});
