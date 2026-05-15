import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";

// A minimal fake of the Preferences object the manager interacts with.
// The real Preferences mutates an underlying object and returns `this` from
// setters; the fake mirrors that so the manager can chain set+save.
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

function makeProvider({ installedPlugins = [], pluginSettings = {} } = {}) {
  const state = { installedPlugins, pluginSettings };
  const preferences = new FakePreferences(state);
  const saveCalls = [];
  return {
    state,
    preferences,
    saveCalls,
    provider: {
      requirePreferences: () => preferences,
      savePreferences: async (prefs) => {
        saveCalls.push(prefs);
      },
    },
  };
}

const t = new TestSuite("pluginPreferencesManager");

t.describe("installed plugins", (it) => {
  it("returns installed plugins from preferences", () => {
    const { provider } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    assertEquals(manager.getInstalledPlugins(), [{ id: "a", enabled: true }]);
  });

  it("setInstalledPlugins persists via savePreferences", async () => {
    const { provider, saveCalls, state, preferences } = makeProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.setInstalledPlugins([{ id: "a", enabled: true }]);
    assertEquals(state.installedPlugins, [{ id: "a", enabled: true }]);
    assertEquals(saveCalls.length, 1);
    assert(saveCalls[0] === preferences);
  });

  it("getInstalledPlugin finds by id", () => {
    const { provider } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assertEquals(manager.getInstalledPlugin("b"), { id: "b", enabled: false });
    assertEquals(manager.getInstalledPlugin("missing"), undefined);
  });

  it("getEnabledPlugins filters to enabled entries", () => {
    const { provider } = makeProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
        { id: "c", enabled: true },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assertEquals(manager.getEnabledPlugins(), [
      { id: "a", enabled: true },
      { id: "c", enabled: true },
    ]);
  });

  it("addInstalledPlugin appends and saves", async () => {
    const { provider, state, saveCalls } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.addInstalledPlugin({ id: "b", enabled: false });
    assertEquals(state.installedPlugins, [
      { id: "a", enabled: true },
      { id: "b", enabled: false },
    ]);
    assertEquals(saveCalls.length, 1);
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
    assertEquals(state.installedPlugins, [{ id: "b", enabled: false }]);
    assertEquals(saveCalls.length, 1);
  });

  it("removeInstalledPlugin is a no-op when id is absent", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.removeInstalledPlugin("missing");
    assertEquals(state.installedPlugins, [{ id: "a", enabled: true }]);
  });
});

t.describe("updateInstalledPlugin", (it) => {
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
    assertEquals(state.installedPlugins, [
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
    assertEquals(state.installedPlugins, [{ id: "a", enabled: false }]);
  });

  it("setPluginEnabled flips enabled to true", async () => {
    const { provider, state } = makeProvider({
      installedPlugins: [{ id: "a", enabled: false }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginEnabled("a");
    assertEquals(state.installedPlugins, [{ id: "a", enabled: true }]);
  });
});

t.describe("plugin settings", (it) => {
  it("readSettingsForPlugin returns stored settings", () => {
    const { provider } = makeProvider({
      pluginSettings: { a: { color: "red" } },
    });
    const manager = new PluginPreferencesManager(provider);
    assertEquals(manager.readSettingsForPlugin("a"), { color: "red" });
    assertEquals(manager.readSettingsForPlugin("missing"), undefined);
  });

  it("writeSettingsForPlugin persists and saves", async () => {
    const { provider, state, saveCalls } = makeProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.writeSettingsForPlugin("a", { color: "blue" });
    assertEquals(state.pluginSettings, { a: { color: "blue" } });
    assertEquals(saveCalls.length, 1);
  });

  it("clearSettingsForPlugin removes settings and saves", async () => {
    const { provider, state, saveCalls } = makeProvider({
      pluginSettings: { a: { color: "blue" }, b: { count: 2 } },
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.clearSettingsForPlugin("a");
    assertEquals(state.pluginSettings, { b: { count: 2 } });
    assertEquals(saveCalls.length, 1);
  });
});

await t.run();
