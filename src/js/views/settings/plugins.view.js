import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";
import { reloadIconTemplate } from "/js/templates/icons/reloadIcon.template.js";
import { confirm } from "/js/modals.js";
import { showToast } from "/js/toasts.js";
import { PermissionsDeclinedError } from "/js/plugins/pluginService.js";
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
    await auth.requireAuth();

    const state = {
      uninstallingIds: new Set(),
      enablingIds: new Set(),
      disablingIds: new Set(),
      reloading: false,
      checkingForUpdates: false,
      updatingAll: false,
      updatingIds: new Set(),
    };
    async function uninstallPlugin(plugin) {
      const confirmed = await confirm(
        `"${plugin.name}" will be uninstalled and its settings will be deleted.`,
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
        showToast(`Uninstalled ${plugin.name}`);
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
        console.error(e);
        showToast("Failed to reload plugins", { style: "error" });
      } finally {
        state.reloading = false;
        renderPage();
      }
    }

    async function checkForUpdates() {
      if (state.checkingForUpdates) return;
      state.checkingForUpdates = true;
      renderPage();
      try {
        const updates = await pluginService.checkForUpdates();
        if (updates.size === 0) {
          showToast("All plugins are up to date", { style: "success" });
        } else {
          showToast(
            `${updates.size} update${updates.size === 1 ? "" : "s"} available`,
          );
        }
      } catch (e) {
        showToast("Failed to check for updates", { style: "error" });
      } finally {
        state.checkingForUpdates = false;
        renderPage();
      }
    }

    async function updatePlugin(plugin) {
      state.updatingIds.add(plugin.id);
      renderPage();
      try {
        const result = await pluginService.updatePlugin(plugin.id);
        if (result.updated) {
          showToast(`Updated ${plugin.name} to v${result.version}`, {
            style: "success",
          });
        }
      } catch (e) {
        if (e instanceof PermissionsDeclinedError) {
          // User declined the permission prompt; nothing to report.
        } else {
          console.error(e);
          showToast(`Failed to update ${plugin.name}`, {
            style: "error",
          });
        }
      } finally {
        state.updatingIds.delete(plugin.id);
        renderPage();
      }
    }

    async function updateAllPlugins() {
      if (state.updatingAll) return;
      state.updatingAll = true;
      renderPage();
      try {
        const { updated, failed } = await pluginService.updateAllPlugins();
        if (failed.length > 0) {
          showToast(`Updated ${updated.length}, failed ${failed.length}`, {
            style: "error",
          });
        } else {
          showToast(
            `Updated ${updated.length} plugin${updated.length === 1 ? "" : "s"}`,
            { style: "success" },
          );
        }
      } finally {
        state.updatingAll = false;
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
          showToast(`Disabled ${plugin.name}`);
        } else {
          try {
            await pluginService.enablePlugin(plugin.id);
            showToast(`Enabled ${plugin.name}`, { style: "success" });
          } catch (e) {
            showToast(`Error when loading ${plugin.name}`, {
              style: "error",
            });
          }
        }
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
      const availableUpdates = pluginService.getAvailableUpdates();
      const hasAvailableUpdates =
        availableUpdates !== null && availableUpdates.size > 0;
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
                    : html`<div class="installed-plugins-header">
                          <h2>Installed plugins</h2>
                          <div class="installed-plugins-header-actions">
                            <button
                              class="plugin-check-updates-button rounded-button rounded-button-primary"
                              ?disabled=${state.checkingForUpdates ||
                              state.updatingAll}
                              @click=${() =>
                                hasAvailableUpdates
                                  ? updateAllPlugins()
                                  : checkForUpdates()}
                            >
                              ${state.checkingForUpdates || state.updatingAll
                                ? html`${hasAvailableUpdates
                                      ? "Updating..."
                                      : "Checking..."}
                                    <div
                                      class="loading-spinner"
                                      data-testid="loading-spinner"
                                    ></div>`
                                : hasAvailableUpdates
                                  ? "Update all"
                                  : "Check for updates"}
                            </button>
                            <button
                              class="plugin-reload-button icon-button"
                              aria-label="Reload plugins"
                              ?disabled=${state.reloading}
                              @click=${() => reloadPlugins()}
                            >
                              ${reloadIconTemplate()}
                            </button>
                          </div>
                        </div>
                        <ul class="plugin-list">
                          ${pluginsInfo.map((plugin) => {
                            const hasUpdate =
                              availableUpdates?.has(plugin.id) ?? false;
                            const isUpdating =
                              state.updatingIds.has(plugin.id) ||
                              (state.updatingAll && hasUpdate);
                            const isPending =
                              state.uninstallingIds.has(plugin.id) ||
                              state.enablingIds.has(plugin.id) ||
                              state.disablingIds.has(plugin.id) ||
                              isUpdating;
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
                                    ${plugin.name}
                                    ${plugin.id.endsWith("__LOCAL")
                                      ? html`<span class="plugin-local-badge"
                                          >local</span
                                        >`
                                      : ""}
                                  </div>
                                  ${plugin.description
                                    ? html`<div
                                        class="plugin-list-item-description"
                                      >
                                        ${plugin.description}
                                      </div>`
                                    : ""}
                                  <div class="plugin-list-item-version">
                                    Version: ${plugin.version}
                                  </div>
                                  <div class="plugin-list-item-author">
                                    By ${plugin.author}
                                  </div>
                                </div>
                                <div class="plugin-list-item-controls">
                                  ${hasUpdate
                                    ? html`<button
                                        class="plugin-update-button rounded-button rounded-button-primary"
                                        @click=${() => updatePlugin(plugin)}
                                      >
                                        ${isUpdating
                                          ? html`Updating
                                              <div
                                                class="loading-spinner"
                                                data-testid="loading-spinner"
                                              ></div>`
                                          : "Update"}
                                      </button>`
                                    : ""}
                                  ${plugin.enabled && plugin.hasSettings
                                    ? html`<a
                                        class="plugin-settings-link icon-button"
                                        href="/settings/plugins/${plugin.id}"
                                        aria-label="Settings for ${plugin.name}"
                                      >
                                        ${settingsIconTemplate()}
                                      </a>`
                                    : ""}
                                  <button
                                    class="plugin-uninstall-button icon-button"
                                    aria-label="Uninstall ${plugin.name}"
                                    @click=${() => uninstallPlugin(plugin)}
                                  >
                                    ${trashCanIconTemplate()}
                                  </button>
                                  <toggle-switch
                                    class="plugin-toggle"
                                    label="Enable ${plugin.name}"
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
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      renderPage();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsPluginsView();
