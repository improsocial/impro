import { PluginBridge } from "/js/plugins/pluginBridge.js";
import { showPluginModal, hidePluginModal } from "/js/modals.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

const ENABLED_PLUGINS_KEY = "enabled-plugins";

export class PluginService {
  constructor(preferencesProvider, { sandbox = true } = {}) {
    this.registries = {
      sidebarItems: new Set(),
      postContextMenuItems: new Set(),
      feedFilters: new Set(),
      settingTabs: new Map(),
    };
    this.pluginBridge = new PluginBridge({ sandbox });
    this.pluginRenderer = new PluginRenderer(this.pluginBridge);
    this.preferencesProvider = preferencesProvider;
    this._setupRegistries();
    this._setupHostMethods();
    if (preferencesProvider) {
      preferencesProvider.on("pluginSettingsChanged", ({ pluginId, data }) => {
        const instance = this.pluginBridge.getInstance(pluginId);
        if (!instance) return;
        instance.sendEvent("settingsChanged", { data });
      });
    }
  }

  _readPluginSettings(pluginId) {
    const prefs = this.preferencesProvider.requirePreferences();
    return prefs.getPluginSettings(pluginId);
  }

  async _writePluginSettings(pluginId, data) {
    if (!this.preferencesProvider) {
      throw new Error("Preferences not available");
    }
    await this.preferencesProvider.updatePluginSettings(pluginId, data);
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
      "postContextMenuItem",
      (plugin, message) => {
        const entry = {
          pluginId: plugin.pluginId,
          icon: message.icon,
          title: message.title,
          invoke: (post) => plugin.call(message.handlerId, post),
        };
        this.registries.postContextMenuItems.add(entry);
        return () => this.registries.postContextMenuItems.delete(entry);
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
  }

  getSettingTabs() {
    return [...this.registries.settingTabs.values()];
  }

  getSettingTab(pluginId) {
    return this.registries.settingTabs.get(pluginId) ?? null;
  }

  async listAvailablePlugins() {
    const ids = this.pluginBridge.getAvailablePluginIds();
    const enabled = new Set(this.getEnabledPlugins());
    const manifests = await Promise.all(
      ids.map((id) => this.pluginBridge.ensureManifest(id)),
    );
    return ids
      .map((id, index) => {
        const manifest = manifests[index];
        if (!manifest) return null;
        return {
          id,
          manifest,
          enabled: enabled.has(id),
          loaded: this.pluginBridge.isLoaded(id),
          hasSettings: this.registries.settingTabs.has(id),
        };
      })
      .filter((entry) => entry !== null);
  }

  async loadEnabledPlugins() {
    const enabledIds = this.getEnabledPlugins();
    await this.pluginBridge.loadPluginIndex("/plugins-local/index.json");
    await this.pluginBridge.loadPlugins(enabledIds);
  }

  getEnabledPlugins() {
    try {
      const raw = localStorage.getItem(ENABLED_PLUGINS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }

  setEnabledPlugins(ids) {
    localStorage.setItem(ENABLED_PLUGINS_KEY, JSON.stringify(ids));
  }

  enablePlugin(pluginId) {
    const ids = this.getEnabledPlugins();
    if (!ids.includes(pluginId)) {
      this.setEnabledPlugins([...ids, pluginId]);
    }
  }

  disablePlugin(pluginId) {
    const ids = this.getEnabledPlugins();
    this.setEnabledPlugins(ids.filter((id) => id !== pluginId));
  }

  // Registry convenience methods

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  getPostContextMenuItems() {
    return [...this.registries.postContextMenuItems];
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
