import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";

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
    const tabRoot = pluginService.getRenderer(pluginId).createRoot();

    function renderTabContent(containerNode) {
      if (!containerNode) return null;
      return tabRoot.render(containerNode);
    }

    function resolveTab() {
      const installed = pluginService.prefManager.$installedPlugins
        .get()
        .find((plugin) => plugin.id === pluginId);
      if (!installed) return { error: "Plugin not found." };
      if (!pluginService.pluginBridge.isLoaded(pluginId)) {
        return { installed, error: "This plugin is not enabled." };
      }
      const tab = pluginService.$settingTabs.get(pluginId);
      if (!tab) return { installed, error: "This plugin has no settings." };
      return { installed, tab };
    }

    pageEffect(root, () => {
      const { tab } = resolveTab();
      if (tab && tab.$content.get().status === "idle") {
        tab.refresh();
      }
    });

    pageEffect(root, () => {
      const { installed, tab, error: availabilityError } = resolveTab();
      const content = tab?.$content.get() ?? null;
      const error =
        availabilityError ??
        (content?.status === "error" ? content.error : null);
      const containerNode = content?.status === "ready" ? content.node : null;
      const manifest = installed ?? null;
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const title = manifest?.name ?? pluginId;
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
                ${error
                  ? html`<p class="error-message">${error}</p>`
                  : html`<div class="plugin-settings-tab">
                      ${renderTabContent(containerNode)}
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
