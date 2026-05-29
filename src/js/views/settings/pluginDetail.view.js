import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { Signal } from "/js/signals.js";

class SettingsPluginDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await auth.requireAuth();

    const { pluginId } = params;

    const $pluginDetails = new Signal.Computed(() => {
      const installed = pluginService.$installedPlugins
        .get()
        .find((plugin) => plugin.id === pluginId);
      return installed ?? null;
    });

    const $settingTab = new Signal.Computed(() => {
      const tab = pluginService.$settingTabs.get(pluginId);
      return tab ?? null;
    });

    const $tabContent = new Signal.State(null);
    const $tabError = new Signal.State(null);

    const tabRoot = pluginService.getRenderer(pluginId).createRoot();

    async function loadTab() {
      const tab = $settingTab.get();
      if (!tab) return;
      $tabError.set(null);
      try {
        const content = await tab.display();
        $tabContent.set(content);
      } catch (error) {
        $tabError.set(error.message ?? String(error));
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
      const tab = $settingTab.get();
      if (tab && !isLoaded) {
        isLoaded = true;
        queueMicrotask(() => loadTab());
      }
    });

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const pluginDetails = $pluginDetails.get();
      const settingTab = $settingTab.get();
      const tabContent = $tabContent.get();
      const tabError = $tabError.get();
      render(
        html`<div id="settings-plugin-detail-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
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
