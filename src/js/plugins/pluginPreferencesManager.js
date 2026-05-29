import { Signal, ReactiveStore, ComputedMap } from "/js/signals.js";

// Handles persisting plugin settings in user preferences
export class PluginPreferencesManager extends ReactiveStore {
  constructor(preferencesProvider) {
    super("pluginPreferencesManager");
    this.preferencesProvider = preferencesProvider;
    this.$installedPlugins = new Signal.Computed(
      () => preferencesProvider.$preferences.get()?.getInstalledPlugins() ?? [],
    );
    this.$enabledPlugins = new Signal.Computed(() =>
      this.$installedPlugins.get().filter((entry) => entry.enabled),
    );
    this.$installedPlugin = new ComputedMap(
      (pluginId) =>
        this.$installedPlugins.get().find((entry) => entry.id === pluginId) ??
        null,
    );
  }

  async setInstalledPlugins(plugins) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setInstalledPlugins(plugins);
    await this.preferencesProvider.savePreferences(preferences);
  }

  async addInstalledPlugin(plugin) {
    const installedPlugins = this.$installedPlugins.get();
    await this.setInstalledPlugins([...installedPlugins, plugin]);
  }

  async removeInstalledPlugin(pluginId) {
    const installedPlugins = this.$installedPlugins.get();
    await this.setInstalledPlugins(
      installedPlugins.filter((plugin) => plugin.id !== pluginId),
    );
  }

  async updateInstalledPlugin(pluginId, updateFunc) {
    const installedPlugins = this.$installedPlugins.get();
    if (!installedPlugins.some((plugin) => plugin.id === pluginId)) {
      throw new Error(
        `Tried to update preference for uninstalled plugin: ${pluginId}`,
      );
    }
    const updated = installedPlugins.map((plugin) =>
      plugin.id === pluginId ? updateFunc(plugin) : plugin,
    );
    await this.setInstalledPlugins(updated);
  }

  async setPluginDisabled(pluginId) {
    await this.updateInstalledPlugin(pluginId, (entry) => ({
      ...entry,
      enabled: false,
    }));
  }

  async setPluginsDisabled(pluginIds) {
    const ids = new Set(pluginIds);
    if (ids.size === 0) return;
    const installedPlugins = this.$installedPlugins.get();
    for (const pluginId of ids) {
      if (!installedPlugins.some((plugin) => plugin.id === pluginId)) {
        throw new Error(
          `Tried to update preference for uninstalled plugin: ${pluginId}`,
        );
      }
    }
    const updated = installedPlugins.map((plugin) =>
      ids.has(plugin.id) ? { ...plugin, enabled: false } : plugin,
    );
    await this.setInstalledPlugins(updated);
  }

  async setPluginEnabled(pluginId) {
    await this.updateInstalledPlugin(pluginId, (entry) => ({
      ...entry,
      enabled: true,
    }));
  }

  readSettingsForPlugin(pluginId) {
    return this.preferencesProvider
      .requirePreferences()
      .getPluginSettings(pluginId);
  }

  async writeSettingsForPlugin(pluginId, data) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setPluginSettings(pluginId, data);
    await this.preferencesProvider.savePreferences(preferences);
  }

  async clearSettingsForPlugin(pluginId) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .clearPluginSettings(pluginId);
    await this.preferencesProvider.savePreferences(preferences);
  }
}
