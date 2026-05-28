import { Signal } from "/js/signals.js";

// Handles persisting plugin settings in user preferences
export class PluginPreferencesManager {
  constructor(preferencesProvider) {
    this.preferencesProvider = preferencesProvider;
    this.$installedPlugins = new Signal.Computed(
      () => preferencesProvider.$preferences.get()?.getInstalledPlugins() ?? [],
    );
  }

  getInstalledPlugins() {
    return this.preferencesProvider.requirePreferences().getInstalledPlugins();
  }

  async setInstalledPlugins(plugins) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setInstalledPlugins(plugins);
    await this.preferencesProvider.savePreferences(preferences);
  }

  getInstalledPlugin(pluginId) {
    return this.getInstalledPlugins().find((plugin) => plugin.id === pluginId);
  }

  getEnabledPlugins() {
    return this.getInstalledPlugins().filter((entry) => entry.enabled);
  }

  async addInstalledPlugin(plugin) {
    const installedPlugins = this.getInstalledPlugins();
    await this.setInstalledPlugins([...installedPlugins, plugin]);
  }

  async removeInstalledPlugin(pluginId) {
    const installedPlugins = this.getInstalledPlugins();
    await this.setInstalledPlugins(
      installedPlugins.filter((plugin) => plugin.id !== pluginId),
    );
  }

  async updateInstalledPlugin(pluginId, updateFunc) {
    const installedPlugins = this.getInstalledPlugins();
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
    const installedPlugins = this.getInstalledPlugins();
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
