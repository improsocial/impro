import { PluginBridge } from "/js/plugins/pluginBridge.js";
import { showPluginModal, hidePluginModal } from "/js/modals.js";
import { showPluginToast, hidePluginToast, showToast } from "/js/toasts.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";
import {
  RemotePluginRegistry,
  LocalPluginRegistry,
} from "/js/plugins/pluginRegistry.js";
import { PluginCache } from "/js/plugins/pluginCache.js";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";
import { SourceProvider } from "/js/plugins/sourceProvider.js";
import { PluginStylesLoader } from "/js/plugins/pluginStylesLoader.js";
import { compareVersions, isDev } from "/js/utils.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { PLUGIN_REGISTRY_URL } from "/js/config.js";

const DISABLE_PLUGINS_QUERY_PARAM = "disable-plugins";

export function arePluginsDisabledByQueryParam() {
  const params = new URLSearchParams(window.location.search);
  return params.has(DISABLE_PLUGINS_QUERY_PARAM);
}

export function parseGithubRepoUrl(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  if (!owner || !repo) return null;
  return `${owner}/${repo}`;
}

export class PluginService extends EventEmitter {
  constructor(preferencesProvider, session) {
    super();
    this.registries = {
      sidebarItems: new Set(),
      eventListeners: new Map(),
      feedFilters: new Set(),
      settingTabs: new Map(),
    };
    this._availableUpdates = null;
    this.localPluginsEnabled = isDev();
    this.remoteRegistry = new RemotePluginRegistry(PLUGIN_REGISTRY_URL);
    this.localRegistry = this.localPluginsEnabled
      ? new LocalPluginRegistry()
      : null;
    this.pluginCache = new PluginCache();
    this.sourceProvider = new SourceProvider(this.pluginCache);
    this.pluginStylesLoader = new PluginStylesLoader();
    this.pluginBridge = new PluginBridge(
      this.sourceProvider,
      this.pluginStylesLoader,
    );
    this.pluginRenderer = new PluginRenderer(this.pluginBridge);
    this.prefManager = new PluginPreferencesManager(preferencesProvider);
    this.session = session;
    this._setupRegistries();
    this._setupHostMethods();
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
      return this.prefManager.readSettingsForPlugin(plugin.pluginId);
    });

    this.pluginBridge.addHostMethod("saveData", async (plugin, { data }) => {
      await this.prefManager.writeSettingsForPlugin(plugin.pluginId, data);
    });

    this.pluginBridge.addHostMethod("refreshSettingTab", (plugin) => {
      this.emit("settingTabRefresh", { pluginId: plugin.pluginId });
    });

    this.pluginBridge.addHostMethod(
      "refreshFeedFilters",
      (plugin, feedURI = null) => {
        this.emit("feedFiltersRefresh", { pluginId: plugin.pluginId, feedURI });
      },
    );

    this.pluginBridge.addHostMethod(
      "applyStyleSnippet",
      (plugin, { snippetId, cssText }) => {
        this.pluginStylesLoader.mountSnippet(
          plugin.pluginId,
          snippetId,
          cssText,
        );
      },
    );

    this.pluginBridge.addHostMethod(
      "removeStyleSnippet",
      (plugin, { snippetId }) => {
        this.pluginStylesLoader.unmountSnippet(plugin.pluginId, snippetId);
      },
    );

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

  async loadEnabledPlugins() {
    if (arePluginsDisabledByQueryParam()) {
      const enabledPluginIds = this.prefManager
        .getEnabledPlugins()
        .map((entry) => entry.id);
      await this.prefManager.setPluginsDisabled(enabledPluginIds);
      return;
    }
    const enabledPlugins = this.prefManager
      .getEnabledPlugins()
      .filter(
        (entry) => this.localPluginsEnabled || !entry.id.endsWith("__LOCAL"),
      );
    const { erroredPlugins } =
      await this.pluginBridge.loadPlugins(enabledPlugins);
    if (erroredPlugins.length) {
      const failedPluginIds = erroredPlugins.map(({ pluginId }) => pluginId);
      showToast(`Failed to load plugin(s): ${failedPluginIds.join(", ")}`, {
        style: "error",
      });
      // Disable plugins that failed to load
      await Promise.all(
        failedPluginIds.map((pluginId) =>
          this.prefManager.setPluginDisabled(pluginId),
        ),
      );
    }
    // Reconcile against all installed plugins (not just enabled) so disabled
    // plugins keep their cached assets on re-enable
    const installedPlugins = this.prefManager.getInstalledPlugins();
    await this._reconcileCache(installedPlugins);
  }

  getAvailableUpdates() {
    return this._availableUpdates;
  }

  async checkForUpdates() {
    const installedPlugins = this.prefManager.getInstalledPlugins();
    const results = await Promise.allSettled(
      installedPlugins.map(async (entry) => {
        const liveManifest = await this.sourceProvider.getLiveManifest(
          entry.id,
          entry.repo,
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
    const installedPlugins = this.prefManager.getInstalledPlugins();
    const results = await Promise.allSettled(
      installedPlugins
        .filter((entry) => entry.enabled === true)
        .map(async (entry) => {
          try {
            await this.pluginBridge.reloadPlugin(
              entry.id,
              entry.version,
              entry.repo,
            );
          } catch (e) {
            await this.prefManager.setPluginDisabled(entry.id);
            throw e;
          }
        }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  getPluginsInfo() {
    const installedPlugins = this.prefManager.getInstalledPlugins();
    const visiblePlugins = this.localPluginsEnabled
      ? installedPlugins
      : installedPlugins.filter((entry) => !entry.id.endsWith("__LOCAL"));
    return visiblePlugins.map((entry) => {
      return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        version: entry.version,
        author: entry.author,
        enabled: entry.enabled,
        loaded: this.pluginBridge.isLoaded(entry.id),
        hasSettings: this.registries.settingTabs.has(entry.id),
      };
    });
  }

  async getManifest(pluginId) {
    const installedPlugin = this.prefManager
      .getInstalledPlugins()
      .find((plugin) => plugin.id === pluginId);
    return this.sourceProvider
      .getManifest(pluginId, installedPlugin?.version, installedPlugin?.repo)
      .catch(() => null);
  }

  async _reconcileCache(installed) {
    const urlLists = await Promise.all(
      installed.map((entry) =>
        this.sourceProvider.getCacheUrls(entry.id, entry.version, entry.repo),
      ),
    );
    await this.pluginCache.reconcile(urlLists.flat());
  }

  async installPlugin(pluginId) {
    let repo = null;
    if (!pluginId.endsWith("__LOCAL")) {
      const listing = await this.remoteRegistry.getListing(pluginId);
      if (!listing) {
        throw new Error(`unknown plugin: ${pluginId}`);
      }
      repo = listing.repo;
    }
    const installedPlugins = this.prefManager.getInstalledPlugins();
    if (installedPlugins.some((plugin) => plugin.id === pluginId)) {
      console.warn(`Plugin ${pluginId} already installed`);
      return;
    }
    let manifest = null;
    try {
      manifest = await this.sourceProvider.getLiveManifest(pluginId, repo);
    } catch (e) {
      console.error("Failed to fetch manifest", e);
      throw new Error("Failed to fetch manifest");
    }
    const { name, version, author, description } = manifest;
    await this.prefManager.addInstalledPlugin({
      id: pluginId,
      name,
      version,
      author,
      description,
      repo,
      enabled: true,
    });
    try {
      await this.pluginBridge.loadPlugin(pluginId, version, repo);
    } catch (e) {
      console.error(e);
      await this.prefManager.removeInstalledPlugin(pluginId);
      throw e;
    }
  }

  async installUnregisteredPlugin(url) {
    const repo = parseGithubRepoUrl(url);
    if (!repo) {
      throw new Error("Invalid GitHub URL");
    }
    let manifest = null;
    try {
      manifest = await this.sourceProvider.getLiveManifestFromRepo(repo);
    } catch (e) {
      console.error("Failed to fetch manifest", e);
      throw new Error("Failed to fetch manifest");
    }
    const { id, name, version, author, description } = manifest;
    if (await this.remoteRegistry.getListing(id)) {
      throw new Error(`Plugin ${id} is in the registry; install it from there`);
    }
    if (this.localRegistry && (await this.localRegistry.getListing(id))) {
      throw new Error(`Plugin ${id} is in the registry; install it from there`);
    }
    const installedPlugins = this.prefManager.getInstalledPlugins();
    if (installedPlugins.some((plugin) => plugin.id === id)) {
      throw new Error(`Plugin ${id} already installed`);
    }
    await this.prefManager.addInstalledPlugin({
      id,
      name,
      version,
      author,
      description,
      repo,
      enabled: true,
    });
    try {
      await this.pluginBridge.loadPlugin(id, version, repo);
    } catch (e) {
      console.error(e);
      await this.prefManager.removeInstalledPlugin(id);
      throw e;
    }
    return { id, name };
  }

  async uninstallPlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this.prefManager.removeInstalledPlugin(pluginId);
    await this.prefManager.clearSettingsForPlugin(pluginId);
    await this._reconcileCache(this.prefManager.getInstalledPlugins());
  }

  async enablePlugin(pluginId) {
    await this.prefManager.setPluginEnabled(pluginId);
    const installedPlugin = this.prefManager.getInstalledPlugin(pluginId);
    try {
      await this.pluginBridge.loadPlugin(
        pluginId,
        installedPlugin.version,
        installedPlugin.repo,
      );
    } catch (e) {
      await this.prefManager.setPluginDisabled(pluginId);
      throw e;
    }
  }

  async disablePlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this.prefManager.setPluginDisabled(pluginId);
  }

  async updatePlugin(pluginId) {
    const installedPlugin = this.prefManager.getInstalledPlugin(pluginId);
    if (!installedPlugin) return null;
    const liveManifest = await this.sourceProvider.getLiveManifest(
      pluginId,
      installedPlugin.repo,
    );
    if (compareVersions(liveManifest.version, installedPlugin.version) > 0) {
      const { name, version, author, description } = liveManifest;
      await this.prefManager.updateInstalledPlugin(pluginId, (entry) => ({
        ...entry,
        name,
        version,
        author,
        description,
      }));
      await this.pluginBridge.reloadPlugin(
        pluginId,
        version,
        installedPlugin.repo,
      );
      this._availableUpdates?.delete(pluginId);
      return { updated: true, version };
    }
    this._availableUpdates?.delete(pluginId);
    return { updated: false };
  }

  async updateAllPlugins() {
    if (!this._availableUpdates || this._availableUpdates.size === 0) {
      return { updated: [], failed: [] };
    }
    const ids = [...this._availableUpdates.keys()];
    const updated = [];
    const failed = [];
    // Serial to avoid racing read-modify-write on installed plugin preferences
    for (const pluginId of ids) {
      try {
        const result = await this.updatePlugin(pluginId);
        if (result?.updated) updated.push(pluginId);
      } catch {
        failed.push(pluginId);
      }
    }
    return { updated, failed };
  }

  async listRegistryPlugins() {
    const remoteListings = await this.remoteRegistry.getListings();
    const localListings = this.localRegistry
      ? await this.localRegistry.getListings()
      : [];
    const installedIds = this.prefManager
      .getInstalledPlugins()
      .map((entry) => entry.id);
    return [...remoteListings, ...localListings].map((listing) => ({
      ...listing,
      installed: installedIds.includes(listing.id),
    }));
  }

  // Registry convenience methods

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  getSettingTabs() {
    return [...this.registries.settingTabs.values()];
  }

  getSettingTab(pluginId) {
    return this.registries.settingTabs.get(pluginId) ?? null;
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
      const feedItems = feed.feed;
      let results = null;
      try {
        results = await feedFilter.invoke(feedUri, feedItems);
      } catch (e) {
        console.error(
          `Plugin ${feedFilter.pluginId} feed filter raised an exception`,
          e,
        );
      }
      if (!results || typeof results !== "object") continue;
      filteredFeedItems = { ...filteredFeedItems, ...results };
    }
    return filteredFeedItems;
  }
}
