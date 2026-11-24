import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";
import {
  makeTestPluginPreferencesProvider,
  storedInstalledPlugins,
  storedPluginSettings,
} from "../../testHelpers.js";

describe("installed plugins", () => {
  it("returns installed plugins from preferences", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.$installedPlugins.get(), [
      { id: "a", enabled: true },
    ]);
  });

  it("updateInstalledPlugins persists via updatePreferences", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.updateInstalledPlugins(() => [{ id: "a", enabled: true }]);
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
    ]);
    assert.deepEqual(server.putCalls, 1);
  });

  it("$installedPlugin finds by id", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
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

  it("$enabledPlugins filters to enabled entries", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
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
    const { provider } = await makeTestPluginPreferencesProvider({
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
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.addInstalledPlugin({ id: "b", enabled: false });
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
      { id: "b", enabled: false },
    ]);
    assert.deepEqual(server.putCalls, 1);
  });

  it("removeInstalledPlugin removes by id and saves", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: false },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.removeInstalledPlugin("a");
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "b", enabled: false },
    ]);
    assert.deepEqual(server.putCalls, 1);
  });

  it("removeInstalledPlugin is a no-op when id is absent", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.removeInstalledPlugin("missing");
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
    ]);
  });
});

describe("updateInstalledPlugin", () => {
  it("applies updateFunc to the matching entry only", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
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
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true, version: "2.0.0" },
      { id: "b", enabled: false, version: "1.0.0" },
    ]);
  });

  it("throws when the plugin is not installed", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
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
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginDisabled("a");
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: false },
    ]);
  });

  it("setPluginEnabled flips enabled to true", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: false }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginEnabled("a");
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
    ]);
  });

  it("setPluginsDisabled flips enabled to false for each given id in one save", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [
        { id: "a", enabled: true },
        { id: "b", enabled: true },
        { id: "c", enabled: true },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginsDisabled(["a", "c"]);
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: false },
      { id: "b", enabled: true },
      { id: "c", enabled: false },
    ]);
    assert.deepEqual(server.putCalls, 1);
  });

  it("setPluginsDisabled is a no-op (no save) for an empty list", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      installedPlugins: [{ id: "a", enabled: true }],
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.setPluginsDisabled([]);
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
    ]);
    assert.deepEqual(server.putCalls, 0);
  });

  it("setPluginsDisabled throws when any id is not installed", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
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
    assert.deepEqual(storedInstalledPlugins(server), [
      { id: "a", enabled: true },
    ]);
  });
});

describe("reads before preferences load", () => {
  it("getInstalledPlugins waits for the load instead of reading empty", async () => {
    const { provider } = await makeTestPluginPreferencesProvider(
      {
        installedPlugins: [{ id: "a", enabled: true }],
      },
      { loaded: false },
    );
    const manager = new PluginPreferencesManager(provider);

    assert.deepEqual(manager.$installedPlugins.get(), []);
    assert.deepEqual(await manager.getInstalledPlugins(), [
      { id: "a", enabled: true },
    ]);
  });

  it("getEnabledPlugins waits for the load instead of reading empty", async () => {
    const { provider } = await makeTestPluginPreferencesProvider(
      {
        installedPlugins: [
          { id: "a", enabled: true },
          { id: "b", enabled: false },
        ],
      },
      { loaded: false },
    );
    const manager = new PluginPreferencesManager(provider);

    const enabled = await manager.getEnabledPlugins();
    assert.deepEqual(
      enabled.map((entry) => entry.id),
      ["a"],
    );
  });

  it("addInstalledPlugin keeps stored plugins it hasn't loaded yet", async () => {
    const { server, provider } = await makeTestPluginPreferencesProvider(
      {
        installedPlugins: [{ id: "a", enabled: true }],
      },
      { loaded: false },
    );
    const manager = new PluginPreferencesManager(provider);

    await manager.addInstalledPlugin({ id: "b", enabled: true });

    assert.deepEqual(
      storedInstalledPlugins(server).map((entry) => entry.id),
      ["a", "b"],
    );
  });

  it("removeInstalledPlugin keeps stored plugins it hasn't loaded yet", async () => {
    const { server, provider } = await makeTestPluginPreferencesProvider(
      {
        installedPlugins: [
          { id: "a", enabled: true },
          { id: "b", enabled: true },
        ],
      },
      { loaded: false },
    );
    const manager = new PluginPreferencesManager(provider);

    await manager.removeInstalledPlugin("a");

    assert.deepEqual(
      storedInstalledPlugins(server).map((entry) => entry.id),
      ["b"],
    );
  });
});

describe("plugin settings", () => {
  it("readSettingsForPlugin returns stored settings", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
      pluginSettings: { a: { color: "red" } },
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(await manager.readSettingsForPlugin("a"), {
      color: "red",
    });
    assert.deepEqual(await manager.readSettingsForPlugin("missing"), null);
  });

  it("writeSettingsForPlugin persists and saves", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider();
    const manager = new PluginPreferencesManager(provider);
    await manager.writeSettingsForPlugin("a", { color: "blue" });
    assert.deepEqual(storedPluginSettings(server), { a: { color: "blue" } });
    assert.deepEqual(server.putCalls, 1);
  });

  it("clearSettingsForPlugin removes settings and saves", async () => {
    const { provider, server } = await makeTestPluginPreferencesProvider({
      pluginSettings: { a: { color: "blue" }, b: { count: 2 } },
    });
    const manager = new PluginPreferencesManager(provider);
    await manager.clearSettingsForPlugin("a");
    assert.deepEqual(storedPluginSettings(server), { b: { count: 2 } });
    assert.deepEqual(server.putCalls, 1);
  });
});

describe("getUserGrantedFetchOrigins", () => {
  it("normalizes and de-duplicates stored origins", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
      installedPlugins: [
        {
          id: "alpha",
          enabled: true,
          userGrantedFetchOrigins: [
            "https://api.example.com/v1",
            "https://api.example.com/v2",
            "http://localhost:11434/api",
          ],
        },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.getUserGrantedFetchOrigins("alpha"), [
      "https://api.example.com/*",
      "http://localhost:11434/*",
    ]);
  });

  // The preferences record is writable by anything holding the account's
  // credentials, so stored values are untrusted input
  it("drops anything that isn't a normalizable origin", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
      installedPlugins: [
        {
          id: "alpha",
          enabled: true,
          userGrantedFetchOrigins: [
            "https://*/*",
            "http://evil.example.com/*",
            "not a url",
            42,
            null,
          ],
        },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.getUserGrantedFetchOrigins("alpha"), []);
  });

  it("returns an empty list for a missing entry or malformed field", async () => {
    const { provider } = await makeTestPluginPreferencesProvider({
      installedPlugins: [
        {
          id: "alpha",
          enabled: true,
          userGrantedFetchOrigins: "https://a.com/*",
        },
      ],
    });
    const manager = new PluginPreferencesManager(provider);
    assert.deepEqual(manager.getUserGrantedFetchOrigins("alpha"), []);
    assert.deepEqual(manager.getUserGrantedFetchOrigins("missing"), []);
  });
});
