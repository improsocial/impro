import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import "/js/components/plugin-custom-content.js";

class PluginSettingsView extends View {
  async render({ root, router, layout, params, context: { pluginService } }) {
    await auth.requireAuth();

    const { pluginId } = params;

    const state = new ReactiveStore("pluginSettingsView");
    state.$pluginDetails = new Signal.Computed(() => {
      const installed = pluginService.$installedPlugins
        .get()
        .find((plugin) => plugin.id === pluginId);
      return installed ?? null;
    });

    state.$settingTab = new Signal.Computed(() => {
      const tab = pluginService.$settingTabs.get(pluginId);
      return tab ?? null;
    });
    state.$loadStatus = new Signal.Computed(() =>
      pluginService.getPluginLoadStatus(pluginId),
    );

    bindToPage(root, layout, "active-nav-click", (event) => {
      event.preventDefault();
      router.go("/plugins/installed");
    });

    bindPageTitle(root, () => {
      return state.$pluginDetails.get()?.name ?? null;
    });

    pageEffect(root, () => {
      const pluginDetails = state.$pluginDetails.get();
      const settingTab = state.$settingTab.get();
      const { loading: pluginLoading, error: pluginLoadError } =
        state.$loadStatus.get();
      render(
        html`<div id="plugin-settings-view">
          ${headerTemplate({
            title: pluginDetails?.name ?? pluginId,
            backButtonFallbackRoute: "/plugins/installed",
          })}
          <main>
            ${(() => {
              if (!pluginDetails) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-detail-not-found"
                >
                  Plugin not found.
                </p>`;
              }
              if (!pluginDetails.enabled) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-detail-disabled"
                >
                  This plugin is not enabled.
                </p>`;
              }
              if (pluginLoadError) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-detail-load-failed"
                >
                  ${pluginLoadError.message ?? "This plugin failed to load."}
                </p>`;
              }
              if (!settingTab) {
                if (pluginLoading) {
                  return html`<div class="plugins-loading-state">
                    <div class="loading-spinner"></div>
                  </div>`;
                }
                return html`<p
                  class="error-message"
                  data-testid="plugin-detail-no-settings"
                >
                  This plugin has no settings.
                </p>`;
              }
              return html`<div class="plugin-content plugin-content-page">
                <plugin-custom-content
                  .pluginService=${pluginService}
                  .customContent=${settingTab.customContent}
                ></plugin-custom-content>
              </div>`;
            })()}
          </main>
        </div>`,
        root,
      );
    });
  }
}

export default new PluginSettingsView();
