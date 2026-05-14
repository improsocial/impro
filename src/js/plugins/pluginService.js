import { PluginBridge } from "/js/plugins/pluginBridge.js";
import { showPluginModal, hidePluginModal } from "/js/modals.js";
import { showPluginToast, hidePluginToast, showToast } from "/js/toasts.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";
import { PluginRegistry } from "/js/plugins/pluginRegistry.js";
import { PluginCache } from "/js/plugins/pluginCache.js";
import { SourceProvider } from "/js/plugins/sourceProvider.js";
import { compareVersions } from "/js/utils.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { PLUGIN_REGISTRY_URL } from "/js/config.js";

export class PluginService extends EventEmitter {
  constructor(preferencesProvider, session) {
    super();
    this.registries = {
      sidebarItems: new Set(),
      eventListeners: new Map(),
      feedFilters: new Set(),
      settingTabs: new Map(),
    };
    this._pluginsInfo = null;
    this._availableUpdates = null;
    this.registry = new PluginRegistry(PLUGIN_REGISTRY_URL);
    this.pluginCache = new PluginCache();
    this.sourceProvider = new SourceProvider(this.registry, this.pluginCache);
    this.pluginBridge = new PluginBridge(this.sourceProvider);
    this.pluginRenderer = new PluginRenderer(this.pluginBridge);
    this.preferencesProvider = preferencesProvider;
    this.session = session;
    this._setupRegistries();
    this._setupHostMethods();
  }

  _readPluginSettings(pluginId) {
    const prefs = this.preferencesProvider.requirePreferences();
    return prefs.getPluginSettings(pluginId);
  }

  async _writePluginSettings(pluginId, data) {
    if (!this.preferencesProvider) {
      throw new Error("Preferences not available");
    }
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setPluginSettings(pluginId, data);
    await this.preferencesProvider.savePreferences(preferences);
    const instance = this.pluginBridge.getInstance(pluginId);
    if (instance) instance.sendEvent("settingsChanged", { data });
  }

  _setupRegistries() {
    this.pluginBridge.addRegistrationTarget(
      "sidebarItem",
      (plugin, message) => {
        const entry = {
          pluginId: plugin.pluginId,
          icon: message.icon,
          title: message.title,
          invoke: () => plugin.call(message.handlerId),
        };
        this.registries.sidebarItems.add(entry);
        return () => this.registries.sidebarItems.delete(entry);
      },
    );
    this.pluginBridge.addRegistrationTarget(
      "eventListener",
      (plugin, message) => {
        let listeners = this.registries.eventListeners.get(message.event);
        if (!listeners) {
          listeners = new Map();
          this.registries.eventListeners.set(message.event, listeners);
        }
        const handler = (...args) => plugin.call(message.handlerId, ...args);
        listeners.set(plugin.pluginId, handler);
        return () => listeners.delete(plugin.pluginId);
      },
    );
    this.pluginBridge.addRegistrationTarget("settingTab", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        name: message.name,
        display: () => plugin.call(message.displayHandlerId),
        hide: () => plugin.call(message.hideHandlerId),
      };
      this.registries.settingTabs.set(plugin.pluginId, entry);
      return () => {
        if (this.registries.settingTabs.get(plugin.pluginId) === entry) {
          this.registries.settingTabs.delete(plugin.pluginId);
        }
      };
    });
    this.pluginBridge.addRegistrationTarget("feedFilter", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        invoke: (feedURI, feedItems) =>
          plugin.call(message.handlerId, feedURI, feedItems),
      };
      this.registries.feedFilters.add(entry);
      return () => this.registries.feedFilters.delete(entry);
    });
  }

  _setupHostMethods() {
    this.pluginBridge.addHostMethod(
      "openModal",
      (plugin, { modalId, title, content }) => {
        showPluginModal({
          pluginRenderer: this.pluginRenderer,
          pluginId: plugin.pluginId,
          modalId,
          title,
          content,
          onDismiss: () => {
            plugin.sendEvent("modalDismissed", {
              modalId,
            });
          },
        });
      },
    );

    this.pluginBridge.addHostMethod("closeModal", (plugin, { modalId }) => {
      hidePluginModal({ pluginId: plugin.pluginId, modalId });
    });

    this.pluginBridge.addHostMethod("loadData", (plugin) => {
      return this._readPluginSettings(plugin.pluginId);
    });

    this.pluginBridge.addHostMethod("saveData", async (plugin, { data }) => {
      await this._writePluginSettings(plugin.pluginId, data);
    });

    this.pluginBridge.addHostMethod("refreshSettingTab", (plugin) => {
      this.emit("settingTabRefresh", { pluginId: plugin.pluginId });
    });

    this.pluginBridge.addHostMethod(
      "showToast",
      (plugin, { toastId, element, timeout }) => {
        showPluginToast({
          pluginRenderer: this.pluginRenderer,
          pluginId: plugin.pluginId,
          toastId,
          element,
          timeout,
        });
      },
    );

    this.pluginBridge.addHostMethod("hideToast", (plugin, { toastId }) => {
      hidePluginToast({ pluginId: plugin.pluginId, toastId });
    });

    this.pluginBridge.addHostMethod("getCurrentUser", () => {
      if (!this.session) return null;
      return {
        did: this.session.did,
        handle: this.session.handle,
      };
    });
  }

  getSettingTabs() {
    return [...this.registries.settingTabs.values()];
  }

  getSettingTab(pluginId) {
    return this.registries.settingTabs.get(pluginId) ?? null;
  }

  getPluginsInfo() {
    return this._pluginsInfo;
  }

  getAvailableUpdates() {
    return this._availableUpdates;
  }

  async checkForUpdates() {
    const installed = this._getInstalledPluginsPreference();
    const results = await Promise.allSettled(
      installed.map(async (entry) => {
        const listing = await this.registry
          .getPluginListing(entry.id)
          .catch(() => null);
        if (listing?.local) return null;
        const liveManifest = await this.sourceProvider.getLiveManifest(
          entry.id,
        );
        if (compareVersions(liveManifest.version, entry.version) > 0) {
          return { id: entry.id, version: liveManifest.version };
        }
        return null;
      }),
    );
    const updates = new Map();
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        updates.set(result.value.id, result.value.version);
      }
    }
    this._availableUpdates = updates;
    return updates;
  }

  async reloadPlugins() {
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    const results = await Promise.allSettled(
      installedPluginsPreference
        .filter((entry) => entry.enabled === true)
        .map(async (entry) => {
          this.pluginBridge.unloadPlugin(entry.id);
          try {
            await this.pluginBridge.loadPlugin(entry.id, entry.version);
          } catch (e) {
            await this._setPluginDisabled(entry.id);
            throw e;
          }
        }),
    );
    await this.loadPluginsInfo();
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  async loadPluginsInfo() {
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    this._pluginsInfo = await Promise.all(
      installedPluginsPreference.map(async (entry) => {
        const [manifest, listing] = await Promise.all([
          this.sourceProvider
            .getManifest(entry.id, entry.version)
            .catch(() => null),
          this.registry.getPluginListing(entry.id).catch(() => null),
        ]);
        return {
          id: entry.id,
          name: manifest?.name ?? entry.id,
          description:
            manifest?.description ?? "Failed to load plugin manifest",
          version: manifest?.version ?? "-",
          author: manifest?.author ?? "Unknown",
          enabled: entry.enabled === true,
          loaded: this.pluginBridge.isLoaded(entry.id),
          hasSettings: this.registries.settingTabs.has(entry.id),
          local: listing?.local === true,
        };
      }),
    );
  }

  async loadEnabledPlugins() {
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    const toLoad = installedPluginsPreference.filter((entry) => entry.enabled);
    const { erroredPlugins } = await this.pluginBridge.loadPlugins(toLoad);
    if (erroredPlugins.length) {
      const failedPluginIds = erroredPlugins.map(({ pluginId }) => pluginId);
      showToast(`Failed to load plugin(s): ${failedPluginIds.join(", ")}`, {
        style: "error",
      });
      // Disable plugins that failed to load
      await Promise.all(
        failedPluginIds.map((pluginId) => this._setPluginDisabled(pluginId)),
      );
    }
    // Reconcile against all installed plugins (not just enabled) so disabled
    // plugins keep their cached assets on re-enable
    await this._reconcileCache(installedPluginsPreference);
  }

  async getManifest(pluginId) {
    const installedPluginsPreference =
      this._getInstalledPluginsPreference().find(
        (plugin) => plugin.id === pluginId,
      );
    return this.sourceProvider
      .getManifest(pluginId, installedPluginsPreference?.version)
      .catch(() => null);
  }

  _getInstalledPluginsPreference() {
    if (!this.preferencesProvider) return [];
    try {
      return this.preferencesProvider
        .requirePreferences()
        .getInstalledPlugins();
    } catch {
      return [];
    }
  }

  async _setInstalledPluginsPreference(plugins) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setInstalledPlugins(plugins);
    await this.preferencesProvider.savePreferences(preferences);
  }

  async _reconcileCache(installed) {
    const urlLists = await Promise.all(
      installed.map((entry) =>
        this.sourceProvider.getCacheUrls(entry.id, entry.version),
      ),
    );
    await this.pluginCache.reconcile(urlLists.flat());
  }

  async installPlugin(pluginId) {
    const listing = await this.registry.getPluginListing(pluginId);
    if (!listing) {
      throw new Error(`unknown plugin: ${pluginId}`);
    }
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    if (installedPluginsPreference.some((plugin) => plugin.id === pluginId))
      return;
    let manifest = null;
    try {
      manifest = listing.local
        ? await this.sourceProvider.getManifest(pluginId)
        : await this.sourceProvider.getLiveManifest(pluginId);
    } catch (e) {
      console.error("Failed to fetch manifest", e);
      throw new Error("Failed to fetch manifest");
    }
    const version = manifest.version;
    await this._addPluginPreferenceEntry({
      id: pluginId,
      version,
      enabled: true,
    });
    try {
      await this.pluginBridge.loadPlugin(pluginId, version);
    } catch (e) {
      await this._removePluginPreferenceEntry(pluginId);
      throw e;
    }
  }

  async uninstallPlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this._removePluginPreferenceEntry(pluginId);
    await this._reconcileCache(this._getInstalledPluginsPreference());
  }

  async enablePlugin(pluginId) {
    await this._setPluginEnabled(pluginId);
    const entry = this._getInstalledPluginsPreference().find(
      (plugin) => plugin.id === pluginId,
    );
    try {
      await this.pluginBridge.loadPlugin(pluginId, entry.version);
    } catch (e) {
      await this._setPluginDisabled(pluginId);
      throw e;
    }
  }

  async _setPluginEnabled(pluginId) {
    await this._updatePluginPreferenceEntry(pluginId, (entry) => ({
      ...entry,
      enabled: true,
    }));
  }

  async disablePlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this._setPluginDisabled(pluginId);
  }

  async _setPluginDisabled(pluginId) {
    await this._updatePluginPreferenceEntry(pluginId, (entry) => ({
      ...entry,
      enabled: false,
    }));
  }

  async updatePlugin(pluginId) {
    const installedPluginsPreference =
      this._getInstalledPluginsPreference().find(
        (plugin) => plugin.id === pluginId,
      );
    if (!installedPluginsPreference) return null;
    const liveManifest = await this.sourceProvider.getLiveManifest(pluginId);
    if (
      compareVersions(
        liveManifest.version,
        installedPluginsPreference.version,
      ) > 0
    ) {
      const newVersion = liveManifest.version;
      await this._updatePluginPreferenceEntry(pluginId, (entry) => ({
        ...entry,
        version: newVersion,
      }));
      await this.pluginBridge.reloadPlugin(pluginId, newVersion);
      this._availableUpdates?.delete(pluginId);
      return { updated: true, version: newVersion };
    }
    this._availableUpdates?.delete(pluginId);
    return { updated: false };
  }

  async updateAllPlugins() {
    if (!this._availableUpdates || this._availableUpdates.size === 0) {
      return { updated: [], failed: [] };
    }
    const ids = [...this._availableUpdates.keys()];
    const results = await Promise.allSettled(
      ids.map((pluginId) => this.updatePlugin(pluginId)),
    );
    const updated = [];
    const failed = [];
    results.forEach((result, index) => {
      const pluginId = ids[index];
      if (result.status === "fulfilled" && result.value?.updated) {
        updated.push(pluginId);
      } else if (result.status === "rejected") {
        failed.push(pluginId);
      }
    });
    return { updated, failed };
  }

  async _addPluginPreferenceEntry(entry) {
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    await this._setInstalledPluginsPreference([
      ...installedPluginsPreference,
      entry,
    ]);
  }

  async _removePluginPreferenceEntry(pluginId) {
    const next = this._getInstalledPluginsPreference().filter(
      (plugin) => plugin.id !== pluginId,
    );
    await this._setInstalledPluginsPreference(next);
  }

  async _updatePluginPreferenceEntry(pluginId, updateFunc) {
    const installedPluginsPreference = this._getInstalledPluginsPreference();
    if (!installedPluginsPreference.some((plugin) => plugin.id === pluginId)) {
      throw new Error(
        `Tried to update preference for uninstalled plugin: ${pluginId}`,
      );
    }
    const updated = installedPluginsPreference.map((plugin) =>
      plugin.id === pluginId ? updateFunc(plugin) : plugin,
    );
    await this._setInstalledPluginsPreference(updated);
  }

  async listRegistryPlugins() {
    const listings = await this.registry.getPluginListings();
    const installedIds = new Set(
      this._getInstalledPluginsPreference().map((entry) => entry.id),
    );
    return listings.map((listing) => ({
      ...listing,
      installed: installedIds.has(listing.id),
    }));
  }

  getEnabledPlugins() {
    return this._getInstalledPluginsPreference()
      .filter((entry) => entry.enabled)
      .map((entry) => entry.id);
  }

  // Registry convenience methods

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  async getPostContextMenuItems(post) {
    return this._collectContextMenuItems("post-context-menu", post);
  }

  async getProfileContextMenuItems(profile) {
    return this._collectContextMenuItems("profile-context-menu", profile);
  }

  async _collectContextMenuItems(event, arg) {
    const listeners = this.registries.eventListeners.get(event);
    if (!listeners || listeners.size === 0) return [];
    const results = await Promise.all(
      [...listeners].map(async ([pluginId, handler]) => {
        try {
          const items = await handler(arg);
          return (items ?? []).map((item) => ({
            pluginId,
            icon: item.icon,
            title: item.title,
            invoke: () =>
              this.pluginBridge.getInstance(pluginId).call(item.handlerId, arg),
          }));
        } catch (error) {
          console.error(`Plugin ${pluginId} ${event} handler failed:`, error);
          return [];
        }
      }),
    );
    return results.flat();
  }

  // RPC

  async getFilteredFeedItems(feedUri, feed) {
    let filteredFeedItems = {};
    for (const feedFilter of this.registries.feedFilters) {
      try {
        const results = await feedFilter.invoke(feedUri, feed.feed);
        if (typeof results !== "object") continue;
        filteredFeedItems = { ...filteredFeedItems, ...results };
      } catch (e) {
        console.error(
          `Plugin ${feedFilter.pluginId} feed filter raised an exception`,
          e,
        );
      }
    }
    return filteredFeedItems;
  }
}
