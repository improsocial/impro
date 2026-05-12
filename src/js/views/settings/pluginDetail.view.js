import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { requireAuth } from "/js/auth.js";

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
    await requireAuth();

    const { pluginId } = params;
    const state = {
      manifest: null,
      tab: null,
      containerNode: null,
      error: null,
    };

    async function loadTab() {
      state.manifest = await pluginService.pluginHost.ensureManifest(pluginId);
      if (!state.manifest) {
        state.error = "Plugin not found.";
        renderPage();
        return;
      }
      if (!pluginService.pluginHost.isLoaded(pluginId)) {
        state.error = "This plugin is not enabled.";
        renderPage();
        return;
      }
      const tab = pluginService.getSettingTab(pluginId);
      state.tab = tab;
      if (!tab) {
        state.error = "This plugin has no settings.";
        renderPage();
        return;
      }
      try {
        state.containerNode = await tab.display();
      } catch (error) {
        state.error = error.message ?? String(error);
      }
      renderPage();
    }

    function renderTabContent(containerNode) {
      if (!containerNode) return null;
      return pluginService.pluginRenderer.renderNode(containerNode, pluginId);
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
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
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => renderPage());
      await loadTab();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadTab();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsPluginDetailView();
