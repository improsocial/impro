import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { requireAuth } from "/js/auth.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";
import { confirm } from "/js/modals.js";
import { showToast } from "/js/toasts.js";
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
      uninstallingIds: new Set(),
    };

    async function loadPlugins() {
      state.loading = true;
      renderPage();
      state.plugins = await pluginService.listInstalledPlugins();
      state.loading = false;
      renderPage();
    }

    async function uninstallPlugin(plugin) {
      const confirmed = await confirm(
        `"${plugin.manifest.name}" will be disabled and uninstalled.`,
        {
          title: "Uninstall plugin?",
          confirmButtonStyle: "danger",
          confirmButtonText: "Uninstall",
        },
      );
      if (!confirmed) return;
      state.uninstallingIds.add(plugin.id);
      renderPage();
      try {
        await pluginService.uninstallPlugin(plugin.id);
        await loadPlugins();
        showToast(`Uninstalled ${plugin.manifest.name}`, { style: "success" });
      } finally {
        state.uninstallingIds.delete(plugin.id);
        renderPage();
      }
    }

    async function togglePlugin(plugin) {
      if (plugin.enabled) {
        await pluginService.disablePlugin(plugin.id);
      } else {
        await pluginService.enablePlugin(plugin.id);
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
                <a
                  class="community-plugins-link"
                  href="/settings/plugins/community"
                >
                  <span class="community-plugins-link-icon"
                    >${globeIconTemplate()}</span
                  >
                  <span class="community-plugins-link-text">
                    <span class="community-plugins-link-title"
                      >Browse community plugins</span
                    >
                    <span class="community-plugins-link-subtitle"
                      >Discover plugins built by the community</span
                    >
                  </span>
                  <span class="community-plugins-link-arrow"
                    >${chevronRightIconTemplate()}</span
                  >
                </a>
                ${state.loading
                  ? html`<p class="plugin-list-loading">Loading…</p>`
                  : state.plugins.length === 0
                    ? html`<div class="plugins-empty-state">
                        <div class="plugins-empty-state-title">
                          No plugins installed
                        </div>
                        <p class="plugins-empty-state-message">
                          Browse the community registry to find and install
                          plugins.
                        </p>
                      </div>`
                    : html`<ul class="plugin-list">
                        ${state.plugins.map(
                          (plugin) => html`
                            <li
                              class="plugin-list-item ${state.uninstallingIds.has(
                                plugin.id,
                              )
                                ? "uninstalling"
                                : ""}"
                              ?inert=${state.uninstallingIds.has(plugin.id)}
                            >
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
                                <button
                                  class="plugin-uninstall-button"
                                  aria-label="Uninstall ${plugin.manifest.name}"
                                  @click=${() => uninstallPlugin(plugin)}
                                >
                                  ${trashCanIconTemplate()}
                                </button>
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
