import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
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
import { Signal, SignalSet } from "/js/signals.js";
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

    const $uninstallingIds = new SignalSet();
    const $enablingIds = new SignalSet();
    const $disablingIds = new SignalSet();
    const $updatingIds = new SignalSet();
    const $reloading = new Signal.State(false);
    const $checkingForUpdates = new Signal.State(false);
    const $updatingAll = new Signal.State(false);

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
      $uninstallingIds.add(plugin.id);
      try {
        await pluginService.uninstallPlugin(plugin.id);
        showToast(`Uninstalled ${plugin.name}`);
      } finally {
        $uninstallingIds.delete(plugin.id);
      }
    }

    async function reloadPlugins() {
      if ($reloading.get()) return;
      $reloading.set(true);
      try {
        await pluginService.reloadPlugins();
        showToast("Reloaded plugins");
      } catch (e) {
        console.error(e);
        showToast("Failed to reload plugins", { style: "error" });
      } finally {
        $reloading.set(false);
      }
    }

    async function checkForUpdates() {
      if ($checkingForUpdates.get()) return;
      $checkingForUpdates.set(true);
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
        $checkingForUpdates.set(false);
      }
    }

    async function updatePlugin(plugin) {
      $updatingIds.add(plugin.id);
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
        $updatingIds.delete(plugin.id);
      }
    }

    async function updateAllPlugins() {
      if ($updatingAll.get()) return;
      $updatingAll.set(true);
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
        $updatingAll.set(false);
      }
    }

    async function togglePlugin(plugin) {
      const pendingIds = plugin.enabled ? $disablingIds : $enablingIds;
      pendingIds.add(plugin.id);
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
        pendingIds.delete(plugin.id);
      }
    }

    pageEffect(root, () => {
      const reloading = $reloading.get();
      const checkingForUpdates = $checkingForUpdates.get();
      const updatingAll = $updatingAll.get();
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const pluginsInfo = pluginService.$pluginsInfo.get();
      const availableUpdates = pluginService.$availableUpdates.get();
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
                              ?disabled=${checkingForUpdates || updatingAll}
                              @click=${() =>
                                hasAvailableUpdates
                                  ? updateAllPlugins()
                                  : checkForUpdates()}
                            >
                              ${checkingForUpdates || updatingAll
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
                              ?disabled=${reloading}
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
                              $updatingIds.has(plugin.id) ||
                              (updatingAll && hasUpdate);
                            const isPending =
                              $uninstallingIds.has(plugin.id) ||
                              $enablingIds.has(plugin.id) ||
                              $disablingIds.has(plugin.id) ||
                              isUpdating;
                            return html`
                              <li
                                class="plugin-list-item ${$uninstallingIds.has(
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
                                    ?checked=${$enablingIds.has(plugin.id)
                                      ? true
                                      : $disablingIds.has(plugin.id)
                                        ? false
                                        : plugin.enabled}
                                    ?disabled=${$enablingIds.has(plugin.id) ||
                                    $disablingIds.has(plugin.id)}
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
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsPluginsView();
