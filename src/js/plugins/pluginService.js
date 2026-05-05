import { isDev } from "/js/utils.js";
import { PluginHost } from "./pluginHost.js";
import { setupPluginModals } from "./pluginModals.js";

class PluginService {
  constructor() {
    this.pluginHost = new PluginHost({ verbose: isDev() });
    setupPluginModals(this.pluginHost);
  }

  async loadPlugins() {
    await this.pluginHost.loadEnabledPlugins();
  }

  getSidebarIcons() {
    return [...this.pluginHost.registries.sidebarIcons];
  }
}

export const pluginService = new PluginService();
