import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { Signal, ReactiveStore } from "/js/signals.js";

class SettingsPluginDetailView extends View {
  async render({
    root,
    params,
    context: { dataLayer, pluginService, mainLayout },
  }) {
    await auth.requireAuth();

    const { pluginId } = params;

    const state = new ReactiveStore("settingsPluginDetailView");
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

    state.$tabContent = new Signal.State(null);
    state.$tabError = new Signal.State(null);

    const tabRoot = pluginService.getRenderer(pluginId).createRoot();

    async function loadTab() {
      const tab = state.$settingTab.get();
      if (!tab) return;
      state.$tabError.set(null);
      try {
        const content = await tab.display();
        state.$tabContent.set(content);
      } catch (error) {
        state.$tabError.set(error.message ?? String(error));
      }
    }

    bindToPage(root, pluginService, "settingTabRefresh", (event) => {
      if (event.pluginId !== pluginId) return;
      if (event.reset) tabRoot.reset();
      loadTab();
    });

    // Load the tab's content on register
    let isLoaded = false;
    pageEffect(root, () => {
      const tab = state.$settingTab.get();
      if (tab && !isLoaded) {
        isLoaded = true;
        queueMicrotask(() => loadTab());
      }
    });

    pageEffect(root, () => {
      const pluginDetails = state.$pluginDetails.get();
      const settingTab = state.$settingTab.get();
      const tabContent = state.$tabContent.get();
      const tabError = state.$tabError.get();
      render(
        html`<div id="settings-plugin-detail-view">
          ${mainLayout({
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${headerTemplate({
                title: pluginDetails?.name ?? pluginId,
                onClickBackButton: () => window.router.go("/settings/plugins"),
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
                  if (!settingTab) {
                    return html`<p
                      class="error-message"
                      data-testid="plugin-detail-no-settings"
                    >
                      This plugin has no settings.
                    </p>`;
                  }
                  if (tabError) {
                    return html`<p
                      class="error-message"
                      data-testid="plugin-detail-tab-error"
                    >
                      ${tabError}
                    </p>`;
                  }
                  return html`<div class="plugin-settings-tab">
                    ${tabContent
                      ? tabRoot.render(tabContent)
                      : html`<div class="plugins-loading-state">
                          <div class="loading-spinner"></div>
                        </div>`}
                  </div>`;
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", () => {
      dataLayer.declarative.ensureCurrentUser();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsPluginDetailView();
