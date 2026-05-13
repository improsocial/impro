import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { requireAuth } from "/js/auth.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";
import { reloadIconTemplate } from "/js/templates/icons/reloadIcon.template.js";
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
      uninstallingIds: new Set(),
      enablingIds: new Set(),
      disablingIds: new Set(),
      reloading: false,
    };

    async function loadPlugins() {
      await pluginService.loadPluginsInfo();
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
        showToast(`Uninstalled ${plugin.manifest.name}`);
      } finally {
        state.uninstallingIds.delete(plugin.id);
        renderPage();
      }
    }

    async function reloadPlugins() {
      if (state.reloading) return;
      state.reloading = true;
      renderPage();
      try {
        await pluginService.reloadPlugins();
        showToast("Reloaded plugins");
      } catch (e) {
        showToast("Failed to reload plugins", { style: "error" });
      } finally {
        state.reloading = false;
        renderPage();
      }
    }

    async function togglePlugin(plugin) {
      const pendingSet = plugin.enabled
        ? state.disablingIds
        : state.enablingIds;
      pendingSet.add(plugin.id);
      renderPage();
      try {
        if (plugin.enabled) {
          await pluginService.disablePlugin(plugin.id);
          showToast(`Disabled ${plugin.manifest.name}`);
        } else {
          try {
            await pluginService.enablePlugin(plugin.id);
            showToast(`Enabled ${plugin.manifest.name}`, { style: "success" });
          } catch (e) {
            showToast(`Error when loading ${plugin.manifest.name}`, {
              style: "error",
            });
          }
        }
        await loadPlugins();
      } finally {
        pendingSet.delete(plugin.id);
        renderPage();
      }
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const pluginsInfo = pluginService.getPluginsInfo();
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
                <div class="installed-plugins-header">
                  <h2>Installed plugins</h2>
                  <button
                    class="plugin-reload-button"
                    aria-label="Reload plugins"
                    ?disabled=${state.reloading}
                    @click=${() => reloadPlugins()}
                  >
                    ${reloadIconTemplate()}
                  </button>
                </div>
                ${!pluginsInfo
                  ? html`<p class="plugin-list-loading">Loading…</p>`
                  : pluginsInfo.length === 0
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
                        ${pluginsInfo.map((plugin) => {
                          const isPending =
                            state.uninstallingIds.has(plugin.id) ||
                            state.enablingIds.has(plugin.id) ||
                            state.disablingIds.has(plugin.id);
                          return html`
                            <li
                              class="plugin-list-item ${state.uninstallingIds.has(
                                plugin.id,
                              )
                                ? "uninstalling"
                                : ""}"
                              ?inert=${isPending}
                            >
                              <div class="plugin-list-item-info">
                                <div class="plugin-list-item-name">
                                  ${plugin.manifest.name}
                                  ${plugin.local
                                    ? html`<span class="plugin-local-badge"
                                        >local</span
                                      >`
                                    : ""}
                                </div>
                                ${plugin.manifest.description
                                  ? html`<div
                                      class="plugin-list-item-description"
                                    >
                                      ${plugin.manifest.description}
                                    </div>`
                                  : ""}
                                <div class="plugin-list-item-version">
                                  Version: ${plugin.manifest.version}
                                </div>
                                <div class="plugin-list-item-author">
                                  By ${plugin.manifest.author}
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
                                  ?checked=${state.enablingIds.has(plugin.id)
                                    ? true
                                    : state.disablingIds.has(plugin.id)
                                      ? false
                                      : plugin.enabled}
                                  ?disabled=${state.enablingIds.has(
                                    plugin.id,
                                  ) || state.disablingIds.has(plugin.id)}
                                  @change=${() => togglePlugin(plugin)}
                                ></toggle-switch>
                              </div>
                            </li>
                          `;
                        })}
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
      renderPage();
      loadPlugins();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsPluginsView();
