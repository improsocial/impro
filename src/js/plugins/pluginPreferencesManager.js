import { Signal, ReactiveStore, ComputedMap } from "/js/signals.js";
import { Permissions } from "/js/plugins/pluginPermissions.js";
import { unique } from "/js/utils.js";

// Sanitizes stored user-granted origins into canonical fetch patterns. The
// installed-plugins list lives in the user's preferences record, we need to
// sanitize before using it.
function parseGrantedOrigins(origins) {
  if (!Array.isArray(origins)) return [];
  return unique(origins.map(Permissions.normalizeFetchOrigin).filter(Boolean));
}

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

  // The signals above remain empty until preferences load, which is correct for
  // reactive consumers (they re-run when necessary) but silently wrong for
  // non-reactive consumers. These methods make sure preferences are loaded first.
  async getInstalledPlugins() {
    await this.preferencesProvider.requirePreferences();
    return this.$installedPlugins.get();
  }

  async getEnabledPlugins() {
    await this.preferencesProvider.requirePreferences();
    return this.$enabledPlugins.get();
  }

  async getInstalledPlugin(pluginId) {
    await this.preferencesProvider.requirePreferences();
    return this.$installedPlugin.get(pluginId);
  }

  async setInstalledPlugins(plugins) {
    const preferences = await this.preferencesProvider.requirePreferences();
    await this.preferencesProvider.updatePreferences(
      preferences.setInstalledPlugins(plugins),
    );
  }

  async addInstalledPlugin(plugin) {
    const installedPlugins = await this.getInstalledPlugins();
    await this.setInstalledPlugins([...installedPlugins, plugin]);
  }

  async removeInstalledPlugin(pluginId) {
    const installedPlugins = await this.getInstalledPlugins();
    await this.setInstalledPlugins(
      installedPlugins.filter((plugin) => plugin.id !== pluginId),
    );
  }

  async updateInstalledPlugin(pluginId, updateFunc) {
    const installedPlugins = await this.getInstalledPlugins();
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
    const installedPlugins = await this.getInstalledPlugins();
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

  // User-granted fetch origins are kept apart from the manifest permissions.
  getUserGrantedFetchOrigins(pluginId) {
    const entry = this.$installedPlugin.get(pluginId);
    return parseGrantedOrigins(entry?.userGrantedFetchOrigins);
  }

  async addUserGrantedFetchOrigin(pluginId, origin) {
    await this.updateInstalledPlugin(pluginId, (entry) => {
      const granted = parseGrantedOrigins(entry.userGrantedFetchOrigins);
      if (granted.includes(origin)) {
        return { ...entry, userGrantedFetchOrigins: granted };
      }
      return { ...entry, userGrantedFetchOrigins: [...granted, origin] };
    });
  }

  async removeUserGrantedFetchOrigin(pluginId, origin) {
    await this.updateInstalledPlugin(pluginId, (entry) => ({
      ...entry,
      userGrantedFetchOrigins: parseGrantedOrigins(
        entry.userGrantedFetchOrigins,
      ).filter((granted) => granted !== origin),
    }));
  }

  async readSettingsForPlugin(pluginId) {
    const preferences = await this.preferencesProvider.requirePreferences();
    return preferences.getPluginSettings(pluginId);
  }

  async writeSettingsForPlugin(pluginId, data) {
    const preferences = await this.preferencesProvider.requirePreferences();
    await this.preferencesProvider.updatePreferences(
      preferences.setPluginSettings(pluginId, data),
    );
  }

  async clearSettingsForPlugin(pluginId) {
    const preferences = await this.preferencesProvider.requirePreferences();
    await this.preferencesProvider.updatePreferences(
      preferences.clearPluginSettings(pluginId),
    );
  }
}
