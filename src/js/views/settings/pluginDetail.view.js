import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
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
    const state = {
      manifest: null,
      containerNode: null,
      error: null,
    };
    const $stateTick = new Signal.State(0);
    function bumpState() {
      $stateTick.set($stateTick.get() + 1);
    }

    pageEffect(
      root,
      () => {
        const tab = pluginService.$settingTabs.get(pluginId).get();
        const installed = pluginService.prefManager.$installedPlugins
          .get()
          .find((plugin) => plugin.id === pluginId);
        state.manifest = installed ?? null;
        if (!installed) {
          state.error = "Plugin not found.";
          bumpState();
        } else if (!pluginService.pluginBridge.isLoaded(pluginId)) {
          state.error = "This plugin is not enabled.";
          bumpState();
        } else if (!tab) {
          state.error = "This plugin has no settings.";
          bumpState();
        } else {
          (async () => {
            try {
              state.containerNode = await tab.display();
              state.error = null;
            } catch (error) {
              state.error = error.message ?? String(error);
            }
            bumpState();
          })();
        }
      },
      "RELOAD_PLUGIN_SETTING_TAB",
    );

    const tabRoot = pluginService.getRenderer(pluginId).createRoot({
      handlerRenderFunc: () => bumpState(),
    });

    function renderTabContent(containerNode) {
      if (!containerNode) return null;
      return tabRoot.render(containerNode);
    }

    pageEffect(root, () => {
      $stateTick.get();
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const title = state.manifest?.name ?? pluginId;
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
                title,
                onClickBackButton: () => window.router.go("/settings/plugins"),
              })}
              <main>
                ${state.error
                  ? html`<p class="error-message">${state.error}</p>`
                  : html`<div class="plugin-settings-tab">
                      ${renderTabContent(state.containerNode)}
                    </div>`}
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
