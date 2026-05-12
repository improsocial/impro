import { PluginBridge } from "/js/plugins/pluginBridge.js";
import { showPluginModal, hidePluginModal } from "/js/modals.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";
import { PluginRegistry } from "/js/plugins/pluginRegistry.js";
import { PluginCache } from "/js/plugins/pluginCache.js";
import { SourceProvider } from "/js/plugins/sourceProvider.js";
import { compareVersions } from "/js/utils.js";
import { PLUGIN_REGISTRY_URL } from "/js/config.js";

export class PluginService {
  constructor(
    preferencesProvider,
    session,
    { sandbox = true, localOnly = false } = {},
  ) {
    this.registries = {
      sidebarItems: new Set(),
      eventListeners: new Map(),
      feedFilters: new Set(),
      settingTabs: new Map(),
    };
    this.localOnly = localOnly;
    this.registry = new PluginRegistry(PLUGIN_REGISTRY_URL, { localOnly });
    this.pluginCache = new PluginCache();
    this.sourceProvider = new SourceProvider(this.registry, this.pluginCache);
    this.pluginBridge = new PluginBridge(this.sourceProvider, {
      sandbox,
    });
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
        filterId: plugin.filterId,
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

  async listInstalledPlugins() {
    const installed = this._getInstalled();
    const results = await Promise.all(
      installed.map(async (entry) => {
        const manifest = await this.sourceProvider.ensureManifest(
          entry.id,
          entry.version,
        );
        if (!manifest) return null;
        return {
          id: entry.id,
          manifest,
          enabled: entry.enabled === true,
          loaded: this.pluginBridge.isLoaded(entry.id),
          hasSettings: this.registries.settingTabs.has(entry.id),
        };
      }),
    );
    return results.filter((entry) => entry !== null);
  }

  async loadEnabledPlugins() {
    const installed = this._getInstalled();
    const toLoad = installed.filter((entry) => entry.enabled);
    await this.pluginBridge.loadPlugins(toLoad);
    // Reconcile against all installed plugins (not just enabled) so disabled
    // plugins keep their cached assets on re-enable
    await this._reconcileCache(installed);
  }

  async getManifest(pluginId) {
    const installed = this._getInstalled().find(
      (plugin) => plugin.id === pluginId,
    );
    return this.sourceProvider.ensureManifest(pluginId, installed?.version);
  }

  _getInstalled() {
    if (!this.preferencesProvider) return [];
    try {
      return this.preferencesProvider
        .requirePreferences()
        .getInstalledPlugins();
    } catch {
      return [];
    }
  }

  async _setInstalled(plugins) {
    const preferences = this.preferencesProvider
      .requirePreferences()
      .setInstalledPlugins(plugins);
    await this.preferencesProvider.savePreferences(preferences);
  }

  // TODO
  // async _applyAutoUpdates() {
  //   const installed = this._getInstalled();
  //   if (installed.length === 0) return installed;
  //   let listings;
  //   try {
  //     listings = await this.registry.getPluginListings();
  //   } catch {
  //     return installed;
  //   }
  //   const listingById = new Map(
  //     listings.map((listing) => [listing.id, listing]),
  //   );
  //   const liveVersions = await Promise.all(
  //     installed.map(async (entry) => {
  //       const listing = listingById.get(entry.id);
  //       if (!listing || listing.local) return null;
  //       try {
  //         const manifest = await this.registry.fetchLiveManifest(listing);
  //         return manifest.version;
  //       } catch {
  //         return null;
  //       }
  //     }),
  //   );
  //   let changed = false;
  //   const next = installed.map((entry, index) => {
  //     const liveVersion = liveVersions[index];
  //     if (!liveVersion) return entry;
  //     if (compareVersions(liveVersion, entry.version) > 0) {
  //       changed = true;
  //       return { ...entry, version: liveVersion };
  //     }
  //     return entry;
  //   });
  //   if (changed) await this._setInstalled(next);
  //   return next;
  // }

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
    const installed = this._getInstalled();
    if (installed.some((plugin) => plugin.id === pluginId)) return;
    const version = listing.local
      ? (await this.sourceProvider.getManifest(pluginId)).version
      : (await this.registry.fetchLiveManifest(listing)).version;
    await this._setInstalled([
      ...installed,
      { id: pluginId, version, enabled: true },
    ]);
    await this.pluginBridge.loadPlugin(pluginId, version);
  }

  async uninstallPlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    const next = this._getInstalled().filter(
      (plugin) => plugin.id !== pluginId,
    );
    await this._setInstalled(next);
    await this._reconcileCache(next);
  }

  async enablePlugin(pluginId) {
    const installed = this._getInstalled();
    const entry = installed.find((plugin) => plugin.id === pluginId);
    if (!entry) throw new Error(`not installed: ${pluginId}`);
    if (entry.enabled) return;
    await this._setInstalled(
      installed.map((plugin) =>
        plugin.id === pluginId ? { ...plugin, enabled: true } : plugin,
      ),
    );
    await this.pluginBridge.loadPlugin(pluginId, entry.version);
  }

  async disablePlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    const installed = this._getInstalled();
    if (!installed.some((plugin) => plugin.id === pluginId)) return;
    await this._setInstalled(
      installed.map((plugin) =>
        plugin.id === pluginId ? { ...plugin, enabled: false } : plugin,
      ),
    );
  }

  async checkForUpdates(pluginId) {
    const listing = await this.registry.getPluginListing(pluginId);
    if (!listing || listing.local) return null;
    const installed = this._getInstalled().find(
      (plugin) => plugin.id === pluginId,
    );
    if (!installed) return null;
    const liveManifest = await this.registry.fetchLiveManifest(listing);
    if (compareVersions(liveManifest.version, installed.version) > 0) {
      // Re-read after the await and merge by id so a concurrent
      // enable/disable/uninstall isn't clobbered.
      const next = this._getInstalled().map((plugin) =>
        plugin.id === pluginId
          ? { ...plugin, version: liveManifest.version }
          : plugin,
      );
      await this._setInstalled(next);
      return { updated: true, version: liveManifest.version };
    }
    return { updated: false };
  }

  async listRegistryPlugins() {
    const listings = await this.registry.getPluginListings();
    const installedIds = new Set(this._getInstalled().map((entry) => entry.id));
    return listings.map((listing) => ({
      ...listing,
      installed: installedIds.has(listing.id),
    }));
  }

  getEnabledPlugins() {
    return this._getInstalled()
      .filter((entry) => entry.enabled)
      .map((entry) => entry.id);
  }

  // Registry convenience methods

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  async getPostContextMenuItems(post) {
    const listeners = this.registries.eventListeners.get("post-context-menu");
    if (!listeners || listeners.size === 0) return [];
    const results = await Promise.all(
      [...listeners].map(async ([pluginId, handler]) => {
        try {
          const items = await handler(post);
          return (items ?? []).map((item) => ({
            pluginId,
            icon: item.icon,
            title: item.title,
            invoke: () =>
              this.pluginBridge
                .getInstance(pluginId)
                .call(item.handlerId, post),
          }));
        } catch (error) {
          console.error(
            `Plugin ${pluginId} post-context-menu handler failed:`,
            error,
          );
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
          `Plugin ${feedFilter.pluginId} feed filter '${feedFilter.filterId}' raised an exception`,
          e,
        );
      }
    }
    return filteredFeedItems;
  }
}
