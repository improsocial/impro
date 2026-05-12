import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { requireAuth } from "/js/auth.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import "/js/components/toggle-switch.js";

class SettingsPluginsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await requireAuth();

    const state = {
      plugins: [],
      loading: true,
    };

    async function loadPlugins() {
      state.loading = true;
      renderPage();
      state.plugins = await pluginService.listAvailablePlugins();
      state.loading = false;
      renderPage();
    }

    async function togglePlugin(plugin) {
      if (plugin.enabled) {
        pluginService.disablePlugin(plugin.id);
        pluginService.pluginHost.unloadPlugin(plugin.id);
      } else {
        pluginService.enablePlugin(plugin.id);
        await pluginService.pluginHost.loadPlugin(plugin.id);
      }
      await loadPlugins();
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      render(
        html`<div id="settings-plugins-view">
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
                title: "Plugins",
                onClickBackButton: () => window.router.go("/settings"),
              })}
              <main>
                ${state.loading
                  ? html`<p>Loading…</p>`
                  : state.plugins.length === 0
                    ? html`<p>No plugins available.</p>`
                    : html`<ul class="plugin-list">
                        ${state.plugins.map(
                          (plugin) => html`
                            <li class="plugin-list-item">
                              <div class="plugin-list-item-info">
                                <div class="plugin-list-item-name">
                                  ${plugin.manifest.name}
                                </div>
                                ${plugin.manifest.description
                                  ? html`<div
                                      class="plugin-list-item-description"
                                    >
                                      ${plugin.manifest.description}
                                    </div>`
                                  : ""}
                                <div class="plugin-list-item-version">
                                  v${plugin.manifest.version}
                                </div>
                              </div>
                              <div class="plugin-list-item-controls">
                                ${plugin.enabled && plugin.hasSettings
                                  ? html`<a
                                      class="plugin-settings-link"
                                      href="/settings/plugins/${plugin.id}"
                                      aria-label="Settings for ${plugin.manifest
                                        .name}"
                                    >
                                      ${settingsIconTemplate()}
                                    </a>`
                                  : ""}
                                <toggle-switch
                                  class="plugin-toggle"
                                  label="Enable ${plugin.manifest.name}"
                                  ?checked=${plugin.enabled}
                                  @change=${() => togglePlugin(plugin)}
                                ></toggle-switch>
                              </div>
                            </li>
                          `,
                        )}
                      </ul>`}
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => renderPage());
      await loadPlugins();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadPlugins();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsPluginsView();
