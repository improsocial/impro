import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";
import { Signal } from "/js/signals.js";

// A minimal fake of the Preferences object the manager interacts with.
// The real Preferences clones on every write and the provider re-publishes
// the result through $preferences, so dependent signals invalidate; the fake
// mirrors that contract.
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

function makeProvider({ installedPlugins = [], pluginSettings = {} } = {}) {
  const state = { installedPlugins, pluginSettings };
  const preferences = new FakePreferences(state);
  const $preferences = new Signal.State(preferences);
  const saveCalls = [];
  return {
    state,
    preferences,
    saveCalls,
    provider: {
      $preferences,
      requirePreferences: () => preferences,
      updatePreferences: async (prefs) => {
        saveCalls.push(prefs);
        $preferences.set(prefs);
      },
    },
  };
}

describe("installed plugins", () => {
  it("returns installed plugins from preferences", () => {
    const { provider } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.$installedPlugins.get(), [
      { id: "a", enabled: true },
    ]);
  });

  it("setInstalledPlugins persists via updatePreferences", async () => {
    const { provider, saveCalls, state } = makeProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.setInstalledPlugins([{ id: "a", enabled: true }]);
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: true }]);
    assert.deepEqual(saveCalls.length, 1);
    assert.deepEqual(saveCalls[0].getInstalledPlugins(), [
      { id: "a", enabled: true },
    ]);
  });

  it("$installedPlugin finds by id", () => {
    const { provider } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.$installedPlugin.get("b"), {
      id: "b",
      enabled: false,
    });
    assert.deepEqual(manager.$installedPlugin.get("missing"), null);
  });

  it("$enabledPlugins filters to enabled entries", () => {
    const { provider } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
        { id: "c", enabled: true },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.$enabledPlugins.get(), [
      { id: "a", enabled: true },
      { id: "c", enabled: true },
    ]);
  });

  it("derived signals recompute after a mutation", async () => {
    const { provider } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.$enabledPlugins.get(), [
      { id: "a", enabled: true },
    ]);
    assert.deepEqual(manager.$installedPlugin.get("b"), null);

    await manager.addInstalledPlugin({ id: "b", enabled: false });
    assert.deepEqual(manager.$installedPlugin.get("b"), {
      id: "b",
      enabled: false,
    });
    assert.deepEqual(manager.$enabledPlugins.get(), [
      { id: "a", enabled: true },
    ]);

    await manager.setPluginEnabled("b");
    assert.deepEqual(manager.$enabledPlugins.get(), [
      { id: "a", enabled: true },
      { id: "b", enabled: true },
    ]);
  });

  it("addInstalledPlugin appends and saves", async () => {
    const { provider, state, saveCalls } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.addInstalledPlugin({ id: "b", enabled: false });
    assert.deepEqual(state.installedPlugins, [
      { id: "a", enabled: true },
      { id: "b", enabled: false },
    ]);
    assert.deepEqual(saveCalls.length, 1);
  });

  it("removeInstalledPlugin removes by id and saves", async () => {
    const { provider, state, saveCalls } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.removeInstalledPlugin("a");
    assert.deepEqual(state.installedPlugins, [{ id: "b", enabled: false }]);
    assert.deepEqual(saveCalls.length, 1);
  });

  it("removeInstalledPlugin is a no-op when id is absent", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.removeInstalledPlugin("missing");
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: true }]);
  });
});

describe("updateInstalledPlugin", () => {
  it("applies updateFunc to the matching entry only", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true, version: "1.0.0" },
        { id: "b", enabled: false, version: "1.0.0" },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.updateInstalledPlugin("a", (entry) => ({
      ...entry,
      version: "2.0.0",
    }));
    assert.deepEqual(state.installedPlugins, [
      { id: "a", enabled: true, version: "2.0.0" },
      { id: "b", enabled: false, version: "1.0.0" },
    ]);
  });

  it("throws when the plugin is not installed", async () => {
    const { provider } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    let caught = null;
    try {
      await manager.updateInstalledPlugin("missing", (entry) => entry);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    assert(caught.message.includes("missing"));
  });

  it("setPluginDisabled flips enabled to false", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginDisabled("a");
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: false }]);
  });

  it("setPluginEnabled flips enabled to true", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: false }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginEnabled("a");
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: true }]);
  });

  it("setPluginsDisabled flips enabled to false for each given id in one save", async () => {
    const { provider, state, saveCalls } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: true },
        { id: "c", enabled: true },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginsDisabled(["a", "c"]);
    assert.deepEqual(state.installedPlugins, [
      { id: "a", enabled: false },
      { id: "b", enabled: true },
      { id: "c", enabled: false },
    ]);
    assert.deepEqual(saveCalls.length, 1);
  });

  it("setPluginsDisabled is a no-op (no save) for an empty list", async () => {
    const { provider, state, saveCalls } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginsDisabled([]);
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: true }]);
    assert.deepEqual(saveCalls.length, 0);
  });

  it("setPluginsDisabled throws when any id is not installed", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    let caught = null;
    try {
      await manager.setPluginsDisabled(["a", "missing"]);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    assert(caught.message.includes("missing"));
    // Should not have mutated state when any id is invalid
    assert.deepEqual(state.installedPlugins, [{ id: "a", enabled: true }]);
  });
});

describe("plugin settings", () => {
  it("readSettingsForPlugin returns stored settings", () => {
    const { provider } = makeProvider({
      pluginSettings: { a: { color: "red" } },
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.readSettingsForPlugin("a"), { color: "red" });
    assert.deepEqual(manager.readSettingsForPlugin("missing"), undefined);
  });

  it("writeSettingsForPlugin persists and saves", async () => {
    const { provider, state, saveCalls } = makeProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.writeSettingsForPlugin("a", { color: "blue" });
    assert.deepEqual(state.pluginSettings, { a: { color: "blue" } });
    assert.deepEqual(saveCalls.length, 1);
  });

  it("clearSettingsForPlugin removes settings and saves", async () => {
    const { provider, state, saveCalls } = makeProvider({
      pluginSettings: { a: { color: "blue" }, b: { count: 2 } },
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.clearSettingsForPlugin("a");
    assert.deepEqual(state.pluginSettings, { b: { count: 2 } });
    assert.deepEqual(saveCalls.length, 1);
  });
});
