import { PluginHost } from "/js/plugins/pluginHost.js";
import { showPluginModal, hidePluginModal } from "/js/modals.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

const ENABLED_PLUGINS_KEY = "enabled-plugins";

export class PluginService {
  constructor() {
    this.registries = {
      sidebarItems: new Set(),
      postContextMenuItems: new Set(),
    };
    this.pluginHost = new PluginHost();
    this.pluginRenderer = new PluginRenderer(this.pluginHost);
    this._setupRegistries();
    this._setupHostMethods();
  }

  _setupRegistries() {
    this.pluginHost.addRegistrationTarget("sidebarItem", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        icon: message.icon,
        title: message.title,
        invoke: () => plugin.call(message.handlerId),
      };
      this.registries.sidebarItems.add(entry);
      return () => this.registries.sidebarItems.delete(entry);
    });
    this.pluginHost.addRegistrationTarget(
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
  }

  _setupHostMethods() {
    this.pluginHost.addHostMethod(
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

    this.pluginHost.addHostMethod("closeModal", (plugin, { modalId }) => {
      hidePluginModal({ pluginId: plugin.pluginId, modalId });
    });
  }

  async loadEnabledPlugins() {
    const enabledIds = this.getEnabledPlugins();
    await this.pluginHost.loadPluginIndex("/plugins-local/index.json");
    await this.pluginHost.loadPlugins(enabledIds);
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
}
