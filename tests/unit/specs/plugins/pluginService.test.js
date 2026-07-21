import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  PluginService,
  PermissionsDeclinedError,
} from "/js/plugins/pluginService.js";
import { Signal } from "/js/signals.js";
import { respondToConfirm } from "../../testHelpers.js";

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
    provider,
    loadCalls,
    reloadCalls,
    unloadCalls,
    reconcileCalls,
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
        { pluginId: "a", error: new Error("Failed to load plugin source") },
        { pluginId: "b", error: new Error("Failed to load plugin source") },
        { pluginId: "c", error: new Error("Failed to load plugin manifest") },
      ],
    });
    document.body.innerHTML = "";
    await service.loadEnabledPlugins();
    const toasts = [...document.body.querySelectorAll('[data-testid="toast"]')];
    assert.deepEqual(
      toasts.map((toast) => toast.textContent.trim()),
      [
        "Failed to load plugin(s): a, b - Failed to load plugin source",
        "Failed to load plugin(s): c - Failed to load plugin manifest",
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

  it("rejects non-GitHub URLs", async () => {
    const { service, state } = makeService();
    let caught = null;
    try {
      await service.installUnregisteredPlugin("https://example.com/ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Invalid GitHub URL"));
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

describe("getClaimedFacetTypes", () => {
  function makeServiceWithRealBridge() {
    const { provider } = makeProvider();
    return new PluginService(provider, null);
  }
  function registerTransform(service, pluginId, message) {
    const handler =
      service.pluginBridge._registrationTargets.get("richTextTransform");
    return handler({ pluginId, call: () => {} }, message);
  }

  it("is empty when no transforms are registered", () => {
    const service = makeServiceWithRealBridge();
    assert.deepEqual([...service.getClaimedFacetTypes()], []);
  });

  it("unions handlesFacetTypes across registered transforms", () => {
    const service = makeServiceWithRealBridge();
    registerTransform(service, "alpha", {
      handlerId: 1,
      handlesFacetTypes: ["blue.moji.richtext.facet", "dev.impro.foo"],
    });
    registerTransform(service, "beta", {
      handlerId: 2,
      handlesFacetTypes: ["dev.impro.foo"],
    });
    assert.deepEqual([...service.getClaimedFacetTypes()].sort(), [
      "blue.moji.richtext.facet",
      "dev.impro.foo",
    ]);
  });

  it("drops entries when a transform unregisters", () => {
    const service = makeServiceWithRealBridge();
    const dispose = registerTransform(service, "alpha", {
      handlerId: 1,
      handlesFacetTypes: ["blue.moji.richtext.facet"],
    });
    dispose();
    assert.deepEqual([...service.getClaimedFacetTypes()], []);
  });

  it("tolerates a transform registered without handlesFacetTypes", () => {
    const service = makeServiceWithRealBridge();
    registerTransform(service, "alpha", { handlerId: 1 });
    assert.deepEqual([...service.getClaimedFacetTypes()], []);
  });
});

describe("slot registry", () => {
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
    assert.deepEqual(service.getSlotEntries("nope"), []);
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
    assert.deepEqual(
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
    assert.deepEqual(calls, [{ handlerId: 7, args: [{ uri: "at://test" }] }]);
  });

  it("dispose removes the entry and prunes the slot when empty", () => {
    const service = makeServiceWithRealBridge();
    const dispose = register(service, makePlugin("alpha"), {
      target: "slot",
      name: "x",
      handlerId: 1,
    });
    assert.deepEqual(service.getSlotEntries("x").length, 1);
    dispose();
    assert.deepEqual(service.getSlotEntries("x"), []);
    assert.deepEqual(service.$slots.get("x"), null);
  });

  it("updates the $slots signal on register and unregister", () => {
    const service = makeServiceWithRealBridge();
    const updates = [];
    const initial = service.$slots.get("x");
    const dispose = register(service, makePlugin("alpha"), {
      target: "slot",
      name: "x",
      handlerId: 1,
    });
    updates.push(
      service.$slots.get("x")?.map((entry) => entry.pluginId) ?? null,
    );
    dispose();
    updates.push(
      service.$slots.get("x")?.map((entry) => entry.pluginId) ?? null,
    );
    assert.deepEqual(initial, null);
    assert.deepEqual(updates, [["alpha"], null]);
  });
});

describe("app.data host methods", () => {
  function makeServiceWithRealBridge() {
    const { provider } = makeProvider();
    return new PluginService(provider, null);
  }

  // Stubs a ComputedMap: get(key) returns the value directly.
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

  it("getProfile host method returns the hydrated profile from derived", async () => {
    const service = makeServiceWithRealBridge();
    const profiles = makeStubComputedMap((did) => ({
      did,
      handle: "alice.test",
    }));
    service.setDataLayer({
      derived: {
        $hydratedPosts: makeStubComputedMap(() => null).map,
        $hydratedProfiles: profiles.map,
      },
    });
    const handler = service.pluginBridge._hostCallHandlers.get("getProfile");
    const result = await handler(null, { did: "did:plc:abc" });
    assert.deepEqual(profiles.calls, ["did:plc:abc"]);
    assert.deepEqual(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getPost returns null when dataLayer has not been set", async () => {
    const service = makeServiceWithRealBridge();
    const handler = service.pluginBridge._hostCallHandlers.get("getPost");
    const result = await handler(null, { uri: "at://example" });
    assert.deepEqual(result, null);
  });

  it("getPost fetches the post on a cache miss", async () => {
    const service = makeServiceWithRealBridge();
    const ensureCalls = [];
    service.setDataLayer({
      derived: {
        $hydratedPosts: makeStubComputedMap(() => null).map,
        $hydratedProfiles: makeStubComputedMap(() => null).map,
      },
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
    const service = makeServiceWithRealBridge();
    service.setDataLayer({
      derived: {
        $hydratedPosts: makeStubComputedMap(() => null).map,
        $hydratedProfiles: makeStubComputedMap(() => null).map,
      },
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
    const service = makeServiceWithRealBridge();
    let loaded = false;
    const profiles = makeStubComputedMap((did) =>
      loaded ? { did, handle: "alice.test" } : null,
    );
    const ensureCalls = [];
    service.setDataLayer({
      derived: {
        $hydratedPosts: makeStubComputedMap(() => null).map,
        $hydratedProfiles: profiles.map,
      },
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
    const service = makeServiceWithRealBridge();
    const knownFollowers = { followers: [{ did: "did:plc:follower" }] };
    const ensureCalls = [];
    service.setDataLayer({
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
    const service = makeServiceWithRealBridge();
    service.setDataLayer({
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
    const service = makeServiceWithRealBridge();
    service.setDataLayer({
      derived: {
        $hydratedPosts: makeStubComputedMap(() => null).map,
        $hydratedProfiles: makeStubComputedMap(() => null).map,
      },
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

describe("feed feedback host methods", () => {
  const feedbackPlugin = {
    pluginId: "test-plugin",
    permissions: { moderation: ["feedback"] },
  };
  const postUri = "at://did:plc:author/app.bsky.feed.post/1";
  const feedUri = "at://did:plc:feedgen/app.bsky.feed.generator/cool-feed";

  function makeService({ feedItem = null, feedGenerator = null } = {}) {
    const { provider } = makeProvider();
    const service = new PluginService(provider, null);
    const calls = { showLess: [], showMore: [], sendInteractions: [] };
    service.setDataLayer({
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
      },
      mutations: {
        sendShowLessInteraction: async (...args) => calls.showLess.push(args),
        sendShowMoreInteraction: async (...args) => calls.showMore.push(args),
      },
      api: {
        sendInteractions: async (...args) => calls.sendInteractions.push(args),
      },
    });
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

  it("all three methods reject when postUri is missing", async () => {
    const { service, calls } = makeService();
    await assert.rejects(
      getHandler(service, "showLessLikeThis")(feedbackPlugin, { feedUri }),
      /requires a postUri/,
    );
    await assert.rejects(
      getHandler(service, "showMoreLikeThis")(feedbackPlugin, { feedUri }),
      /requires a postUri/,
    );
    await assert.rejects(
      getHandler(service, "sendInteraction")(feedbackPlugin, {
        event: "app.bsky.feed.defs#interactionSeen",
        feedProxyUrl: "did:web:feed.example#bsky_fg",
      }),
      /requires a postUri/,
    );
    assert.deepEqual(calls.showLess, []);
    assert.deepEqual(calls.showMore, []);
    assert.deepEqual(calls.sendInteractions, []);
  });

  it("muteActor and blockActor reject when did is missing", async () => {
    const { service } = makeService();
    await assert.rejects(
      getHandler(service, "muteActor")(
        { pluginId: "test-plugin", permissions: { moderation: ["mute"] } },
        {},
      ),
      /muteActor requires a did/,
    );
    await assert.rejects(
      getHandler(service, "blockActor")(
        { pluginId: "test-plugin", permissions: { moderation: ["block"] } },
        {},
      ),
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

  it("sendInteraction sends a known event with caller-supplied routing and context", async () => {
    const { service, calls } = makeService();
    await getHandler(service, "sendInteraction")(feedbackPlugin, {
      postUri,
      event: "app.bsky.feed.defs#interactionSeen",
      feedProxyUrl: "did:web:feed.example#bsky_fg",
      feedContext: "plugin-ctx",
    });
    assert.deepEqual(calls.sendInteractions, [
      [
        [
          {
            item: postUri,
            event: "app.bsky.feed.defs#interactionSeen",
            feedContext: "plugin-ctx",
          },
        ],
        "did:web:feed.example#bsky_fg",
      ],
    ]);
  });

  it("sendInteraction omits feedContext when the caller does not supply one", async () => {
    const { service, calls } = makeService();
    await getHandler(service, "sendInteraction")(feedbackPlugin, {
      postUri,
      event: "app.bsky.feed.defs#interactionShare",
      feedProxyUrl: "did:web:feed.example#bsky_fg",
    });
    assert.deepEqual(calls.sendInteractions, [
      [
        [{ item: postUri, event: "app.bsky.feed.defs#interactionShare" }],
        "did:web:feed.example#bsky_fg",
      ],
    ]);
  });

  it("sendInteraction rejects when feedProxyUrl is missing", async () => {
    const { service, calls } = makeService();
    await assert.rejects(
      getHandler(service, "sendInteraction")(feedbackPlugin, {
        postUri,
        event: "app.bsky.feed.defs#interactionSeen",
      }),
      /requires a feedProxyUrl/,
    );
    assert.deepEqual(calls.sendInteractions, []);
  });

  it("sendInteraction rejects unknown and disallowed events", async () => {
    const { service, calls } = makeService();
    for (const event of [
      "app.bsky.feed.defs#madeUp",
      "app.bsky.feed.defs#clickthroughItem",
      "app.bsky.feed.defs#clickthroughAuthor",
      "app.bsky.feed.defs#clickthroughReposter",
      "app.bsky.feed.defs#clickthroughEmbed",
    ]) {
      await assert.rejects(
        getHandler(service, "sendInteraction")(feedbackPlugin, {
          postUri,
          event,
          feedProxyUrl: "did:web:feed.example#bsky_fg",
        }),
        /Unsupported feed interaction event/,
      );
    }
    assert.deepEqual(calls.sendInteractions, []);
  });

  it("all three methods require the feedback moderation permission", async () => {
    const { service, calls } = makeService();
    const noPermissionPlugin = {
      pluginId: "test-plugin",
      permissions: { moderation: ["mute"] },
    };
    for (const name of [
      "showLessLikeThis",
      "showMoreLikeThis",
      "sendInteraction",
    ]) {
      await assert.rejects(
        getHandler(service, name)(noPermissionPlugin, {
          postUri,
          event: "app.bsky.feed.defs#interactionSeen",
        }),
        /"feedback" moderation permission/,
      );
    }
    assert.deepEqual(calls.showLess, []);
    assert.deepEqual(calls.showMore, []);
    assert.deepEqual(calls.sendInteractions, []);
  });
});

describe("getRecord host method", () => {
  function makeServiceWithRealBridge() {
    const { provider } = makeProvider();
    return new PluginService(provider, null);
  }

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

describe("rich text transform pipeline", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  function makeContext({
    uri = "at://did:test/app.bsky.feed.post/1",
    surface = "largePost",
    text = "hello",
    facets = [],
  } = {}) {
    return {
      surface,
      uri,
      did: "did:test",
      numberOfLines: null,
      source: { text, facets },
    };
  }

  function addTransform(service, pluginId, invoke) {
    const entry = { pluginId, invoke };
    service.registries.richTextTransforms.add(entry);
    return entry;
  }

  function silencingErrors(run) {
    const originalError = console.error;
    console.error = () => {};
    return Promise.resolve()
      .then(run)
      .finally(() => {
        console.error = originalError;
      });
  }

  it("resolves null with no transforms registered", async () => {
    const { service } = makeService();
    const tokens = [{ type: "text", value: "hello" }];
    assert.deepEqual(
      await service.transformRichTextTokens(tokens, makeContext()),
      null,
    );
  });

  it("resolves the transformed tokens and caches them per post and surface", async () => {
    const { service } = makeService();
    const batches = [];
    addTransform(service, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "!" }],
      }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    const transformed = await service.transformRichTextTokens(tokens, context);
    assert.deepEqual(transformed, [
      { type: "text", value: "hello" },
      { type: "text", value: "!" },
    ]);

    // Second request hits the cache: same result, no extra plugin call.
    assert.deepEqual(
      await service.transformRichTextTokens(tokens, context),
      transformed,
    );
    assert.deepEqual(batches.length, 1);
  });

  it("batches all posts of a render burst into one call per plugin", async () => {
    const { service } = makeService();
    const batches = [];
    addTransform(service, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });

    await Promise.all([
      service.transformRichTextTokens(
        [{ type: "text", value: "one" }],
        makeContext({ uri: "at://post/1", text: "one" }),
      ),
      service.transformRichTextTokens(
        [{ type: "text", value: "two" }],
        makeContext({ uri: "at://post/2", text: "two" }),
      ),
    ]);

    assert.deepEqual(batches.length, 1);
    assert.deepEqual(batches[0].length, 2);
    assert.deepEqual(batches[0][0].tokens, [{ type: "text", value: "one" }]);
    assert.deepEqual(batches[0][1].tokens, [{ type: "text", value: "two" }]);
  });

  it("shares one run between concurrent requests for the same post and surface", async () => {
    const { service } = makeService();
    const batches = [];
    addTransform(service, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    const [first, second] = await Promise.all([
      service.transformRichTextTokens(tokens, context),
      service.transformRichTextTokens(tokens, context),
    ]);

    assert.deepEqual(first, second);
    assert.deepEqual(batches.length, 1);
    assert.deepEqual(batches[0].length, 1);
  });

  it("chains transforms in registration order", async () => {
    const { service } = makeService();
    addTransform(service, "alpha", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "A" }],
      })),
    );
    addTransform(service, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "B" }],
      })),
    );

    const transformed = await service.transformRichTextTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.value),
      ["hello", "A", "B"],
    );
  });

  it("fails open when a transform throws", async () => {
    const { service } = makeService();
    addTransform(service, "alpha", async () => {
      throw new Error("boom");
    });
    addTransform(service, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "B" }],
      })),
    );

    const transformed = await silencingErrors(() =>
      service.transformRichTextTokens(
        [{ type: "text", value: "hello" }],
        makeContext(),
      ),
    );

    assert.deepEqual(
      transformed.map((token) => token.value),
      ["hello", "B"],
    );
  });

  it("fails open per item on error entries and malformed tokens", async () => {
    const { service } = makeService();
    addTransform(service, "alpha", async (batch) =>
      batch.map(({ context }) =>
        context.uri.endsWith("/1")
          ? { error: "no thanks" }
          : { value: [{ type: "bogus" }] },
      ),
    );

    const [first, second] = await silencingErrors(() =>
      Promise.all([
        service.transformRichTextTokens(
          [{ type: "text", value: "one" }],
          makeContext({ uri: "at://post/1", text: "one" }),
        ),
        service.transformRichTextTokens(
          [{ type: "text", value: "two" }],
          makeContext({ uri: "at://post/2", text: "two" }),
        ),
      ]),
    );

    assert.deepEqual(first, [{ type: "text", value: "one" }]);
    assert.deepEqual(second, [{ type: "text", value: "two" }]);
  });

  it("re-hydrates returned facet tokens to the host originals", async () => {
    const { service } = makeService();
    const facet = {
      index: { byteStart: 0, byteEnd: 4 },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: "tag" }],
    };
    const facetToken = { type: "facet", facet, text: "#tag" };
    // Simulate the structured-clone boundary: the plugin returns a copy.
    addTransform(service, "alpha", async (batch) =>
      batch.map(({ tokens }) => ({
        value: JSON.parse(JSON.stringify(tokens)),
      })),
    );

    const transformed = await service.transformRichTextTokens(
      [facetToken, { type: "text", value: " in front" }],
      makeContext({ text: "#tag in front", facets: [facet] }),
    );

    assert(
      transformed[0] === facetToken,
      "facet token should be the host object",
    );
  });

  it("rejects a result containing an unrecognized facet", async () => {
    const { service } = makeService();
    addTransform(service, "alpha", async (batch) =>
      batch.map(() => ({
        value: [
          {
            type: "facet",
            facet: { index: { byteStart: 0, byteEnd: 99 }, features: [] },
            text: "forged",
          },
        ],
      })),
    );
    const tokens = [{ type: "text", value: "hello" }];

    const transformed = await silencingErrors(() =>
      service.transformRichTextTokens(tokens, makeContext()),
    );

    assert.deepEqual(transformed, tokens);
  });

  it("stamps inline/block tokens with the emitting transform's pluginId and preserves earlier ids", async () => {
    const { service } = makeService();
    const node = { tag: "code", text: "x" };
    addTransform(service, "alpha", async (batch) =>
      batch.map(() => ({ value: [{ type: "inline", node }] })),
    );
    addTransform(service, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "block", node }],
      })),
    );

    const transformed = await service.transformRichTextTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.pluginId),
      ["alpha", "beta"],
    );
  });

  it("re-stamps a forged pluginId naming another plugin", async () => {
    const { service } = makeService();
    const node = { tag: "code", text: "x" };
    addTransform(service, "alpha", async (batch) =>
      batch.map(() => ({
        value: [{ type: "inline", pluginId: "victim", node }],
      })),
    );

    const transformed = await service.transformRichTextTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.pluginId),
      ["alpha"],
    );
  });

  it("clears cached results when the transform set changes", async () => {
    const { service } = makeService();
    const batches = [];
    addTransform(service, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    await service.transformRichTextTokens(tokens, context);
    service._invalidateRichTextTransforms();
    await service.transformRichTextTokens(tokens, context);

    assert.deepEqual(batches.length, 2);
  });

  it("resolves in-flight requests with null when transforms change mid-run", async () => {
    const { service } = makeService();
    let releaseTransform;
    const gate = new Promise((resolve) => {
      releaseTransform = resolve;
    });
    addTransform(service, "alpha", async (batch) => {
      await gate;
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const request = service.transformRichTextTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );
    await flush();
    service._invalidateRichTextTransforms();
    releaseTransform();

    assert.deepEqual(await request, null);
    assert.deepEqual(service._richTextTokensCache.size, 0);
  });

  it("re-runs when the cached entry no longer matches the source text", async () => {
    const { service } = makeService();
    const batches = [];
    addTransform(service, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const context = makeContext({ text: "before" });

    await service.transformRichTextTokens(
      [{ type: "text", value: "before" }],
      context,
    );
    const transformed = await service.transformRichTextTokens(
      [{ type: "text", value: "after" }],
      makeContext({ text: "after" }),
    );

    assert.deepEqual(batches.length, 2);
    assert.deepEqual(transformed, [{ type: "text", value: "after" }]);
  });

  it("renderRichTextNodeToken mounts a sanitized element and reuses it per token and host", () => {
    const { service } = makeService();
    service.setRenderContext({});
    const token = {
      type: "inline",
      pluginId: "alpha",
      node: { tag: "code", attrs: {}, text: "x", children: [], events: {} },
    };
    const host = document.createElement("div");

    const element = service.renderRichTextNodeToken(token, host);
    assert.deepEqual(element.localName, "code");
    assert.deepEqual(element.textContent, "x");
    assert(service.renderRichTextNodeToken(token, host) === element);
    const otherHost = document.createElement("div");
    const otherElement = service.renderRichTextNodeToken(token, otherHost);
    assert.deepEqual(otherElement.localName, "code");
    assert(otherElement !== element);
  });
});
