import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { requireAuth } from "/js/auth.js";
import { showToast } from "/js/toasts.js";

class SettingsCommunityPluginsView extends View {
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
      entries: [],
      loading: true,
      error: null,
      pending: new Set(),
    };

    async function loadEntries() {
      state.loading = true;
      state.error = null;
      renderPage();
      try {
        state.entries = await pluginService.listRegistryPlugins();
      } catch (error) {
        state.error = error.message ?? String(error);
      }
      state.loading = false;
      renderPage();
    }

    async function toggleInstall(entry) {
      state.pending.add(entry.id);
      renderPage();
      const wasInstalled = entry.installed;
      try {
        if (wasInstalled) {
          await pluginService.uninstallPlugin(entry.id);
        } else {
          await pluginService.installPlugin(entry.id);
        }
        state.entries = await pluginService.listRegistryPlugins();
        showToast(wasInstalled ? "Uninstalled plugin" : "Installed plugin", {
          style: wasInstalled ? "default" : "success",
        });
      } catch (error) {
        state.error = error.message ?? String(error);
        showToast(
          wasInstalled
            ? "Failed to uninstall plugin"
            : "Failed to install plugin",
          { style: "error" },
        );
      }
      state.pending.delete(entry.id);
      renderPage();
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      render(
        html`<div id="settings-community-plugins-view">
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
                title: "Community plugins",
                onClickBackButton: () => window.router.go("/settings/plugins"),
              })}
              <main>
                ${state.loading
                  ? html`<p class="plugin-list-loading">Loading…</p>`
                  : state.error
                    ? html`<div class="error-state">
                        <div>Failed to load plugins</div>
                        <button @click=${() => loadEntries()}>Try again</button>
                      </div>`
                    : state.entries.length === 0
                      ? html`<div class="plugins-empty-state">
                          <div class="plugins-empty-state-title">
                            No community plugins to show
                          </div>
                          <p class="plugins-empty-state-message">
                            The registry is empty right now.
                          </p>
                        </div>`
                      : html`<ul class="plugin-list">
                          ${state.entries.map((entry) => {
                            const pending = state.pending.has(entry.id);
                            const buttonClass = entry.installed
                              ? "plugin-install-button rounded-button"
                              : "plugin-install-button rounded-button rounded-button-primary";
                            return html`
                              <li class="plugin-list-item">
                                <div class="plugin-list-item-info">
                                  <div class="plugin-list-item-name">
                                    ${entry.name}
                                  </div>
                                  ${entry.description
                                    ? html`<div
                                        class="plugin-list-item-description"
                                      >
                                        ${entry.description}
                                      </div>`
                                    : ""}
                                  <div class="plugin-list-item-version">
                                    By ${entry.author}
                                  </div>
                                </div>
                                <div class="plugin-list-item-controls">
                                  <button
                                    class=${buttonClass}
                                    ?disabled=${pending}
                                    @click=${() => toggleInstall(entry)}
                                  >
                                    ${pending
                                      ? html`<div
                                          class="loading-spinner"
                                          data-testid="loading-spinner"
                                        ></div>`
                                      : entry.installed
                                        ? "Uninstall"
                                        : "Install"}
                                  </button>
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
      await loadEntries();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadEntries();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsCommunityPluginsView();
