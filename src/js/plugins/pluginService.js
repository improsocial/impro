import { isDev } from "/js/utils.js";
import { PluginHost } from "./pluginHost.js";
import { setupPluginModals } from "./pluginModals.js";

const ENABLED_PLUGINS_KEY = "enabled-plugins";

function getEnabledPlugins() {
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

function setEnabledPlugins(ids) {
  localStorage.setItem(ENABLED_PLUGINS_KEY, JSON.stringify(ids));
}

class PluginService {
  constructor() {
    this.pluginHost = new PluginHost({ verbose: isDev() });
    setupPluginModals(this.pluginHost);
  }

  async loadPlugins() {
    const enabledIds = getEnabledPlugins();
    await this.pluginHost.loadPlugins(enabledIds);
  }

  enablePlugin(pluginId) {
    const ids = getEnabledPlugins();
    if (!ids.includes(pluginId)) {
      ids.push(pluginId);
      setEnabledPlugins(ids);
    }
  }

  disablePlugin(pluginId) {
    const ids = getEnabledPlugins();
    const next = ids.filter((id) => id !== pluginId);
    if (next.length !== ids.length) setEnabledPlugins(next);
  }

  getSidebarItems() {
    return [...this.pluginHost.registries.sidebarItems];
  }
}

export const pluginService = new PluginService();

window.enablePlugin = (pluginId) => pluginService.enablePlugin(pluginId);
window.disablePlugin = (pluginId) => pluginService.disablePlugin(pluginId);
