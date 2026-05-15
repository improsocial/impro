import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PluginService } from "/js/plugins/pluginService.js";

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
  service.localRegistry = localListings
    ? { getListings: async () => localListings }
    : null;
  service.sourceProvider = {
    getLiveManifest: async (id) => {
      if (!liveManifests[id]) throw new Error(`no manifest for ${id}`);
      return liveManifests[id];
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

t.describe("installPlugin", (it) => {
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
});

t.describe("updatePlugin", (it) => {
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
    assertEquals(result, { updated: [], failed: [] });
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

t.describe("listRegistryPlugins", (it) => {
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
    const listings = await service.listRegistryPlugins();
    assertEquals(listings.length, 3);
    const byId = Object.fromEntries(
      listings.map((listing) => [listing.id, listing]),
    );
    assertEquals(byId.alpha.installed, true);
    assertEquals(byId.beta.installed, false);
    assertEquals(byId.gamma__LOCAL.installed, false);
  });

  it("returns only remote listings when localRegistry is absent", async () => {
    const { service } = makeService({
      remoteListings: [{ id: "alpha", repo: "ow/alpha", name: "Alpha" }],
    });
    const listings = await service.listRegistryPlugins();
    assertEquals(listings.length, 1);
    assertEquals(listings[0].id, "alpha");
  });
});

await t.run();
